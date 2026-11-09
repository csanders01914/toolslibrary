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
 * Unit tests for the central password service (Stage 1 of the KILO
 * auth/security plan). Pure module — no database, no Next.js runtime.
 * Covers the work order's required unit-level cases: policy boundaries in
 * Unicode code points, NFC normalization, long-password round-trips,
 * pinned Argon2id parameters, legacy bcrypt interop, the 72-byte upgrade
 * gate, and fail-closed verification on malformed hashes.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseOptions } from "@node-rs/argon2";
import * as bcrypt from "@node-rs/bcrypt";
import {
  ARGON2ID_MEMORY_COST,
  ARGON2ID_PARALLELISM,
  ARGON2ID_TIME_COST,
  PasswordPolicyError,
  countCodePoints,
  hashNewPassword,
  hashUpgradedLegacyPassword,
  isArgon2idHash,
  isLegacyBcryptHash,
  isSafeToOpportunisticallyUpgrade,
  validateNewPassword,
  verifyStoredPassword,
} from "../src/lib/passwords";

/** ASCII password of exactly `len` code points. */
function asciiPassword(len: number): string {
  return "Aa1!".repeat(Math.ceil(len / 4)).slice(0, len);
}

describe("new-password policy validation", () => {
  test("accepts the 15-code-point minimum", () => {
    assert.equal(validateNewPassword(asciiPassword(15)), null);
  });

  test("rejects 14 code points", () => {
    const error = validateNewPassword(asciiPassword(14));
    assert.match(error ?? "", /at least 15/);
  });

  test("accepts 256 code points", () => {
    assert.equal(validateNewPassword(asciiPassword(256)), null);
  });

  test("rejects 257 code points", () => {
    const error = validateNewPassword(asciiPassword(257));
    assert.match(error ?? "", /at most 256/);
  });

  test("counts Unicode code points, not UTF-16 code units", () => {
    // 256 emoji = 256 code points but 512 UTF-16 units — a UTF-16 counter
    // would wrongly reject this against the 256 cap.
    assert.equal(countCodePoints("\u{1F600}".repeat(256)), 256);
    assert.equal(validateNewPassword("\u{1F600}".repeat(256)), null);
    // 257 emoji = 257 code points — rejected.
    assert.match(validateNewPassword("\u{1F600}".repeat(257)) ?? "", /at most 256/);
  });

  test("normalizes to NFC before counting (combining marks compose)", () => {
    // 15 × (e + U+0301 combining acute) = 30 code points decomposed, but
    // NFC composes each pair into é — exactly 15 code points after
    // normalization, so the policy accepts it.
    const decomposed = "e\u0301".repeat(15);
    assert.equal(countCodePoints(decomposed), 30);
    assert.equal(validateNewPassword(decomposed), null);
  });

  test("accepts the 1024-byte boundary (256 four-byte code points)", () => {
    const emoji256 = "\u{1F600}".repeat(256);
    assert.equal(Buffer.byteLength(emoji256, "utf8"), 1024);
    assert.equal(validateNewPassword(emoji256), null);
  });

  test("rejects empty and non-string input", () => {
    assert.match(validateNewPassword("") ?? "", /required/);
    assert.match(validateNewPassword(undefined) ?? "", /required/);
    assert.match(validateNewPassword(123 as unknown as string) ?? "", /required/);
  });

  test("allows spaces, punctuation, and mixed scripts without composition rules", () => {
    assert.equal(validateNewPassword("correct horse battery staple 日本"), null);
  });
});

