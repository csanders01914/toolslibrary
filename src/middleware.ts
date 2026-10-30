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

export default auth((req) => {
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
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};