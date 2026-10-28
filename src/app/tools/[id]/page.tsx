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
import { notFound } from "next/navigation";
import ToolDetailClient from "./ToolDetailClient";
import { manageLoan } from "@/lib/actions/tools";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ToolDetailPage({ params }: PageProps) {
  const { id } = await params;

  const tool = await prisma.tool.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true, bio: true, createdAt: true },
      },
      loans: {
        where: { status: { in: ["ACTIVE", "APPROVED", "REQUESTED"] } },
        include: { borrower: { select: { id: true, alias: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!tool) {
    notFound();
  }

  // Wrap manageLoan to only accept FormData for form actions and return void.
  // The wrapper MUST be an inline server action: a plain function prop cannot
  // cross the server→client boundary (React serialization error → 500).
  const manageLoanAction = async (formData: FormData) => {
    "use server";
    await manageLoan(undefined, formData);
  };

  return <ToolDetailClient tool={tool} manageLoan={manageLoanAction} />;
}