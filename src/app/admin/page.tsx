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
import { redirect } from "next/navigation";
import { getCanaryState } from "@/lib/canary";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [
    totalMembers,
    totalTools,
    availableTools,
    borrowedTools,
    maintenanceTools,
    activeLoans,
    skillsCount,
    recentTools,
    recentSkills,
    users,
    helpRequests,
    canaryState,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tool.count(),
    prisma.tool.count({ where: { status: "AVAILABLE" } }),
    prisma.tool.count({ where: { status: "BORROWED" } }),
    prisma.tool.count({ where: { status: "MAINTENANCE" } }),
    prisma.loan.count({ where: { status: { in: ["APPROVED", "ACTIVE"] } } }),
    prisma.skill.count(),
    prisma.tool.findMany({
      take: 20,
      include: { owner: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.skill.findMany({
      take: 20,
      include: { owner: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        alias: true,
        role: true,
        trustScore: true,
        banned: true,
        createdAt: true,
        _count: { select: { tools: true, skills: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.helpRequest.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    // PHASE_30: canary state for the dashboard strip — the operator must see
    // STALE/DISCLOSED status without visiting the canary console.
    getCanaryState(session.user.id),
  ]);

  const userRows = users.map((user) => ({
    id: user.id,
    username: user.username,
    alias: user.alias,
    role: user.role,
    trustScore: user.trustScore,
    banned: user.banned,
    toolCount: user._count.tools,
    skillCount: user._count.skills,
    createdAt: user.createdAt,
  }));

  return (
    <AdminClient
      currentUserId={session.user.id}
      stats={{
        totalMembers,
        totalTools,
        availableTools,
        borrowedTools,
        maintenanceTools,
        activeLoans,
        skillsCount,
      }}
      auditTools={recentTools}
      auditSkills={recentSkills}
      users={userRows}
      helpRequests={helpRequests}
      canary={{
        status: canaryState.status,
        latest: canaryState.latest,
        pending: canaryState.pending,
      }}
    />
  );
}
