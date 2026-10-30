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
 * Zero-dependency in-memory token-bucket rate limiter (PHASE_23_RATE_LIMITING).
 *
 * Protects the unauthenticated write surfaces — NextAuth credential checks,
 * registration, recovery-key consumption, password verification, and the
 * public help/webhook actions — from brute force and spam flooding.
 *
 * Zero-PII invariants:
 * - Client identifiers (IP addresses) are hashed with SHA-256 using a random
 *   per-process salt before use; the raw identifier is never stored.
 * - Buckets live in process memory ONLY: never persisted, never logged, and
 *   the salt regenerates on every restart, so stored hashes (if any leaked)
 *   would be unlinkable anyway. Buckets are swept when idle.
 *
 * Deployment note: `cf-connecting-ip` (set by a trusted Cloudflare Tunnel) is
 * preferred, then the first `x-forwarded-for` hop. With direct exposure and
 * neither header present, every client shares one bucket per action —
 * fail-safe (throttling still applies) rather than fail-open.
 */

import crypto from "node:crypto";

export interface RateLimitConfig {
  /** Burst size: tokens available immediately. */
  capacity: number;
  /** Sustained rate: tokens added per minute. */
  refillPerMinute: number;
}

/**
 * Budgets per protected surface. Generous enough for humans behind shared
 * NATs, tight enough to make brute force impractical:
 * - login: 10 burst / 5 per minute ≈ 7,200 guesses/day per client — bcrypt
 *   cost 12 makes each guess expensive on the server too.
 * - recover: 5 burst / 2 per minute ≈ 2,880 code guesses/day against a
 *   16^8 keyspace of 8 single-use codes.
 * - help: 5 burst / 2 per minute caps webhook and Matrix admin-room flooding.
 * - powChallenge: 20 burst / 8 per minute caps proof-of-work challenge
 *   issuance across all three protected surfaces (chat, register, help).
 * - chatToken: 5 burst / 2 per minute caps one-time token minting attempts
 *   against the Synapse login endpoint.
 * - adminEmail: 5 burst / 2 per minute — authenticated admin-only surface
 *   (PHASE_29); password-verified when replacing an existing destination.
 * - canary: 5 burst / 2 per minute — authenticated admin-only surface
 *   (PHASE_30); throttles canary passphrase checks and staging against
 *   brute force.
 */
export const RATE_LIMITS = {
  login: { capacity: 10, refillPerMinute: 5 },
  register: { capacity: 5, refillPerMinute: 2 },
  recover: { capacity: 5, refillPerMinute: 2 },
  changePassword: { capacity: 10, refillPerMinute: 5 },
  deleteAccount: { capacity: 10, refillPerMinute: 5 },
  help: { capacity: 5, refillPerMinute: 2 },
  powChallenge: { capacity: 20, refillPerMinute: 8 },
  chatToken: { capacity: 5, refillPerMinute: 2 },
  adminEmail: { capacity: 5, refillPerMinute: 2 },
  canary: { capacity: 5, refillPerMinute: 2 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

interface TokenBucketState {
  tokens: number;
  updatedAt: number;
}

// Shared per-process state on globalThis: Next.js compiles each route and
// server action as a separate bundle in dev (and can split bundles in
// standalone output), so plain module-level state would be duplicated per
// bundle — different salts per route would silently break anything that
// compares client hashes across two entry points. The globalThis singleton
// (same pattern as the Prisma client in src/lib/db.ts) guarantees one
// instance per process in every environment.
interface RateLimitGlobal {
  __rateLimitSalt?: Buffer;
  __rateLimitBuckets?: Map<string, TokenBucketState>;
}
const rateLimitGlobal = globalThis as unknown as RateLimitGlobal;
const SALT = rateLimitGlobal.__rateLimitSalt ?? (rateLimitGlobal.__rateLimitSalt = crypto.randomBytes(32));
const buckets =
  rateLimitGlobal.__rateLimitBuckets ??
  (rateLimitGlobal.__rateLimitBuckets = new Map<string, TokenBucketState>());

// Memory hygiene: idle buckets are evicted so a flood of unique spoofed
// identifiers cannot grow the Map without bound.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const BUCKET_IDLE_MS = 60 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > BUCKET_IDLE_MS) {
      buckets.delete(key);
    }
  }
}

// Random per-process salt: hashed identifiers are unlinkable across restarts.
// (The salt itself lives on globalThis — see the shared-state note above.)

/** SHA-256 of (process salt ‖ client identifier) — hex. Never logged. */
export function hashClient(clientIdentifier: string): string {
  return crypto
    .createHash("sha256")
    .update(SALT)
    .update(clientIdentifier)
    .digest("hex");
}

export interface TokenVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Consume one token from `bucketName` for `clientHash`. Pure function over
 * the in-memory bucket store — no request context required.
 */
export function consumeToken(
  bucketName: RateLimitBucket,
  clientHash: string
): TokenVerdict {
  const config: RateLimitConfig = RATE_LIMITS[bucketName];
  const now = Date.now();
  sweep(now);

  const key = `${bucketName}:${clientHash}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, updatedAt: now };
    buckets.set(key, bucket);
  }

  const elapsedMinutes = (now - bucket.updatedAt) / 60_000;
  bucket.tokens = Math.min(
    config.capacity,
    bucket.tokens + elapsedMinutes * config.refillPerMinute
  );
  bucket.updatedAt = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.ceil(
    ((1 - bucket.tokens) / config.refillPerMinute) * 60
  );
  return { allowed: false, retryAfterSeconds };
}

export type RateLimitVerdict =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/** Consistent, PII-free throttle message for form error states. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  const unit = retryAfterSeconds === 1 ? "second" : "seconds";
  return `Too many requests — try again in ${retryAfterSeconds} ${unit}.`;
}

async function getClientHash(): Promise<string> {
  try {
    // Dynamic import: keeps next/headers out of non-request bundles and lets
    // this module be exercised outside a Next.js request scope (tests).
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

/**
 * Enforce the bucket for the current request's client. Returns `{ ok: true }`
 * or `{ ok: false, retryAfterSeconds }`; callers translate the latter into
 * their own error shape (form state, or `null` from NextAuth authorize).
 */
export async function enforceRateLimit(
  bucketName: RateLimitBucket
): Promise<RateLimitVerdict> {
  const clientHash = await getClientHash();
  const verdict = consumeToken(bucketName, clientHash);
  return verdict.allowed
    ? { ok: true }
    : { ok: false, retryAfterSeconds: verdict.retryAfterSeconds };
}
