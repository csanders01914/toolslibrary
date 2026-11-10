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
 * SEC_REVIEW_TEST_1_ADMIN_BYPASS_INTEGRATION: integration test for the
 * demoted admin middleware bypass fix (Critical #1).
 *
 * The fix: removed admin role check from edge middleware `authorized` callback;
 * added `export const runtime = 'nodejs'` to all admin pages so they run in
 * Node runtime where the central `sessionVersion` revocation check in
 * `src/auth.ts` jwt callback applies.
 *
 * This test verifies the full flow:
 * 1. Create admin user
 * 2. Simulate sign-in (session with sessionVersion = 0)
 * 3. Demote admin to USER via second session (bumps sessionVersion to 1)
 * 4. First session's token (sessionVersion = 0) is now revoked
 * 5. Access to /admin would redirect to /dashboard (session revoked)
 *
 * Runs in its OWN node:test child process with a DISPOSABLE SQLite
 * database (data/test-admin-bypass.db, gitignored) provisioned with the
 * real migrations — never the development or production database.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { updateUserRoleForCaller as updateUserRoleForCallerType } from "../src/lib/actions/admin";
import type { isSessionRevoked as isSessionRevokedType } from "../src/lib/credentialAuth";

const dbPath = path
  .join(process.cwd(), "data", "test-admin-bypass.db")
  .split(path.sep)
  .join("/");
const dbUrl = `file:${dbPath}`;

let prisma: PrismaClient;
let updateUserRoleForCaller: typeof updateUserRoleForCallerType;
let isSessionRevoked: typeof isSessionRevokedType;
let hashNewPassword: (password: string) => Promise<string>;

before(async () => {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  process.env.DATABASE_URL = dbUrl;
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });

  prisma = (await import("../src/lib/db")).prisma;
  const adminActions = await import("../src/lib/actions/admin");
  updateUserRoleForCaller = adminActions.updateUserRoleForCaller;
  const cred = await import("../src/lib/credentialAuth");
  isSessionRevoked = cred.isSessionRevoked;
  hashNewPassword = (await import("../src/lib/passwords")).hashNewPassword;
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

function roleForm(userId: string, role: string): FormData {
  const fd = new FormData();
  fd.set("userId", userId);
  fd.set("role", role);
  return fd;
}

describe("SEC_REVIEW_CRITICAL_1: admin middleware bypass after demotion", () => {
  test("demoted admin loses access immediately — old session revoked by sessionVersion bump", async () => {
    // Ensure clean state: no existing admins
    await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "USER" } });

    // Step 1: Create admin user (the "victim" who will be demoted)
    const admin = await createUser("adminvictim", "Admin Victim", "ADMIN");

    // Step 2: Create another admin (the "operator" who performs the demotion)
    const operator = await createUser("adminoperator", "Admin Operator", "ADMIN");

    // Step 3: Simulate the victim's session token (what their browser holds)
    // At sign-in, the JWT is stamped with the current sessionVersion (0)
    const victimToken = { userId: admin.id, sessionVersion: 0 };

    // The token is valid initially
    assert.equal(
      await isSessionRevoked(victimToken),
      false,
      "victim's initial session token must be valid"
    );

    // Step 4: Operator demotes the victim to USER
    // This calls updateUserRoleForCaller which bumps the victim's sessionVersion
    await updateUserRoleForCaller(operator.id, roleForm(admin.id, "USER"));

    // Step 5: Verify the victim's sessionVersion was bumped
    const demotedUser = await prisma.user.findUnique({ where: { id: admin.id } });
    assert.equal(demotedUser!.role, "USER", "victim must be demoted to USER");
    assert.equal(demotedUser!.sessionVersion, 1, "demotion must bump sessionVersion to 1");

    // Step 6: The victim's OLD token (sessionVersion = 0) is now revoked
    // This is the core of the fix: the edge middleware no longer checks role,
    // the request reaches the Node-runtime admin page, the jwt callback
    // compares token.sessionVersion (0) against DB (1), detects mismatch,
    // returns null → session revoked → redirect to /dashboard
    assert.equal(
      await isSessionRevoked(victimToken),
      true,
      "victim's pre-demotion token must be revoked by the sessionVersion bump"
    );

    // Step 7: Only a token issued AFTER the demotion (fresh sign-in) would survive
    const freshToken = { userId: admin.id, sessionVersion: 1 };
    assert.equal(
      await isSessionRevoked(freshToken),
      false,
      "a token with the new sessionVersion must be valid"
    );
  });

  test("promoted user's old USER token is revoked — promotion also bumps sessionVersion", async () => {
    // Ensure clean state
    await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "USER" } });

    const operator = await createUser("promoter", "Promoter", "ADMIN");
    const target = await createUser("promotetarget", "Promote Target", "USER");

    // Target's initial USER token
    const userToken = { userId: target.id, sessionVersion: 0 };
    assert.equal(await isSessionRevoked(userToken), false);

    // Operator promotes target to ADMIN
    await updateUserRoleForCaller(operator.id, roleForm(target.id, "ADMIN"));

    // Target's sessionVersion bumped
    const promotedUser = await prisma.user.findUnique({ where: { id: target.id } });
    assert.equal(promotedUser!.role, "ADMIN");
    assert.equal(promotedUser!.sessionVersion, 1);

    // Old USER token is revoked
    assert.equal(
      await isSessionRevoked(userToken),
      true,
      "promotion must also bump sessionVersion and revoke old token"
    );

    // Fresh ADMIN token works
    const adminToken = { userId: target.id, sessionVersion: 1 };
    assert.equal(await isSessionRevoked(adminToken), false);
  });

  test("edge middleware no longer checks admin role — request reaches Node runtime", async () => {
    // This test documents the architectural change: the edge middleware's
    // `authorized` callback no longer checks `auth.user.role === "ADMIN"` for
    // `/admin` paths. The request is allowed through to the Node-runtime
    // page where the jwt callback performs the sessionVersion check.
    //
    // The actual middleware behavior is tested in the Stage 7 end-to-end pass.
    // Here we verify the sessionVersion revocation mechanism that makes it work.

    await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "USER" } });
    const admin = await createUser("middlewareadmin", "Middleware Admin", "ADMIN");

    // Token with correct version passes
    const validToken = { userId: admin.id, sessionVersion: 0 };
    assert.equal(await isSessionRevoked(validToken), false);

    // Bump version (simulating any revocation event: password change, recovery, role change)
    await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } });

    // Old token now fails — this is what the Node-runtime jwt callback checks
    assert.equal(await isSessionRevoked(validToken), true);

    // The admin page (running in Node runtime) calls auth(), the jwt callback
    // runs isSessionRevoked, gets true, returns null, NextAuth redirects to
    // the sign-in page (or /dashboard for signed-in users with revoked sessions).
  });
});