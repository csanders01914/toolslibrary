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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Configuration for the standalone helpdesk assistant.
 *
 * Values come from the environment; a local `.env` file is loaded first with a
 * tiny deterministic parser (no dotenv dependency). The access token is the
 * only secret and is never logged or written anywhere.
 */

function loadEnvFile(path: string = ".env"): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), path), "utf8");
  } catch {
    return; // No .env file is fine — real environment variables still apply.
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

// Webhook listen port. Defaults to 3005 so the bot never collides with the
// Next.js server (port 3000) in a shared container namespace — the website
// reaches this webhook through Podman's internal DNS as http://helpbot:3005
// (see DEPLOYMENT.md), never through a hardcoded localhost URL.
const PORT = process.env.PORT || 3005;

export const config = {
  homeserverUrl: process.env.HOMESERVER_URL ?? "https://matrix.tools-library.com",
  accessToken: process.env.ACCESS_TOKEN ?? "",
  helpDeskRoomId:
    process.env.HELP_DESK_ROOM_ID ?? "!INow90Ytx7b84MEGWwWn7f03oh8gF6ovjImC1uVsBzc",
  adminRoomId:
    process.env.ADMIN_ROOM_ID ?? "!0bHz6weMUTvTjV9Y-VoNfklMKdXGuQ7Lv2NAje86Cv8",
  port: Number(PORT),
  /**
   * Optional shared secret for the website webhook. When set, callers must
   * send it in the X-Webhook-Secret header; requests without it are rejected
   * with 401. Leave empty only on fully trusted loopback-only setups.
   */
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
} as const;

/** Returns readable configuration problems; an empty array means valid. */
export function validateConfig(): string[] {
  const problems: string[] = [];
  if (!config.accessToken) {
    problems.push(
      "ACCESS_TOKEN is not set. Create a token for the helpbot account and put it in .env (see .env.example)."
    );
  }
  if (!/^https?:\/\//.test(config.homeserverUrl)) {
    problems.push("HOMESERVER_URL must start with http:// or https://");
  }
  if (!config.helpDeskRoomId.startsWith("!")) {
    problems.push("HELP_DESK_ROOM_ID must be an internal room ID starting with '!'");
  }
  if (!config.adminRoomId.startsWith("!")) {
    problems.push("ADMIN_ROOM_ID must be an internal room ID starting with '!'");
  }
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    problems.push("PORT must be an integer between 1 and 65535");
  }
  if (!process.env.DATABASE_URL) {
    problems.push(
      "DATABASE_URL is not set. Point it at the platform's SQLite volume so !tools, !search, and !status report live inventory (see .env.example)."
    );
  }
  return problems;
}
