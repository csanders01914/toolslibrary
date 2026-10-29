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

import { routeHelpRequest, type HelpIntent } from "@/lib/intentRouter";
import { botResponses } from "@/lib/botResponses";
import { sendMatrixMessage } from "@/lib/matrix";

/**
 * Central support triage engine.
 *
 * Single entry point for both channels (website help form and the Matrix
 * long-polling listener). Classification is deterministic: the regex intent
 * router picks the key and the reply is looked up in the pre-written
 * response dictionary. Escalation intents additionally notify the admin
 * team room on the self-hosted Matrix server.
 */

export type MessageSource = "website" | "matrix";

export type TriageResult = {
  intent: HelpIntent;
  replyText: string;
  needsAdmin: boolean;
};

/** Intents that always require someone on the admin team to take a look. */
export const ESCALATION_INTENTS: readonly HelpIntent[] = [
  "report_moderation",
  "missing_tool",
  "damaged_tool",
  "default_fallback",
];

/**
 * Evaluates one inbound support message.
 *
 * 1. Classifies the message with the deterministic intent router.
 * 2. Looks up the fixed reply text for that intent.
 * 3. For escalation intents, forwards a summary (source, identifier,
 *    intent, and the original message) to the configured admin room.
 *
 * Returns the intent, the reply text, and whether the admin team is needed.
 */
export async function evaluateMessage(
  userMessage: string,
  source: MessageSource,
  userIdentifier: string
): Promise<TriageResult> {
  const intent = routeHelpRequest(userMessage);
  const replyText = botResponses[intent];
  const needsAdmin = ESCALATION_INTENTS.includes(intent);

  if (needsAdmin && process.env.MATRIX_ADMIN_ROOM_ID) {
    const alert = [
      "SUPPORT ESCALATION",
      `Source: ${source}`,
      `User: ${userIdentifier}`,
      `Intent: ${intent}`,
      `Message: ${userMessage}`,
    ].join("\n");

    const delivered = await sendMatrixMessage(process.env.MATRIX_ADMIN_ROOM_ID, alert);
    if (!delivered) {
      console.error(
        `[triage] escalation for intent "${intent}" could not be delivered to the admin room`
      );
    }
  }

  return { intent, replyText, needsAdmin };
}
