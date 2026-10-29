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

import { redirect } from "next/navigation";

/**
 * The Discord community lives on the existing Discord server, so this route
 * simply forwards to the current invite link — the single place the invite
 * URL is configured. Update the target here and every /discord-chat link
 * (footer and elsewhere) follows.
 */
export default function DiscordChatPage() {
  redirect("https://discord.gg/mw37N9DNum");
}
