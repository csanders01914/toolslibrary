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
import {
  CANARY_CONFIRM_TTL_MINUTES,
  CANARY_MIN_PASSPHRASE_LENGTH,
  cancelCanaryStaging,
  commitStagedCanaryUpdate,
  setCanaryPassphrase,
  stageCanaryUpdate,
  verifyCanaryPassphrase,
  type CanaryAction,
} from "@/lib/canary";

export type CanaryActionState = {
  success?: boolean;
  error?: string;
  detail?: string;
  staged?: boolean;
} | undefined;

/**
 * Deployment origin for the out-of-band confirmation link. Same derivation
 * and fallback as the NextAuth redirect callback (src/auth.config.ts): the
 * canonical public site origin unless the operator overrides it for an
 * alternative self-hosted deployment.
 */
function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
    "https://www.tools-library.com"
  );
}

const passphraseSchema = z
  .object({
    currentPassphrase: z.string().optional(),
    passphrase: z
      .string()
      .min(
        CANARY_MIN_PASSPHRASE_LENGTH,
        `Passphrase must be at least ${CANARY_MIN_PASSPHRASE_LENGTH} characters`
      )
      .max(128, "Passphrase too long (max 128 characters)"),
    confirmPassphrase: z.string().max(128, "Passphrase too long (max 128 characters)"),
  })
  .refine((data) => data.passphrase === data.confirmPassphrase, {
    message: "Passphrases do not match",
    path: ["confirmPassphrase"],
  });

/**
 * Set or replace the dedicated canary passphrase (PHASE_30). This credential
 * is deliberately independent of the login password: a leaked, reused, or
 * keylogged login password must not open the canary signing authority on its
 * own. Replacing an existing passphrase requires the current one — derived
 * from DATABASE state (`user.canaryPassphraseHash` is null or not), never
 * from client input, so a forged form field cannot bypass the check (same
 * pattern as setAdminEmail in src/lib/actions/admin.ts).
 */
