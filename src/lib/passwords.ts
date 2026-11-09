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

/**
 * Central password service (KILO_AUTH_SECURITY_IMPLEMENTATION_PLAN.md Stage 1).
 *
 * Single source of truth for every password hash/verify decision in the
 * platform. Every password-creation, verification, or reset path MUST go
 * through this module — no call site may import @node-rs/bcrypt or
 * @node-rs/argon2 directly.
 *
 * Hashing policy (owner-fixed):
 * - NEW, CHANGED, and RESET passwords are hashed with Argon2id
 *   (v=19, memoryCost=19456 KiB, timeCost=2, parallelism=1 — the OWASP
 *   baseline), applied explicitly, never via unspecified library defaults.
 * - Existing bcrypt hashes (cost 12, `$2a$`/`$2b$`/`$2y$`) keep verifying
 *   so no account is ever locked out; after an UNAMBIGUOUS successful
 *   legacy verification the caller may opportunistically upgrade the
 *   account to Argon2id (see credentialAuth.ts for the guarded write).
 * - Unknown or malformed hash formats FAIL CLOSED (verify returns false).
 *
 * Input policy (owner-fixed):
 * - Passwords are Unicode: spaces, punctuation, emoji, and any script are
 *   allowed. No composition rules are imposed.
 * - NEW passwords must be 15..256 Unicode CODE POINTS (counted after NFC
 *   normalization, never UTF-16 code units) and at most 1024 UTF-8 bytes
 *   after normalization. Input is NEVER truncated — oversize input is
 *   rejected with an explicit error. (256 code points × 4 max UTF-8 bytes
 *   per code point = exactly 1024, so the byte bound is defense-in-depth
 *   for future policy changes, not the active limiter.)
 * - Argon2id hashing/verification normalizes to NFC first so the same
 *   logical password hashes and verifies identically regardless of how the
 *   input device encoded combining marks.
 * - LEGACY bcrypt verification passes the RAW input unchanged — exactly the
 *   pre-Stage-1 behavior — so existing accounts (including ones below the
 *   new 15-code-point minimum) keep authenticating.
 *
 * bcrypt 72-byte caveat: a bcrypt hash authenticates only the first 72
 * UTF-8 bytes of the input. Legacy login input at or above 72 bytes is
 * therefore potentially ambiguous (a longer secret sharing that prefix
 * would also verify) and must NEVER be silently promoted to Argon2id —
 * `isSafeToOpportunisticallyUpgrade` gates the automatic upgrade, and those
 * accounts migrate only through the explicit password-change flow.
 */

import { hash as argon2Hash, verify as argon2Verify, type Options } from "@node-rs/argon2";
import * as bcrypt from "@node-rs/bcrypt";

/** OWASP-recommended Argon2id baseline, pinned explicitly (not defaults). */
export const ARGON2ID_MEMORY_COST = 19_456; // KiB (19 MiB)
export const ARGON2ID_TIME_COST = 2; // passes
export const ARGON2ID_PARALLELISM = 1; // thread

/**
 * Explicit Argon2id parameters. `Algorithm.Argon2id` is numeric 2 and
 * `Version.V0x13` (v=19) is numeric 1 in the NAPI-RS ambient const enum —
 * spelled numerically here because `isolatedModules` forbids value access
 * to ambient const enums; the unit tests assert the stored PHC parameters
 * via `parseOptions`, so any drift fails loudly.
 */
const ARGON2ID_OPTIONS: Options = {
  algorithm: 2 as Options["algorithm"], // Algorithm.Argon2id
  version: 1 as Options["version"], // Version.V0x13 (v=19)
  memoryCost: ARGON2ID_MEMORY_COST,
  timeCost: ARGON2ID_TIME_COST,
  parallelism: ARGON2ID_PARALLELISM,
};

/** New-password minimum, in Unicode code points (owner-fixed). */
export const PASSWORD_MIN_CODE_POINTS = 15;

/** New-password maximum, in Unicode code points (owner-fixed). */
export const PASSWORD_MAX_CODE_POINTS = 256;

/**
 * Bounded input byte limit after NFC normalization (owner-fixed: 256 code
 * points × 4 max UTF-8 bytes per code point). Defense-in-depth — see the
 * module comment.
 */
export const PASSWORD_MAX_BYTES = 1024;

/** bcrypt hash prefixes this platform has issued (bcryptjs `$2a$` era and @node-rs `$2b$`). */
const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"] as const;

/** Thrown when a password violates the new-password policy. */
export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

