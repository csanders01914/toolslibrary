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
import { ADMIN_ROOM_ID, HELP_DESK_ROOM_ID } from "./rooms";

/**
 * Outgoing message helpers.
 *
 * All user-authored content is HTML-escaped before it is placed into a
 * formatted_body, so a support message can never inject markup into the admin
 * room. Plain-text `body` fallbacks are always provided alongside HTML.
 */

export interface OutgoingContent {
  msgtype: "m.text" | "m.notice";
  body: string;
  format?: "org.matrix.custom.html";
  formatted_body?: string;
  "m.relates_to"?: {
    "m.in_reply_to": { event_id: string };
  };
}

export interface MinimalInboundEvent {
  type: string;
  sender: string;
  event_id: string;
  content?: { msgtype?: string; body?: string };
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function htmlWithLineBreaks(input: string): string {
  return escapeHtml(input).replace(/\r?\n/g, "<br />");
}

export async function sendPlainText(
  client: MatrixClient,
  roomId: string,
  text: string,
  asNotice: boolean = false
): Promise<void> {
  const content: OutgoingContent = { msgtype: asNotice ? "m.notice" : "m.text", body: text };
  await client.sendMessage(roomId, content as unknown as Record<string, unknown>);
}

export async function sendHtmlText(
  client: MatrixClient,
  roomId: string,
  text: string,
  html: string
): Promise<void> {
  const content: OutgoingContent = {
    msgtype: "m.text",
    body: text,
    format: "org.matrix.custom.html",
    formatted_body: html,
  };
  await client.sendMessage(roomId, content as unknown as Record<string, unknown>);
}

/** Replies to a specific event with a standard in-reply-to fallback body. */
export async function replyToEvent(
  client: MatrixClient,
  roomId: string,
  event: MinimalInboundEvent,
  text: string,
  html?: string
): Promise<void> {
  const quoted = event.content?.body ?? "";
  const fallbackBody = quoted
    ? `> <${event.sender}> ${quoted.split(/\r?\n/).join("\n> ")}\n\n${text}`
    : text;

  const content: OutgoingContent = {
    msgtype: "m.text",
    body: fallbackBody,
    "m.relates_to": { "m.in_reply_to": { event_id: event.event_id } },
  };
  if (html) {
    content.format = "org.matrix.custom.html";
    const quotedHtml = quoted ? htmlWithLineBreaks(quoted) : "";
    content.formatted_body =
      `<mx-reply><blockquote><a href="https://matrix.to/#/${encodeURIComponent(roomId)}/${encodeURIComponent(event.event_id)}">In reply to</a> ` +
      `<a href="https://matrix.to/#/${encodeURIComponent(event.sender)}">${escapeHtml(event.sender)}</a>` +
      (quotedHtml ? `<br />${quotedHtml}` : "") +
      `</blockquote></mx-reply>${html}`;
  }

  await client.sendMessage(roomId, content as unknown as Record<string, unknown>);
}

// ----------------------------------------------------------------
// Admin forwarding
// ----------------------------------------------------------------

export type ForwardSource = "Help Desk (Matrix)" | "Website support form";

export interface AdminForward {
  source: ForwardSource;
  userIdentifier: string;
  /** Present for Matrix-originated requests; absent for website ones. */
  roomId?: string;
  intent?: string;
  message: string;
}

export function buildForwardContent(fwd: AdminForward): { text: string; html: string } {
  const lines: string[] = ["SUPPORT REQUEST", `Source: ${fwd.source}`];
  const htmlRows: string[] = [];

  lines.push(`From: ${fwd.userIdentifier}`);
  htmlRows.push(`<b>From:</b> ${escapeHtml(fwd.userIdentifier)}`);

  if (fwd.roomId) {
    const label = fwd.roomId === HELP_DESK_ROOM_ID ? "public Help Desk" : fwd.roomId;
    lines.push(`Room: ${label}`);
    htmlRows.push(`<b>Room:</b> ${escapeHtml(label)}`);
  }

  if (fwd.intent) {
    lines.push(`Detected intent: ${fwd.intent}`);
    htmlRows.push(`<b>Detected intent:</b> ${escapeHtml(fwd.intent)}`);
  }

  lines.push("", "Message:", fwd.message);
  const text = lines.join("\n");

  const html =
    `<h4>🔔 Support Request</h4>` +
    `<p>${htmlRows.map((row) => `<span>${row}</span>`).join("<br />")}</p>` +
    `<p><b>Message:</b></p><blockquote>${htmlWithLineBreaks(fwd.message)}</blockquote>`;

  return { text, html };
}

/** Sends a formatted HTML support request to the private admin room. */
export async function forwardToAdmin(
  client: MatrixClient,
  fwd: AdminForward
): Promise<boolean> {
  const { text, html } = buildForwardContent(fwd);
  try {
    const content: OutgoingContent = {
      msgtype: "m.text",
      body: text,
      format: "org.matrix.custom.html",
      formatted_body: html,
    };
    await client.sendMessage(ADMIN_ROOM_ID, content as unknown as Record<string, unknown>);
    return true;
  } catch (error) {
    console.error(
      "[forward] could not reach the admin room:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
