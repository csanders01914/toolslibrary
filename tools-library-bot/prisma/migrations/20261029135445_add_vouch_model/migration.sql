-- CreateTable
CREATE TABLE "Vouch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "voucheeId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vouch_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vouch_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vouch_voucheeId_fkey" FOREIGN KEY ("voucheeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Vouch_voucheeId_idx" ON "Vouch"("voucheeId");

-- CreateIndex
CREATE UNIQUE INDEX "Vouch_loanId_voucherId_key" ON "Vouch"("loanId", "voucherId");