describe("Argon2id hashing (new/changed/reset passwords)", () => {
  test("pins the OWASP baseline parameters in the stored PHC string", async () => {
    const hash = await hashNewPassword(asciiPassword(15));
    const parsed = parseOptions(hash);
    assert.equal(parsed.algorithm, 2); // Algorithm.Argon2id
    assert.equal(parsed.version, 1); // Version.V0x13 (v=19)
    assert.equal(parsed.memoryCost, ARGON2ID_MEMORY_COST); // 19456 KiB
    assert.equal(parsed.timeCost, ARGON2ID_TIME_COST); // 2 passes
    assert.equal(parsed.parallelism, ARGON2ID_PARALLELISM); // 1 thread
    assert.ok(hash.startsWith("$argon2id$"));
    assert.ok(isArgon2idHash(hash));
  });

  test("round-trips 15/30/40/64/100/256-code-point passwords in full", async () => {
    for (const len of [15, 30, 40, 64, 100, 256]) {
      const password = asciiPassword(len);
      const hash = await hashNewPassword(password);
      assert.ok(await verifyStoredPassword(password, hash), `length ${len} must verify`);
      assert.ok(
        !(await verifyStoredPassword(password + "x", hash)),
        `length ${len} wrong candidate must fail`
      );
    }
  });

  test("round-trips emoji, CJK, and combining marks; NFC and NFD input are interchangeable", async () => {
    const composed = "Lörem-ipsüm-😀-日本語-x9";
    const decomposed = composed
      .replaceAll("ö", "o\u0308")
      .replaceAll("ü", "u\u0308");
    assert.notEqual(composed, decomposed); // different byte encodings…
    const hash = await hashNewPassword(composed);
    assert.ok(await verifyStoredPassword(composed, hash));
    // …but the same logical password verifies from either encoding.
    assert.ok(await verifyStoredPassword(decomposed, hash));
  });

  test("generates a unique salt per hash", async () => {
    const password = asciiPassword(15);
    const [a, b] = await Promise.all([
      hashNewPassword(password),
      hashNewPassword(password),
    ]);
    assert.notEqual(a, b);
  });

  test("rejects policy violations BEFORE hashing (cheap failure)", async () => {
    await assert.rejects(() => hashNewPassword(asciiPassword(14)), PasswordPolicyError);
    await assert.rejects(() => hashNewPassword(asciiPassword(257)), PasswordPolicyError);
    await assert.rejects(() => hashNewPassword(""), PasswordPolicyError);
  });
});

describe("legacy bcrypt interop", () => {
  test("verifies existing bcrypt hashes, including below the new 15-code-point minimum", async () => {
    // Cost 4: fixture-only hash, fast to compute in tests.
    const legacyHash = await bcrypt.hash("legacyPass1", { cost: 4 });
    assert.ok(isLegacyBcryptHash(legacyHash));
    assert.ok(await verifyStoredPassword("legacyPass1", legacyHash));
    assert.ok(await verifyStoredPassword("short10xy", await bcrypt.hash("short10xy", { cost: 4 })));
    assert.ok(!(await verifyStoredPassword("wrongPass99", legacyHash)));
  });

  test("bcrypt still authenticates inputs at or above 72 bytes (truncation behavior preserved)", async () => {
    const longSecret = "a".repeat(100);
    const legacyHash = await bcrypt.hash(longSecret, { cost: 4 });
    assert.ok(await verifyStoredPassword(longSecret, legacyHash));
  });

  test("upgrades a verified legacy credential to Argon2id without policy re-validation", async () => {
    const legacyPassword = "legacyPass1"; // 11 chars — below the new minimum
    const upgraded = await hashUpgradedLegacyPassword(legacyPassword);
    assert.ok(isArgon2idHash(upgraded));
    assert.ok(await verifyStoredPassword(legacyPassword, upgraded));
  });
});

describe("bcrypt 72-byte upgrade gate", () => {
  test("inputs under 72 UTF-8 bytes are unambiguous and may upgrade", () => {
    assert.ok(isSafeToOpportunisticallyUpgrade("a".repeat(71)));
    assert.ok(isSafeToOpportunisticallyUpgrade("é".repeat(35))); // 70 bytes
  });

  test("inputs at or above 72 UTF-8 bytes must never auto-migrate", () => {
    assert.ok(!isSafeToOpportunisticallyUpgrade("a".repeat(72)));
    assert.ok(!isSafeToOpportunisticallyUpgrade("a".repeat(100)));
    assert.ok(!isSafeToOpportunisticallyUpgrade("é".repeat(36))); // 72 bytes
  });
});

describe("fail-closed verification", () => {
  const candidate = "whatever-password";

  test("unknown hash formats return false", async () => {
    assert.ok(!(await verifyStoredPassword(candidate, "garbage")));
    assert.ok(!(await verifyStoredPassword(candidate, "$plaintext$abc")));
    assert.ok(!(await verifyStoredPassword(candidate, "")));
    assert.ok(!(await verifyStoredPassword(candidate, null)));
    assert.ok(!(await verifyStoredPassword(candidate, undefined)));
  });

  test("malformed Argon2id PHC strings return false", async () => {
    assert.ok(!(await verifyStoredPassword(candidate, "$argon2id$malformed")));
    assert.ok(!(await verifyStoredPassword(candidate, "$argon2id$m=19456,t=2,p=1$short$salt")));
  });

  test("malformed bcrypt strings return false", async () => {
    assert.ok(!(await verifyStoredPassword(candidate, "$2a$12$malformedmalformedmalformedmalformedmalformedmalformedma")));
  });

  test("empty candidate never verifies", async () => {
    const hash = await hashNewPassword(asciiPassword(15));
    assert.ok(!(await verifyStoredPassword("", hash)));
  });
});
