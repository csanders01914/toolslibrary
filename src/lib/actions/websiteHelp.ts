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

"use server";

import { resolveSupportMessage } from "@/lib/supportChannel";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";

/**
 * Website help-form channel of the deterministic support system.
 *
 * Called from the site's help form via a Server Action. The message is
 * classified by the regex intent router and answered with a pre-written
 * response. When BOT_WEBHOOK_URL is configured (required in production —
 * the Podman container DNS URL of the helpbot, e.g. http://helpbot:3005),
 * the submission is triaged by the standalone helpdesk assistant (which
 * also delivers escalations to the admin team room on the community Matrix
 * server); if the assistant is unreachable, the built-in engine answers and
 * escalations surface in the Admin Console help queue.
 */

export type WebsiteHelpResult = {
  success: boolean;
  intent: string;
  botReply: string;
  escalated: boolean;
  error?: string;
};

export async function handleWebsiteHelp(
  formData: FormData
): Promise<WebsiteHelpResult> {
  // Public, unauthenticated surface that can forward to the helpdesk
  // assistant (and from there to the admin Matrix room): throttle flooding
  // before any triage or webhook work (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("help");
  if (!limit.ok) {
    return {
      success: false,
      intent: "rate_limited",
      botReply: "",
      escalated: false,
      error: rateLimitMessage(limit.retryAfterSeconds),
    };
  }

  const message = String(formData.get("message") ?? "").trim();
  const alias = String(formData.get("alias") ?? "").trim() || "Guest";
  const threadId = formData.get("threadId");

  if (message.length === 0) {
    return {
      success: false,
      intent: "default_fallback",
      botReply: "",
      escalated: false,
      error: "Message cannot be empty.",
    };
  }

  const result = await resolveSupportMessage(message, "website", alias);

  // Integration point for the built-in messenger: when the help form is
  // embedded in an existing conversation (threadId present), persist the
  // automated reply into that thread so the exchange stays in the chat
  // history alongside the neighbor messages.
  //
  // if (threadId) {
  //   await prisma.message.create({
  //     data: {
  //       content: result.replyText,
  //       fromId: HELP_DESK_ACCOUNT_ID, // provisioned help desk account id
  //       toId: threadId,
  //     },
  //   });
  // }

  return {
    success: true,
    intent: result.intent,
    botReply: result.replyText,
    escalated: result.needsAdmin,
  };
}
