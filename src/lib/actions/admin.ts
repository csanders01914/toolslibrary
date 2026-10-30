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
import bcrypt from "bcryptjs";
import { z } from "zod";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { notifyAdmins } from "@/lib/email";

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
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { userId, role } = parsed.data;

  if (userId === session.user.id) {
    return { success: false, error: "Cannot change your own role" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
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

  const nextScore = Math.max(0, Math.min(100, user.trustScore + delta));

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

  await prisma.$transaction(async (tx) => {
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
    const isValid = await bcrypt.compare(
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
