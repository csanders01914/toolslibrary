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
import { z } from "zod";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  hashLegacyRecoveryCode,
  LEGACY_RECOVERY_CODE_LENGTH,
} from "@/lib/crypto";
import {
  hashNewPassword,
  validateNewPassword,
  verifyStoredPassword,
} from "@/lib/passwords";
import { getRequestClientHash, recordFailure, verifySolution } from "@/lib/pow";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { notifyAdmins } from "@/lib/email";
import { deleteUploadedImage, deleteSecretImage } from "@/lib/uploads";

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_-]{3,24}$/, "Username must be 3-24 characters, alphanumeric, underscore, or hyphen"),
  alias: z.string().min(2, "Alias must be at least 2 characters").max(32, "Alias must be at most 32 characters"),
  // Stage 1: presence only — the full Unicode code-point policy
  // (15..256, NFC, byte bound) is enforced by validateNewPassword below so
  // the error messages are precise and the server stays authoritative.
  password: z.string().min(1, "Password is required"),
});

const recoverSchema = z.object({
  username: z.string().min(1),
  recoveryCode: z.string().min(1),
  newPassword: z.string().min(1, "New password is required"),
});

/** Sentinel for the friendly "Username already taken" path (audit S5). */
class UsernameTakenError extends Error {}

/** True when a Prisma write failed on a unique-constraint violation (P2002). */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Audit S5: promise-chain mutex serializing the registration critical
 * section (see the comment at the call site in registerUser). The platform
 * is single-node by contract — the rate limiter and PoW store are in-memory
 * for the same reason — so this lock is a complete serialization point.
 */
let registrationChain: Promise<unknown> = Promise.resolve();
function withRegistrationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = registrationChain.then(fn, fn);
  registrationChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function registerUser(
  prevState: { success?: boolean; error?: string; recoveryCodes?: string[] } | undefined,
  formData: FormData
) {
  // Account-creation spam gate (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("register");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  // Proof-of-work gate: the browser must have solved a challenge issued for
  // the register surface before any account is created. Missing or malformed
  // fields take the same failure path as a wrong solution.
  const powCounterValue = formData.get("powCounter");
  const powCounter = powCounterValue === null ? Number.NaN : Number(powCounterValue);
  const clientHash = await getRequestClientHash();
  const pow = verifySolution(
    "register",
    formData.get("powChallenge"),
    Number.isInteger(powCounter) ? powCounter : undefined,
    clientHash
  );
  if (!pow.ok) {
    recordFailure("register", clientHash);
    return {
      success: false,
      error:
        pow.reason === "expired" || pow.reason === "replayed"
          ? "Your proof-of-work challenge expired or was already used. Please try again."
          : "Proof-of-work verification failed. Please try again.",
    };
  }

  const rawData = {
    username: formData.get("username"),
    alias: formData.get("alias"),
    password: formData.get("password"),
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { username, alias, password } = parsed.data;

  // Stage 1: enforce the Unicode password policy (15..256 code points, NFC,
  // byte bound) BEFORE any expensive hashing — invalid input fails cheaply.
  const passwordPolicyError = validateNewPassword(password);
  if (passwordPolicyError) {
    return { success: false, error: passwordPolicyError };
  }

  // Hash password (Argon2id, pinned parameters — Stage 1)
  const passwordHash = await hashNewPassword(password);

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes(8);
  const recoveryKeyHashes = recoveryCodes.map(hashRecoveryCode);

  // Audit S5: the existence check, the first-user ADMIN election, and the
  // create are serialized through the in-process registration lock. SQLite
  // transactions begin deferred, so a bare $transaction does NOT make the
  // read-then-create atomic — two concurrent first registrations could both
  // observe count 0 and both elect ADMIN. The lock makes the check-then-act
  // sequence atomic within the only writer process; the P2002 catch below
  // stays as defense for any future multi-process deployment.
  try {
    await withRegistrationLock(() =>
      prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { username },
        });
        if (existingUser) {
          throw new UsernameTakenError();
        }

        // Check if this is the first user (becomes ADMIN)
        const userCount = await tx.user.count();
        const role = userCount === 0 ? "ADMIN" : "USER";

        const user = await tx.user.create({
          data: {
            username,
            alias,
            passwordHash,
            role,
            // The registration set is already the modern 12-character
            // format, so the account is marked issued and the first sign-in
            // does not rotate it again.
            recoveryCodesIssuedAt: new Date(),
          },
        });

        await tx.recoveryKey.createMany({
          data: recoveryKeyHashes.map((keyHash) => ({
            keyHash,
            userId: user.id,
          })),
        });
      })
    );
  } catch (error) {
    if (error instanceof UsernameTakenError || isUniqueConstraintViolation(error)) {
      return { success: false, error: "Username already taken" };
    }
    throw error;
  }

  // PHASE_29: informational operator alert after the account write commits —
  // fire-and-forget so the notification can never block or fail registration
  // (notifyAdmins never throws).
  void notifyAdmins({ type: "registration", username, alias });

  return { success: true, recoveryCodes };
}

