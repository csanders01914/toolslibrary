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
import { notFound, redirect } from "next/navigation";
import SkillEditClient from "./SkillEditClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SkillEditPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    notFound();
  }

  // Only the owner (or an admin) may edit the listing; everyone else is
  // bounced back to the public detail page.
  if (skill.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    redirect(`/skills/${id}`);
  }

  return (
    <SkillEditClient
      skill={{
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
      }}
    />
  );
}
