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
import MessagesClient from "./MessagesClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { to } = await searchParams;

  const [messages, unreadCount, targetUser] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [{ fromId: session.user.id }, { toId: session.user.id }],
      },
      include: {
        sender: { select: { id: true, alias: true, trustScore: true } },
        receiver: { select: { id: true, alias: true, trustScore: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.count({
      where: { toId: session.user.id, read: false },
    }),
    to
      ? prisma.user.findUnique({
          where: { id: to },
          select: { id: true, alias: true, trustScore: true },
        })
      : Promise.resolve(null),
  ]);

  const conversationMap = new Map<string, {
    partnerId: string;
    partnerAlias: string;
    partnerTrustScore: number;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
  }>();

  for (const msg of messages) {
    const isFromMe = msg.fromId === session.user.id;
    const partnerId = isFromMe ? msg.toId : msg.fromId;
    const partner = isFromMe ? msg.receiver : msg.sender;

    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, {
        partnerId,
        partnerAlias: partner.alias,
        partnerTrustScore: partner.trustScore,
        lastMessage: msg.content,
        lastMessageTime: msg.createdAt,
        unreadCount: 0,
      });
    }

    if (!isFromMe && !msg.read) {
      const conv = conversationMap.get(partnerId)!;
      conv.unreadCount += 1;
    }
  }

  // Pre-select the ?to= target user even if no conversation exists yet
  if (targetUser && targetUser.id !== session.user.id && !conversationMap.has(targetUser.id)) {
    conversationMap.set(targetUser.id, {
      partnerId: targetUser.id,
      partnerAlias: targetUser.alias,
      partnerTrustScore: targetUser.trustScore,
      lastMessage: "No messages yet — say hello!",
      lastMessageTime: new Date(0),
      unreadCount: 0,
    });
  }

  const conversationList = Array.from(conversationMap.values()).sort(
    (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );

  return (
    <MessagesClient
      initialConversations={conversationList}
      currentUserId={session.user.id}
      unreadCount={unreadCount}
      initialPartnerId={targetUser?.id ?? null}
    />
  );
}