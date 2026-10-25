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
