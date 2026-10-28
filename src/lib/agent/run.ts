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

import {
  chatCompletion,
  type ChatMessage,
  type ResolvedLlm,
} from "@/lib/services/llm";
import {
  agentToolSchemas,
  guardedToolCall,
} from "@/lib/agent/tools";

/**
 * Shared automation turn runner: drives the tool-calling loop against the
 * configured endpoint. Safe tool calls execute immediately through the
 * guardrail; destructive calls come back as PENDING_APPROVAL records that the
 * model is informed about (it cannot bypass the human gate).
 */

export const AGENT_SYSTEM_PROMPT = [
  "You are the Tool Library Operations Agent — the autonomous operations layer of a zero-PII community tool lending and skills exchange.",
  "You can act on the platform through tools: queryDatabase (read-only), updateToolStatus, modifySkillListing, resolveHelpRequest.",
  "Destructive tools (banUserAlias, deleteTool, deleteSkill) are INTERCEPTED by a guardrail: your call is queued as PENDING and does nothing until a human administrator approves it. Call them only when clearly warranted, always stating the reason.",
  "Rules: never invent data — query first; keep answers terse and terminal-styled; never request or repeat credentials or PII; when a request involves safety, disputes, harassment, or anything you cannot verify, do not act — explain what needs human attention and leave the ticket for admin review.",
  "When you have finished acting, summarize exactly what you did (tool names + outcomes) in 1-4 short lines.",
].join(" ");

export type AgentToolCallRecord = {
  name: string;
  args: unknown;
  status: "EXECUTED" | "PENDING_APPROVAL" | "FAILED" | "ERROR";
  result?: unknown;
  error?: string;
  actionId?: string;
};

export type AgentTurnResult =
  | { ok: true; reply: string; toolCalls: AgentToolCallRecord[] }
  | { ok: false; error: string };

const MAX_TOOL_ITERATIONS = 4;

function parseToolCallArguments(raw: string): { ok: true; args: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, args: JSON.parse(raw || "{}") };
  } catch {
    // Models sometimes wrap arguments in prose/fences; extract the outermost object.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return { ok: true, args: JSON.parse(raw.slice(start, end + 1)) };
      } catch {
        return { ok: false, error: "Unparseable tool arguments" };
      }
    }
    return { ok: false, error: "Unparseable tool arguments" };
  }
}

/**
 * Runs one full automation turn (up to MAX_TOOL_ITERATIONS tool rounds)
 * against the resolved endpoint. `history` must already include the system
 * prompt and the conversation so far; the assistant reply is returned along
 * with a record of every tool call attempt for UI rendering and audit.
 */
export async function runAgentTurn(
  resolved: ResolvedLlm,
  history: ChatMessage[]
): Promise<AgentTurnResult> {
  const messages: ChatMessage[] = [...history];
  const toolCalls: AgentToolCallRecord[] = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const completion = await chatCompletion(resolved, messages, agentToolSchemas());
    if (!completion.ok) {
      return { ok: false, error: completion.error };
    }

    const assistant = completion.message;
    messages.push({
      role: "assistant",
      content: assistant.content ?? null,
      tool_calls: assistant.tool_calls,
    });

    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) {
      return {
        ok: true,
        reply: assistant.content?.trim() || "(no content)",
        toolCalls,
      };
    }

    for (const call of calls) {
      const parsedArgs = parseToolCallArguments(call.function.arguments);
      let outcome;
      if (!parsedArgs.ok) {
        outcome = { kind: "ERROR" as const, error: parsedArgs.error };
      } else {
        outcome = await guardedToolCall(call.function.name, parsedArgs.args);
      }

      if (outcome.kind === "EXECUTED") {
        toolCalls.push({
          name: call.function.name,
          args: parsedArgs.ok ? parsedArgs.args : call.function.arguments,
          status: "EXECUTED",
          result: outcome.result,
          actionId: outcome.actionId,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify({ status: "EXECUTED", result: outcome.result }),
        });
      } else if (outcome.kind === "PENDING_APPROVAL") {
        toolCalls.push({
          name: call.function.name,
          args: parsedArgs.ok ? parsedArgs.args : call.function.arguments,
          status: "PENDING_APPROVAL",
          actionId: outcome.actionId,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify({
            status: "PENDING_HUMAN_APPROVAL",
            actionId: outcome.actionId,
            note:
              "Guardrail intercepted this destructive call. It will only execute after an administrator approves it in the guardrail queue. Do not retry it.",
          }),
        });
      } else {
        toolCalls.push({
          name: call.function.name,
          args: parsedArgs.ok ? parsedArgs.args : call.function.arguments,
          status: outcome.kind === "ERROR" ? "ERROR" : "FAILED",
          error: outcome.error,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify({ status: "ERROR", error: outcome.error }),
        });
      }
    }
  }

  // Iteration budget exhausted — ask the model for a final summary without tools.
  const final = await chatCompletion(resolved, messages);
  if (!final.ok) {
    return { ok: false, error: final.error };
  }
  return {
    ok: true,
    reply: final.message.content?.trim() || "(tool iteration budget exhausted)",
    toolCalls,
  };
}