export async function setCanaryPassphraseAction(
  prevState: CanaryActionState,
  formData: FormData
): Promise<CanaryActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  // Password-verified write on an admin-only surface: throttles brute-forcing
  // the current canary passphrase (PHASE_23 budget pattern, PHASE_30 bucket).
  const limit = await enforceRateLimit("canary");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = passphraseSchema.safeParse({
    currentPassphrase: formData.get("currentPassphrase") ?? undefined,
    passphrase: formData.get("passphrase"),
    confirmPassphrase: formData.get("confirmPassphrase"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canaryPassphraseHash: true },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (user.canaryPassphraseHash) {
    if (!parsed.data.currentPassphrase) {
      return {
        success: false,
        error: "Current canary passphrase is required to change it",
      };
    }
    const isValid = await bcrypt.compare(
      parsed.data.currentPassphrase,
      user.canaryPassphraseHash
    );
    if (!isValid) {
      return { success: false, error: "Current canary passphrase is incorrect" };
    }
  }

  const wasUnset = !user.canaryPassphraseHash;

  await setCanaryPassphrase(session.user.id, parsed.data.passphrase);

  // First enrollment is the exact moment a hijacked session would try to
  // enroll its own canary credentials (the bootstrap window has no current-
  // passphrase check by definition) — so it is never silent: every configured
  // admin is alerted, fire-and-forget.
  if (wasUnset) {
    void notifyAdmins({
      type: "canary_passphrase_enrolled",
      alias: session.user.alias,
    });
  }

  return { success: true, detail: "Canary passphrase set." };
}

const stageSchema = z
  .object({
    action: z.enum(["AFFIRM", "DISCLOSE"]),
    passphrase: z.string().min(1, "Canary passphrase is required").max(128),
    note: z.string().max(2000, "Note too long (max 2000 characters)").optional(),
  })
  .refine(
    (data) => data.action !== "DISCLOSE" || (data.note ?? "").trim().length >= 10,
    {
      message: "A disclosure note of at least 10 characters is required",
      path: ["note"],
    }
  )
  // The note is interpolated into the newline-delimited canonical payload
  // that gets signed and published — a note containing CR/LF (or other
  // control characters) could forge-looking field lines ("action:", "seq:",
  // "statements:") into the payload and deceive naive line-parsers and human
  // readers. The signature still covers the true bytes, but the honest
  // format is single-line notes: reject line breaks and control characters
  // outright.
  .refine(
    (data) => !data.note || !/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(data.note),
    {
      message: "Note must be a single line without control characters",
      path: ["note"],
    }
  );

/**
 * Stage a canary update for out-of-band approval (PHASE_30). The update does
 * NOT take effect here: staging verifies the dedicated canary passphrase,
 * writes a pending row, and emails a single-use confirmation link to the
 * operator's notification email. The commit happens only when the operator
 * follows that link while signed in as an administrator — so a stolen admin
 * session alone, or an inbox alone, can sign nothing.
 *
 * A wrong passphrase is not a silent failure: it alerts every configured
 * admin notification address (fire-and-forget), because a hijacked session
 * probing this form is exactly the signal the operator must not miss.
 */
export async function stageCanaryUpdateAction(
  prevState: CanaryActionState,
  formData: FormData
): Promise<CanaryActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const limit = await enforceRateLimit("canary");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = stageSchema.safeParse({
    action: formData.get("action"),
    passphrase: formData.get("passphrase"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { action, passphrase, note } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canaryPassphraseHash: true, notificationEmail: true, alias: true },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }
  if (!user.canaryPassphraseHash) {
    return { success: false, error: "Set a canary passphrase first" };
  }
  if (!user.notificationEmail) {
    return {
      success: false,
      error: "A notification email is required for out-of-band approval — set one at /admin-email",
    };
  }

  const passphraseOk = await verifyCanaryPassphrase(session.user.id, passphrase);
  if (!passphraseOk) {
    // Fire-and-forget: the alert must never block or fail the error path,
    // and notifyAdmins never throws (PHASE_29 contract).
    void notifyAdmins({
      type: "canary_failed_attempt",
      alias: user.alias,
    });
    return { success: false, error: "Incorrect canary passphrase" };
  }

  const trimmedNote = note && note.trim().length > 0 ? note.trim() : null;

  const staged = await stageCanaryUpdate(
    session.user.id,
    action as CanaryAction,
    trimmedNote
  );
  if (!staged.ok) {
    return { success: false, error: staged.reason };
  }

  // Fire-and-forget: the confirmation email is the out-of-band factor, but a
  // dead relay must not fail the staging — the pending row still exists and
  // the operator can stage again after the TTL lapses.
  void notifyAdmins({
    type: "canary_staged",
    to: user.notificationEmail,
    action: action as CanaryAction,
    confirmUrl: `${siteOrigin()}/admin/canary/confirm/${staged.token}`,
    expiresInMinutes: CANARY_CONFIRM_TTL_MINUTES,
  });

  return {
    success: true,
    staged: true,
    detail: `Confirmation email sent to ${user.notificationEmail} — the update takes effect only after you approve it from the link within ${CANARY_CONFIRM_TTL_MINUTES} minutes.`,
  };
}

/**
 * Drop a staged (pending) canary update without committing it. Idempotent and
 * low-risk: it only deletes the caller's own pending row, so no rate-limit
 * budget is spent and no email is sent.
 */
export async function cancelCanaryStagingAction(
  prevState: CanaryActionState,
  formData: FormData
): Promise<CanaryActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  await cancelCanaryStaging(session.user.id);

  return {
    success: true,
    detail: "Staged canary update cancelled — nothing was changed.",
  };
}

const confirmSchema = z.object({
  token: z.string().min(1, "Missing confirmation token").max(128),
});

/**
 * Consume the single-use email token and commit the staged canary event
 * (PHASE_30). This is the commit half of the out-of-band approval: the
 * operator followed the emailed link while signed in as an administrator and
 * pressed Approve. Re-validates everything server-side (session, role,
 * timing-safe token hash, TTL, terminal-disclosure guard) — the token in the
 * form is untrusted input, never proof of approval.
 */
export async function confirmCanaryCommitAction(
  prevState: CanaryActionState,
  formData: FormData
): Promise<CanaryActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  // The token check is a credential-verification surface like any other:
  // keep it inside the canary bucket for a consistent brute-force posture
  // (the 256-bit single-use token makes this practically moot, but the
  // module should not contain an unthrottled credential check).
  const limit = await enforceRateLimit("canary");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = confirmSchema.safeParse({
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const committed = await commitStagedCanaryUpdate(
    session.user.id,
    parsed.data.token
  );
  if (!committed.ok) {
    return { success: false, error: committed.reason };
  }

  // Fire-and-forget: every configured admin learns the canary changed. The
  // commit itself is already durable; a dead relay must not fail the action.
  void notifyAdmins({
    type: "canary_committed",
    action: committed.event.action,
    alias: committed.event.adminAlias,
    validUntil: committed.event.expiresAt
      ? committed.event.expiresAt.toISOString()
      : null,
    note: committed.event.note,
  });

  return {
    success: true,
    detail:
      committed.event.action === "AFFIRM"
        ? `Canary affirmed — valid through ${committed.event.expiresAt?.toISOString().slice(0, 10)}.`
        : "Disclosure recorded. The canary is now dropped and cannot be re-affirmed.",
  };
}
