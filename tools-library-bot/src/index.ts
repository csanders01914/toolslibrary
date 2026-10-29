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

import { MatrixClient } from "matrix-bot-sdk";
import { config, validateConfig } from "./config";
import { isAllowedRoom, isAdminRoom } from "./rooms";
import { replyToEvent, type MinimalInboundEvent } from "./matrix";
import { executeCommand, parseCommand, type CommandContext } from "./commands/registry";
import { routeInboundMessage } from "./triage/triageEngine";
import { markConnected } from "./runtime";
import { startWebhook } from "./server/webhook";
import { getToolRepository } from "./data/toolRepository";

/**
 * The ToolsLibrary — standalone deterministic helpdesk assistant.
 *
 * Scope & privacy invariants:
 * - Events are processed ONLY in the public Help Desk room and the private
 *   admin room; every other invite is rejected (no auto-join mixin).
 * - Triage is 100% deterministic: regular expressions and scripted responses.
 *   No text generation, no external services beyond the Operator's own
 *   homeserver.
 * - User message bodies are never logged — not to the console, not to disk.
 *   The client keeps its sync state in memory only.
 */

interface InboundMessageEvent extends MinimalInboundEvent {
  type: "m.room.message";
}

/** Bounded in-memory guard against double-processing an event after a resync. */
const seenEventIds = new Set<string>();
const SEEN_EVENT_LIMIT = 500;

function markEventSeen(eventId: string): boolean {
  if (seenEventIds.has(eventId)) return false;
  if (seenEventIds.size >= SEEN_EVENT_LIMIT) {
    const oldest = seenEventIds.values().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  seenEventIds.add(eventId);
  return true;
}

async function handleMessage(
  client: MatrixClient,
  ownUserId: string,
  roomId: string,
  event: InboundMessageEvent
): Promise<void> {
  if (!isAllowedRoom(roomId)) return;
  if (!event.sender || event.sender === ownUserId) return;
  if (event.content?.msgtype !== "m.text") return;

  const body = (event.content.body ?? "").trim();
  if (body.length === 0) return;
  if (!markEventSeen(event.event_id)) return;

  const parsed = parseCommand(body);
  if (parsed) {
    const ctx: CommandContext = {
      client,
      roomId,
      sender: event.sender,
      eventId: event.event_id,
      args: parsed.args,
      event,
    };
    const handled = await executeCommand(ctx, parsed.name);
    if (!handled) {
      await replyToEvent(
        client,
        roomId,
        event,
        `Unknown command "!${parsed.name}". Try !help for the command list.`
      );
    }
    return;
  }

  // The private admin room is commands-only: never auto-triage the admin's
  // own chat, and never echo bot forwards back as new requests.
  if (isAdminRoom(roomId)) return;

  // Public Help Desk room: deterministic triage of plain messages.
  const triage = await routeInboundMessage(client, "helpdesk", event.sender, roomId, body);
  await replyToEvent(client, roomId, event, triage.replyText);
}

async function main(): Promise<void> {
  const problems = validateConfig();
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[config] ${problem}`);
    }
    process.exit(1);
  }

  const client = new MatrixClient(config.homeserverUrl, config.accessToken);
  const ownUserId = await client.getUserId();

  // Scope guard: join only allowlisted rooms; reject every other invite.
  client.on("room.invite", (roomId: string): void => {
    void (async (): Promise<void> => {
      try {
        if (isAllowedRoom(roomId)) {
          await client.joinRoom(roomId);
          console.log(`[rooms] joined allowed room ${roomId}`);
        } else {
          await client.leaveRoom(roomId);
          console.log(`[rooms] rejected invite to non-allowlisted room ${roomId}`);
        }
      } catch (error) {
        console.error(
          "[rooms] invite handling failed:",
          error instanceof Error ? error.message : error
        );
      }
    })();
  });

  client.on("room.message", (roomId: string, event: InboundMessageEvent): void => {
    void (async (): Promise<void> => {
      try {
        await handleMessage(client, ownUserId, roomId, event);
      } catch (error) {
        console.error(
          "[messages] handling failed:",
          error instanceof Error ? error.message : error
        );
      }
    })();
  });

  await client.start();
  markConnected();
  console.log(`[bot] connected to ${config.homeserverUrl} as ${ownUserId}`);
  console.log("[bot] scope: Help Desk + private admin room only; all other invites rejected");

  const webhookServer = startWebhook(client);

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("[bot] shutting down");
    void (async (): Promise<void> => {
      try {
        await getToolRepository().destroy();
      } catch (error) {
        console.error(
          "[bot] data-source shutdown error:",
          error instanceof Error ? error.message : error
        );
      }
      webhookServer.close(() => process.exit(0));
      // Force-exit if lingering connections hold the server open.
      setTimeout(() => process.exit(0), 3000).unref();
    })();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(
    "[bot] fatal startup error:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
