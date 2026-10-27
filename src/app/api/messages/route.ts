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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const sendMessageSchema = z.object({
  toId: z.string().min(1),
  content: z.string().min(1).max(1000),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partnerId");

  if (!partnerId) {
    // Thread index (messenger widget): one row per conversation partner with
    // the latest message snippet and the count of unread incoming messages.
    const recentMessages = await prisma.message.findMany({
      where: {
        OR: [{ fromId: session.user.id }, { toId: session.user.id }],
      },
      include: {
        sender: { select: { id: true, alias: true } },
        receiver: { select: { id: true, alias: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const threads = new Map<
      string,
      {
        partnerId: string;
        partnerAlias: string;
        lastMessage: string;
        lastMessageAt: Date;
        unreadCount: number;
      }
    >();

    for (const message of recentMessages) {
      const partner =
        message.fromId === session.user.id ? message.receiver : message.sender;
      const isIncoming = message.toId === session.user.id;
      const existing = threads.get(partner.id);
      if (!existing) {
        threads.set(partner.id, {
          partnerId: partner.id,
          partnerAlias: partner.alias,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: isIncoming && !message.read ? 1 : 0,
        });
      } else if (isIncoming && !message.read) {
        existing.unreadCount += 1;
      }
    }

    const threadList = Array.from(threads.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );

    return NextResponse.json({ threads: threadList });
  }

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromId: session.user.id, toId: partnerId },
        { fromId: partnerId, toId: session.user.id },
      ],
    },
    include: {
      sender: { select: { id: true, alias: true } },
      receiver: { select: { id: true, alias: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { toId, content } = parsed.data;

    if (toId === session.user.id) {
      return NextResponse.json({ error: "Cannot send message to yourself" }, { status: 400 });
    }

    const recipient = await prisma.user.findUnique({
      where: { id: toId },
      select: { id: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        content,
        fromId: session.user.id,
        toId,
      },
      include: {
        sender: { select: { id: true, alias: true } },
        receiver: { select: { id: true, alias: true } },
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}