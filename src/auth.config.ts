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
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.alias = user.alias;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword ?? false;
        // PHASE_29: forced admin notification-email setup flag, derived from
        // the authorize() return (DB truth at sign-in). The Node bundle in
        // src/auth.ts re-derives this on session.update() — client payloads
        // are never trusted.
        token.needsAdminEmail = user.needsAdminEmail ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.alias = token.alias as string;
        session.user.role = token.role as string;
        session.user.mustChangePassword = token.mustChangePassword === true;
        session.user.needsAdminEmail = token.needsAdminEmail === true;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      // Open-redirect guard. Relative URLs resolve against the current
      // deployment origin. Absolute URLs are honored only when they target
      // the canonical public site origin (e.g. the Burn Session post-logout
      // redirect) or the deployment origin itself; everything else falls
      // back to the deployment origin. Override NEXT_PUBLIC_SITE_URL for
      // alternative self-hosted deployments.
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      const allowedOrigins = new Set([
        baseUrl,
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tools-library.com",
      ]);
      try {
        if (allowedOrigins.has(new URL(url).origin)) return url;
      } catch {
        // Malformed URL: fall through to the safe default below.
      }
      return baseUrl;
    },
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      // QR handoff scan target and printable label are member-only surfaces.
      const isToolSubpage = /^\/tools\/[^/]+\/(handoff|label)$/.test(pathname);
      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/tools/new") ||
        isToolSubpage ||
        pathname.startsWith("/skills/new") ||
        pathname.startsWith("/messages") ||
        pathname.startsWith("/admin");

      if (isProtected) {
        if (!auth?.user) return false;
        if (pathname.startsWith("/admin") && auth.user.role !== "ADMIN") {
          return false;
        }
      }

      return true;
    },
  },
  session: {
    strategy: "jwt",
    // Ephemeral login token: the JWT and its cookie are re-issued with a fresh
    // expiry on every session fetch, so this acts as an inactivity timeout.
    // One hour of inactivity invalidates the token; active browsing keeps it alive.
    maxAge: 60 * 60,
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;

// Create edge-safe auth function for middleware
export const { auth } = NextAuth(authConfig);