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
 * Stage 5 integration tests (KILO auth/security plan): session revocation
 * via the per-user sessionVersion counter.
 *
 * Runs in its OWN node:test child process with a DISPOSABLE SQLite
 * database (data/test-auth-stage5.db, gitignored) provisioned with the
 * real migrations — never the development or production database.
 *
 * The revocation CHECK is exercised through its extracted, testable form
 * (isSessionRevoked in src/lib/credentialAuth.ts) — the exact function the
 * Node-runtime jwt callback calls on every session access. The jwt-callback
 * wiring itself (token stamping at sign-in, null-return on revocation) is
 * thin and is exercised by the Stage 7 end-to-end pass; the bump semantics
 * are exercised through the real server actions here.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type {
  recoverAccount as recoverAccountType,
  changePasswordForUser as changePasswordForUserType,
} from "../src/lib/actions/auth";
import type { updateUserRoleForCaller as updateUserRoleForCallerType } from "../src/lib/actions/admin";
import type { isSessionRevoked as isSessionRevokedType } from "../src/lib/credentialAuth";

const dbPath = path
  .join(process.cwd(), "data", "test-auth-stage5.db")
  .split(path.sep)
  .join("/");
const dbUrl = `file:${dbPath}`;

let prisma: PrismaClient;
let recoverAccount: typeof recoverAccountType;
let changePasswordForUser: typeof changePasswordForUserType;
let updateUserRoleForCaller: typeof updateUserRoleForCallerType;
let isSessionRevoked: typeof isSessionRevokedType;
let hashNewPassword: (password: string) => Promise<string>;
let hashRecoveryCode: (code: string) => string;

before(async () => {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  process.env.DATABASE_URL = dbUrl;
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });

  prisma = (await import("../src/lib/db")).prisma;
  const authActions = await import("../src/lib/actions/auth");
  recoverAccount = authActions.recoverAccount;
  changePasswordForUser = authActions.changePasswordForUser;
  const adminActions = await import("../src/lib/actions/admin");
  updateUserRoleForCaller = adminActions.updateUserRoleForCaller;
  const cred = await import("../src/lib/credentialAuth");
  isSessionRevoked = cred.isSessionRevoked;
  hashNewPassword = (await import("../src/lib/passwords")).hashNewPassword;
  hashRecoveryCode = (await import("../src/lib/crypto")).hashRecoveryCode;
});

after(async () => {
  await prisma?.$disconnect();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
});

async function createUser(username: string, alias: string, role: string): Promise<{ id: string; password: string }> {
  const password = `${username}Pass15!x`;
  const user = await prisma.user.create({
    data: {
      username,
      alias,
      role,
      passwordHash: await hashNewPassword(password),
      recoveryCodesIssuedAt: new Date(),
    },
  });
  return { id: user.id, password };
}

function passwordForm(currentPassword: string, newPassword: string): FormData {
  const fd = new FormData();
  fd.set("currentPassword", currentPassword);
  fd.set("newPassword", newPassword);
  return fd;
}

function roleForm(userId: string, role: string): FormData {
  const fd = new FormData();
  fd.set("userId", userId);
  fd.set("role", role);
  return fd;
}

describe("the revocation check", () => {
  test("a token whose version matches the database is valid", async () => {
    const user = await createUser("revmatch", "Revocation Match", "USER");
    assert.equal(
      await isSessionRevoked({ userId: user.id, sessionVersion: 0 }),
      false
    );
  });

  test("a token whose version is behind the database is revoked", async () => {
    const user = await createUser("revstale", "Revocation Stale", "USER");
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    assert.equal(
      await isSessionRevoked({ userId: user.id, sessionVersion: 0 }),
      true
    );
  });

  test("a pre-migration token without a version is treated as version 0 (graceful rollout)", async () => {
    const user = await createUser("revlegacy", "Revocation Legacy", "USER");
    assert.equal(
      await isSessionRevoked({ userId: user.id, sessionVersion: undefined }),
      false,
      "the deploy must not mass-invalidate existing sessions"
    );
  });

  test("a deleted account's token is revoked immediately", async () => {
    const user = await createUser("revdeleted", "Revocation Deleted", "USER");
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal(
      await isSessionRevoked({ userId: user.id, sessionVersion: 0 }),
      true
    );
  });
});

