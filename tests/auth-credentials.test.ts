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
 * Integration tests for credential authentication, the staged
 * bcrypt-to-Argon2id migration, and self-service recovery-code
 * regeneration (Stages 1-2 of the KILO auth/security plan).
 *
 * Runs against a DISPOSABLE SQLite database (data/test-auth-stage1.db,
 * gitignored) provisioned with the real version-controlled migrations via
 * `prisma migrate deploy` — never against the development or production
 * database. Covers the work order's required integration cases: legacy
 * 10-character bcrypt login without forced reset, exactly-once upgrade on
 * valid login, wrong-login-never-writes, fail-closed malformed hashes,
 * the 72-byte no-auto-migration rule, the concurrent-reset compare-and-set
 * guard, Argon2id issuance through the real registration and recovery
 * server actions, and the Stage 2 regeneration flow (session requirement,
 * fresh password verification, transactional rotation, legacy-account
 * direct rotation, rate limiting).
 *
 * Not covered here (documented in the Stage 1 handoff): changePassword and
 * deleteOwnAccount require an Auth.js request session (auth()) that does
 * not exist outside the Next.js runtime; their crypto goes through the
 * unit-tested password service and their wiring is exercised by the
 * Stage 7 end-to-end pass.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "../src/lib/credentialAuth";
import type {
  registerUser as registerUserType,
  recoverAccount as recoverAccountType,
  regenerateRecoveryCodes as regenerateRecoveryCodesType,
  regenerateRecoveryCodesForUser as regenerateRecoveryCodesForUserType,
} from "../src/lib/actions/auth";
import type {
  issueChallenge as issueChallengeType,
  getRequestClientHash as getRequestClientHashType,
} from "../src/lib/pow";

// Disposable database URL — MUST be set before any Prisma client is
// constructed, so every app-module import in this file is dynamic.
const dbPath = path
  .join(process.cwd(), "data", "test-auth-stage1.db")
  .split(path.sep)
  .join("/");
const dbUrl = `file:${dbPath}`;

let prisma: PrismaClient;
let authenticateAndMaybeUpgrade: (
  username: string,
  password: string
) => Promise<AuthenticatedUser | null>;
let rehashIfUnchanged: (userId: string, oldHash: string, verifiedPassword: string) => Promise<boolean>;
let hashNewPassword: (password: string) => Promise<string>;
let verifyStoredPassword: (
  password: string,
  storedHash: string | null | undefined
) => Promise<boolean>;
let isArgon2idHash: (storedHash: string | null | undefined) => boolean;
let isLegacyBcryptHash: (storedHash: string | null | undefined) => boolean;
let hashRecoveryCode: (code: string) => string;
let hashLegacyRecoveryCode: (code: string) => string;
let bcryptMod: typeof import("@node-rs/bcrypt");
let registerUser: typeof registerUserType;
let recoverAccount: typeof recoverAccountType;
let regenerateRecoveryCodes: typeof regenerateRecoveryCodesType;
let regenerateRecoveryCodesForUser: typeof regenerateRecoveryCodesForUserType;
let issueChallenge: typeof issueChallengeType;
let getRequestClientHash: typeof getRequestClientHashType;

before(async () => {
  // Fresh disposable database on every run.
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  process.env.DATABASE_URL = dbUrl;

  // Apply the real version-controlled migrations to the disposable file.
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });

  const db = await import("../src/lib/db");
  prisma = db.prisma;
  const cred = await import("../src/lib/credentialAuth");
  authenticateAndMaybeUpgrade = cred.authenticateAndMaybeUpgrade;
  rehashIfUnchanged = cred.rehashIfUnchanged;
  const pw = await import("../src/lib/passwords");
  hashNewPassword = pw.hashNewPassword;
  verifyStoredPassword = pw.verifyStoredPassword;
  isArgon2idHash = pw.isArgon2idHash;
  isLegacyBcryptHash = pw.isLegacyBcryptHash;
  const cryptoMod = await import("../src/lib/crypto");
  hashRecoveryCode = cryptoMod.hashRecoveryCode;
  hashLegacyRecoveryCode = cryptoMod.hashLegacyRecoveryCode;
  bcryptMod = await import("@node-rs/bcrypt");
  const actions = await import("../src/lib/actions/auth");
  registerUser = actions.registerUser;
  recoverAccount = actions.recoverAccount;
  regenerateRecoveryCodes = actions.regenerateRecoveryCodes;
  regenerateRecoveryCodesForUser = actions.regenerateRecoveryCodesForUser;
  const pow = await import("../src/lib/pow");
  issueChallenge = pow.issueChallenge;
  getRequestClientHash = pow.getRequestClientHash;
});

