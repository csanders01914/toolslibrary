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
 * Synapse one-time login token minting for the community chat access page.
 *
 * Flow: verify the user's Matrix credentials with a password login, exchange
 * the resulting session for a one-time login token (usable once by a Matrix
 * client such as Element Web), then immediately destroy the full session so
 * only the single-use token survives.
 *
 * Uses only native fetch — no Matrix SDK and no other third-party package.
 * Zero-PII invariants: the alias, password, access token, and login token are
 * never logged; only non-PII failure reasons reach the console, in the same
 * style as src/lib/matrix.ts.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export type MatrixTokenResult =
  | { ok: true; loginToken: string; expiresInMs: number }
  | { ok: false; reason: "unconfigured" | "credentials" | "unavailable" };

/**
 * Mints a one-time Matrix login token for `alias` / `password`.
 *
 * Returns a discriminated union instead of throwing: "credentials" means the
 * Synapse server rejected the login, "unconfigured" means the homeserver URL
 * is absent, and "unavailable" covers network failures, timeouts, 5xx
 * responses, and malformed responses.
 */
export async function mintChatLoginToken(
  alias: string,
  password: string
): Promise<MatrixTokenResult> {
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  if (!homeserverUrl) {
    console.error("[chat-token] MATRIX_HOMESERVER_URL is not configured; token minting disabled");
    return { ok: false, reason: "unconfigured" };
  }

  // Step 1: password login against our own Synapse server to obtain a
  // short-lived full access token.
  let accessToken: string;
  try {
    const loginResponse = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: alias },
        password,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (
      loginResponse.status === 400 ||
      loginResponse.status === 401 ||
      loginResponse.status === 403
    ) {
      return { ok: false, reason: "credentials" };
    }
    if (!loginResponse.ok) {
      console.error(`[chat-token] login rejected with status ${loginResponse.status}`);
      return { ok: false, reason: "unavailable" };
    }

    const loginBody = (await loginResponse.json().catch(() => null)) as {
      access_token?: unknown;
    } | null;
    if (!loginBody || typeof loginBody.access_token !== "string" || !loginBody.access_token) {
      console.error("[chat-token] login response missing access_token");
      return { ok: false, reason: "unavailable" };
    }
    accessToken = loginBody.access_token;
  } catch (error) {
    console.error(
      "[chat-token] login request failed:",
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "unavailable" };
  }

  // Step 2: exchange the full session for a one-time login token.
  let loginToken: string | undefined;
  let expiresInMs = 0;
  let step2Succeeded = false;
  try {
    const tokenResponse = await fetch(`${homeserverUrl}/_matrix/client/v1/login/get_token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (tokenResponse.ok) {
      const tokenBody = (await tokenResponse.json().catch(() => null)) as {
        login_token?: unknown;
        expires_in_ms?: unknown;
      } | null;
      if (tokenBody && typeof tokenBody.login_token === "string" && tokenBody.login_token) {
        loginToken = tokenBody.login_token;
        expiresInMs =
          typeof tokenBody.expires_in_ms === "number" && Number.isFinite(tokenBody.expires_in_ms)
            ? tokenBody.expires_in_ms
            : 0;
        step2Succeeded = true;
      } else {
        console.error("[chat-token] get_token response missing login_token");
      }
    } else {
      console.error(`[chat-token] get_token rejected with status ${tokenResponse.status}`);
    }
  } catch (error) {
    console.error(
      "[chat-token] get_token request failed:",
      error instanceof Error ? error.message : error
    );
  }

  // Step 3: always destroy the full session we just created — success or
  // failure of step 2 — so only the single-use token remains. Best-effort:
  // Synapse expires idle sessions on its own, so a failure here is ignored.
  try {
    await fetch(`${homeserverUrl}/_matrix/client/v3/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Best-effort logout; nothing sensitive is lost if this fails.
  }

  if (!step2Succeeded || !loginToken) {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, loginToken, expiresInMs };
}
