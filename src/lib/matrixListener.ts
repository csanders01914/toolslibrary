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

import { sendMatrixMessage } from "@/lib/matrix";
import { evaluateMessage } from "@/lib/triageEngine";

/**
 * Matrix long-polling listener (self-hosted Synapse).
 *
 * A singleton background loop that keeps a /sync long-poll open against the
 * community Matrix server and answers support questions through the same
 * deterministic triage engine the website help form uses.
 *
 * Behavior:
 * - Runs at most once per server process (module-level guard).
 * - Performs an initial sync with timeout=0 so historical events are never
 *   re-processed after a server boot.
 * - Auto-joins rooms it is invited to and posts a welcome message.
 * - Answers messages that explicitly address the helper (a leading !help or
 *   an @mention of the bot user id). In public rooms, unmatched chatter is
 *   left alone so normal conversation is never interrupted.
 * - The admin team room is never echoed back into.
 */

let isListening = false;

const LONG_POLL_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 5_000;
const FETCH_TIMEOUT_MS = 15_000;

const WELCOME_MESSAGE = [
  "Hi! I'm the Tools-Library automated helper for this community server.",
  "I can answer questions about: passwords and recovery codes, account deletion, changing your alias, privacy and zero-PII, guest access, borrowing limits, handoffs and pickups, late returns, QR code labels, the Skills Exchange, managing listings, costs (there are none), consumables, meeting safety, tool safety, prohibited items, donations, supporting the server, and this Matrix server itself.",
  "Start your message with !help or mention me and I'll reply here. Anything I can't answer gets passed to the admin team.",
].join(" ");

type MatrixEvent = {
  type?: string;
  sender?: string;
  content?: { msgtype?: string; body?: string };
};

type MatrixSyncData = {
  next_batch?: string;
  rooms?: {
    invite?: Record<string, unknown>;
    join?: Record<string, { timeline?: { events?: MatrixEvent[] } }>;
  };
};

type SyncResult = { ok: boolean; data: MatrixSyncData | null };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSync(
  homeserverUrl: string,
  accessToken: string,
  timeoutMs: number,
  sinceToken: string | null
): Promise<SyncResult> {
  const params = new URLSearchParams({ timeout: String(timeoutMs) });
  if (sinceToken) {
    params.set("since", sinceToken);
  }

  try {
    const response = await fetch(
      `${homeserverUrl}/_matrix/client/v3/sync?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(timeoutMs + FETCH_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      console.error(`[matrix-listener] sync request failed with status ${response.status}`);
      return { ok: false, data: null };
    }
    const data = (await response.json()) as MatrixSyncData;
    return { ok: true, data };
  } catch (error) {
    console.error(
      "[matrix-listener] sync request error:",
      error instanceof Error ? error.message : error
    );
    return { ok: false, data: null };
  }
}

async function joinRoom(
  homeserverUrl: string,
  accessToken: string,
  roomId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      console.error(`[matrix-listener] failed to join room ${roomId} (status ${response.status})`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `[matrix-listener] error joining room ${roomId}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

async function runListenerLoop(): Promise<void> {
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const accessToken = process.env.MATRIX_BOT_ACCESS_TOKEN;
  const botUserId = process.env.MATRIX_BOT_USER_ID;
  const adminRoomId = process.env.MATRIX_ADMIN_ROOM_ID;

  if (!homeserverUrl || !accessToken || !botUserId) {
    console.error(
      "[matrix-listener] Matrix configuration incomplete (MATRIX_HOMESERVER_URL, MATRIX_BOT_USER_ID, MATRIX_BOT_ACCESS_TOKEN); listener not started"
    );
    isListening = false;
    return;
  }

  // Initial sync with timeout=0: grab next_batch so old history is not
  // re-processed when the server boots.
  const initial = await fetchSync(homeserverUrl, accessToken, 0, null);
  if (!initial.ok || !initial.data?.next_batch) {
    console.error("[matrix-listener] initial sync failed; listener not started");
    isListening = false;
    return;
  }
  let nextBatchToken: string = initial.data.next_batch;

  console.log("[matrix-listener] long-polling listener started");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const sync = await fetchSync(
        homeserverUrl,
        accessToken,
        LONG_POLL_TIMEOUT_MS,
        nextBatchToken
      );
      if (!sync.ok) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      if (sync.data?.next_batch) {
        nextBatchToken = sync.data.next_batch;
      }
      if (!sync.data) {
        continue;
      }

      // ---- Auto-join invites ----
      const invites = sync.data.rooms?.invite ?? {};
      for (const roomId of Object.keys(invites)) {
        const joined = await joinRoom(homeserverUrl, accessToken, roomId);
        if (joined) {
          await sendMatrixMessage(roomId, WELCOME_MESSAGE);
        }
      }

      // ---- Process joined-room messages ----
      const joinedRooms = sync.data.rooms?.join ?? {};
      for (const [roomId, room] of Object.entries(joinedRooms)) {
        // Never echo into the admin team room.
        if (adminRoomId && roomId === adminRoomId) {
          continue;
        }

        const events = room?.timeline?.events ?? [];
        for (const event of events) {
          if (event.type !== "m.room.message") continue;
          if (!event.sender || event.sender === botUserId) continue;
          if (event.content?.msgtype !== "m.text") continue;

          const rawText = event.content?.body;
          if (typeof rawText !== "string" || rawText.trim().length === 0) continue;

          const normalized = rawText.toLowerCase();
          const isExplicitTrigger =
            normalized.startsWith("!help") || rawText.includes(botUserId);

          const triage = await evaluateMessage(rawText, "matrix", event.sender);

          // In public rooms, ignore chatter that neither addresses the
          // helper nor matches a known intent, so normal conversation is
          // never interrupted.
          if (!isExplicitTrigger && triage.intent === "default_fallback") {
            continue;
          }

          await sendMatrixMessage(roomId, triage.replyText);
        }
      }
    } catch (error) {
      console.error(
        "[matrix-listener] sync cycle error:",
        error instanceof Error ? error.message : error
      );
      await delay(RETRY_DELAY_MS);
    }
  }
}

/**
 * Starts the Matrix listener exactly once per server process.
 * Safe to call repeatedly (e.g. from the instrumentation hook).
 */
export function startMatrixBotListener(): void {
  if (isListening) {
    return;
  }
  isListening = true;
  void runListenerLoop();
}
