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
 * Secret-link image publishing helpers.
 *
 * A PublishedImage is reachable ONLY at /i/<token>, where the token is a
 * 256-bit CSPRNG hex slug. The token is the entire access model: it is never
 * listed publicly, never included in the sitemap, and the serving route
 * responds with nothing but the raw image bytes. These helpers are the single
 * source of truth for the token's shape so the generator and every validator
 * (serving route, dashboard lookups) cannot drift apart.
 */

import crypto from "node:crypto";

/** Token length in hex characters (32 random bytes = 64 hex chars). */
const TOKEN_HEX_LENGTH = 64;

const TOKEN_PATTERN = new RegExp(`^[a-f0-9]{${TOKEN_HEX_LENGTH}}$`);

/**
 * Generates the unguessable secret URL slug for a published image:
 * 32 bytes from the OS CSPRNG, hex-encoded. A 2^256 keyspace makes
 * enumeration and collision probing impractical.
 */
export function generateImageToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Strict shape check for a candidate token. Rejects anything that is not
 * exactly 64 lowercase hex characters so malformed requests are refused
 * before touching the database.
 */
export function isValidImageToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