after(async () => {
  await prisma?.$disconnect();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
});

/** Builds a PoW-signed FormData for the register surface (difficulty 0). */
async function registrationForm(username: string, alias: string, password: string): Promise<FormData> {
  const clientHash = await getRequestClientHash();
  const challenge = issueChallenge("register", 0, clientHash);
  const fd = new FormData();
  fd.set("username", username);
  fd.set("alias", alias);
  fd.set("password", password);
  fd.set("powChallenge", challenge.challenge);
  fd.set("powCounter", "0");
  return fd;
}

describe("legacy bcrypt login and staged upgrade", () => {
  test("a 10-character legacy bcrypt account logs in and is upgraded exactly once", async () => {
    const legacyHash = await bcryptMod.hash("legacyPass1", { cost: 4 });
    const user = await prisma.user.create({
      data: { username: "legacy10", alias: "Legacy Ten", passwordHash: legacyHash },
    });

    const first = await authenticateAndMaybeUpgrade("legacy10", "legacyPass1");
    assert.ok(first, "legacy login must succeed without forced reset");
    assert.equal(first.id, user.id);

    const storedAfterFirst = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.ok(isArgon2idHash(storedAfterFirst), "hash must be upgraded to Argon2id after unambiguous verification");

    // Second login verifies through the Argon2id path and must NOT rehash.
    const second = await authenticateAndMaybeUpgrade("legacy10", "legacyPass1");
    assert.ok(second);
    const storedAfterSecond = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.equal(storedAfterSecond, storedAfterFirst, "upgrade must happen exactly once");
  });

  test("a wrong login never changes the stored hash", async () => {
    const password = "CorrectHorse15!x";
    const user = await prisma.user.create({
      data: {
        username: "wronglogin",
        alias: "Wrong Login",
        passwordHash: await hashNewPassword(password),
      },
    });
    const before = user.passwordHash;

    assert.equal(await authenticateAndMaybeUpgrade("wronglogin", "WrongHorse16!y"), null);
    const after = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.equal(after, before, "failed authentication must never write");
  });

  test("malformed stored hashes fail closed", async () => {
    await prisma.user.create({
      data: { username: "malformed1", alias: "Malformed One", passwordHash: "not-a-hash" },
    });
    assert.equal(await authenticateAndMaybeUpgrade("malformed1", "anything-at-all"), null);

    await prisma.user.create({
      data: { username: "malformed2", alias: "Malformed Two", passwordHash: "$argon2id$malformed" },
    });
    assert.equal(await authenticateAndMaybeUpgrade("malformed2", "anything-at-all"), null);
  });

  test("a 72-byte-plus legacy input authenticates but is never auto-migrated", async () => {
    const longSecret = "b".repeat(100);
    const user = await prisma.user.create({
      data: {
        username: "wide72",
        alias: "Wide Seventy-Two",
        passwordHash: await bcryptMod.hash(longSecret, { cost: 4 }),
      },
    });

    const result = await authenticateAndMaybeUpgrade("wide72", longSecret);
    assert.ok(result, "the legacy login itself must keep working");

    const stored = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.ok(isLegacyBcryptHash(stored), "ambiguous 72-byte-plus input must NOT be promoted to Argon2id");
  });
});

describe("concurrent-reset compare-and-set guard", () => {
  test("a concurrent reset wins and the rehash stands down", async () => {
    const legacyHash = await bcryptMod.hash("guardPass1", { cost: 4 });
    const user = await prisma.user.create({
      data: { username: "rehashguard", alias: "Rehash Guard", passwordHash: legacyHash },
    });

    // Simulate a concurrent password reset that commits first: the stored
    // hash is now a different (Argon2id) value.
    const resetHash = await hashNewPassword("ResetPassword15!");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: resetHash } });

    // The login-path upgrade (still holding the OLD hash) must not overwrite it.
    const upgraded = await rehashIfUnchanged(user.id, legacyHash, "guardPass1");
    assert.equal(upgraded, false, "compare-and-set must lose against the concurrent reset");

    const stored = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.equal(stored, resetHash, "the reset hash must survive");
  });

  test("the guard performs the upgrade when nothing raced it", async () => {
    const legacyHash = await bcryptMod.hash("guardPass2", { cost: 4 });
    const user = await prisma.user.create({
      data: { username: "rehashguard2", alias: "Rehash Guard Two", passwordHash: legacyHash },
    });

    const upgraded = await rehashIfUnchanged(user.id, legacyHash, "guardPass2");
    assert.equal(upgraded, true);

    const stored = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.ok(isArgon2idHash(stored));
    assert.ok(await verifyStoredPassword("guardPass2", stored));
  });
});

