-- AlterTable
ALTER TABLE "User" ADD COLUMN "canaryPassphraseHash" TEXT;

-- CreateTable
CREATE TABLE "CanaryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "committedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "signature" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "adminAlias" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CanaryPending" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanaryPending_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CanaryKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CanaryEvent_seq_key" ON "CanaryEvent"("seq");

-- CreateIndex
CREATE INDEX "CanaryEvent_committedAt_idx" ON "CanaryEvent"("committedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryPending_userId_key" ON "CanaryPending"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryPending_tokenHash_key" ON "CanaryPending"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryKey_publicKey_key" ON "CanaryKey"("publicKey");
