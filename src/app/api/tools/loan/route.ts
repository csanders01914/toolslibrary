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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const requestLoanSchema = z.object({
  toolId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { toolId, startDate, endDate } = parsed.data;

  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: { owner: true },
  });

  if (!tool) {
    return NextResponse.json({ success: false, error: "Tool not found" }, { status: 404 });
  }

  if (tool.ownerId === session.user.id) {
    return NextResponse.json({ success: false, error: "Cannot borrow your own tool" }, { status: 400 });
  }

  if (tool.status !== "AVAILABLE") {
    return NextResponse.json({ success: false, error: "Tool is not available for borrowing" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (start < now) {
    return NextResponse.json({ success: false, error: "Start date must be in the future" }, { status: 400 });
  }

  if (end <= start) {
    return NextResponse.json({ success: false, error: "End date must be after start date" }, { status: 400 });
  }

  const existingLoan = await prisma.loan.findFirst({
    where: {
      toolId,
      status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] },
    },
  });

  if (existingLoan) {
    return NextResponse.json({ success: false, error: "Tool already has a pending or active loan" }, { status: 400 });
  }

  await prisma.loan.create({
    data: {
      toolId,
      borrowerId: session.user.id,
      startDate: start,
      endDate: end,
      status: "REQUESTED",
    },
  });

  return NextResponse.json({ success: true });
}