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
import ToolsClient from "./ToolsClient";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  // Guest browsing (GUEST_ALIAS_REDACTION): owner aliases are stripped from
  // the payload itself so the real strings never reach a guest's browser.
  // Availability status stays in the payload (the status filter needs it) and
  // is censored at render time inside ToolsClient.
  const [session, tools] = await Promise.all([
    auth(),
    prisma.tool.findMany({
      include: {
        owner: {
          select: { id: true, alias: true, trustScore: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const isGuest = !session?.user;

  return (
    <ToolsClient
      guestView={isGuest}
      initialTools={tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        status: tool.status,
        imageUrl: tool.imageUrl,
        owner: {
          ...tool.owner,
          alias: isGuest ? redactText(tool.owner.alias) : tool.owner.alias,
        },
        createdAt: tool.createdAt.toISOString(),
      }))}
    />
  );
}
