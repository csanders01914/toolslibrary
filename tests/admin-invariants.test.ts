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
 * Stage 4 integration tests (KILO auth/security plan): the secure
 * first-admin bootstrap and the last-administrator invariants.
 *
 * Runs in its OWN node:test child process with a DISPOSABLE SQLite
 * database (data/test-auth-stage4.db, gitignored) provisioned with the
 * real migrations — never the development or production database. The
 * bootstrap-script tests execute the real scripts/bootstrap-admin.mjs via
 * child processes against the same disposable database.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type {
  registerUser as registerUserType,
  deleteOwnAccountForUser as deleteOwnAccountForUserType,
} from "../src/lib/actions/auth";
import type { updateUserRoleForCaller as updateUserRoleForCallerType } from "../src/lib/actions/admin";
import type {
  issueChallenge as issueChallengeType,
  getRequestClientHash as getRequestClientHashType,
} from "../src/lib/pow";

const dbPath = path
  .join(process.cwd(), "data", "test-auth-stage4.db")
  .split(path.sep)
  .join("/");
const dbUrl = `file:${dbPath}`;

let prisma: PrismaClient;
let registerUser: typeof registerUserType;
let deleteOwnAccountForUser: typeof deleteOwnAccountForUserType;
let updateUserRoleForCaller: typeof updateUserRoleForCallerType;
let hashNewPassword: (password: string) => Promise<string>;
let issueChallenge: typeof issueChallengeType;
let getRequestClientHash: typeof getRequestClientHashType;

before(async () => {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
  process.env.DATABASE_URL = dbUrl;
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });

  prisma = (await import("../src/lib/db")).prisma;
  const authActions = await import("../src/lib/actions/auth");
  registerUser = authActions.registerUser;
  deleteOwnAccountForUser = authActions.deleteOwnAccountForUser;
  updateUserRoleForCaller = (await import("../src/lib/actions/admin")).updateUserRoleForCaller;
  hashNewPassword = (await import("../src/lib/passwords")).hashNewPassword;
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

function roleForm(userId: string, role: string): FormData {
  const fd = new FormData();
  fd.set("userId", userId);
  fd.set("role", role);
  return fd;
}

function deletionForm(password: string): FormData {
  const fd = new FormData();
  fd.set("password", password);
  fd.set("acknowledge", "true");
  return fd;
}

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

/**
 * The file shares one disposable database across tests, so count-sensitive
 * scenarios normalize the admin population first: everything is demoted,
 * then the test creates exactly the admins its scenario describes.
 */
async function demoteAllAdmins(): Promise<void> {
  await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "USER" } });
}

describe("first-admin bootstrap", () => {
  test("registration never grants ADMIN, even for the very first account", async () => {
    // The database is empty at this point — the old election would have
    // granted ADMIN here.
    const result = await registerUser(
      undefined,
      await registrationForm("firstuser", "First User", "FirstUserPass15!")
    );
    assert.equal(result?.success, true, `registration should succeed: ${result?.error ?? ""}`);

    const user = await prisma.user.findUnique({ where: { username: "firstuser" } });
    assert.equal(user!.role, "USER", "registration must never auto-grant ADMIN");
  });

  test("the bootstrap script dry-runs, promotes, and is idempotent", async () => {
    const { id } = await createUser("bootstrapped", "Bootstrapped Admin", "USER");

    // Dry-run: reports the promotion without applying it.
    const dryRun = execSync(`node scripts/bootstrap-admin.mjs bootstrapped`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    }).toString();
    assert.match(dryRun, /Would promote/);
    assert.equal((await prisma.user.findUnique({ where: { id } }))!.role, "USER");

    // Apply.
    const applied = execSync(`node scripts/bootstrap-admin.mjs bootstrapped --yes`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    }).toString();
    assert.match(applied, /Promoted/);
    assert.equal((await prisma.user.findUnique({ where: { id } }))!.role, "ADMIN");

    // Idempotent: a second run reports and changes nothing.
    const again = execSync(`node scripts/bootstrap-admin.mjs bootstrapped --yes`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    }).toString();
    assert.match(again, /already an administrator/);
    assert.equal((await prisma.user.findUnique({ where: { id } }))!.role, "ADMIN");
  });

  test("the bootstrap script refuses unknown usernames", () => {
    assert.throws(
      () =>
        execSync(`node scripts/bootstrap-admin.mjs no-such-account --yes`, {
          env: { ...process.env, DATABASE_URL: dbUrl },
          stdio: "pipe",
        }),
      (error: { status?: number }) => error.status !== 0
    );
  });
});

