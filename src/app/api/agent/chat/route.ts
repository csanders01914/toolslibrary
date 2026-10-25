import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { resolveLlm, type ChatMessage } from "@/lib/services/llm";
import { AGENT_SYSTEM_PROMPT, runAgentTurn } from "@/lib/agent/run";

/**
 * Admin agent chat endpoint. ADMIN-gated.
 * POST { messages: [{ role: "user"|"assistant", content }] } → runs one agent
 * turn with the full tool registry. Safe tools execute through the guardrail;
 * destructive tools are intercepted into the PENDING approval queue.
 */

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});

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

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation failed: ${parsed.error.errors[0].message}` },
      { status: 400 }
    );
  }

  const resolved = await resolveLlm();
  if (!resolved) {
    return NextResponse.json(
      { error: "No LLM configured. Set up a provider in LLM CONFIGURATION first." },
      { status: 409 }
    );
  }

  const history: ChatMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    ...parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })) as ChatMessage[],
  ];

  const turn = await runAgentTurn(resolved, history);
  if (!turn.ok) {
    return NextResponse.json({ error: turn.error }, { status: 502 });
  }

  return NextResponse.json({
    reply: turn.reply,
    toolCalls: turn.toolCalls,
  });
}
