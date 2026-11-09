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
 * Stage 6 integration tests (KILO auth/security plan): durable file-purge
 * reconciliation for the zero-PII deletion paths.
 *
 * The whole process is chdir'd into a disposable sandbox BEFORE the app
 * modules load, so uploads.ts's module-level UPLOADS_DIR (resolved from
 * process.cwd()) points at the sandbox tree — the real data/uploads volume
 * is never touched. The database is a disposable SQLite file provisioned
 * with the real migrations.
 *
 * Failure simulation is deterministic and portable: the test temporarily
 * replaces fs.promises.unlink with a failing stub while the deletion action
 * runs (restored in a finally), so the retry semantics are exercised
 * identically on every platform — permission-based simulation is unreliable
 * (libuv strips the Windows read-only attribute before unlinking).
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type {
  deleteOwnAccountForUser as deleteOwnAccountForUserType,
} from "../src/lib/actions/auth";
import type { deleteUserForCaller as deleteUserForCallerType } from "../src/lib/actions/admin";
import type {
  drainPendingFileDeletions as drainPendingFileDeletionsType,
} from "../src/lib/uploads";

const projectRoot = process.cwd();
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "kilo", "file-purge-"));
const uploadsDir = path.join(sandbox, "data", "uploads");
const secretDir = path.join(uploadsDir, "secret");
fs.mkdirSync(secretDir, { recursive: true });
const dbUrl = `file:${sandbox.split(path.sep).join("/")}/data/test-auth-stage6.db`;
const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");

// Must happen BEFORE any app-module import: UPLOADS_DIR is a module-level
// constant resolved from process.cwd().
process.chdir(sandbox);

let prisma: PrismaClient;
let deleteOwnAccountForUser: typeof deleteOwnAccountForUserType;
let deleteUserForCaller: typeof deleteUserForCallerType;
let drainPendingFileDeletions: typeof drainPendingFileDeletionsType;
let hashNewPassword: (password: string) => Promise<string>;

