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
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Pending-activity counts for the navbar notification indicator. One cheap
 * authenticated GET returning every queue the member may need to act on:
 * unread messages, incoming tool requests, approved loans awaiting the
 * borrower's pickup confirmation, active loans awaiting the owner's return
 * marking, and completed loans awaiting the member's vouch. Counts only —
 * no message content, aliases, or loan rows leave the server.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [unreadMessages, incomingRequests, awaitingPickup, awaitingReturn, awaitingVouch] =
    await Promise.all([
      prisma.message.count({ where: { toId: userId, read: false } }),
      prisma.loan.count({ where: { tool: { ownerId: userId }, status: "REQUESTED" } }),
      prisma.loan.count({ where: { borrowerId: userId, status: "APPROVED" } }),
      prisma.loan.count({ where: { tool: { ownerId: userId }, status: "ACTIVE" } }),
      prisma.loan.count({
        where: {
          status: "RETURNED",
          OR: [{ borrowerId: userId }, { tool: { ownerId: userId } }],
          vouches: { none: { voucherId: userId } },
        },
      }),
    ]);

  return NextResponse.json({
    counts: { unreadMessages, incomingRequests, awaitingPickup, awaitingReturn, awaitingVouch },
  });
}
