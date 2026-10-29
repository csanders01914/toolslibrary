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

import crypto from "node:crypto";

import { hashClient } from "@/lib/rateLimit";

/**
 * Generalized proof-of-work access gateway shared by every protected surface:
 * the community chat token page, account creation, and the help-triage form.
 *
 * Stateless, zero-dependency design:
 * - Challenges are HMAC-SHA256 signed with a random per-process key (same
 *   pattern as the rate limiter's SALT), so no challenge storage is needed.
 *   Verification recomputes the signature and compares in constant time.
 * - Every challenge is bound to a surface ("chat", "register", or "help"):
 *   a challenge issued for one surface can never be spent on another, so a
 *   solve obtained from a lenient gate cannot be replayed against a stricter
 *   one. The surface lives inside the signed payload and is checked after
 *   the signature and client binding.
 * - Consumed challenge ids (jtis) are tracked in process memory only and
 *   pruned once past their expiry, so a solved challenge can never be
 *   replayed to mint extra tokens or create extra accounts. Each challenge
 *   is also bound to the hashed client it was issued to, so challenges
 *   cannot be stockpiled by one client and spent by another.
 * - Difficulty scales with how suspicious recent request traffic from the
 *   client looks, scored per surface. Client identifiers are hashed with
 *   the same per-process salt as the rate limiter; the raw identifier is
 *   never stored or logged.
 * - Nothing here touches the database and nothing persists across restarts.
 */

const CHALLENGE_VERSION = 1;
const NONCE_BYTES = 32;
// Base TTL covers tiers 0-1 (16-20 bits: seconds to about a minute of
// browser work). Elevated tiers get a proportionally longer window so a
// legitimate but slow device can still finish inside it — a challenge that
// reliably expires before it can be solved would self-perpetuate a lockout.
const BASE_TTL_MS = 10 * 60 * 1000;
const ELEVATED_TTL_MS = 30 * 60 * 1000;

function challengeTtlMs(difficulty: number): number {
  return difficulty >= 22 ? ELEVATED_TTL_MS : BASE_TTL_MS;
}

/** Surfaces protected by the proof-of-work gate. */
export const POW_SURFACES = ["chat", "register", "help"] as const;

export type PowSurface = (typeof POW_SURFACES)[number];

/** Allowlist guard used by the challenge endpoint (unknown surface → 404). */
export function isPowSurface(value: unknown): value is PowSurface {
  return (
    typeof value === "string" &&
    (POW_SURFACES as readonly string[]).includes(value)
  );
}

// Random per-process HMAC key: signed challenges are unlinkable across
// restarts and unverifiable by any other process.
const HMAC_KEY = crypto.randomBytes(32);

interface ChallengePayload {
  v: number;
  jti: string;
  exp: number;
  diff: number;
  nonce: string;
  /** Hashed client identifier this challenge was issued to. */
  c: string;
  /** Surface this challenge was issued for — spent only on that surface. */
  s: PowSurface;
}

export interface IssuedChallenge {
  challenge: string;
  difficulty: number;
  algorithm: "sha256";
  expiresInSeconds: number;
}

export type SolutionVerdict =
  | { ok: true }
  | { ok: false; reason: "expired" | "replayed" | "signature" | "solution" };

// ---------------------------------------------------------------------------
// Challenge signing
// ---------------------------------------------------------------------------

function encodeBase64Url(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}

function signBase64Url(payloadB64: string): string {
  return crypto.createHmac("sha256", HMAC_KEY).update(payloadB64).digest("base64url");
}

/**
 * Issues a signed, stateless proof-of-work challenge for `surface` requiring
 * `difficulty` leading zero bits of SHA-256 work. The challenge is bound to
 * `clientHash` (the salted hashed client identifier) so it can only be
 * redeemed by the client it was issued to, and to `surface` so it can only
 * be spent on the gate that issued it.
 */
export function issueChallenge(
  surface: PowSurface,
  difficulty: number,
  clientHash: string
): IssuedChallenge {
  const ttlMs = challengeTtlMs(difficulty);
  const payload: ChallengePayload = {
    v: CHALLENGE_VERSION,
    jti: crypto.randomUUID(),
    exp: Date.now() + ttlMs,
    diff: difficulty,
    nonce: crypto.randomBytes(NONCE_BYTES).toString("hex"),
    c: clientHash,
    s: surface,
  };
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const signatureB64 = signBase64Url(payloadB64);
  return {
    challenge: `${payloadB64}.${signatureB64}`,
    difficulty,
    algorithm: "sha256",
    expiresInSeconds: Math.round(ttlMs / 1000),
  };
}

/**
 * Counts the leading zero bits of a hex digest string: each '0' hex char is
 * four zero bits, and the first non-zero digit contributes its partial nibble
 * (1 → 3 bits, 2-3 → 2 bits, 4-7 → 1 bit, 8-F → 0 bits).
 */
