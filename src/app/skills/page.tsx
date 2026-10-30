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
import { redactText } from "@/lib/redact";
import SkillsClient from "./SkillsClient";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  // Guest browsing (GUEST_ALIAS_REDACTION): owner aliases are stripped from
  // the payload itself so the real strings never reach a guest's browser.
  // The `available` boolean stays in the payload (the AVAILABLE ONLY filter
  // needs it) and the status text is censored at render time in SkillsClient.
  const [session, skillCount, recentSkills] = await Promise.all([
    auth(),
    prisma.skill.count(),
    prisma.skill.findMany({
      where: { available: true },
      include: {
        owner: {
          select: { id: true, alias: true, trustScore: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const isGuest = !session?.user;

  return (
    <SkillsClient
      guestView={isGuest}
      initialSkills={recentSkills.map((skill) => ({
        ...skill,
        owner: {
          ...skill.owner,
          alias: isGuest ? redactText(skill.owner.alias) : skill.owner.alias,
        },
      }))}
      totalCount={skillCount}
    />
  );
}