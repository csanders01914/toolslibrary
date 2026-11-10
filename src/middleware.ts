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

import { auth } from "./auth.config";
import { NextResponse } from "next/server";

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export default auth((req) => {
  // Generate CSP nonce for this request
  const nonce = generateNonce();

  // Force password change: a session flagged mustChangePassword (stock seeded
  // credentials) is locked out of every route until the password is replaced.
  const mustChangePassword = req.auth?.user?.mustChangePassword === true;
  // PHASE_29: forced admin notification-email setup flag (see below).
  const needsAdminEmail = req.auth?.user?.needsAdminEmail === true;
  const { pathname } = req.nextUrl;

  if (mustChangePassword && pathname !== "/change-password") {
    return Response.redirect(new URL("/change-password", req.nextUrl));
  }

  // PHASE_29: forced admin email setup runs AFTER the password gate — a flagged
  // admin is locked to /admin-email until a notification email is on record.
  if (!mustChangePassword && needsAdminEmail && pathname !== "/admin-email") {
    return Response.redirect(new URL("/admin-email", req.nextUrl));
  }

  // Route protection is handled in authConfig.callbacks.authorized

  // Continue with the response, adding CSP nonce headers
  const response = NextResponse.next();

  // Set CSP nonce as a cookie for the layout to read
  response.cookies.set("csp-nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour (matches session maxAge)
  });

  // Set CSP header with nonce
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  return response;
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};