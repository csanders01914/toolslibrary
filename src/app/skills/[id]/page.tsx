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
import { notFound } from "next/navigation";
import { redactText } from "@/lib/redact";
import SkillDetailClient from "./SkillDetailClient";
import { toggleSkillAvailability, deleteSkill } from "@/lib/actions/skills";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [session, skill] = await Promise.all([
    auth(),
    prisma.skill.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, alias: true, trustScore: true, bio: true, createdAt: true },
        },
      },
    }),
  ]);

  if (!skill) {
    notFound();
  }

  // Guest browsing (GUEST_ALIAS_REDACTION): the owner alias is stripped from
  // the payload before it crosses to the client, so the real string never
  // reaches a guest's browser. Availability is censored at render time inside
  // SkillDetailClient.
  const isGuest = !session?.user;
  const safeSkill = isGuest
    ? { ...skill, owner: { ...skill.owner, alias: redactText(skill.owner.alias) } }
    : skill;

  // Wrappers MUST be inline server actions: plain function props cannot cross
  // the server→client boundary (React serialization error → 500).
  const toggleAvailabilityAction = async (formData: FormData) => {
    "use server";
    await toggleSkillAvailability(undefined, formData);
  };

  const deleteSkillAction = async (formData: FormData) => {
    "use server";
    await deleteSkill(undefined, formData);
  };

  return (
    <SkillDetailClient
      skill={safeSkill}
      guestView={isGuest}
      toggleAvailability={toggleAvailabilityAction}
      deleteSkill={deleteSkillAction}
    />
  );
}