describe("server actions issue Argon2id", () => {
  test("registerUser stores an Argon2id hash and issues 8 recovery codes", async () => {
    const result = await registerUser(
      undefined,
      await registrationForm("register1", "Register One", "Argon2idPass15!")
    );
    assert.equal(result?.success, true, `registration should succeed: ${result?.error ?? ""}`);
    assert.equal(result?.recoveryCodes?.length, 8);

    const user = await prisma.user.findUnique({ where: { username: "register1" } });
    assert.ok(user);
    assert.ok(isArgon2idHash(user.passwordHash), "registration must store Argon2id");
    assert.ok(await verifyStoredPassword("Argon2idPass15!", user.passwordHash));
  });

  test("registerUser enforces the 15-code-point minimum", async () => {
    const result = await registerUser(
      undefined,
      await registrationForm("register2", "Register Two", "Aa1!x".repeat(2) + "Aa1!x".slice(0, 4)) // 14 code points
    );
    assert.equal(result?.success, false);
    assert.match(result?.error ?? "", /at least 15/);
  });

  test("recoverAccount resets to Argon2id and consumes the code exactly once", async () => {
    const code = "AbCd-EfGh-IjKl"; // modern 12-character format with separators
    const user = await prisma.user.create({
      data: {
        username: "recover1",
        alias: "Recover One",
        passwordHash: await bcryptMod.hash("OldPassword1", { cost: 4 }),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash: hashRecoveryCode(code) }] },
      },
    });

    const fd = new FormData();
    fd.set("username", "recover1");
    fd.set("recoveryCode", code);
    fd.set("newPassword", "BrandNewPass15!");
    const result = await recoverAccount(undefined, fd);
    assert.equal(result?.success, true, `recovery should succeed: ${result?.error ?? ""}`);

    const stored = (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash;
    assert.ok(isArgon2idHash(stored), "recovery reset must store Argon2id");
    assert.ok(await verifyStoredPassword("BrandNewPass15!", stored));

    const key = await prisma.recoveryKey.findFirst({ where: { userId: user.id } });
    assert.ok(key?.usedAt, "the recovery code must be consumed");

    // The consumed code cannot be reused.
    const fd2 = new FormData();
    fd2.set("username", "recover1");
    fd2.set("recoveryCode", code);
    fd2.set("newPassword", "AnotherPass15!x");
    const replay = await recoverAccount(undefined, fd2);
    assert.equal(replay?.success, false);
    assert.equal(replay?.error, "Invalid username or recovery code");
  });

  test("recoverAccount rejects an invalid new password cheaply and uniformly", async () => {
    const code = "ZxYw-VuTs-RqPo";
    await prisma.user.create({
      data: {
        username: "recover2",
        alias: "Recover Two",
        passwordHash: await bcryptMod.hash("OldPassword2", { cost: 4 }),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash: hashRecoveryCode(code) }] },
      },
    });

    const fd = new FormData();
    fd.set("username", "recover2");
    fd.set("recoveryCode", code);
    fd.set("newPassword", "short"); // below the 15-code-point minimum
    const result = await recoverAccount(undefined, fd);
    assert.equal(result?.success, false);
    assert.match(result?.error ?? "", /at least 15/);

    // The code was NOT consumed by the rejected attempt.
    const key = await prisma.recoveryKey.findFirst({
      where: { user: { username: "recover2" } },
    });
    assert.equal(key?.usedAt ?? null, null, "a rejected reset must not consume the code");
  });
});

