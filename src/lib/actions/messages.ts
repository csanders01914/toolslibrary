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

"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";

const sendMessageSchema = z.object({
  toId: z.string().min(1, "Recipient is required"),
  content: z.string().min(1, "Message cannot be empty").max(1000, "Message too long (max 1000 characters)"),
});

const updateProfileSchema = z.object({
  alias: z.string().min(2, "Alias must be at least 2 characters").max(32, "Alias must be at most 32 characters"),
  bio: z.string().max(500, "Bio too long (max 500 characters)").optional().nullable(),
});

export async function sendMessage(
  prevState: { success?: boolean; error?: string; messageId?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const rawData = {
    toId: formData.get("toId"),
    content: formData.get("content"),
  };

  const parsed = sendMessageSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { toId, content } = parsed.data;

  if (toId === session.user.id) {
    return { success: false, error: "Cannot send message to yourself" };
  }

  const recipient = await prisma.user.findUnique({
    where: { id: toId },
    select: { id: true },
  });

  if (!recipient) {
    return { success: false, error: "Recipient not found" };
  }

  const message = await prisma.message.create({
    data: {
      content,
      fromId: session.user.id,
      toId,
    },
  });

  return { success: true, messageId: message.id };
}

export async function markThreadRead(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const partnerId = formData.get("partnerId") as string;
  if (!partnerId) {
    return { success: false, error: "Partner ID is required" };
  }

  await prisma.message.updateMany({
    where: {
      fromId: partnerId,
      toId: session.user.id,
      read: false,
    },
    data: { read: true },
  });

  return { success: true };
}

export async function updateProfile(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const rawData = {
    alias: formData.get("alias"),
    bio: formData.get("bio"),
  };

  const parsed = updateProfileSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { alias, bio } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { alias, bio },
  });

  return { success: true };
}

export async function getConversations(userId: string) {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ fromId: userId }, { toId: userId }],
    },
    include: {
      sender: { select: { id: true, alias: true, trustScore: true } },
      receiver: { select: { id: true, alias: true, trustScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const conversationMap = new Map<string, {
    partnerId: string;
    partnerAlias: string;
    partnerTrustScore: number;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
  }>();

  for (const msg of messages) {
    const isFromMe = msg.fromId === userId;
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

  return Array.from(conversationMap.values()).sort(
    (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );
}

export async function getMessages(userId: string, partnerId: string) {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromId: userId, toId: partnerId },
        { fromId: partnerId, toId: userId },
      ],
    },
    include: {
      sender: { select: { id: true, alias: true } },
      receiver: { select: { id: true, alias: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return messages;
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.message.count({
    where: {
      toId: userId,
      read: false,
    },
  });
  return count;
}

export async function getUserStats(userId: string) {
  const [toolsLent, activeBorrows, skillsOffered, trustScore, activeLoansAsOwner, activeLoansAsBorrower] = await Promise.all([
    prisma.tool.count({ where: { ownerId: userId } }),
    prisma.loan.count({ where: { borrowerId: userId, status: { in: ["APPROVED", "ACTIVE"] } } }),
    prisma.skill.count({ where: { ownerId: userId, available: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } }),
    prisma.loan.findMany({
      where: { tool: { ownerId: userId }, status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
      include: { tool: true, borrower: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loan.findMany({
      where: { borrowerId: userId, status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
      include: { tool: { include: { owner: { select: { id: true, alias: true } } } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  return {
    toolsLent,
    activeBorrows,
    skillsOffered,
    trustScore: trustScore?.trustScore ?? 100,
    activeLoansAsOwner,
    activeLoansAsBorrower,
  };
}