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
import { getToolRepository } from "../data/toolRepository";
import type { Command, CommandContext } from "./types";

/**
 * !search [keyword] — inventory search.
 * Case-insensitive substring match across tool names and descriptions.
 */

const MAX_RESULTS = 10;

export const searchCommand: Command = {
  name: "search",
  aliases: [],
  description: "Search the inventory for a keyword.",
  usage: "!search [keyword]",
  async execute(ctx: CommandContext): Promise<void> {
    const keyword = ctx.args.trim();
    if (keyword.length < 2) {
      await replyToEvent(
        ctx.client,
        ctx.roomId,
        ctx.event,
        "Usage: !search [keyword] — give me at least 2 characters to look for, e.g. !search drill"
      );
      return;
    }

    try {
      const matches = await getToolRepository().search(keyword);
      if (matches.length === 0) {
        await replyToEvent(
          ctx.client,
          ctx.roomId,
          ctx.event,
          `No inventory items matched "${keyword}". Try a shorter or broader keyword, or use !tools to browse categories.`
        );
        return;
      }

      const shown = matches.slice(0, MAX_RESULTS);
      const lines = shown.map(
        (tool) => `• ${tool.name} [${tool.category}] — ${tool.status} — ${tool.description} (owner: ${tool.ownerAlias})`
      );
      const truncatedNote =
        matches.length > MAX_RESULTS ? `\n…and ${matches.length - MAX_RESULTS} more — narrow your keyword to see them all.` : "";

      const text = [
        `🔎 SEARCH RESULTS for "${keyword}" (${matches.length} match${matches.length === 1 ? "" : "es"})`,
        ...lines,
        truncatedNote,
        "",
        "To borrow, register at https://tools-library.com and request the item from its listing page.",
      ].join("\n");

      await replyToEvent(ctx.client, ctx.roomId, ctx.event, text);
    } catch (error) {
      console.error(
        "[search] inventory query failed:",
        error instanceof Error ? error.message : error
      );
      await replyToEvent(
        ctx.client,
        ctx.roomId,
        ctx.event,
        "The inventory is temporarily unavailable. Please try again shortly."
      );
    }
  },
};
