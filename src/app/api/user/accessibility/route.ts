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

const a11yPrefsSchema = z.object({
  contrast: z.enum(["normal", "high", "inverted", "monochrome"]),
  fontSize: z.enum(["100", "125", "150"]),
  dyslexic: z.boolean(),
  textSpacing: z.boolean(),
  focusIndicators: z.boolean(),
  reducedMotion: z.boolean(),
  bigCursor: z.boolean(),
  readingGuide: z.boolean(),
  underlineLinks: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { a11yPrefs: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let prefs = null;
  if (user.a11yPrefs) {
    try {
      prefs = JSON.parse(user.a11yPrefs);
    } catch {
      prefs = null;
    }
  }

  return NextResponse.json({ prefs });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = a11yPrefsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid accessibility preferences" }, { status: 400 });
    }

    // Anonymous JSON only: contains no PII, no identifiers, no free-form text.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { a11yPrefs: JSON.stringify(parsed.data) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save accessibility preferences:", error);
    return NextResponse.json(
      { error: "Failed to save accessibility preferences" },
      { status: 500 }
    );
  }
}
