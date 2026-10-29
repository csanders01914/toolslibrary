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

import {
  difficultyForTier,
  getRequestClientHash,
  isPowSurface,
  issueChallenge,
  recordChallenge,
  suspicionTier,
} from "@/lib/pow";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";

/**
 * Issues a signed proof-of-work challenge for any protected surface
 * ("chat", "register", or "help") via the unified /api/pow/[surface]
 * endpoint. The surface is validated against the allowlist before any work
 * is done — a challenge is always bound to the surface it was issued for
 * and can never be spent on another.
 *
 * Difficulty is not fixed: it scales with how suspicious recent request
 * traffic from this client looks on this surface (challenge volume and past
 * failures over a 15-minute window). The client identifier is hashed with
 * the rate limiter's per-process salt — the raw IP is never stored or logged.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ surface: string }> }
) {
  const { surface } = await params;
  if (!isPowSurface(surface)) {
    return NextResponse.json(
      { error: "Unknown proof-of-work surface." },
      { status: 404 }
    );
  }

  const limit = await enforceRateLimit("powChallenge");
  if (!limit.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterSeconds) },
      { status: 429 }
    );
  }

  const clientHash = await getRequestClientHash();
  recordChallenge(surface, clientHash);
  const tier = suspicionTier(surface, clientHash);

  // no-store: challenges are single-use and client-bound; a cached response
  // would hand one client another client's (or an already-spent) challenge.
  const response = NextResponse.json(
    issueChallenge(surface, difficultyForTier(tier), clientHash)
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
