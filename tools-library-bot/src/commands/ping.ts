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

import { replyToEvent } from "../matrix";
import type { Command, CommandContext } from "./types";

/**
 * !ping — continuity check kept from the original prototype.
 */
export const pingCommand: Command = {
  name: "ping",
  aliases: [],
  description: "Check that the assistant is online.",
  usage: "!ping",
  async execute(ctx: CommandContext): Promise<void> {
    await replyToEvent(ctx.client, ctx.roomId, ctx.event, "Pong! 🏓 Helpbot is online.");
  },
};
