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

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import DashboardClient from "./DashboardClient";
import { getVouchableLoans } from "@/lib/actions/vouch";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, toolsLent, activeBorrows, skillsOffered, skillsTotal, incomingRequests, activeLoansAsOwner, activeLoansAsBorrower, vouchableLoans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, alias: true, bio: true, trustScore: true, role: true, createdAt: true },
    }),
    prisma.tool.count({ where: { ownerId: session.user.id } }),
    prisma.loan.count({ where: { borrowerId: session.user.id, status: { in: ["APPROVED", "ACTIVE"] } } }),
    prisma.skill.count({ where: { ownerId: session.user.id, available: true } }),
    prisma.skill.count({ where: { ownerId: session.user.id } }),
    prisma.loan.findMany({
      where: { tool: { ownerId: session.user.id }, status: "REQUESTED" },
      include: { tool: true, borrower: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loan.findMany({
      where: { tool: { ownerId: session.user.id }, status: { in: ["APPROVED", "ACTIVE"] } },
      include: { tool: true, borrower: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.loan.findMany({
      where: { borrowerId: session.user.id, status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
      include: { tool: { include: { owner: { select: { id: true, alias: true } } } } },
      orderBy: { endDate: "asc" },
    }),
    getVouchableLoans(session.user.id),
  ]);

  return (
    <DashboardClient
      user={user!}
      stats={{
        toolsLent,
        activeBorrows,
        skillsOffered,
        skillsTotal,
        trustScore: user?.trustScore ?? 100,
      }}
      incomingRequests={incomingRequests}
      activeLoansAsOwner={activeLoansAsOwner}
      activeLoansAsBorrower={activeLoansAsBorrower}
      vouchableLoans={vouchableLoans}
    />
  );
}