function leadingZeroBits(hexDigest: string): number {
  let bits = 0;
  for (let i = 0; i < hexDigest.length; i += 1) {
    const value = Number.parseInt(hexDigest[i], 16);
    if (Number.isNaN(value)) return bits;
    if (value === 0) {
      bits += 4;
      continue;
    }
    if (value < 2) bits += 3;
    else if (value < 4) bits += 2;
    else if (value < 8) bits += 1;
    break;
  }
  return bits;
}

function meetsDifficulty(input: string, difficulty: number): boolean {
  const digest = crypto.createHash("sha256").update(input).digest("hex");
  return leadingZeroBits(digest) >= difficulty;
}

function isChallengePayload(value: unknown): value is ChallengePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === CHALLENGE_VERSION &&
    typeof candidate.jti === "string" &&
    candidate.jti.length > 0 &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp) &&
    typeof candidate.diff === "number" &&
    Number.isInteger(candidate.diff) &&
    candidate.diff >= 0 &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length > 0 &&
    typeof candidate.c === "string" &&
    candidate.c.length > 0 &&
    isPowSurface(candidate.s)
  );
}

// Consumed challenge ids: in-memory only, keyed by jti with the challenge
// expiry so entries can be pruned once they can no longer be replayed (an
// expired challenge is rejected before the replay check ever runs).
const usedJtis = new Map<string, number>();
const JTI_SWEEP_INTERVAL_MS = 60 * 1000;
let lastJtiSweep = Date.now();

function sweepUsedJtis(now: number): void {
  if (now - lastJtiSweep < JTI_SWEEP_INTERVAL_MS) return;
  lastJtiSweep = now;
  for (const [jti, exp] of usedJtis) {
    if (exp < now) usedJtis.delete(jti);
  }
}

/**
 * Verifies a proof-of-work solution against a signed challenge for
 * `surface`. Never throws on malformed input — every failure path returns a
 * structured reason.
 *
 * Order of checks: signature (constant-time) → client binding → surface →
 * expiry → replay → solution. The jti is consumed only after every check
 * passes, BEFORE the protected action runs — so every account creation,
 * help triage, or token mint attempt, including one that fails on invalid
 * credentials, costs a fresh proof of work.
 */
export function verifySolution(
  surface: PowSurface,
  challenge: unknown,
  counter: unknown,
  clientHash: string
): SolutionVerdict {
  if (typeof challenge !== "string") return { ok: false, reason: "signature" };
  const separator = challenge.indexOf(".");
  if (separator <= 0 || separator === challenge.length - 1) {
    return { ok: false, reason: "signature" };
  }
  if (
    typeof counter !== "number" ||
    !Number.isInteger(counter) ||
    counter < 0 ||
    counter > Number.MAX_SAFE_INTEGER
  ) {
    return { ok: false, reason: "solution" };
  }

  const payloadB64 = challenge.slice(0, separator);
  const signatureB64 = challenge.slice(separator + 1);

  const expectedSignature = crypto.createHmac("sha256", HMAC_KEY).update(payloadB64).digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(signatureB64, "base64url");
  } catch {
    return { ok: false, reason: "signature" };
  }
  if (
    receivedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return { ok: false, reason: "signature" };
  }

  let payload: ChallengePayload;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!isChallengePayload(decoded)) return { ok: false, reason: "signature" };
    payload = decoded;
  } catch {
    return { ok: false, reason: "signature" };
  }

  // Client binding: the signed payload names the hashed client this challenge
  // was issued to. Constant-time compare (lengths are fixed 64-char hashes,
  // but guard anyway because timingSafeEqual throws on length mismatch).
  const boundClient = Buffer.from(payload.c, "utf8");
  const expectedClient = Buffer.from(clientHash, "utf8");
  if (
    boundClient.length !== expectedClient.length ||
    !crypto.timingSafeEqual(boundClient, expectedClient)
  ) {
    return { ok: false, reason: "signature" };
  }

  // Surface binding: a challenge issued for one surface can never be spent
  // on another. The surface is part of the signed payload, so this is not
  // spoofable — a mismatched surface is treated as an invalid challenge.
  if (payload.s !== surface) return { ok: false, reason: "signature" };

  const now = Date.now();
  if (now > payload.exp) return { ok: false, reason: "expired" };

  sweepUsedJtis(now);
  if (usedJtis.has(payload.jti)) return { ok: false, reason: "replayed" };

  if (!meetsDifficulty(`${payload.nonce}:${counter}`, payload.diff)) {
    return { ok: false, reason: "solution" };
  }

  usedJtis.set(payload.jti, payload.exp);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Traffic suspicion scoring
// ---------------------------------------------------------------------------

interface SuspicionState {
  challenges: number[];
  failures: number[];
  updatedAt: number;
}

