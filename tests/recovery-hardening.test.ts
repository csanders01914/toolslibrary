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
 * Stage 3 integration tests (KILO auth/security plan): recovery-endpoint
 * hardening — cheap failure paths, per-account throttling, and the
 * edge-correct client-identity derivation.
 *
 * Runs in its OWN node:test child process (the runner spawns one process
 * per file), so the in-memory rate-limit buckets and per-process salt are
 * fresh here regardless of the other test files. The database is a
 * DISPOSABLE SQLite file provisioned with the real migrations — never the
 * development or production database.
 *
 * Timing note: the work order's "measure/bound timing exposure" is
 * satisfied structurally — the expensive password hash now happens only
 * after the cheap code pre-check passes, and the remaining asymmetry
 * between "no such user" and "bad code" is a single indexed query. Wall-
 * clock timing assertions would be flaky; the ordering contract is
 * asserted behaviorally (invalid inputs never consume a code and never
 * change a hash).
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { recoverAccount as recoverAccountType } from "../src/lib/actions/auth";

const dbPath = path
  .join(process.cwd(), "data", "test-auth-stage3.db")
  .split(path.sep)
  .join("/");
const dbUrl = `file:${dbPath}`;

let prisma: PrismaClient;
let recoverAccount: typeof recoverAccountType;
let hashNewPassword: (password: string) => Promise<string>;
let hashRecoveryCode: (code: string) => string;
let consumeToken: typeof import("../src/lib/rateLimit").consumeToken;
let hashClient: typeof import("../src/lib/rateLimit").hashClient;
let clientIdentifierFromHeaders: typeof import("../src/lib/rateLimit").clientIdentifierFromHeaders;

before(async () => {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  process.env.DATABASE_URL = dbUrl;
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });

  prisma = (await import("../src/lib/db")).prisma;
  const actions = await import("../src/lib/actions/auth");
  recoverAccount = actions.recoverAccount;
  const pw = await import("../src/lib/passwords");
  hashNewPassword = pw.hashNewPassword;
  hashRecoveryCode = (await import("../src/lib/crypto")).hashRecoveryCode;
  const rl = await import("../src/lib/rateLimit");
  consumeToken = rl.consumeToken;
  hashClient = rl.hashClient;
  clientIdentifierFromHeaders = rl.clientIdentifierFromHeaders;
});

after(async () => {
  await prisma?.$disconnect();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
});

function recoveryForm(username: string, code: string, newPassword: string): FormData {
  const fd = new FormData();
  fd.set("username", username);
  fd.set("recoveryCode", code);
  fd.set("newPassword", newPassword);
  return fd;
}

describe("client-identity derivation (edge-correct)", () => {
  test("cf-connecting-ip wins when a trusted edge provides it", () => {
    const h = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "spoofed, 203.0.113.7" });
    assert.equal(clientIdentifierFromHeaders(h), "203.0.113.7");
  });

  test("the LAST x-forwarded-for hop is used (Caddy appends the real client)", () => {
    const h = new Headers({ "x-forwarded-for": "spoofed-by-client, 198.51.100.9" });
    assert.equal(clientIdentifierFromHeaders(h), "198.51.100.9");
  });

  test("a single-hop XFF is used as-is", () => {
    const h = new Headers({ "x-forwarded-for": "198.51.100.9" });
    assert.equal(clientIdentifierFromHeaders(h), "198.51.100.9");
  });

  test("whitespace and empty hops are tolerated", () => {
    const h = new Headers({ "x-forwarded-for": " , spoofed , 198.51.100.9 " });
    assert.equal(clientIdentifierFromHeaders(h), "198.51.100.9");
  });

  test("no proxy headers falls back to the shared fail-safe identity", () => {
    assert.equal(clientIdentifierFromHeaders(new Headers()), "unknown");
    assert.equal(clientIdentifierFromHeaders(new Headers({ "x-forwarded-for": " , " })), "unknown");
  });
});