export async function recoverAccount(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  // Recovery-key brute-force gate (PHASE_23_RATE_LIMITING): without email
  // verification these 8 single-use codes are the only recovery path, so
  // guessing must be rate-limited before the database lookup.
  const limit = await enforceRateLimit("recover");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const rawData = {
    username: formData.get("username"),
    recoveryCode: formData.get("recoveryCode"),
    newPassword: formData.get("newPassword"),
  };

  const parsed = recoverSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { username, recoveryCode, newPassword } = parsed.data;

  // Stage 1: enforce the Unicode password policy BEFORE any expensive
  // hashing — an invalid new password fails cheaply and uniformly.
  const passwordPolicyError = validateNewPassword(newPassword);
  if (passwordPolicyError) {
    return { success: false, error: passwordPolicyError };
  }

  // Audit S11: one uniform failure message for both "no such user" and
  // "bad or already used code" — distinct errors were a username-existence
  // oracle for account enumeration.
  const RECOVERY_FAILURE = "Invalid username or recovery code";

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    return { success: false, error: RECOVERY_FAILURE };
  }

  // Format discriminator (RECOVERY_CODES_12_CHAR_UPGRADE): modern codes are
  // 12 case-sensitive alphanumeric characters, legacy codes were 8 hex
  // characters — the normalized lengths are disjoint. Legacy codes keep
  // their original case-insensitive matching until the account is re-issued
  // a modern set at its next sign-in; modern codes match case-exactly.
  const normalizedCode = recoveryCode.trim().replace(/[^A-Za-z0-9]/g, "");
  const codeHash =
    normalizedCode.length === LEGACY_RECOVERY_CODE_LENGTH
      ? hashLegacyRecoveryCode(recoveryCode)
      : hashRecoveryCode(recoveryCode);
  const newPasswordHash = await hashNewPassword(newPassword);

  // Audit S4: atomic single-use consumption. The usedAt: null predicate
  // makes the update a compare-and-set — two concurrent submissions of the
  // same code can never both consume it, and the password reset happens
  // only for the winner, inside the same transaction.
  const consumed = await prisma.$transaction(async (tx) => {
    const claim = await tx.recoveryKey.updateMany({
      where: { keyHash: codeHash, userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      return false;
    }
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });
    return true;
  });

  if (!consumed) {
    return { success: false, error: RECOVERY_FAILURE };
  }

  return { success: true };
}

/**
 * RECOVERY_CODES_12_CHAR_UPGRADE: one-time recovery-code rotation delivered
 * at sign-in. Every account still holding the legacy 8-character code set
 * (recoveryCodesIssuedAt null) receives a fresh set of 12-character
 * case-sensitive codes the first time it signs in after the upgrade; the
 * login page calls this action immediately after a successful credentials
 * sign-in and displays the returned codes in the recovery-key vault. The
 * plaintext codes travel only over the authenticated session and are shown
 * exactly once — only their SHA-256 hashes are persisted, and the legacy
 * keys are deleted in the same transaction.
 *
 * The compare-and-set on recoveryCodesIssuedAt (audit S4 pattern) makes
 * concurrent claims — e.g. the same member signing in from two tabs — yield
 * exactly one rotation: the loser observes count 0 and gets null.
 */
