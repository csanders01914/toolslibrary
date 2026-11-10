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
import { cookies } from "next/headers";
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
import {
  consumeToken,
  enforceRateLimit,
  hashClient,
  rateLimitMessage,
} from "@/lib/rateLimit";
import { notifyAdmins } from "@/lib/email";
import {
  purgeStoredImage,
  recordPendingFileDeletions,
} from "@/lib/uploads";

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_-]{3,24}$/, "Username must be 3-24 characters, alphanumeric, underscore, or hyphen"),
  alias: z.string().min(2, "Alias must be at least 2 characters").max(32, "Alias must be at most 32 characters"),
  // Stage 1: presence only — the full Unicode code-point policy
  // (15..256, NFC, byte bound) is enforced by validateNewPassword below so
  // the error messages are precise and the server stays authoritative.
  password: z.string().min(1, "Password is required"),
});

const recoverSchema = z.object({
  // Stage 3: bounded inputs — the username keys the per-account bucket and
  // the code feeds the hash lookup, so both get cheap DoS ceilings (real
  // usernames are 3-24 chars; codes are 8 or 12 alnum characters plus
  // separators).
  username: z.string().min(1).max(64),
  recoveryCode: z.string().min(1).max(32),
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

/**
 * SQLite advisory lock for cross-process registration safety
 * (SEC_REVIEW_HIGH_4_ADVISORY_LOCK defense-in-depth).
 *
 * SQLite doesn't have native advisory locks like PostgreSQL, but we can
 * implement a mutex using a dedicated table with a single row. The lock is
 * acquired by starting an IMMEDIATE transaction and updating the row — this
 * acquires a reserved lock on the database that blocks other IMMEDIATE
 * transactions. The lock is released when the transaction commits or rolls
 * back.
 *
 * This is defense-in-depth for any future multi-process deployment that
 * cannot be avoided. The in-process promise-chain mutex (withRegistrationLock)
 * remains the primary guard; this advisory lock adds cross-process safety.
 */
async function withAdvisoryRegistrationLock<T>(fn: () => Promise<T>): Promise<T> {
  // Use a dedicated advisory lock table. We create it on first use.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS _advisory_lock (
      name TEXT PRIMARY KEY,
      holder TEXT NOT NULL,
      acquired_at INTEGER NOT NULL
    )
  `);

  const lockName = "registration";
  const holderId = `${process.pid}-${Math.random().toString(36).slice(2)}`;

  // Try to acquire the lock with a timeout
  const maxWaitMs = 30_000; // 30 second timeout
  const startTime = Date.now();

  while (true) {
    try {
      // Attempt to acquire lock in an IMMEDIATE transaction
      await prisma.$transaction(async (tx) => {
        // Try to insert or update the lock row
        const result = await tx.$executeRawUnsafe(`
          INSERT INTO _advisory_lock (name, holder, acquired_at)
          VALUES (?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            holder = CASE WHEN holder = ? THEN ? ELSE holder END,
            acquired_at = CASE WHEN holder = ? THEN ? ELSE acquired_at END
          WHERE name = ? AND (holder = ? OR acquired_at < ?)
        `, lockName, holderId, Date.now(), holderId, holderId, holderId, Date.now(), lockName, holderId, Date.now() - maxWaitMs);

        // Check if we got the lock
        const lockRow = await tx.$queryRawUnsafe<{ holder: string }[]>(`
          SELECT holder FROM _advisory_lock WHERE name = ?
        `, lockName);

        if (!lockRow.length || lockRow[0].holder !== holderId) {
          throw new Error("Could not acquire advisory lock");
        }
      });

      // Lock acquired, run the function
      try {
        return await fn();
      } finally {
        // Release the lock
        await prisma.$executeRawUnsafe(`
          DELETE FROM _advisory_lock WHERE name = ? AND holder = ?
        `, lockName, holderId);
      }
    } catch (error) {
      // Check if we should retry
      if (Date.now() - startTime >= maxWaitMs) {
        throw new Error(`Advisory lock timeout after ${maxWaitMs}ms`);
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
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
  // read-then-create atomic — two concurrent registrations could both pass
  // the uniqueness check and race the create. The lock makes the
  // check-then-act sequence atomic within the only writer process; the
  // P2002 catch below stays as defense for any future multi-process
  // deployment.
  //
  // SEC_REVIEW_HIGH_4_ADVISORY_LOCK: defense-in-depth advisory lock for
  // cross-process safety. The in-process lock is the primary guard; the
  // advisory lock adds protection if multiple Node processes ever write to
  // the same SQLite database (violating the single-writer contract).
  try {
    await withRegistrationLock(() =>
      withAdvisoryRegistrationLock(() =>
        prisma.$transaction(async (tx) => {
          const existingUser = await tx.user.findUnique({
            where: { username },
          });
          if (existingUser) {
            throw new UsernameTakenError();
          }

          // Stage 4 (KILO auth/security plan): registration NEVER grants
          // ADMIN. The old first-registered-user election let a fresh public
          // deployment be hijacked by the first stranger to register. The
          // operator promotes their own account after registering with
          // `node scripts/bootstrap-admin.mjs <username> --yes` (single-use,
          // operator-run, no web surface).
          const role = "USER";

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
      )
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

  // Stage 3: PER-ACCOUNT throttle, keyed by the submitted username, so a
  // distributed attack (many clients, one target) is bounded by the same
  // budget a single client faces. Consumed before any lookup; idle buckets
  // are swept by the limiter so fake usernames cannot grow memory without
  // bound. The tradeoff — a flood against one username temporarily delays
  // THAT account's recovery — is accepted: the modern code keyspace (62^12)
  // makes offline guessing hopeless and the login itself is never blocked.
  const accountVerdict = consumeToken(
    "recoverAccount",
    hashClient(`account-recovery:${username}`)
  );
  if (!accountVerdict.allowed) {
    // SEC_REVIEW_HIGH_3_RECOVERY_ALERTING: alert admins when the per-account
    // recovery bucket is exhausted — indicates a targeted DoS against one
    // account's recovery path. Fire-and-forget; never blocks the response.
    const clientHash = await getRequestClientHash();
    void notifyAdmins({
      type: "recovery_bucket_exhausted",
      username,
      clientHash,
      retryAfterSeconds: accountVerdict.retryAfterSeconds,
    });
    return {
      success: false,
      error: rateLimitMessage(accountVerdict.retryAfterSeconds),
    };
  }

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

  // Stage 3: CHEAP pre-check before any password hashing. The previous
  // order hashed the attacker-controlled new password (a full Argon2id/
  // bcrypt computation) before looking at the code, so invalid-code spam
  // burned server CPU. Now an invalid, unknown, or already-consumed code
  // fails after one indexed lookup and never reaches the hash. The
  // remaining timing asymmetry between "no such user" and "bad code" is a
  // single indexed query — bounded by design; no artificial delays.
  const unusedKey = await prisma.recoveryKey.findFirst({
    where: { keyHash: codeHash, userId: user.id, usedAt: null },
    select: { id: true },
  });
  if (!unusedKey) {
    return { success: false, error: RECOVERY_FAILURE };
  }

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
      // Stage 5: the reset revokes ALL sessions of the account — anyone
      // holding an old token (e.g. an attacker who stole it) is locked out
      // by the central sessionVersion check on their next request.
      data: { passwordHash: newPasswordHash, sessionVersion: { increment: 1 } },
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
  // auth() reads the request through next/headers and throws outside a
  // request scope; treat that as unauthenticated (same pattern as the
  // Stage 2/4 wrappers — keeps the action test-exercisable).
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  return changePasswordForUser(session.user.id, formData);
}

/**
 * The password-change body, split from the session wrapper so the
 * integration tests can exercise the real logic against a disposable
 * database with a synthetic user id (the NextAuth session does not exist
 * in tests).
 */
export async function changePasswordForUser(
  userId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
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
    where: { id: userId },
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

  // Stage 5: bumping sessionVersion revokes EVERY session of this account
  // (including the current one) — the defined change-password behavior is
  // full re-authentication with the new password. Also clear the session
  // cookie immediately so the current session cannot be used even before the
  // next request hits the central revocation check.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });

  // Immediately invalidate the current session cookie so an attacker who
  // stole the session cannot continue using it. The cookie name follows
  // NextAuth v5 defaults: "next-auth.session-token" (production) or
  // "__Host-next-auth.session-token" (development with secure prefix).
  // Wrapped in try/catch because cookies() throws outside a request scope
  // (e.g., in integration tests that call the action directly).
  try {
    const cookieStore = await cookies();
    cookieStore.delete("next-auth.session-token");
    cookieStore.delete("__Host-next-auth.session-token");
    // Also clear the callback URL and CSRF cookies for completeness
    cookieStore.delete("next-auth.callback-url");
    cookieStore.delete("__Host-next-auth.callback-url");
    cookieStore.delete("next-auth.csrf-token");
    cookieStore.delete("__Host-next-auth.csrf-token");
  } catch {
    // Outside request scope (tests) — sessionVersion bump still revokes
    // the token on next request; cookie clearing is a defense-in-depth
    // measure for production request contexts only.
  }

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
  // auth() reads the request through next/headers and throws outside a
  // request scope; treat that as unauthenticated (same pattern as the
  // Stage 2 regeneration wrapper — keeps the action test-exercisable).
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  return deleteOwnAccountForUser(session.user.id, formData);
}

/**
 * The deletion body, split from the session wrapper so the integration
 * tests can exercise the real logic against a disposable database with a
 * synthetic user id (the NextAuth session does not exist in tests).
 */
export async function deleteOwnAccountForUser(
  userId: string,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const isValid = await verifyStoredPassword(parsed.data.password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  const ownedImageFiles: string[] = [];
  const publishedImageFiles: string[] = [];

  const deleted = await prisma.$transaction(async (tx) => {
    // Stage 4: the last-admin invariant is enforced INSIDE the transaction
    // that performs the deletion — the previous pre-transaction count check
    // raced concurrent role changes (two simultaneous last-admin deletions
    // could both observe count 2 and both proceed). SQLite serializes
    // writers, so the in-transaction count is authoritative for the delete
    // that follows it in the same transaction.
    if (user.role === "ADMIN") {
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        // Refusal: the transaction commits empty (no work done) and the
        // caller turns this into the friendly error below.
        return false;
      }
    }

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

    // Stage 6: durable purge records written INSIDE the transaction — if the
    // process dies between commit and unlink, the boot-time sweep still
    // converges the bytes with the zero-PII exit path.
    await recordPendingFileDeletions(tx, [
      ...ownedImageFiles.map((filename) => ({ filename, kind: "public" as const })),
      ...publishedImageFiles.map((filename) => ({ filename, kind: "secret" as const })),
    ]);

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
    return true;
  });

  if (!deleted) {
    return {
      success: false,
      error: "Cannot delete the last administrator account — promote another member first",
    };
  }

  // Post-commit file purge (audit S9 + Stage 6): attempt immediately; on
  // success the durable record is drained, on failure it stays for the
  // boot-time sweep. The helpers are no-ops for missing files, so this is
  // idempotent.
  for (const filename of ownedImageFiles) await purgeStoredImage(filename, "public");
  for (const filename of publishedImageFiles) await purgeStoredImage(filename, "secret");

  return { success: true };
}

const regenerateCodesSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

export interface RegenerateCodesState {
  success?: boolean;
  error?: string;
  recoveryCodes?: string[];
}

/**
 * Stage 2 (KILO auth/security plan): self-service recovery-code
 * regeneration.
 *
 * Until now a member who closed the one-time code display without saving
 * had no way back in except a recovery code they may not hold. This flow
 * lets an authenticated member rotate their 8 codes at will, gated by a
 * FRESH current-password verification (a live session alone is not enough
 * — a hijacked session must not be able to lock the real owner out of
 * recovery), rate-limited, and transactional:
 *
 * - All existing RecoveryKey rows are deleted and 8 new hashed codes are
 *   written in one transaction; the plaintext codes leave the server
 *   exactly once, in this action's return value.
 * - A compare-and-set on `recoveryCodesIssuedAt` makes a concurrent
 *   rotation (another tab's regeneration, or the login-time legacy
 *   rotation) win and this attempt stand down instead of double-rotating.
 * - Accounts still holding the legacy 8-character set (issuedAt null)
 *   rotate directly — no forced login detour.
 * - Routine logins never rotate codes; only this explicit flow and the
 *   one-time legacy login rotation do.
 */
export async function regenerateRecoveryCodes(
  _prevState: RegenerateCodesState | undefined,
  formData: FormData
): Promise<RegenerateCodesState> {
  // auth() reads the request through next/headers and throws outside a
  // request scope; treat that as unauthenticated (this also keeps the
  // action exercisable by the integration tests).
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }
  return regenerateRecoveryCodesForUser(session.user.id, formData);
}

/**
 * The regeneration body, split from the session wrapper so the integration
 * tests can exercise the real logic against a disposable database with a
 * synthetic user id (the NextAuth session does not exist in tests).
 */
export async function regenerateRecoveryCodesForUser(
  userId: string,
  formData: FormData
): Promise<RegenerateCodesState> {
  const limit = await enforceRateLimit("recoveryRegen");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  const parsed = regenerateCodesSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
  });
  if (!parsed.success) {
    return { success: false, error: "Current password is required" };
  }
  const { currentPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, recoveryCodesIssuedAt: true },
  });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const isValid = await verifyStoredPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  const codes = generateRecoveryCodes(8);
  const keyHashes = codes.map((code) => hashRecoveryCode(code));
  const issuedAt = new Date();

  const rotated = await prisma.$transaction(async (tx) => {
    const claim = await tx.user.updateMany({
      where: { id: user.id, recoveryCodesIssuedAt: user.recoveryCodesIssuedAt },
      data: { recoveryCodesIssuedAt: issuedAt },
    });
    if (claim.count !== 1) return false;
    await tx.recoveryKey.deleteMany({ where: { userId: user.id } });
    await tx.recoveryKey.createMany({
      data: keyHashes.map((keyHash) => ({ userId: user.id, keyHash })),
    });
    return true;
  });

  if (!rotated) {
    return {
      success: false,
      error: "Your recovery codes were just regenerated in another session. Refresh and try again.",
    };
  }

  return { success: true, recoveryCodes: codes };
}