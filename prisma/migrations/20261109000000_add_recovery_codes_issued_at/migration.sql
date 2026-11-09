-- One-time recovery-code upgrade (RECOVERY_CODES_12_CHAR_UPGRADE):
-- recoveryCodesIssuedAt records when an account received its current
-- 12-character case-sensitive recovery-code set. Null means the account
-- still holds the legacy 8-character (XXXX-XXXX) set and will be re-issued
-- the modern format at its next sign-in.
ALTER TABLE "User" ADD COLUMN "recoveryCodesIssuedAt" DATETIME;