describe("revocation bumps through the real actions", () => {
  test("a recovery reset bumps sessionVersion (revokes ALL sessions)", async () => {
    const user = await createUser("revrecover", "Revocation Recover", "USER");
    const code = "ReV1-CoDe-2233";
    await prisma.recoveryKey.create({
      data: { userId: user.id, keyHash: hashRecoveryCode(code) },
    });

    const fd = new FormData();
    fd.set("username", "revrecover");
    fd.set("recoveryCode", code);
    fd.set("newPassword", "ResetPassword15!");
    const result = await recoverAccount(undefined, fd);
    assert.equal(result?.success, true);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(stored!.sessionVersion, 1, "the reset must bump the version");
    assert.equal(
      await isSessionRevoked({ userId: user.id, sessionVersion: 0 }),
      true,
      "every pre-reset token is now dead"
    );
  });

  test("a password change bumps sessionVersion", async () => {
    const user = await createUser("revchange", "Revocation Change", "USER");

    const result = await changePasswordForUser(
      user.id,
      passwordForm(user.password, "ChangedPassword15!")
    );
    assert.equal(result?.success, true);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(stored!.sessionVersion, 1);
    assert.equal(
      await isSessionRevoked({ userId: user.id, sessionVersion: 0 }),
      true,
      "the pre-change token is dead"
    );
  });

  test("role changes bump the target's sessionVersion", async () => {
    await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "USER" } });
    const caller = await createUser("revcaller", "Revocation Caller", "ADMIN");
    const target = await createUser("revtarget", "Revocation Target", "USER");

    // Promotion bumps.
    await updateUserRoleForCaller(caller.id, roleForm(target.id, "ADMIN"));
    let stored = await prisma.user.findUnique({ where: { id: target.id } });
    assert.equal(stored!.sessionVersion, 1, "promotion must bump the target's version");

    // Demotion bumps too — and the stale ADMIN token dies.
    await updateUserRoleForCaller(caller.id, roleForm(target.id, "USER"));
    stored = await prisma.user.findUnique({ where: { id: target.id } });
    assert.equal(stored!.sessionVersion, 2, "demotion must bump the target's version");
    assert.equal(
      await isSessionRevoked({ userId: target.id, sessionVersion: 1 }),
      true,
      "the token issued at promotion is dead after demotion"
    );
  });
});

describe("the stale-role window closes (multi-session demonstration)", () => {
  test("an old token dies at the central check after a role change", async () => {
    await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "USER" } });
    const caller = await createUser("windowcaller", "Window Caller", "ADMIN");
    const target = await createUser("windowtarget", "Window Target", "USER");

    // Token A: what the target's browser holds right now (USER role, version 0).
    const tokenA = { userId: target.id, sessionVersion: 0 };
    assert.equal(await isSessionRevoked(tokenA), false);

    // The operator promotes the target; the bump revokes every token the
    // target holds. Their next request re-authenticates and receives a
    // token with the ADMIN role — there is no window in which a demoted
    // (or promoted) account keeps acting on a stale role.
    await updateUserRoleForCaller(caller.id, roleForm(target.id, "ADMIN"));
    assert.equal(
      await isSessionRevoked(tokenA),
      true,
      "the pre-change token must be revoked by the bump"
    );

    // Only a token issued after the change (fresh sign-in) survives.
    const tokenB = { userId: target.id, sessionVersion: 1 };
    assert.equal(await isSessionRevoked(tokenB), false);
  });
});
