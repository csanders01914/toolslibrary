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
 * Browser-side helpers for the proof-of-work gate shared by the chat portal,
 * account creation, and the help-triage form.
 *
 * Plain module — no "use client" directive needed (it is only ever imported
 * from client components) and no Node imports: all hashing uses the Web
 * Crypto API so the solver runs entirely in the browser. The server never
 * sees the hash search.
 */

export type PowSurface = "chat" | "register" | "help";

export interface PowChallenge {
  challenge: string;
  difficulty: number;
  algorithm: string;
  expiresInSeconds: number;
}

/** Error carrying a user-safe message from a failed challenge request. */
export class PowChallengeError extends Error {}

/**
 * Fetches a signed proof-of-work challenge for `surface` from the unified
 * endpoint. Throws `PowChallengeError` on any non-OK response — with the
 * server's error message when the body parses as JSON — or on a malformed
 * challenge body.
 */
export async function fetchChallenge(surface: PowSurface): Promise<PowChallenge> {
  let response: Response;
  try {
    response = await fetch(`/api/pow/${surface}`, { signal: AbortSignal.timeout(15_000) });
  } catch {
    // Network error or timeout: fail with a user-safe message instead of
    // leaving the form stuck in its solving state.
    throw new PowChallengeError("Could not request a challenge. Check your connection and try again.");
  }
  if (!response.ok) {
    let message = "Could not request a challenge. Try again.";
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error) message = data.error;
    } catch {
      // Non-JSON body: fall through to the fallback message.
    }
    throw new PowChallengeError(message);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new PowChallengeError("Received an invalid challenge. Try again.");
  }
  const candidate = data as Partial<PowChallenge> | null;
  if (
    !candidate ||
    typeof candidate.challenge !== "string" ||
    candidate.challenge.length === 0 ||
    typeof candidate.difficulty !== "number" ||
    !Number.isInteger(candidate.difficulty) ||
    candidate.difficulty < 0
  ) {
    throw new PowChallengeError("Received an invalid challenge. Try again.");
  }
  return candidate as PowChallenge;
}

/**
 * Extracts the challenge nonce from the signed payload. The payload is
 * base64url-encoded JSON — signed, not secret — so the browser can read the
 * nonce to compute SHA-256(`${nonce}:${counter}`) exactly as the server will.
 */
export function extractNonce(challenge: string): string | null {
  const separator = challenge.indexOf(".");
  if (separator <= 0) return null;
  const payloadB64 = challenge.slice(0, separator).replace(/-/g, "+").replace(/_/g, "/");
  const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
  try {
    const payload: unknown = JSON.parse(atob(padded));
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as { nonce?: unknown }).nonce === "string"
    ) {
      return (payload as { nonce: string }).nonce;
    }
    return null;
  } catch {
    return null;
  }
}

/** Counts leading zero bits of a hex digest: 4 per '0' char, partial nibble aware. */
export function leadingZeroBits(hexDigest: string): number {
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

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Outcome of a browser proof-of-work solve. */
export type SolveResult =
  | { ok: true; counter: number }
  | { ok: false; reason: "superseded" | "timeout" };

/**
 * Solves the proof of work: loops the counter from 0 until
 * SHA-256(`${nonce}:${counter}`) has at least `difficulty` leading zero bits.
 * Reports progress periodically when `onProgress` is given (visible flows)
 * and yields to the event loop so the browser can paint. Silent flows (the
 * help form) omit `onProgress` and simply await the result.
 *
 * `deadlineMs` is a wall-clock cap (the challenge's expiry minus a small
 * margin): when it passes the solve stops with reason "timeout" instead of
 * burning CPU on a puzzle that the server would reject as expired anyway.
 */
export async function solveProofOfWork(
  nonce: string,
  difficulty: number,
  isCurrentRun: () => boolean,
  deadlineMs: number,
  onProgress?: (hashes: number) => void
): Promise<SolveResult> {
  const encoder = new TextEncoder();
  const prefix = `${nonce}:`;
  let counter = 0;
  let lastReport = Date.now();

  for (;;) {
    if (!isCurrentRun()) return { ok: false, reason: "superseded" };
    if (Date.now() >= deadlineMs || counter > Number.MAX_SAFE_INTEGER - 1) {
      return { ok: false, reason: "timeout" };
    }
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${prefix}${counter}`));
    if (leadingZeroBits(bytesToHex(new Uint8Array(digest))) >= difficulty) {
      if (onProgress) onProgress(counter);
      return { ok: true, counter };
    }
    counter += 1;
    const now = Date.now();
    if (now - lastReport >= 200) {
      lastReport = now;
      if (onProgress) onProgress(counter);
      // Yield so the progress update can paint before the next batch.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
