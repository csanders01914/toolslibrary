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
import { listCommands } from "./registry";
import type { Command, CommandContext } from "./types";

/**
 * !help / !faq — command list and basic platform info.
 */
export const helpCommand: Command = {
  name: "help",
  aliases: ["faq"],
  description: "Show the command list and basic platform info.",
  usage: "!help or !faq",
  async execute(ctx: CommandContext): Promise<void> {
    const commandLines = listCommands()
      .map((command) => {
        const aliasNote = command.aliases.length > 0 ? ` (or ${command.aliases.map((a) => `!${a}`).join(", ")})` : "";
        return `• ${command.usage}${aliasNote} — ${command.description}`;
      })
      .join("\n");

    const text = [
      "🛠 THE TOOLSLIBRARY — HELPDESK ASSISTANT",
      "",
      "COMMANDS",
      commandLines,
      "",
      "PLATFORM INFO",
      "• 100% free mutual-aid platform: borrow tools, trade skills.",
      "• Zero-PII: no email, no phone, no real names — just an alias.",
      "• Borrowing limit: 3 tools at a time.",
      "• Website: https://tools-library.com",
      "• Docs: https://tools-library.com (LeafWiki hub)",
      "",
      "Tip: plain questions work too — ask me things like \"how to borrow\" or \"reset password\" and I'll answer instantly. Anything I can't answer gets passed to the admin team.",
    ].join("\n");

    await replyToEvent(ctx.client, ctx.roomId, ctx.event, text);
  },
};
