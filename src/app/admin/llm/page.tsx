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
import LlmClient from "./LlmClient";

export const dynamic = "force-dynamic";

/**
 * Dedicated LLM control console. Every automation feature (provider
 * configuration, operations chat with tool calling, the destructive-action
 * guardrail queue, and listing audits) lives here, linked from /admin.
 * Admin-gated on the server and by middleware (auth.config.ts covers the
 * whole /admin path prefix).
 */
export default async function AdminLlmPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [recentTools, recentSkills] = await Promise.all([
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
  ]);

  return <LlmClient auditTools={recentTools} auditSkills={recentSkills} />;
}
