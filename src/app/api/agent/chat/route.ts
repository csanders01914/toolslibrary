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

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { resolveLlm, type ChatMessage } from "@/lib/services/llm";
import { AGENT_SYSTEM_PROMPT, runAgentTurn } from "@/lib/agent/run";

/**
 * Admin operations chat endpoint. ADMIN-gated.
 * POST { messages: [{ role: "user"|"assistant", content }] } → runs one
 * automation turn with the full tool registry. Safe tools execute through the
 * guardrail; destructive tools are intercepted into the PENDING approval queue.
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
      { error: "No provider configured. Set up a provider in AUTOMATION CONFIGURATION first." },
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
