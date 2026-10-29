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
import { config } from "../config";
import { getRuntimeState, formatUptime } from "../runtime";
import type { Command, CommandContext } from "./types";

/**
 * !status — server health, uptime, and data-source connection status.
 * Reports connection facts only; never any user message content.
 */
export const statusCommand: Command = {
  name: "status",
  aliases: [],
  description: "Show bot health, uptime, and data-source status.",
  usage: "!status",
  async execute(ctx: CommandContext): Promise<void> {
    const runtime = getRuntimeState();
    const dataHealth = await getToolRepository().health();
    const memory = process.memoryUsage();

    const lines = [
      "📊 SYSTEM STATUS",
      `• Bot uptime: ${runtime.connectedAt ? formatUptime(runtime.connectedAt) : "starting…"}`,
      `• Node.js: ${process.version}`,
      `• Memory (RSS): ${Math.round(memory.rss / 1024 / 1024)} MB`,
      `• Homeserver: ${config.homeserverUrl} — ${runtime.connectedAt ? "connected" : "connecting…"}`,
      `• Data source: platform database — ${dataHealth.connected ? `${dataHealth.toolCount} tools` : "unreachable"}`,
      `• Webhook: ${runtime.webhookPort !== null ? `listening on port ${runtime.webhookPort}` : "not started"}`,
    ];

    await replyToEvent(ctx.client, ctx.roomId, ctx.event, lines.join("\n"));
  },
};
