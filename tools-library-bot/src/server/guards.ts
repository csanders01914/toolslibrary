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

import { timingSafeEqual } from "node:crypto";
import { config } from "../config";

/**
 * Webhook access control — deterministic, dependency-free guards.
 *
 * - Shared secret: when WEBHOOK_SECRET is configured, requests must carry it
 *   in the X-Webhook-Secret header. Comparison is timing-safe.
 * - Rate limit: a bounded in-memory window (per IP) caps how often the
 *   webhook will trigger triage and admin-room deliveries. No request bodies
 *   are ever recorded — only counts and timestamps.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_TRACKED_IPS = 1000;

/** Timing-safe secret check; returns false when no secret is configured (fail closed). */
export function isSecretValid(presented: unknown): boolean {
  const expected = config.webhookSecret;
  if (expected.length === 0) return false; // No secret configured: reject (fail closed).
  if (typeof presented !== "string" || presented.length === 0) return false;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(presented, "utf8");
  if (a.length !== b.length) {
    // Burn comparable time before rejecting to avoid length oracles.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Client identifier from request headers (SEC_REVIEW_MEDIUM_4_BOT_TRUST_PROXY):
 * `cf-connecting-ip` when a trusted edge provides it, otherwise the
 * LAST `x-forwarded-for` hop — the remote address the edge proxy itself
 * appended. Caddy (the production edge) APPENDS the real client address to
 * any client-supplied X-Forwarded-For, so earlier hops are attacker-
 * controlled and the previous first-hop derivation was spoofable; the last
 * hop is the only value the edge vouches for. With direct exposure (no
 * proxy headers) this returns the shared fail-safe "unknown" identity:
 * throttling still applies, just to one shared bucket.
 */
export function clientIdentifierFromHeaders(h: Record<string, string | string[] | undefined>): string {
  const cf = (h["cf-connecting-ip"] as string | undefined)?.trim();
  if (cf) return cf;
  const xff = h["x-forwarded-for"] as string | string[] | undefined;
  if (xff) {
    const xffStr = Array.isArray(xff) ? xff[0] : xff;
    const hops = xffStr
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return "unknown";
}

const hits = new Map<string, number[]>();

/** True when the IP is still within the allowed request budget. */
export function isRateAllowed(ip: string, now: number = Date.now()): boolean {
  if (hits.size >= MAX_TRACKED_IPS) {
    // Evict expired entries wholesale; keeps the map bounded without timers.
    for (const [key, stamps] of hits) {
      const live = stamps.filter((t) => now - t < WINDOW_MS);
      if (live.length === 0) hits.delete(key);
      else hits.set(key, live);
    }
    if (hits.size >= MAX_TRACKED_IPS) {
      const oldestKey = hits.keys().next().value;
      if (oldestKey !== undefined) hits.delete(oldestKey);
    }
  }

  const stamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(ip, stamps);
    return false;
  }
  stamps.push(now);
  hits.set(ip, stamps);
  return true;
}