before(async () => {
  // Disposable database URL — MUST be set before any Prisma client is
  // constructed. Without this the generated client auto-loads the project
  // .env and the tests would run against the DEVELOPMENT database.
  process.env.DATABASE_URL = dbUrl;

  // Invoke the Prisma CLI through node on its JS entry (the boot-migrate.mjs
  // pattern): npx cannot resolve the package from the sandbox cwd, which has
  // no node_modules.
  const prismaJs = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
  execSync(`node "${prismaJs}" migrate deploy --schema "${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  prisma = (await import("../src/lib/db")).prisma;
  const authActions = await import("../src/lib/actions/auth");
  deleteOwnAccountForUser = authActions.deleteOwnAccountForUser;
  deleteUserForCaller = (await import("../src/lib/actions/admin")).deleteUserForCaller;
  const uploads = await import("../src/lib/uploads");
  drainPendingFileDeletions = uploads.drainPendingFileDeletions;
  hashNewPassword = (await import("../src/lib/passwords")).hashNewPassword;
});

after(async () => {
  await prisma?.$disconnect();
  process.chdir(projectRoot);
  fs.rmSync(sandbox, { recursive: true, force: true });
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

function deletionForm(password: string): FormData {
  const fd = new FormData();
  fd.set("password", password);
  fd.set("acknowledge", "true");
  return fd;
}

function deletionTargetForm(userId: string): FormData {
  const fd = new FormData();
  fd.set("userId", userId);
  return fd;
}

/** Writes real bytes for a stored filename in the sandbox upload tree. */
function writeStoredFile(kind: "public" | "secret", filename: string): string {
  const dir = kind === "secret" ? secretDir : uploadsDir;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, "png-bytes");
  return filePath;
}

describe("durable file-purge reconciliation", () => {
  test("self-deletion purges files immediately and drains the records", async () => {
    const user = await createUser("purgeown", "Purge Own", "USER");
    await prisma.tool.create({
      data: {
        name: "Drill",
        description: "Cordless drill",
        category: "Tools",
        ownerId: user.id,
        imageUrl: "1700000000-abc123.png",
      },
    });
    await prisma.publishedImage.create({
      data: {
        token: "a".repeat(64),
        title: "Secret photo",
        filename: "1700000001-def456.png",
        ownerId: user.id,
      },
    });
    const publicFile = writeStoredFile("public", "1700000000-abc123.png");
    const secretFile = writeStoredFile("secret", "1700000001-def456.png");

    const result = await deleteOwnAccountForUser(user.id, deletionForm(user.password));
    assert.equal(result?.success, true);

    assert.equal(fs.existsSync(publicFile), false, "the public photo must be gone");
    assert.equal(fs.existsSync(secretFile), false, "the secret photo must be gone");
    assert.equal(await prisma.pendingFileDeletion.count(), 0, "records drained on success");
    assert.equal(await prisma.user.findUnique({ where: { id: user.id } }), null);
  });

  test("a failed unlink leaves the durable record; the sweep retries it", async () => {
    const user = await createUser("purgestuck", "Purge Stuck", "USER");
    await prisma.tool.create({
      data: {
        name: "Saw",
        description: "Hand saw",
        category: "Tools",
        ownerId: user.id,
        imageUrl: "1700000002-stuck1.png",
      },
    });
    const stuckFile = writeStoredFile("public", "1700000002-stuck1.png");

    // Simulate an fs failure portably: every unlink throws while the
    // deletion action runs; the real unlink is restored in finally.
    const realUnlink = fsp.unlink;
    const failingUnlink = (async () => {
      throw Object.assign(new Error("simulated fs failure"), { code: "EPERM" });
    }) as typeof realUnlink;
    let result: { success?: boolean; error?: string } | undefined;
    try {
      (fsp as unknown as { unlink: typeof realUnlink }).unlink = failingUnlink;
      result = await deleteOwnAccountForUser(user.id, deletionForm(user.password));
    } finally {
      (fsp as unknown as { unlink: typeof realUnlink }).unlink = realUnlink;
    }
    assert.equal(result?.success, true, "the DB deletion must not fail because the unlink did");

    assert.equal(fs.existsSync(stuckFile), true, "the file outlived the failed unlink");
    const record = await prisma.pendingFileDeletion.findUnique({
      where: { filename: "1700000002-stuck1.png" },
    });
    assert.ok(record, "the durable record must survive the failed purge");
    assert.equal(record.kind, "public");

    // The boot-time sweep converges once the fs recovers.
    const drained = await drainPendingFileDeletions();
    assert.equal(drained.removed, 1);
    assert.equal(drained.failed, 0);
    assert.equal(fs.existsSync(stuckFile), false, "the sweep removed the orphan");
    assert.equal(await prisma.pendingFileDeletion.count(), 0, "the record is drained");
  });

  test("the sweep is idempotent on missing files", async () => {
    await prisma.pendingFileDeletion.create({
      data: { filename: "1700000003-ghost789.png", kind: "public" },
    });

    const drained = await drainPendingFileDeletions();
    assert.equal(drained.removed, 1, "a missing file counts as removed (already gone)");
    assert.equal(await prisma.pendingFileDeletion.count(), 0);
  });

  test("guard-refused filenames drain instead of looping forever", async () => {
    await prisma.pendingFileDeletion.create({
      data: { filename: "../evil.png", kind: "public" },
    });

    const drained = await drainPendingFileDeletions();
    assert.equal(drained.removed, 1, "a refused name can never be a stored file — drain it");
    assert.equal(await prisma.pendingFileDeletion.count(), 0);
  });

  test("secret-kind records sweep through the secret directory", async () => {
    const secretFile = writeStoredFile("secret", "1700000004-sec567.png");
    await prisma.pendingFileDeletion.create({
      data: { filename: "1700000004-sec567.png", kind: "secret" },
    });

    const drained = await drainPendingFileDeletions();
    assert.equal(drained.removed, 1);
    assert.equal(fs.existsSync(secretFile), false);
  });

  test("the admin deletion path records and purges too", async () => {
    const caller = await createUser("purgeadmin", "Purge Admin", "ADMIN");
    const target = await createUser("purgetarget", "Purge Target", "USER");
    await prisma.tool.create({
      data: {
        name: "Sander",
        description: "Orbital sander",
        category: "Tools",
        ownerId: target.id,
        imageUrl: "1700000005-admin1.png",
      },
    });
    await prisma.publishedImage.create({
      data: {
        token: "b".repeat(64),
        title: "Admin-purged photo",
        filename: "1700000006-admin2.png",
        ownerId: target.id,
      },
    });
    const publicFile = writeStoredFile("public", "1700000005-admin1.png");
    const secretFile = writeStoredFile("secret", "1700000006-admin2.png");

    const result = await deleteUserForCaller(caller.id, deletionTargetForm(target.id));
    assert.equal(result?.success, true);

    assert.equal(fs.existsSync(publicFile), false);
    assert.equal(fs.existsSync(secretFile), false);
    assert.equal(await prisma.pendingFileDeletion.count(), 0);
    assert.equal(await prisma.user.findUnique({ where: { id: target.id } }), null);
  });
});
