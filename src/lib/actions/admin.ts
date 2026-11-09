/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { verifyStoredPassword } from "@/lib/passwords";
import { clampTrustScore } from "@/lib/constants";
import { deleteUploadedImage, deleteSecretImage } from "@/lib/uploads";
import { z } from "zod";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { notifyAdmins } from "@/lib/email";
import { sendEncryptedEmail } from "@/lib/mail/transporter";

export type AdminActionState = {
  success?: boolean;
  error?: string;
  detail?: string;
} | undefined;

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN"]),
});

const trustSchema = z.object({
  userId: z.string().min(1),
  delta: z.coerce.number().int().min(-100).max(100),
});

const toolStatusSchema = z.object({
  toolId: z.string().min(1),
  status: z.enum(["AVAILABLE", "MAINTENANCE"]),
});

const deleteUserSchema = z.object({
  userId: z.string().min(1),
});

export async function updateUserRole(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  // auth() reads the request through next/headers and throws outside a
  // request scope; treat that as unauthenticated (same pattern as the
  // Stage 2/4 wrappers — keeps the action test-exercisable).
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }
  return updateUserRoleForCaller(session.user.id, formData);
}

/**
 * The role-change body, split from the session wrapper so the integration
 * tests can exercise the real logic against a disposable database with
 * synthetic caller/target ids (the NextAuth session does not exist in
 * tests).
 */
export async function updateUserRoleForCaller(
  callerId: string,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { userId, role } = parsed.data;

  if (userId === callerId) {
    return { success: false, error: "Cannot change your own role" };
  }

  // Stage 4: re-verify the caller's role from the DATABASE, not just the
  // JWT claim — a demoted admin's token still says ADMIN until the
  // session-revocation work lands (Stage 5); this closes the stale-role
  // window for role changes specifically.
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { role: true },
  });
  if (caller?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Stage 4: last-admin demotion guard, enforced inside the transaction —
  // two admins demoting each other concurrently are serialized by SQLite,
  // and the second transaction observes count 1 and refuses, so the
  // platform can never reach zero administrators through this path.
  // Stage 5: every role change also bumps the target's sessionVersion, so
  // their existing JWT — which still carries the old role — dies at the
  // central revocation check and the next sign-in issues a token with the
  // new role. This closes the stale-role escalation window.
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const demoted = await prisma.$transaction(async (tx) => {
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return false;
      }
      await tx.user.update({
        where: { id: userId },
        data: { role, sessionVersion: { increment: 1 } },
      });
      return true;
    });
    if (!demoted) {
      return {
        success: false,
        error: "Cannot demote the last administrator — promote another member first",
      };
    }
    return { success: true };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role, sessionVersion: { increment: 1 } },
  });

  return { success: true };
}

export async function adjustTrustScore(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = trustSchema.safeParse({
    userId: formData.get("userId"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { userId, delta } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const nextScore = clampTrustScore(user.trustScore + delta);

  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: nextScore },
  });

  return { success: true };
}

