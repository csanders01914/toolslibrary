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
 * Client-safe canary contract (PHASE_30_CANARY_SIGNING).
 *
 * Everything here is pure data: constants, public shapes, and pure functions
 * with NO Node built-in imports. This split exists because the client
 * components of the canary console (src/app/admin/canary/*) need the
 * constants and types, and importing them from src/lib/canary.ts would drag
 * node:crypto / the Prisma client into the browser bundle (webpack fails the
 * build on `node:` scheme imports in client graphs). Server-only logic —
 * signing, key sealing, database access — lives exclusively in
 * src/lib/canary.ts, which re-exports this module so server consumers can
 * keep importing from "@/lib/canary".
 */

/** A canary affirmation stays valid this many days before going STALE. */
export const CANARY_VALID_DAYS = 30;

/** Staged updates expire this many minutes after staging if not confirmed. */
export const CANARY_CONFIRM_TTL_MINUTES = 15;

/** Minimum length for the dedicated canary passphrase. */
export const CANARY_MIN_PASSPHRASE_LENGTH = 12;

/**
 * The four statements affirmed by every AFFIRM event, verbatim from the
 * transparency page. They are embedded in the signed canonical payload, so
 * changing this list invalidates every historical signature — treat it as
 * immutable and bump the payload header version if it ever changes.
 */
export const CANARY_STATEMENTS: readonly string[] = [
  "As of the date below, this service has received zero government or law-enforcement requests for user data.",
  "No gag orders, national security letters, or secret subpoenas have been served on the operators.",
  "No warrants, court orders, or informal requests have been received from any local, state, or federal agency.",
  "No backdoors, lawful-intercept hooks, or deliberate weaknesses have been introduced into this software.",
];

export type CanaryAction = "AFFIRM" | "DISCLOSE";
export type CanaryStatus = "NEVER_AFFIRMED" | "INTACT" | "STALE" | "DISCLOSED";

export interface CanaryEventPublic {
  id: string;
  seq: number;
  action: CanaryAction;
  note: string | null;
  committedAt: Date;
  expiresAt: Date | null;
  signature: string;
  publicKey: string;
  adminAlias: string;
  adminUsername: string;
}

export interface CanaryPendingPublic {
  action: CanaryAction;
  note: string | null;
  expiresAt: Date;
}

export interface CanaryState {
  status: CanaryStatus;
  latest: CanaryEventPublic | null;
  publicKey: string | null;
  pending: CanaryPendingPublic | null;
  hasPassphrase: boolean;
}

/**
 * Derive the public canary status from the latest committed event. Pure and
 * deterministic: null → NEVER_AFFIRMED, a disclosure → DISCLOSED (terminal,
 * regardless of age), an expired affirmation → STALE, otherwise INTACT.
 */
export function deriveCanaryStatus(
  latest: { action: string; expiresAt: Date | null } | null,
  now: Date = new Date()
): CanaryStatus {
  if (!latest) return "NEVER_AFFIRMED";
  if (latest.action === "DISCLOSE") return "DISCLOSED";
  // AFFIRM rows always carry an expiry (committedAt + CANARY_VALID_DAYS);
  // a null expiry on an AFFIRM row is treated as still-valid defensively.
  if (latest.expiresAt && latest.expiresAt.getTime() <= now.getTime()) {
    return "STALE";
  }
  return "INTACT";
}

/**
 * Build the canonical payload string for a canary event. This exact string
 * is what gets signed at commit time and what /transparency displays for
 * offline verification, so the format is a public contract:
 * - `toolslibrary-canary/v1` header line (bump the version if the format
 *   ever changes — historical signatures must stay verifiable);
 * - one `key: value` line per field, newline-separated, in fixed order;
 * - timestamps are ISO-8601 via toISOString() (always UTC, fixed width);
 * - null values render as `-`;
 * - AFFIRM payloads append a `statements:` section with each affirmed
 *   statement as a `- ` line; DISCLOSE payloads omit it (the note IS the
 *   statement).
 * Deterministic by construction — same input, byte-identical output — so a
 * third party can recompute the payload from the public event fields and
 * check the Ed25519 signature offline. Notes are single-line by validation
 * (the staging schema rejects CR/LF and control characters), so the
 * newline-delimited format cannot be spoofed from note content.
 */
export function buildCanonicalPayload(input: {
  action: CanaryAction;
  seq: number;
  committedAt: Date;
  expiresAt: Date | null;
  note: string | null;
}): string {
  const lines: string[] = [
    "toolslibrary-canary/v1",
    `action: ${input.action}`,
    `seq: ${input.seq}`,
    `committedAt: ${input.committedAt.toISOString()}`,
    `expiresAt: ${input.expiresAt ? input.expiresAt.toISOString() : "-"}`,
    `note: ${input.note ?? "-"}`,
  ];
  if (input.action === "AFFIRM") {
    lines.push("statements:");
    for (const statement of CANARY_STATEMENTS) {
      lines.push(`- ${statement}`);
    }
  }
  return lines.join("\n");
}
