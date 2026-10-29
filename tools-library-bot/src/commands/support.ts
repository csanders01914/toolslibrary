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

import { forwardToAdmin, replyToEvent } from "../matrix";
import { isAdminRoom } from "../rooms";
import type { Command, CommandContext } from "./types";

/**
 * !support [message] — forward a message to the private admin room.
 *
 * The forward is a cleanly formatted HTML Matrix message containing the
 * sender's identity (Matrix ID plus display alias when resolvable), the room,
 * and the original message. The user always gets a confirmation reply.
 */
export const supportCommand: Command = {
  name: "support",
  aliases: [],
  description: "Forward a message to the admin team privately.",
  usage: "!support [message]",
  async execute(ctx: CommandContext): Promise<void> {
    const message = ctx.args.trim();
    if (message.length === 0) {
      await replyToEvent(
        ctx.client,
        ctx.roomId,
        ctx.event,
        "Usage: !support [message] — tell me what you need and I'll pass it to the admin team, e.g. !support the mower in the shed won't start"
      );
      return;
    }

    if (isAdminRoom(ctx.roomId)) {
      await replyToEvent(
        ctx.client,
        ctx.roomId,
        ctx.event,
        "You're already in the private admin room — just type your message here and someone will see it."
      );
      return;
    }

    // Best-effort display alias lookup; falls back to the raw Matrix ID.
    let userIdentifier = ctx.sender;
    try {
      const profile = await ctx.client.getUserProfile(ctx.sender);
      const displayname = (profile as { displayname?: unknown } | undefined)?.displayname;
      if (typeof displayname === "string" && displayname.trim().length > 0) {
        userIdentifier = `${ctx.sender} (${displayname.trim()})`;
      }
    } catch {
      // Profile lookup is optional; the Matrix ID alone identifies the sender.
    }

    const delivered = await forwardToAdmin(ctx.client, {
      source: "Help Desk (Matrix)",
      userIdentifier,
      roomId: ctx.roomId,
      message,
    });

    if (!delivered) {
      await replyToEvent(
        ctx.client,
        ctx.roomId,
        ctx.event,
        "I couldn't reach the admin room just now. Please try again in a moment, or post on the website's help page: https://tools-library.com/help"
      );
      return;
    }

    await replyToEvent(
      ctx.client,
      ctx.roomId,
      ctx.event,
      "✅ Your message was securely forwarded to the admin team. Someone will follow up in this room shortly."
    );
  },
};
