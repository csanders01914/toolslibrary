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

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Full config with Prisma for API route handlers (Node.js runtime)
// NOTE: The credentials entry is REPLACED (not appended) so there is exactly
// one sign-in method with id "credentials" — a duplicate id would shadow authorize.
export const { handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    {
      ...authConfig.providers[0],
      async authorize(credentials) {
        // Dynamic import to avoid bundling Prisma in edge runtime
        const { enforceRateLimit } = await import("@/lib/rateLimit");

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Brute-force gate (PHASE_23_RATE_LIMITING): throttle BEFORE any
        // database or password-hash work so exhausted clients cannot burn
        // CPU on cost-12/Argon2id hashes. A throttled attempt is
        // indistinguishable from bad credentials (null) — no
        // account-existence oracle — and the hashed client key is never
        // logged.
        const limit = await enforceRateLimit("login");
        if (!limit.ok) {
          console.error("[rate-limit] login throttled; credential check rejected");
          return null;
        }

        const { username, password } = parsed.data;

        // Stage 1 (KILO auth/security plan): credential verification and the
        // staged bcrypt→Argon2id upgrade live in one testable service. It
        // verifies Argon2id and legacy bcrypt hashes (fail closed on unknown
        // formats), never writes on a failed verification, and upgrades a
        // legacy hash only after an unambiguous verification via a
        // compare-and-set that a concurrent reset/change can win.
        const { authenticateAndMaybeUpgrade } = await import(
          "@/lib/credentialAuth"
        );
        const user = await authenticateAndMaybeUpgrade(username, password);
        if (!user) return null;

        // Banned accounts (admin or approved automated ban) cannot authenticate.
        if (user.banned) return null;

        return {
          id: user.id,
          username: user.username,
          alias: user.alias,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          // PHASE_29: forced notification-email setup — ADMIN accounts without
          // a notification email on record are locked to /admin-email by the
          // middleware until one is stored.
          needsAdminEmail: user.needsAdminEmail,
        };
      },
    },
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      // Shared sign-in logic first (pure, edge-safe).
      const token = await authConfig.callbacks!.jwt!(params);
      if (params.trigger === "update" && token) {
        // PHASE_29: session.update() payloads are client-supplied and never
        // trusted — re-derive the forced-email flag from database truth.
        // (A hijacked session must not be able to flip the gate off by
        // calling useSession().update({ needsAdminEmail: false }).)
        const { prisma } = await import("@/lib/db");
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, notificationEmail: true },
        });
        if (dbUser) {
          token.needsAdminEmail =
            dbUser.role === "ADMIN" && !dbUser.notificationEmail;
        }
      }
      return token;
    },
  },
});

// Re-export auth from auth.config for middleware
export { auth } from "./auth.config";