export async function claimLoginRecoveryCodes(): Promise<{ codes: string[] | null }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { codes: null };
  }

  const userId = session.user.id;
  const codes = generateRecoveryCodes(8);
  const keyHashes = codes.map(hashRecoveryCode);

  const rotated = await prisma.$transaction(async (tx) => {
    const claim = await tx.user.updateMany({
      where: { id: userId, recoveryCodesIssuedAt: null },
      data: { recoveryCodesIssuedAt: new Date() },
    });
    if (claim.count === 0) {
      return false;
    }
    await tx.recoveryKey.deleteMany({ where: { userId } });
    await tx.recoveryKey.createMany({
      data: keyHashes.map((keyHash) => ({ keyHash, userId })),
    });
    return true;
  });

  return { codes: rotated ? codes : null };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  // Stage 1: presence only — the Unicode code-point policy is enforced by
  // validateNewPassword below (server authoritative).
  newPassword: z.string().min(1, "New password is required"),
});

export async function changePassword(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  // Current-password verification is a brute-force surface even when
  // authenticated (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("changePassword");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  };

  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { currentPassword, newPassword } = parsed.data;

  // Stage 1: enforce the Unicode password policy before any expensive work.
  const passwordPolicyError = validateNewPassword(newPassword);
  if (passwordPolicyError) {
    return { success: false, error: passwordPolicyError };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const isValid = await verifyStoredPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  // "New differs from old" generalized to both hash algorithms: verifying
  // the candidate against the stored hash succeeds only when the candidate
  // IS the current password (Argon2id compares exactly; legacy bcrypt keeps
  // its documented 72-byte prefix behavior — a >72-byte candidate sharing
  // the prefix is rejected as "not different", which is safe).
  if (await verifyStoredPassword(newPassword, user.passwordHash)) {
    return { success: false, error: "New password must be different from the current password" };
  }

  const newPasswordHash = await hashNewPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    },
  });

  return { success: true };
}

const deleteOwnAccountSchema = z.object({
  password: z.string().min(1, "Current password is required"),
  acknowledge: z.string().optional(), // "true" when the confirmation box is checked
});

/**
 * Self-service account deletion — the zero-PII exit path. Requires the current
 * password (identity proof) plus an explicit acknowledgment checkbox. Every
 * record the member owns (RecoveryKey, Tool, Skill, Loan, Message) is purged
 * via the schema's onDelete: Cascade relations; tools the member currently
 * holds as a borrower are released back to AVAILABLE inside the same
 * transaction so no tool stays locked in BORROWED after the loan rows cascade
 * away. Guardrail: the last administrator cannot self-delete (admin lockout).
 * The client signs the burned session out after a successful purge.
 */
export async function deleteOwnAccount(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  // Destructive + password-verified: throttle repeat attempts
  // (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("deleteAccount");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = deleteOwnAccountSchema.safeParse({
    password: formData.get("password"),
    // FormData.get() yields null for an unchecked/absent checkbox; zod
    // .optional() rejects null — normalize to undefined.
    acknowledge: formData.get("acknowledge") ?? undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  if (parsed.data.acknowledge !== "true") {
    return { success: false, error: "You must acknowledge the permanent deletion notice" };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const isValid = await verifyStoredPassword(parsed.data.password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return {
        success: false,
        error: "Cannot delete the last administrator account — promote another member first",
      };
    }
  }

  const ownedImageFiles: string[] = [];
  const publishedImageFiles: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Audit S9: collect the image filenames the cascade is about to remove
    // rows for, so the files can be purged from disk after commit — the DB
    // cascade alone leaves photos publicly retrievable at /api/uploads/<file>
    // indefinitely, and the zero-PII exit path must remove the bytes too.
    const ownedImages = await tx.tool.findMany({
      where: { ownerId: user.id, imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    ownedImageFiles.push(
      ...ownedImages.map((t) => t.imageUrl).filter((f): f is string => Boolean(f))
    );
    const publishedImages = await tx.publishedImage.findMany({
      where: { ownerId: user.id },
      select: { filename: true },
    });
    publishedImageFiles.push(...publishedImages.map((p) => p.filename));

    const heldLoans = await tx.loan.findMany({
      where: { borrowerId: user.id, status: { in: ["APPROVED", "ACTIVE"] } },
      select: { toolId: true },
    });
    for (const loan of heldLoans) {
      await tx.tool.update({
        where: { id: loan.toolId },
        data: { status: "AVAILABLE" },
      });
    }

    await tx.user.delete({ where: { id: user.id } });
  });

  // Post-commit file purge (audit S9): the deletion helpers are no-ops for
  // missing files, so this is idempotent.
  for (const filename of ownedImageFiles) await deleteUploadedImage(filename);
  for (const filename of publishedImageFiles) await deleteSecretImage(filename);

  return { success: true };
}