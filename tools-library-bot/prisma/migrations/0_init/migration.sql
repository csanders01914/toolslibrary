-- ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
-- Copyright (C) 2026  Chris Sanders
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as
-- published by the Free Software Foundation, either version 3 of the
-- License, or (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- PHASE_22_DATA_SAFETY: baseline migration.
-- Generated with: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- This snapshot captures the schema previously managed by `prisma db push`.
-- Existing databases must be baselined once with:
--   npx prisma migrate resolve --applied 0_init
-- so `prisma migrate deploy` never re-runs these CREATE statements.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "trustScore" INTEGER NOT NULL DEFAULT 100,
    "a11yPrefs" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecoveryKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "imageUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tool_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "returnCondition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Loan_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "alias" TEXT,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "triageReason" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryKey_keyHash_key" ON "RecoveryKey"("keyHash");

-- CreateIndex
CREATE INDEX "RecoveryKey_userId_idx" ON "RecoveryKey"("userId");

-- CreateIndex
CREATE INDEX "Tool_status_category_idx" ON "Tool"("status", "category");

-- CreateIndex
CREATE INDEX "Tool_ownerId_idx" ON "Tool"("ownerId");

-- CreateIndex
CREATE INDEX "Loan_toolId_idx" ON "Loan"("toolId");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_idx" ON "Loan"("borrowerId");

-- CreateIndex
CREATE INDEX "Skill_category_available_idx" ON "Skill"("category", "available");

-- CreateIndex
CREATE INDEX "Skill_ownerId_idx" ON "Skill"("ownerId");

-- CreateIndex
CREATE INDEX "Message_fromId_toId_idx" ON "Message"("fromId", "toId");

-- CreateIndex
CREATE INDEX "Message_toId_read_idx" ON "Message"("toId", "read");

-- CreateIndex
CREATE INDEX "HelpRequest_status_route_idx" ON "HelpRequest"("status", "route");
