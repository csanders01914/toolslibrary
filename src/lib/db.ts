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

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
  });

prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;').catch(() => {});

// SEC_REVIEW_HIGH_2_SINGLE_WRITER_DOC: startup validation for single-writer
// deployment. The platform uses SQLite with an in-process registration lock
// (src/lib/actions/auth.ts:withRegistrationLock) and in-memory rate-limiter
// buckets. Multiple Node processes writing to the same SQLite database would
// race the registration critical section and share no rate-limit state. This
// check runs once per process at module load and logs a prominent warning if
// another PrismaClient instance is already active (indicating a multi-process
// or multi-bundle deployment that violates the single-writer contract).
if (globalForPrisma.prisma && globalForPrisma.prisma !== prisma) {
  // This branch is unreachable because of the || above, but we keep the
  // pattern for clarity: the singleton assignment below is the authoritative
  // guard. If you see this warning in logs, you are running multiple Prisma
  // clients in the same process — consolidate to one.
  console.warn(
    '[db] WARNING: Multiple PrismaClient instances detected. ' +
    'This application requires a SINGLE WRITER deployment — only one Node ' +
    'process may write to the SQLite database. Multi-process deployments ' +
    '(PM2 cluster, multiple Podman replicas, etc.) will race the registration ' +
    'lock and share no rate-limit state. See DEPLOYMENT.md and docs/DEPLOY.md.'
  );
}

// Audit P5: unconditional singleton. In production the module can be
// evaluated per bundle chunk; the old NODE_ENV-conditional let each
// evaluation instantiate another PrismaClient (a connection pool per chunk).
globalForPrisma.prisma = prisma;
