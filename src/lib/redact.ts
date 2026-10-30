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
 * Guest-browsing redaction helpers (GUEST_ALIAS_REDACTION).
 *
 * Guests (unauthenticated visitors) must not read member aliases or listing
 * availability; those values are masked with asterisks and rendered in red.
 * `redactText` preserves the source length so masked text keeps the original
 * layout footprint, and it is idempotent: masking an already-masked string
 * returns the same string, which lets server pages pre-redact alias payloads
 * while client components safely re-mask at render time.
 */
export function redactText(value: string): string {
  return "*".repeat(value.length);
}
