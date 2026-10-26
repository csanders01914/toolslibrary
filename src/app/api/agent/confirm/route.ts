import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { confirmAgentAction } from "@/lib/agent/tools";

/**
 * Guardrail confirmation endpoint. ADMIN-gated.
 * GET  → pending destructive actions + recent action audit trail.
 * POST { actionId, approve } → human-in-the-loop decision on a pending
 *                              destructive automated action.
 */

const confirmSchema = z.object({
  actionId: z.string().min(1),
  approve: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
  }

  const [pending, recent] = await Promise.all([
    prisma.agentAction.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.agentAction.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { decidedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ pending, recent });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation failed: ${parsed.error.errors[0].message}` },
      { status: 400 }
    );
  }

  const result = await confirmAgentAction(
    parsed.data.actionId,
    parsed.data.approve,
    session
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
