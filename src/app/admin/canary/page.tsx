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

import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCanaryKeyFingerprint, getCanaryState } from "@/lib/canary";
import CanaryClient from "./CanaryClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warrant Canary — ToolsLibrary",
};

/**
 * PHASE_30_CANARY_SIGNING: admin warrant-canary console. Admin-only surface
 * (the middleware authorized() callback also gates /admin/*, but every admin
 * page re-checks server-side — the middleware is defense in depth, not the
 * authority). Loads the operator's canary credentials state and the public
 * canary state, then hands both to the client console.
 */
export default async function AdminCanaryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { alias: true, canaryPassphraseHash: true, notificationEmail: true },
  });
  if (!user) redirect("/login");

  const canaryState = await getCanaryState(session.user.id);
  const keyFingerprint = await getCanaryKeyFingerprint();

  return (
    <CanaryClient
      alias={user.alias}
      hasPassphrase={user.canaryPassphraseHash !== null}
      notificationEmail={user.notificationEmail}
      state={canaryState}
      keyFingerprint={keyFingerprint}
    />
  );
}
