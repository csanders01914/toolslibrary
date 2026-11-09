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
 * Credential authentication with staged Argon2id migration
 * (KILO_AUTH_SECURITY_IMPLEMENTATION_PLAN.md Stage 1).
 *
 * Extracted from the NextAuth `authorize` callback in src/auth.ts so the
 * verify-and-upgrade path is directly testable against a disposable
 * database. The NextAuth callback stays a thin wrapper: schema parse →
 * rate limit → this function → banned check.
 *
 * Migration semantics (owner-fixed):
 * - Existing bcrypt accounts authenticate exactly as before, including
 *   passwords below the new 15-code-point minimum. No forced reset.
 * - After an UNAMBIGUOUS successful legacy verification (input under the
 *   72-byte bcrypt boundary), the stored hash is opportunistically
 *   upgraded to Argon2id.
 * - The upgrade is a conditional compare-and-set
 *   (`updateMany` where id AND the old passwordHash match): a concurrent
 *   password reset/change/recovery that commits first wins, and the
 *   upgrade silently stands down instead of overwriting the newer hash.
 * - A FAILED verification never writes anything — the stored hash is never
 *   touched on unsuccessful authentication.
 * - Rehashing the password hash alone must never affect sessions (the JWT
 *   strategy revocation work is Stage 5's separate concern).
 */

import {
  hashUpgradedLegacyPassword,
  isLegacyBcryptHash,
  isSafeToOpportunisticallyUpgrade,
  verifyStoredPassword,
} from "@/lib/passwords";

/** Session-payload shape the NextAuth `authorize` callback consumes. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  alias: string;
  role: string;
  mustChangePassword: boolean;
  needsAdminEmail: boolean;
  banned: boolean;
}

/**
 * Verifies a username/password pair against the stored credential and, for
 * legacy bcrypt accounts, opportunistically upgrades the stored hash to
 * Argon2id after an unambiguous verification. Returns the authenticated
 * user row payload, or null for unknown username / wrong password /
 * malformed stored hash (fail closed — callers must not distinguish).
 */
export async function authenticateAndMaybeUpgrade(
  username: string,
  password: string
): Promise<AuthenticatedUser | null> {
  // Dynamic import keeps Prisma out of edge bundles (same pattern as the
  // previous inline authorize implementation in src/auth.ts).
  const { prisma } = await import("@/lib/db");

  const user = await prisma.user.findUnique({
    where: { username },
  });
  if (!user) return null;

  const isValid = await verifyStoredPassword(password, user.passwordHash);
  if (!isValid) return null;

  if (
    isLegacyBcryptHash(user.passwordHash) &&
    isSafeToOpportunisticallyUpgrade(password)
  ) {
    // One Argon2id hash per successful legacy login that is still on
    // bcrypt — bounded extra latency (~50-100 ms) only on that path.
    // The compare-and-set guard makes a concurrent credential write win.
    const upgradedHash = await hashUpgradedLegacyPassword(password);
    await prisma.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash: upgradedHash },
    });
  }

  return {
    id: user.id,
    username: user.username,
    alias: user.alias,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    needsAdminEmail: user.role === "ADMIN" && !user.notificationEmail,
    banned: user.banned,
  };
}

/**
 * The guarded upgrade write, exported for tests: rehashes `verifiedPassword`
 * to Argon2id and swaps the stored hash ONLY while it still equals
 * `oldHash` — the exact compare-and-set the login path uses, so the
 * concurrent-reset-vs-rehash invariant can be exercised deterministically.
 * Returns true when this call performed the upgrade.
 */
export async function rehashIfUnchanged(
  userId: string,
  oldHash: string,
  verifiedPassword: string
): Promise<boolean> {
  const { prisma } = await import("@/lib/db");
  const upgradedHash = await hashUpgradedLegacyPassword(verifiedPassword);
  const result = await prisma.user.updateMany({
    where: { id: userId, passwordHash: oldHash },
    data: { passwordHash: upgradedHash },
  });
  return result.count === 1;
}
