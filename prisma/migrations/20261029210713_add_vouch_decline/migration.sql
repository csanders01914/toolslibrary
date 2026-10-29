-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vouch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "voucheeId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vouch_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vouch_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vouch_voucheeId_fkey" FOREIGN KEY ("voucheeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Vouch" ("createdAt", "delta", "id", "loanId", "voucheeId", "voucherId") SELECT "createdAt", "delta", "id", "loanId", "voucheeId", "voucherId" FROM "Vouch";
DROP TABLE "Vouch";
ALTER TABLE "new_Vouch" RENAME TO "Vouch";
CREATE INDEX "Vouch_voucheeId_idx" ON "Vouch"("voucheeId");
CREATE UNIQUE INDEX "Vouch_loanId_voucherId_key" ON "Vouch"("loanId", "voucherId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