/** True when the stored hash is a modern Argon2id PHC string. */
export function isArgon2idHash(storedHash: string | null | undefined): boolean {
  return typeof storedHash === "string" && storedHash.startsWith("$argon2id$");
}

/** True when the stored hash is a legacy bcrypt string this platform issued. */
export function isLegacyBcryptHash(storedHash: string | null | undefined): boolean {
  return (
    typeof storedHash === "string" &&
    BCRYPT_PREFIXES.some((prefix) => storedHash.startsWith(prefix))
  );
}

/**
 * Canonical password normalization: Unicode NFC. Applied before Argon2id
 * hashing and verification so composed and decomposed encodings of the same
 * logical password are interchangeable. Legacy bcrypt input is NOT
 * normalized (its original behavior is preserved byte-for-byte).
 */
export function normalizePassword(password: string): string {
  return password.normalize("NFC");
}

/** Counts Unicode code points (not UTF-16 code units). */
export function countCodePoints(value: string): number {
  let count = 0;
  for (const _ of value) count += 1;
  return count;
}

/**
 * Validates a NEW password against the owner-fixed policy. Returns null
 * when the password is acceptable, or a clear human-readable error message
 * suitable for form error states. Never mutates or truncates the input.
 */
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }
  const normalized = normalizePassword(password);
  const codePoints = countCodePoints(normalized);
  if (codePoints < PASSWORD_MIN_CODE_POINTS) {
    return `Password must be at least ${PASSWORD_MIN_CODE_POINTS} characters`;
  }
  if (codePoints > PASSWORD_MAX_CODE_POINTS) {
    return `Password must be at most ${PASSWORD_MAX_CODE_POINTS} characters`;
  }
  if (Buffer.byteLength(normalized, "utf8") > PASSWORD_MAX_BYTES) {
    return `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes)`;
  }
  return null;
}

/**
 * Hashes a NEW password (registration, password change, or recovery reset)
 * with Argon2id at the pinned parameters. Validates the policy FIRST so an
 * invalid or oversize input never reaches the expensive hash. Returns the
 * PHC string exactly as produced (unique 16-byte salt per call).
 */
export async function hashNewPassword(password: string): Promise<string> {
  const policyError = validateNewPassword(password);
  if (policyError) {
    throw new PasswordPolicyError(policyError);
  }
  return argon2Hash(normalizePassword(password), ARGON2ID_OPTIONS);
}

/**
 * Rehashes an ALREADY-VERIFIED legacy credential to Argon2id during an
 * opportunistic upgrade. Deliberately does NOT apply the new-password
 * policy: legacy passwords may predate the 15-code-point minimum, and the
 * upgrade must never lock the account out of its own next login. The input
 * is still NFC-normalized so the stored hash matches future NFC-normalized
 * verification input.
 */
export async function hashUpgradedLegacyPassword(password: string): Promise<string> {
  return argon2Hash(normalizePassword(password), ARGON2ID_OPTIONS);
}

/**
 * Verifies a password candidate against a stored hash, whatever algorithm
 * issued it:
 * - `$argon2id$` → NFC-normalize the input, Argon2id verify.
 * - `$2a$`/`$2b$`/`$2y$` → RAW input, bcrypt verify (original behavior).
 * - anything else (malformed, unknown PHC, empty) → false. FAIL CLOSED.
 *
 * Never throws; every error path collapses to `false` so a malformed hash
 * can never authenticate and never leak algorithm details through
 * differential exceptions.
 */
export async function verifyStoredPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0) return false;
  if (!storedHash) return false;

  if (isArgon2idHash(storedHash)) {
    try {
      return await argon2Verify(storedHash, normalizePassword(password));
    } catch {
      // Malformed PHC body / bad salt: fail closed.
      return false;
    }
  }

  if (isLegacyBcryptHash(storedHash)) {
    try {
      // RAW input — legacy hashes were created from raw input and must keep
      // verifying byte-identically (no NFC normalization here).
      return await bcrypt.verify(password, storedHash);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * True when a successfully verified legacy bcrypt credential is
 * UNAMBIGUOUS and may be silently upgraded to Argon2id: bcrypt
 * authenticates only the first 72 UTF-8 bytes, so input at or above 72
 * bytes could be a prefix of several different real secrets and must NOT
 * be promoted automatically (the owner migrates those via the explicit
 * password-change flow instead). The RAW input's byte length decides —
 * that is what bcrypt authenticated.
 */
export function isSafeToOpportunisticallyUpgrade(password: string): boolean {
  return Buffer.byteLength(password, "utf8") < 72;
}
