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

import { NextRequest, NextResponse } from "next/server";

import { getRequestClientHash, recordFailure, verifySolution } from "@/lib/pow";
import { mintChatLoginToken } from "@/lib/matrixToken";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const CHAT_URL = "https://chat.tools-library.com";

interface ChatTokenBody {
  alias?: unknown;
  password?: unknown;
  challenge?: unknown;
  counter?: unknown;
}

/**
 * Verifies a proof-of-work solution and mints a one-time Matrix login token.
 *
 * Zero-PII invariants: the alias and password are forwarded only to our own
 * Synapse server, never echoed in any response, and never logged. Failures
 * are recorded against the hashed client identifier only.
 */
export async function POST(request: NextRequest) {
  // Same-origin guard: a browser always sends Origin on cross-site POSTs, so
  // a mismatched host is rejected before any work is done. Requests without
  // an Origin header (same-origin fetches, non-browser clients) pass through
  // and remain protected by the rate limit and proof of work.
  const origin = request.headers.get("origin");
  if (origin !== null) {
    const requestHost = request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!requestHost || originHost !== requestHost) {
      return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
    }
  }

  const limit = await enforceRateLimit("chatToken");
  if (!limit.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterSeconds) },
      { status: 429 }
    );
  }

  let body: ChatTokenBody;
  try {
    body = (await request.json()) as ChatTokenBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { alias, password, challenge, counter } = body;
  const typesValid =
    typeof alias === "string" &&
    alias.length > 0 &&
    alias.length <= 256 &&
    typeof password === "string" &&
    password.length > 0 &&
    password.length <= 256 &&
    typeof challenge === "string" &&
    challenge.length > 0 &&
    typeof counter === "number" &&
    Number.isInteger(counter) &&
    counter >= 0 &&
    counter <= Number.MAX_SAFE_INTEGER;

  if (!typesValid) {
    return NextResponse.json(
      { error: "Invalid request. Provide an alias, a password, a challenge, and a proof-of-work counter." },
      { status: 400 }
    );
  }

  const clientHash = await getRequestClientHash();

  const pow = verifySolution("chat", challenge, counter, clientHash);
  if (!pow.ok) {
    recordFailure("chat", clientHash);
    const message =
      pow.reason === "expired" || pow.reason === "replayed"
        ? "This challenge has expired or was already used. Request a new challenge and try again."
        : "Proof of work verification failed. Request a new challenge and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await mintChatLoginToken(alias, password);
  if (!result.ok) {
    if (result.reason === "credentials") {
      recordFailure("chat", clientHash);
      return NextResponse.json({ error: "Invalid alias or password." }, { status: 401 });
    }
    if (result.reason === "unconfigured") {
      return NextResponse.json(
        { error: "The chat server is not configured." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "The chat server is unavailable. Try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    token: result.loginToken,
    expiresInMs: result.expiresInMs,
    chatUrl: CHAT_URL,
  });
}
