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
    return NextResponse.json({ error: "Partner ID required" }, { status: 400 });
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