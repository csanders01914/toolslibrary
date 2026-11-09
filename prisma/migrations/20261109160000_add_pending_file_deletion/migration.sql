-- Stage 6 (KILO auth/security plan): durable file-purge reconciliation.
--
-- Account/tool/image deletion writes one PendingFileDeletion row per
-- orphan-prone filename INSIDE the deletion transaction, then attempts the
-- unlink immediately after commit; a failed unlink leaves the record for the
-- boot-time sweep (drainPendingFileDeletions, wired in
-- src/instrumentation.ts) to retry idempotently until the bytes are gone.

-- CreateTable
CREATE TABLE "PendingFileDeletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'public',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingFileDeletion_filename_key" ON "PendingFileDeletion"("filename");
