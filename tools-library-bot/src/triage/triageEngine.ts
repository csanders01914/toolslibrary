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

import type { MatrixClient } from "matrix-bot-sdk";
import { routeHelpRequest, type HelpIntent } from "./intentRouter";
import { botResponses } from "./responses";
import { forwardToAdmin, type ForwardSource } from "../matrix";

/**
 * Deterministic triage engine — the single routing brain for both channels
 * (the Matrix Help Desk room and the website webhook).
 *
 * 1. The regex intent router classifies the message.
 * 2. A keyword match resolves the message automatically with the scripted
 *    response for that intent.
 * 3. No keyword match (or a safety-critical match such as a moderation
 *    report, a missing tool, or a damaged tool) routes the message to the
 *    private admin room, formatted as HTML, exactly like the !support
 *    command.
 *
 * Classification is 100% deterministic: standard TypeScript string matching,
 * regular expressions, and logic gates. No text generation of any kind.
 */

export type MessageSource = "helpdesk" | "website";

export interface TriageResult {
  intent: HelpIntent;
  replyText: string;
  /** True when the scripted response fully answers the request. */
  autoResolved: boolean;
  /** True when the message was forwarded to the admin room. */
  escalated: boolean;
}

/** Keyword-matched intents that must ALSO reach the admin team. */
export const ESCALATION_INTENTS: ReadonlySet<HelpIntent> = new Set<HelpIntent>([
  "report_moderation",
  "missing_tool",
  "damaged_tool",
]);

/** Pure classification + scripted lookup. No I/O. */
export function evaluateMessage(userMessage: string): TriageResult {
  const intent = routeHelpRequest(userMessage);
  const replyText = botResponses[intent];
  const escalated = intent === "default_fallback" || ESCALATION_INTENTS.has(intent);
  return { intent, replyText, autoResolved: !escalated, escalated };
}

/**
 * Full inbound pipeline: triage, then forward to the admin room when the
 * message needs a person. The caller delivers `replyText` to the user.
 */
export async function routeInboundMessage(
  client: MatrixClient,
  source: MessageSource,
  userIdentifier: string,
  roomId: string | undefined,
  userMessage: string
): Promise<TriageResult> {
  const result = evaluateMessage(userMessage);

  if (result.escalated) {
    const delivered = await forwardToAdmin(client, {
      source: source === "helpdesk" ? "Help Desk (Matrix)" : "Website support form",
      userIdentifier,
      roomId,
      intent: result.intent,
      message: userMessage,
    });
    if (!delivered) {
      console.error(
        `[triage] escalation for intent "${result.intent}" could not be delivered to the admin room`
      );
    }
  }

  return result;
}