describe("self-service recovery-code regeneration (Stage 2)", () => {
  function regenForm(password: string): FormData {
    const fd = new FormData();
    fd.set("currentPassword", password);
    return fd;
  }

  test("the action requires a valid session", async () => {
    // Outside a Next.js request scope auth() throws; the wrapper must treat
    // that as unauthenticated rather than leaking an error.
    const result = await regenerateRecoveryCodes(undefined, regenForm("whatever"));
    assert.equal(result?.success, false);
    assert.equal(result?.error, "Authentication required");
  });

  test("a wrong current password fails without rotating anything", async () => {
    const keyHash = hashRecoveryCode("Aa1b-Bc2d-Cd3e");
    const user = await prisma.user.create({
      data: {
        username: "regenwrong",
        alias: "Regen Wrong",
        passwordHash: await hashNewPassword("RegenerationPass15!"),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash }] },
      },
    });

    const result = await regenerateRecoveryCodesForUser(user.id, regenForm("WrongPass16!y"));
    assert.equal(result?.success, false);
    assert.equal(result?.error, "Current password is incorrect");

    const keys = await prisma.recoveryKey.findMany({ where: { userId: user.id } });
    assert.equal(keys.length, 1, "a failed attempt must not touch the codes");
    assert.equal(keys[0].keyHash, keyHash);
  });

  test("rotation is transactional: old codes die, 8 new codes live, shown once", async () => {
    const oldCode = "OlDc-OdE1-OlD2";
    const user = await prisma.user.create({
      data: {
        username: "regen1",
        alias: "Regen One",
        passwordHash: await hashNewPassword("RegenerationPass15!"),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash: hashRecoveryCode(oldCode) }] },
      },
    });
    const issuedBefore = user.recoveryCodesIssuedAt!;

    const result = await regenerateRecoveryCodesForUser(user.id, regenForm("RegenerationPass15!"));
    assert.equal(result?.success, true);
    assert.equal(result?.recoveryCodes?.length, 8);

    const keys = await prisma.recoveryKey.findMany({ where: { userId: user.id } });
    assert.equal(keys.length, 8, "the account holds exactly 8 codes after rotation");
    const storedHashes = new Set(keys.map((k) => k.keyHash));
    // The returned plaintext codes match the stored hashes (shown once, hashed at rest)…
    for (const code of result?.recoveryCodes ?? []) {
      assert.ok(storedHashes.has(hashRecoveryCode(code)));
    }
    // …and the old code is gone.
    assert.ok(!storedHashes.has(hashRecoveryCode(oldCode)));

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(after!.recoveryCodesIssuedAt! > issuedBefore, "issuedAt must advance");

    // The old code can no longer recover the account (uniform failure).
    const fdOld = new FormData();
    fdOld.set("username", "regen1");
    fdOld.set("recoveryCode", oldCode);
    fdOld.set("newPassword", "AnotherPass15!x");
    const replay = await recoverAccount(undefined, fdOld);
    assert.equal(replay?.success, false);
    assert.equal(replay?.error, "Invalid username or recovery code");
  });

  test("an account still holding the legacy code set regenerates directly", async () => {
    const legacyHash = hashLegacyRecoveryCode("ABCD1234");
    const user = await prisma.user.create({
      data: {
        username: "regenlegacy",
        alias: "Regen Legacy",
        passwordHash: await hashNewPassword("LegacyRegenPass15!"),
        recoveryCodesIssuedAt: null,
        recoveryKeys: { create: [{ keyHash: legacyHash }] },
      },
    });

    const result = await regenerateRecoveryCodesForUser(user.id, regenForm("LegacyRegenPass15!"));
    assert.equal(result?.success, true, "legacy accounts must not be forced through login rotation first");
    assert.equal(result?.recoveryCodes?.length, 8);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(after!.recoveryCodesIssuedAt, "the account is marked modern after regeneration");
    const keys = await prisma.recoveryKey.findMany({ where: { userId: user.id } });
    assert.equal(keys.length, 8);
    assert.ok(!keys.some((k) => k.keyHash === legacyHash), "the legacy key is purged");
  });

  test("the recoveryRegen rate limit holds", async () => {
    const user = await prisma.user.create({
      data: {
        username: "regenratelimit",
        alias: "Regen Rate Limit",
        passwordHash: await hashNewPassword("RateLimitPass15!"),
        recoveryCodesIssuedAt: new Date(),
      },
    });

    // The shared "unknown" client bucket may already hold spent tokens from
    // earlier tests in this file, so consume until throttled (bounded loop):
    // the invariant is that the bucket throttles well before 12 consecutive
    // attempts (capacity 5, refill 2/min).
    let throttled = false;
    let successes = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const result = await regenerateRecoveryCodesForUser(user.id, regenForm("RateLimitPass15!"));
      if (result?.error?.startsWith("Too many requests")) {
        throttled = true;
        break;
      }
      if (result?.success) successes += 1;
    }
    assert.ok(throttled, "the recoveryRegen bucket must throttle consecutive attempts");
    assert.ok(successes >= 1, "legitimate attempts succeed until the bucket empties");
  });
});