export async function setToolStatus(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = toolStatusSchema.safeParse({
    toolId: formData.get("toolId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { toolId, status } = parsed.data;

  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) {
    return { success: false, error: "Tool not found" };
  }

  if (tool.status === "BORROWED" && status === "AVAILABLE") {
    return { success: false, error: "Tool is on an active loan; resolve the loan first" };
  }

  await prisma.tool.update({
    where: { id: toolId },
    data: { status },
  });

  return { success: true };
}

/**
 * Permanently deletes a member account and every record they own. This is the
 * zero-PII purge path: RecoveryKey, Tool, Skill, Loan, and Message rows are
 * removed via the schema's onDelete: Cascade relations. Guardrails:
 * - An administrator cannot delete their own account.
 * - Administrator accounts cannot be deleted directly — demote to USER first
 *   (prevents accidental admin lockout).
 * - Tools the member currently holds as a borrower are released back to
 *   AVAILABLE inside the same transaction, so no tool stays locked in
 *   BORROWED after its loan rows cascade away.
 */
export async function deleteUser(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { userId } = parsed.data;

  if (userId === session.user.id) {
    return { success: false, error: "Cannot delete your own account" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: { select: { tools: true, skills: true } },
    },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (user.role === "ADMIN") {
    return { success: false, error: "Cannot delete an administrator — demote to USER first" };
  }

  const ownedImageFiles: string[] = [];
  const publishedImageFiles: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Audit S9: collect the image filenames the cascade is about to remove
    // rows for, so the files can be purged from disk after commit — the DB
    // cascade alone leaves photos publicly retrievable at /api/uploads/<file>
    // indefinitely.
    const ownedImages = await tx.tool.findMany({
      where: { ownerId: userId, imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    ownedImageFiles.push(
      ...ownedImages.map((t) => t.imageUrl).filter((f): f is string => Boolean(f))
    );
    const publishedImages = await tx.publishedImage.findMany({
      where: { ownerId: userId },
      select: { filename: true },
    });
    publishedImageFiles.push(...publishedImages.map((p) => p.filename));

    // Release tools this member currently holds as a borrower so they do not
    // remain locked in BORROWED once the loan rows cascade away.
    const heldLoans = await tx.loan.findMany({
      where: { borrowerId: userId, status: { in: ["APPROVED", "ACTIVE"] } },
      select: { toolId: true },
    });
    for (const loan of heldLoans) {
      await tx.tool.update({
        where: { id: loan.toolId },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.user.delete({ where: { id: userId } });
  });

  // Post-commit file purge (audit S9): the deletion helpers are no-ops for
  // missing files, so this is idempotent.
  for (const filename of ownedImageFiles) await deleteUploadedImage(filename);
  for (const filename of publishedImageFiles) await deleteSecretImage(filename);

  return {
    success: true,
    detail: `Deleted @${user.username} (${user._count.tools} tool(s), ${user._count.skills} skill(s), loans and messages purged).`,
  };
}

const adminEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254, "Email too long (max 254 characters)"),
  currentPassword: z.string().optional(),
});

/**
 * Set or replace the operator's notification email (PHASE_29) — the single
 * deliberate PII exception on the platform, stored on ADMIN accounts only as
 * the destination for operational alert emails. Replacing an existing
 * destination requires the current password (a hijacked session must not be
 * able to silently redirect alerts); first-time setup skips that re-prompt
 * because the forced /admin-email flow runs seconds after a full password
 * rotation and a fresh sign-in. That decision is derived from DATABASE state
 * (`user.notificationEmail` is null or not) — never from client input — so a
 * forged form field cannot bypass the password check.
 */
export async function setAdminEmail(
  prevState: { success?: boolean; error?: string; email?: string } | undefined,
  formData: FormData
): Promise<{ success: boolean; error?: string; email?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  // Password-verified write on an admin-only surface (PHASE_23_RATE_LIMITING
  // budget reused for PHASE_29): throttles brute-forcing the current password.
  const limit = await enforceRateLimit("adminEmail");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = adminEmailSchema.safeParse({
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const oldEmail = user.notificationEmail;
  const isChange = Boolean(oldEmail);
  if (isChange) {
    if (!parsed.data.currentPassword) {
      return {
        success: false,
        error: "Current password is required to change the notification email",
      };
    }
    const isValid = await verifyStoredPassword(
      parsed.data.currentPassword,
      user.passwordHash
    );
    if (!isValid) {
      return { success: false, error: "Current password is incorrect" };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { notificationEmail: parsed.data.email },
  });

  if (oldEmail && oldEmail !== parsed.data.email) {
    // Fire-and-forget: the alert to the OLD address must never block or fail
    // the write, and notifyAdmins never throws (PHASE_29 contract).
    void notifyAdmins({
      type: "email_changed",
      to: oldEmail,
      oldEmail,
      newEmail: parsed.data.email,
      changedBy: user.alias,
    });
  }

  return { success: true, email: parsed.data.email };
}

// Hardcoded test-email content for the "Send Test Email" button on the admin
// notification-email screens. Fixed by design: the button is a relay-chain
// health check, not a free-form send — there is no user-editable content to
// sanitize, and the fixed copy makes flooding the relay chain the only
// possible abuse (handled by the dedicated rate-limit budget).
const TEST_EMAIL_SUBJECT = "ToolsLibrary test email";
const TEST_EMAIL_BODY = [
  "This is a test email from your ToolsLibrary deployment.",
  "",
  "If you can read this, the outbound chain works end to end: the body was",
  "PGP-encrypted in process to your ProtonMail public key, handed to the",
  "local Postfix relay, and dispatched through the Resend smart host. Only",
  "routing metadata (From, To, Subject) traveled as plaintext.",
  "",
  "No action is needed — this message was sent by the Send Test Email",
  "button on the admin notification-email screen.",
].join("\n");

const testEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254, "Email too long (max 254 characters)"),
});

/**
 * Send the hardcoded test email to the address the admin provides — the
 * typed address on the /admin-email setup screen, or the address on record
 * from the dashboard. Admin-only and rate-limited (dedicated budget, kept
 * separate from the password-verified setAdminEmail bucket). The send goes
 * through sendEncryptedEmail, so the body is PGP-encrypted to the operator's
 * key BEFORE it touches the relay chain, and every failure collapses into a
 * coarse reason that is safe to surface to the operator. Unlike the alert
 * dispatcher this action AWAITS the send: the button exists to report the
 * outcome, and the 10-second per-phase SMTP caps bound the wait.
 */
export async function sendTestEmail(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const limit = await enforceRateLimit("adminEmailTest");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = testEmailSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const result = await sendEncryptedEmail({
    to: parsed.data.email,
    subject: TEST_EMAIL_SUBJECT,
    body: TEST_EMAIL_BODY,
  });
  if (!result.sent) {
    return { success: false, error: `Test email failed: ${result.reason}` };
  }
  return { success: true };
}

