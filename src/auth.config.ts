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

/**
 * Server-side allowlist of safe callback paths (SEC_REVIEW_LOW_1_CALLBACK_VALIDATION).
 * The login page validates callbackUrl client-side for UX, but the primary guard
 * is this server-side allowlist in the redirect callback. Only explicitly
 * allowed paths are accepted; everything else falls back to /dashboard.
 * This prevents open redirects to attacker-controlled hosts.
 */
const ALLOWED_CALLBACK_PATHS = new Set([
  "/dashboard",
  "/tools",
  "/skills",
  "/messages",
  "/admin",
  "/admin/canary",
  "/admin-email",
  "/change-password",
  "/chat",
  "/help",
  "/profile",
]);

function isAllowedCallbackPath(path: string): boolean {
  // Exact match or prefix match for nested routes
  if (ALLOWED_CALLBACK_PATHS.has(path)) return true;
  for (const allowed of ALLOWED_CALLBACK_PATHS) {
    if (path.startsWith(allowed + "/")) return true;
  }
  return false;
}

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
        // Stage 5: the session version this token was issued at. The Node
        // bundle's jwt callback compares it against database truth on every
        // invocation and kills the token on mismatch (session revocation).
        token.sessionVersion = user.sessionVersion ?? 0;
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
      // SEC_REVIEW_LOW_1_CALLBACK_VALIDATION: server-side allowlist of safe
      // callback paths. The login page validates client-side for UX, but the
      // primary guard is here — only explicitly allowed paths are accepted.
      // This prevents open redirects to attacker-controlled hosts.
      if (url.startsWith("/")) {
        // Relative URL: validate against allowlist
        const path = url.split("?")[0]; // strip query string
        if (isAllowedCallbackPath(path)) {
          return `${baseUrl}${url}`;
        }
        // Not in allowlist: fall back to dashboard
        return `${baseUrl}/dashboard`;
      }
      // Absolute URL: only allow the canonical deployment origin
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
        // Admin role check is intentionally omitted here — the middleware runs in
        // edge runtime and cannot perform the database sessionVersion revocation
        // check. Admin pages run in Node runtime (export const runtime = 'nodejs')
        // where the jwt callback validates sessionVersion against the database
        // and the page re-checks the role from the refreshed session.
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