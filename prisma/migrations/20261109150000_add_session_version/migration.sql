-- Stage 5 session revocation (KILO auth/security plan).
--
-- Adds the per-user session-version counter that JWT sessions are checked
-- against: the JWT carries the sessionVersion it was issued with, and the
-- central jwt-callback check rejects the token when the database value no
-- longer matches (or the account was deleted). The counter is bumped on
-- recovery reset (revokes ALL sessions), password change, and role changes
-- — never by rehash-only upgrades, and AUTH_SECRET is never rotated for
-- this. Existing tokens issued before this migration carry no version and
-- are treated as version 0, so the deploy does not mass-invalidate
-- sessions; only bumped accounts are revoked.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
