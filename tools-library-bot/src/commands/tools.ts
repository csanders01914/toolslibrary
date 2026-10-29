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
import {
  getToolRepository,
  TOOL_CATEGORIES,
  type ToolCategory,
} from "../data/toolRepository";
import type { Command, CommandContext } from "./types";

/**
 * !tools [category] — formatted list of available inventory.
 * With no argument, lists the categories with counts.
 */

function resolveCategory(input: string): ToolCategory | null {
  const needle = input.trim().toLowerCase();
  if (needle.length === 0) return null;
  return (
    TOOL_CATEGORIES.find((category) => category.toLowerCase() === needle) ??
    TOOL_CATEGORIES.find((category) => category.toLowerCase().includes(needle)) ??
    null
  );
}

export const toolsCommand: Command = {
  name: "tools",
  aliases: [],
  description: "List available tools, optionally filtered by category.",
  usage: "!tools [category]",
  async execute(ctx: CommandContext): Promise<void> {
    try {
      if (ctx.args.length === 0) {
        const counts = await getToolRepository().countByCategory();
        const lines = TOOL_CATEGORIES.map(
          (category) => `• ${category} (${counts.get(category) ?? 0} listed)`
        );
        const text = [
          "🧰 INVENTORY CATEGORIES",
          ...lines,
          "",
          "Use !tools <category> to see what's available — e.g. !tools hand tools",
        ].join("\n");
        await replyToEvent(ctx.client, ctx.roomId, ctx.event, text);
        return;
      }

      const category = resolveCategory(ctx.args);
      if (category === null) {
        const text = [
          `I couldn't match a category to "${ctx.args}".`,
          "",
          "Valid categories:",
          ...TOOL_CATEGORIES.map((c) => `• ${c}`),
        ].join("\n");
        await replyToEvent(ctx.client, ctx.roomId, ctx.event, text);
        return;
      }

      const available = await getToolRepository().listAvailable(category);
      if (available.length === 0) {
        await replyToEvent(
          ctx.client,
          ctx.roomId,
          ctx.event,
          `Nothing in "${category}" is available right now — check back soon, or use !search to look for something specific.`
        );
        return;
      }

      const lines = available.map((tool) => `• ${tool.name} — ${tool.description} (owner: ${tool.ownerAlias})`);
      const text = [
        `🧰 AVAILABLE — ${category.toUpperCase()} (${available.length})`,
        ...lines,
        "",
        "To borrow, register at https://tools-library.com and request the item from its listing page.",
      ].join("\n");
      await replyToEvent(ctx.client, ctx.roomId, ctx.event, text);
    } catch (error) {
      console.error(
        "[tools] inventory query failed:",
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