describe("last-admin invariants", () => {
  test("role changes re-verify the caller from the database (stale-token window closed)", async () => {
    const caller = await createUser("stalecaller", "Stale Caller", "USER");
    const target = await createUser("roletarget", "Role Target", "USER");

    // A JWT that still says ADMIN (stale token) must not authorize role
    // changes once the database says USER.
    const result = await updateUserRoleForCaller(caller.id, roleForm(target.id, "USER"));
    assert.equal(result?.success, false);
    assert.equal(result?.error, "Admin privileges required");
    assert.equal((await prisma.user.findUnique({ where: { id: target.id } }))!.role, "USER");
  });

  test("self role changes remain blocked", async () => {
    const caller = await createUser("selfcaller", "Self Caller", "ADMIN");
    const result = await updateUserRoleForCaller(caller.id, roleForm(caller.id, "USER"));
    assert.equal(result?.success, false);
    assert.equal(result?.error, "Cannot change your own role");
  });

  test("a normal demotion works while two admins exist", async () => {
    await demoteAllAdmins();
    const adminA = await createUser("demoter", "Demoter", "ADMIN");
    const adminB = await createUser("demotee", "Demotee", "ADMIN");

    const result = await updateUserRoleForCaller(adminA.id, roleForm(adminB.id, "USER"));
    assert.equal(result?.success, true);
    assert.equal((await prisma.user.findUnique({ where: { id: adminB.id } }))!.role, "USER");
    assert.equal(await prisma.user.count({ where: { role: "ADMIN" } }), 1);
  });

  test("concurrent mutual demotions can never reach zero admins", async () => {
    await demoteAllAdmins();
    const adminA = await createUser("mutualA", "Mutual A", "ADMIN");
    const adminB = await createUser("mutualB", "Mutual B", "ADMIN");

    // A demotes B while B demotes A. SQLite serializes the two
    // transactions; the second observes count 1 and refuses. The invariant
    // asserted here is the one that matters: the platform never ends up
    // with zero administrators, no matter how the race resolves.
    const outcomes = await Promise.allSettled([
      updateUserRoleForCaller(adminA.id, roleForm(adminB.id, "USER")),
      updateUserRoleForCaller(adminB.id, roleForm(adminA.id, "USER")),
    ]);

    const successes = outcomes.filter(
      (o) => o.status === "fulfilled" && o.value?.success === true
    ).length;
    assert.ok(successes <= 1, "at most one mutual demotion may succeed");
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    assert.ok(adminCount >= 1, "the platform must never reach zero administrators");
  });

  test("the last administrator cannot self-delete", async () => {
    await demoteAllAdmins();
    const admin = await createUser("lastadmin", "Last Admin", "ADMIN");
    assert.equal(await prisma.user.count({ where: { role: "ADMIN" } }), 1);

    const result = await deleteOwnAccountForUser(admin.id, deletionForm(admin.password));
    assert.equal(result?.success, false);
    assert.match(result?.error ?? "", /last administrator/);
    assert.ok(await prisma.user.findUnique({ where: { id: admin.id } }), "the account must survive");
  });

  test("a second administrator can self-delete", async () => {
    await demoteAllAdmins();
    const adminA = await createUser("deleterA", "Deleter A", "ADMIN");
    await createUser("deleterB", "Deleter B", "ADMIN");

    const result = await deleteOwnAccountForUser(adminA.id, deletionForm(adminA.password));
    assert.equal(result?.success, true);
    assert.equal(await prisma.user.findUnique({ where: { id: adminA.id } }), null);
    assert.equal(await prisma.user.count({ where: { role: "ADMIN" } }), 1);
  });
});