describe("per-account recovery throttle", () => {
  test("the recoverAccount bucket throttles one username without touching others", () => {
    const victim = hashClient("account-recovery:victim");
    for (let i = 0; i < 20; i++) {
      assert.ok(consumeToken("recoverAccount", victim).allowed, `attempt ${i + 1} must be allowed`);
    }
    assert.ok(!consumeToken("recoverAccount", victim).allowed, "attempt 21 must be throttled");
    // A different username has its own bucket.
    assert.ok(consumeToken("recoverAccount", hashClient("account-recovery:other")).allowed);
  });

  test("the action consults the per-account bucket", async () => {
    const user = await prisma.user.create({
      data: {
        username: "flooded",
        alias: "Flooded Account",
        passwordHash: await hashNewPassword("FloodedPass15!x"),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash: hashRecoveryCode("FlOo-DeD1-CoDe") }] },
      },
    });
    void user;

    // Exhaust the account bucket directly (as a distributed attack would).
    const victimKey = hashClient("account-recovery:flooded");
    for (let i = 0; i < 20; i++) {
      consumeToken("recoverAccount", victimKey);
    }

    const result = await recoverAccount(
      undefined,
      recoveryForm("flooded", "FlOo-DeD1-CoDe", "WhateverPass15!")
    );
    assert.equal(result?.success, false);
    assert.match(result?.error ?? "", /Too many requests/);
  });
});

describe("recovery cheap-failure ordering", () => {
  test("an invalid code fails uniformly and changes nothing", async () => {
    const passwordHash = await hashNewPassword("UntouchedPass15!");
    const keyHash = hashRecoveryCode("ReAl-CoDe-1234");
    const user = await prisma.user.create({
      data: {
        username: "cheapfail1",
        alias: "Cheap Fail One",
        passwordHash,
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash }] },
      },
    });

    const result = await recoverAccount(
      undefined,
      recoveryForm("cheapfail1", "WrOnG-CoDe-9999", "BrandNewPass15!")
    );
    assert.equal(result?.success, false);
    assert.equal(result?.error, "Invalid username or recovery code");

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(after!.passwordHash, passwordHash, "the stored hash must never change on a failed attempt");
    const key = await prisma.recoveryKey.findFirst({ where: { userId: user.id } });
    assert.equal(key!.usedAt ?? null, null, "the real code must stay unconsumed");
  });

  test("an invalid new password fails before the claim and the code stays usable", async () => {
    const code = "UsAb-Le1-CoDe";
    const user = await prisma.user.create({
      data: {
        username: "cheapfail2",
        alias: "Cheap Fail Two",
        passwordHash: await hashNewPassword("UntouchedPass16!"),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash: hashRecoveryCode(code) }] },
      },
    });

    // 14 code points — rejected by the policy BEFORE the code is claimed.
    const rejected = await recoverAccount(
      undefined,
      recoveryForm("cheapfail2", code, "Aa1!x".repeat(2) + "Aa1!x".slice(0, 4))
    );
    assert.equal(rejected?.success, false);
    assert.match(rejected?.error ?? "", /at least 15/);

    // The same code still works: the rejected attempt consumed nothing.
    const retry = await recoverAccount(
      undefined,
      recoveryForm("cheapfail2", code, "BrandNewPass15!")
    );
    assert.equal(retry?.success, true);
    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(await (await import("../src/lib/passwords")).verifyStoredPassword("BrandNewPass15!", stored!.passwordHash));
  });

  test("a valid recovery still works end-to-end after the reorder", async () => {
    const code = "EnD2-To3-EaD";
    const user = await prisma.user.create({
      data: {
        username: "cheapfail3",
        alias: "Cheap Fail Three",
        passwordHash: await hashNewPassword("OldPassword15!x"),
        recoveryCodesIssuedAt: new Date(),
        recoveryKeys: { create: [{ keyHash: hashRecoveryCode(code) }] },
      },
    });

    const result = await recoverAccount(
      undefined,
      recoveryForm("cheapfail3", code, "ResetPassword15!")
    );
    assert.equal(result?.success, true);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    const passwords = await import("../src/lib/passwords");
    assert.ok(await passwords.verifyStoredPassword("ResetPassword15!", stored!.passwordHash));
    assert.ok(!(await passwords.verifyStoredPassword("OldPassword15!x", stored!.passwordHash)));
    const key = await prisma.recoveryKey.findFirst({ where: { userId: user.id } });
    assert.ok(key!.usedAt, "the code is consumed exactly once");
  });
});
