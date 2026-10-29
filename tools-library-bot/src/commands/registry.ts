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

import { pingCommand } from "./ping";
import { helpCommand } from "./help";
import { toolsCommand } from "./tools";
import { searchCommand } from "./search";
import { statusCommand } from "./status";
import { supportCommand } from "./support";
import type { Command, CommandContext } from "./types";

export type { Command, CommandContext } from "./types";

/**
 * Command registry and dispatcher for the Help Desk room.
 *
 * A message is a command when it starts with "!". The first token (case
 * insensitive) selects the command; everything after it is the argument
 * string. Unknown commands return false so the caller can hint at !help.
 */

const COMMANDS: readonly Command[] = [
  pingCommand,
  helpCommand,
  toolsCommand,
  searchCommand,
  statusCommand,
  supportCommand,
];

const REGISTRY: ReadonlyMap<string, Command> = (() => {
  const map = new Map<string, Command>();
  for (const command of COMMANDS) {
    map.set(command.name, command);
    for (const alias of command.aliases) {
      map.set(alias, command);
    }
  }
  return map;
})();

export function listCommands(): readonly Command[] {
  return COMMANDS;
}

export interface ParsedCommand {
  name: string;
  args: string;
}

/** Returns null when the text is not a !command. */
export function parseCommand(rawText: string): ParsedCommand | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("!")) return null;
  const withoutPrefix = trimmed.slice(1);
  const spaceIndex = withoutPrefix.indexOf(" ");
  const name = (spaceIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, spaceIndex))
    .trim()
    .toLowerCase();
  if (name.length === 0) return null;
  const args = spaceIndex === -1 ? "" : withoutPrefix.slice(spaceIndex + 1).trim();
  return { name, args };
}

/** Executes a parsed command; false when the name is not registered. */
export async function executeCommand(
  ctx: CommandContext,
  name: string
): Promise<boolean> {
  const command = REGISTRY.get(name);
  if (!command) return false;
  await command.execute(ctx);
  return true;
}
