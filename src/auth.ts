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
// NOTE: The credentials provider is REPLACED (not appended) so there is exactly
// one provider with id "credentials" — a duplicate id would shadow authorize.
export const { handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    {
      ...authConfig.providers[0],
      async authorize(credentials) {
        // Dynamic import to avoid bundling Prisma in edge runtime
        const { prisma } = await import("@/lib/db");
        const bcrypt = (await import("bcryptjs")).default;

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { username },
        });
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Banned accounts (admin or approved automated ban) cannot authenticate.
        if (user.banned) return null;

        return {
          id: user.id,
          username: user.username,
          alias: user.alias,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    },
  ],
});

// Re-export auth from auth.config for middleware
export { auth } from "./auth.config";