// Keyed by `${surface}:${hashedClient}` — suspicion is scored per surface so
// heavy traffic on one gate does not harden every other gate for that client.
// Entries live in process memory only and are swept when idle.
const suspicion = new Map<string, SuspicionState>();
const SUSPICION_WINDOW_MS = 15 * 60 * 1000;
const SUSPICION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
// Hard global cap: if the proxy header is ever spoofable (direct exposure
// bypassing the trusted tunnel), a flood of unique client identifiers must
// not grow this Map without bound. Oldest-inserted entries are evicted;
// idle entries are already swept on the interval above.
const MAX_SUSPICION_ENTRIES = 10_000;
// Upper bound per counter per client: every tier threshold saturates far
// below this, so capping preserves scoring while bounding memory under a
// flood of requests from a single client.
const MAX_TRACKED_EVENTS = 100;
let lastSuspicionSweep = Date.now();

function pruneEvents(events: number[], now: number): number[] {
  const cutoff = now - SUSPICION_WINDOW_MS;
  let firstAlive = 0;
  while (firstAlive < events.length && events[firstAlive] <= cutoff) firstAlive += 1;
  return firstAlive > 0 ? events.slice(firstAlive) : events;
}

function sweepSuspicion(now: number): void {
  if (now - lastSuspicionSweep < SUSPICION_SWEEP_INTERVAL_MS) return;
  lastSuspicionSweep = now;
  for (const [key, state] of suspicion) {
    if (now - state.updatedAt > SUSPICION_WINDOW_MS) suspicion.delete(key);
  }
}

function suspicionKey(surface: PowSurface, clientHash: string): string {
  return `${surface}:${clientHash}`;
}

function recordEvent(
  kind: "challenges" | "failures",
  surface: PowSurface,
  clientHash: string
): void {
  const now = Date.now();
  sweepSuspicion(now);
  const key = suspicionKey(surface, clientHash);
  let state = suspicion.get(key);
  if (!state) {
    state = { challenges: [], failures: [], updatedAt: now };
    suspicion.set(key, state);
  }
  state[kind] = pruneEvents(state[kind], now);
  state[kind].push(now);
  if (state[kind].length > MAX_TRACKED_EVENTS) state[kind].shift();
  state.updatedAt = now;

  if (suspicion.size > MAX_SUSPICION_ENTRIES) {
    const oldest = suspicion.keys().next().value;
    if (oldest !== undefined && oldest !== key) suspicion.delete(oldest);
  }
}

/** Records one proof-of-work challenge issued to this client for `surface`. */
export function recordChallenge(surface: PowSurface, clientHash: string): void {
  recordEvent("challenges", surface, clientHash);
}

/** Records one failed verification or credential attempt on `surface`. */
export function recordFailure(surface: PowSurface, clientHash: string): void {
  recordEvent("failures", surface, clientHash);
}

/**
 * Suspicion tier 0..3 over a 15-minute sliding window, scored per surface:
 * - tier 0: fewer than 5 challenges and no failures (ordinary traffic)
 * - tier 1: fewer than 10 challenges, or at most 2 failures
 * - tier 2: fewer than 20 challenges, or at most 5 failures
 * - tier 3: otherwise (sustained volume or repeated failures)
 */
export function suspicionTier(
  surface: PowSurface,
  clientHash: string
): 0 | 1 | 2 | 3 {
  const now = Date.now();
  const state = suspicion.get(suspicionKey(surface, clientHash));
  const challengeCount = state ? pruneEvents(state.challenges, now).length : 0;
  const failureCount = state ? pruneEvents(state.failures, now).length : 0;

  if (challengeCount < 5 && failureCount === 0) return 0;
  if (challengeCount < 10 || failureCount <= 2) return 1;
  if (challengeCount < 20 || failureCount <= 5) return 2;
  return 3;
}

// Browser-solvable ladder: 24 bits ≈ 2^24 ≈ 16.7M expected hashes, roughly
// 1.5–5 minutes of WebCrypto work on a modest device — inside the elevated
// 30-minute TTL with margin. Higher tiers (26+) would routinely outlive any
// reasonable TTL and lock flagged clients out entirely, so the ladder stops
// at 24; the rate limiter remains the hard cap on attempt volume.
const TIER_DIFFICULTY_BITS = [16, 20, 22, 24] as const;

/** Maps a suspicion tier to the required leading-zero-bit difficulty. */
export function difficultyForTier(tier: 0 | 1 | 2 | 3): number {
  return TIER_DIFFICULTY_BITS[tier];
}

// ---------------------------------------------------------------------------
// Request client identification
// ---------------------------------------------------------------------------

/**
 * Hashed client identifier for the current request, computed exactly like the
 * rate limiter's: cf-connecting-ip, then the first x-forwarded-for hop, then
 * a shared fail-safe "unknown" bucket. The raw identifier never leaves this
 * function and the hash is never logged.
 */
export async function getRequestClientHash(): Promise<string> {
  try {
    // Dynamic import: keeps next/headers out of non-request bundles and lets
    // this module be exercised outside a Next.js request scope.
    const { headers } = await import("next/headers");
    const h = await headers();
    const clientIdentifier =
      h.get("cf-connecting-ip")?.trim() ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    return hashClient(clientIdentifier);
  } catch {
    // No request scope (or no proxy headers): shared fail-safe bucket.
    return hashClient("unknown");
  }
}
