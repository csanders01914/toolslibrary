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

import { evaluateMessage, type MessageSource } from "@/lib/triageEngine";

/**
 * Support channel resolver for the website.
 *
 * Forwards submissions to the standalone helpdesk assistant's webhook
 * (POST /api/web-support), which triages the message with the same
 * deterministic rules and — when a person is needed — delivers it to the
 * admin team room on the community Matrix server. If the assistant is
 * unreachable at runtime, the website falls back to its built-in engine
 * (identical rules and responses), so the help form never breaks.
 *
 * The bot's URL comes STRICTLY from the environment (BOT_WEBHOOK_URL) —
 * never a hardcoded localhost. In the multi-container Podman deployment this
 * is the bot container's DNS name on a shared user-defined network, e.g.
 * BOT_WEBHOOK_URL=http://helpbot:3005 (see DEPLOYMENT.md). A missing
 * configuration fails loudly instead of silently degrading.
 */

const WEBHOOK_TIMEOUT_MS = 5000;

export interface SupportVerdict {
  intent: string;
  replyText: string;
  needsAdmin: boolean;
}

interface WebhookResponse {
  success?: boolean;
  intent?: string;
  reply?: string;
  escalated?: boolean;
  error?: string;
}

export async function resolveSupportMessage(
  message: string,
  source: MessageSource,
  userIdentifier: string
): Promise<SupportVerdict> {
  // Strict guardrail: the bot URL must be provided by the environment — a
  // missing configuration throws instead of silently falling back to a
  // hardcoded localhost URL.
  const botUrl = process.env.BOT_WEBHOOK_URL;
  if (!botUrl) {
    throw new Error("BOT_WEBHOOK_URL is not configured.");
  }

  const webhookSecret = process.env.HELPDESK_WEBHOOK_SECRET;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhookSecret) {
      headers["X-Webhook-Secret"] = webhookSecret;
    }
    const response = await fetch(
      `${botUrl.replace(/\/+$/, "")}/api/web-support`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ userIdentifier, message }),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      const data = (await response.json()) as WebhookResponse;
      if (
        data.success &&
        typeof data.intent === "string" &&
        typeof data.reply === "string"
      ) {
        return {
          intent: data.intent,
          replyText: data.reply,
          needsAdmin: Boolean(data.escalated),
        };
      }
      console.error(
        `[support-channel] assistant rejected the submission: ${data.error ?? "unknown error"}`
      );
    } else {
      console.error(
        `[support-channel] assistant responded with status ${response.status}`
      );
    }
  } catch (error) {
    console.error(
      "[support-channel] assistant unreachable; using the built-in engine:",
      error instanceof Error ? error.message : error
    );
  }

  return evaluateMessage(message, source, userIdentifier);
}
