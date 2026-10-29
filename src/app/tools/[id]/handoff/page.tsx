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
import { notFound, redirect } from "next/navigation";
import { getHandoffContext } from "@/lib/actions/tools";
import HandoffClient from "./HandoffClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * QR handoff scan target (PHASE_24_QR_LOAN_LIFECYCLE). The printed tool label
 * encodes this URL; a phone-camera scan lands here and the page resolves the
 * tool's current live loan and the viewer's role in it, offering exactly the
 * one transition that role may perform:
 *   owner    + REQUESTED → approve / reject
 *   borrower + APPROVED → confirm pickup (loan ACTIVE, tool BORROWED)
 *   owner    + ACTIVE   → mark returned
 */
export default async function HandoffPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/tools/${id}/handoff`);
  }

  const context = await getHandoffContext(id);
  if (!context) {
    notFound();
  }

  const viewerId = session.user.id;
  const viewerRole =
    context.loan && context.loan.owner.id === viewerId
      ? ("owner" as const)
      : context.loan && context.loan.borrower.id === viewerId
        ? ("borrower" as const)
        : ("observer" as const);

  return <HandoffClient tool={context.tool} loan={context.loan} viewerRole={viewerRole} />;
}
