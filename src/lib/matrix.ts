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

import crypto from "node:crypto";

/**
 * Minimal Matrix Client-Server API client for the self-hosted Synapse server.
 *
 * Uses only native fetch and node:crypto — no Matrix SDK and no other
 * third-party package. Messages are plain "m.text" events sent with a
 * unique transaction id so Synapse can deduplicate retries.
 */

const REQUEST_TIMEOUT_MS = 15_000;

/** True when the homeserver URL and bot access token are both configured. */
export function isMatrixConfigured(): boolean {
  return Boolean(process.env.MATRIX_HOMESERVER_URL && process.env.MATRIX_BOT_ACCESS_TOKEN);
}

/**
 * Sends a plain-text message to a Matrix room.
 *
 * PUT /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}
 *
 * Returns true when Synapse accepted the event, false otherwise. Failures
 * are logged and never thrown so support flows can degrade gracefully.
 */
export async function sendMatrixMessage(
  roomId: string,
  message: string
): Promise<boolean> {
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const accessToken = process.env.MATRIX_BOT_ACCESS_TOKEN;

  if (!homeserverUrl || !accessToken) {
    console.error(
      "[matrix] MATRIX_HOMESERVER_URL / MATRIX_BOT_ACCESS_TOKEN are not configured; message not sent"
    );
    return false;
  }
  if (!roomId) {
    console.error("[matrix] sendMatrixMessage requires a roomId");
    return false;
  }

  const txnId = crypto.randomUUID();
  const url =
    `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}` +
    `/send/m.room.message/${encodeURIComponent(txnId)}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ msgtype: "m.text", body: message }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[matrix] message send rejected with status ${response.status}: ${detail.slice(0, 300)}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `[matrix] message send to room failed:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
