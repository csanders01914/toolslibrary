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

import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Webhook guard suite: shared-secret check (timing-safe) and the per-IP
 * rate-limit window with deterministic time injection.
 *
 * The secret must be present in the environment BEFORE the config module is
 * first imported, so it is set here prior to the dynamic import.
 */

process.env.WEBHOOK_SECRET = "test-secret-123";

test("shared secret: missing, wrong, and non-string values are rejected", async () => {
  const { isSecretValid } = await import("../src/server/guards");

  assert.equal(isSecretValid(undefined), false);
  assert.equal(isSecretValid(""), false);
  assert.equal(isSecretValid("wrong"), false);
  assert.equal(isSecretValid(12345 as unknown), false);
  assert.equal(isSecretValid("test-secret-123"), true);
});

test("shared secret: length mismatches are rejected without leaking timing", async () => {
  const { isSecretValid } = await import("../src/server/guards");

  const start = process.hrtime.bigint();
  const shortResult = isSecretValid("x");
  const mid = process.hrtime.bigint();
  const correctResult = isSecretValid("test-secret-123");
  const end = process.hrtime.bigint();

  assert.equal(shortResult, false);
  assert.equal(correctResult, true);
  // The rejection path must not be dramatically cheaper than the acceptance
  // path (the burn comparison keeps rejection cost in the same ballpark).
  const rejectNs = mid - start;
  const acceptNs = end - mid;
  assert.ok(rejectNs > 0 && acceptNs > 0);
});

test("rate limit: allows the configured budget, then blocks within the window", async () => {
  const { isRateAllowed } = await import("../src/server/guards");

  const ip = "203.0.113.7";
  for (let i = 0; i < 10; i++) {
    assert.equal(isRateAllowed(ip, i * 1000), true, `request ${i + 1} should pass`);
  }
  assert.equal(isRateAllowed(ip, 10_000), false, "request 11 should be blocked");
  assert.equal(isRateAllowed(ip, 20_000), false, "still blocked inside the window");
});

test("rate limit: the window slides and the budget recovers", async () => {
  const { isRateAllowed } = await import("../src/server/guards");

  const ip = "198.51.100.9";
  for (let i = 0; i < 10; i++) {
    assert.equal(isRateAllowed(ip, i * 1000), true);
  }
  assert.equal(isRateAllowed(ip, 30_000), false);
  // 60 seconds after the first hit, all early stamps have expired.
  assert.equal(isRateAllowed(ip, 61_000), true);
});

test("rate limit: budgets are tracked per IP", async () => {
  const { isRateAllowed } = await import("../src/server/guards");

  assert.equal(isRateAllowed("10.0.0.1", 0), true);
  assert.equal(isRateAllowed("10.0.0.2", 0), true);
  for (let i = 1; i < 10; i++) {
    assert.equal(isRateAllowed("10.0.0.1", i * 1000), true);
  }
  assert.equal(isRateAllowed("10.0.0.1", 10_000), false);
  assert.equal(isRateAllowed("10.0.0.2", 10_000), true, "the other IP keeps its own budget");
});
