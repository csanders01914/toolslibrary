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

import { config } from "./config";

/**
 * Room scope guard.
 *
 * The bot has a strict, minimal privacy footprint: it processes events ONLY in
 * the public Help Desk room and the private admin room. Every other invite is
 * rejected and every other room's events are ignored.
 */

export const HELP_DESK_ROOM_ID: string = config.helpDeskRoomId;
export const ADMIN_ROOM_ID: string = config.adminRoomId;

const ALLOWED_ROOM_IDS: ReadonlySet<string> = new Set<string>([
  HELP_DESK_ROOM_ID,
  ADMIN_ROOM_ID,
]);

export function isAllowedRoom(roomId: string): boolean {
  return ALLOWED_ROOM_IDS.has(roomId);
}

export function isHelpDeskRoom(roomId: string): boolean {
  return roomId === HELP_DESK_ROOM_ID;
}

export function isAdminRoom(roomId: string): boolean {
  return roomId === ADMIN_ROOM_ID;
}
