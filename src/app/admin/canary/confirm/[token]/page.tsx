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
import { redirect } from "next/navigation";
import { inspectCanaryToken } from "@/lib/canary";
import ConfirmClient from "./ConfirmClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm canary update — ToolsLibrary",
};

/**
 * PHASE_30_CANARY_SIGNING: the out-of-band approval target. The emailed link
 * lands here; the token in the URL is untrusted input — it is validated
 * server-side against the staging admin's pending row (timing-safe hash
 * comparison + TTL) before anything is rendered, and the commit itself
 * re-validates everything again inside the server action. The link is
 * deliberately NOT sufficient on its own: an active ADMIN session is also
 * required, so an inbox compromise alone can sign nothing.
 */
export default async function ConfirmCanaryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/admin/canary/confirm/${token}`)}`);
  }
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const verdict = await inspectCanaryToken(session.user.id, token);

  return (
    <ConfirmClient
      token={token}
      ok={verdict.ok}
      pending={verdict.ok ? verdict.pending : null}
    />
  );
}
