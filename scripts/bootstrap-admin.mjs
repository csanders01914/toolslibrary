#!/usr/bin/env node
/**
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
 * Operator-controlled ADMIN bootstrap (Stage 4 of the KILO auth/security
 * plan).
 *
 * Registration no longer elects the first account ADMIN — that let a fresh
 * public deployment be hijacked by the first stranger to register. The
 * operator instead registers normally, then promotes their own account
 * with this script:
 *
 *   node scripts/bootstrap-admin.mjs <username>          # dry-run
 *   node scripts/bootstrap-admin.mjs <username> --yes    # apply
 *
 * - Operator-run only: there is no web surface, no token, and no expiry to
 *   manage; the script runs where the database is reachable (container
 *   exec on the server, or locally against the dev database).
 * - Single-use per invocation and idempotent: an already-ADMIN account is
 *   reported and left untouched; the promotion is a compare-and-set
 *   (`updateMany` where id AND current role match) so a concurrent role
 *   change can never be overwritten blindly.
 * - Never demotes anyone. The last-admin invariants live in the
 *   application actions (updateUserRoleForCaller / deleteOwnAccountForUser).
 *
 * Zero-PII: prints only the username, alias, and role — never credentials
 * (there are none to print; the script never touches password hashes).
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

// Minimal .env loader so local runs work without exporting DATABASE_URL
// manually. The container environment already provides the variable, in
// which case .env is not consulted. Values are assigned into process.env
// only — never printed, never logged.
if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

const username = process.argv[2];
const apply = process.argv.includes("--yes");

if (!username) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <username> [--yes]");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["error"] });

const user = await prisma.user.findUnique({
  where: { username },
  select: { id: true, username: true, alias: true, role: true },
});

if (!user) {
  console.error(`No account named "${username}" exists. Register the account first, then bootstrap it.`);
  await prisma.$disconnect();
  process.exit(1);
}

if (user.role === "ADMIN") {
  console.log(`"${user.username}" (${user.alias}) is already an administrator — nothing to do.`);
  await prisma.$disconnect();
  process.exit(0);
}

if (!apply) {
  console.log(`Would promote "${user.username}" (${user.alias}) from ${user.role} to ADMIN. Re-run with --yes to apply.`);
  await prisma.$disconnect();
  process.exit(0);
}

// Compare-and-set on the current role: a concurrent role change wins and
// this promotion stands down instead of overwriting it blindly.
const result = await prisma.user.updateMany({
  where: { id: user.id, role: user.role },
  data: { role: "ADMIN" },
});

if (result.count !== 1) {
  console.error(`The role of "${user.username}" changed concurrently — re-run the script.`);
  await prisma.$disconnect();
  process.exit(1);
}

console.log(`Promoted "${user.username}" (${user.alias}) to ADMIN.`);
await prisma.$disconnect();
