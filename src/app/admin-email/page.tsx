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

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import AdminEmailClient from "./AdminEmailClient";

export const dynamic = "force-dynamic";

/**
 * PHASE_29: forced admin notification-email setup. The middleware locks a
 * flagged admin (ADMIN with no notification email on record) to /admin-email
 * once the password-rotation gate has been satisfied, so the forced flow is:
 * sign in → /change-password (stock credentials only) → this page → dashboard.
 */
export default async function AdminEmailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { alias: true, notificationEmail: true },
  });
  if (!user) redirect("/login");

  // DB truth wins over the JWT flag: once an email is on record the forced
  // gate is satisfied. CRITICAL: never `redirect("/dashboard")` from this
  // branch — if the JWT flag is stale-true the middleware bounces /dashboard
  // straight back here and the two redirects loop forever. Render the
  // "already-set" panel instead; its Continue button clears the flag via
  // useSession().update() (server re-derives from DB) before navigating.
  if (user.notificationEmail) {
    return <AdminEmailClient mode="already-set" alias={user.alias} />;
  }
  return <AdminEmailClient mode="setup" alias={user.alias} />;
}
