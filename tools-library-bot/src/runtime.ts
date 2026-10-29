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

/**
 * In-memory runtime state for the !status command.
 * Contains no user data — only connection facts.
 */

interface RuntimeState {
  /** Set once the homeserver sync loop is running. */
  connectedAt: Date | null;
  /** Set once the webhook HTTP listener is bound. */
  webhookPort: number | null;
}

const state: RuntimeState = {
  connectedAt: null,
  webhookPort: null,
};

export function markConnected(): void {
  state.connectedAt = new Date();
}

export function markWebhookListening(port: number): void {
  state.webhookPort = port;
}

export function getRuntimeState(): Readonly<RuntimeState> {
  return state;
}

/** Formats a duration as "2h 14m 03s". */
export function formatUptime(from: Date): string {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - from.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
