-- Reconciliation migration (Stage 1 of the KILO auth/security plan).
--
-- `User.location` (PHASE_44_DOCS_LOCATION_STANDARD) and
-- `User.notificationEmail` (PHASE_29_ADMIN_EMAIL_NOTIFICATIONS) were added
-- to the schema during the pre-migration `prisma db push` era and never
-- recorded in the version-controlled migration history. Every existing
-- database (development, staging, production) already has both columns via
-- that era (and the boot-migrate baseline), but a FRESH volume provisioned
-- with `prisma migrate deploy` produced a schema the generated client
-- could not use — first surfaced by the Stage 1 disposable-database test
-- run (Prisma error: "The column `location` does not exist").
--
-- This migration records the missing columns so fresh installs converge
-- on the real schema. Existing volumes get it marked applied:
-- - db-push-era volumes: prisma/boot-migrate.mjs baselines it on boot via
--   the footprint entry in its MIGRATIONS list (both columns present).
-- - The local development database: `prisma migrate resolve --applied`
--   (the columns already exist; running the ALTERs would fail).
--
-- Matches schema.prisma exactly: both fields are optional String? → TEXT.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "location" TEXT;
ALTER TABLE "User" ADD COLUMN "notificationEmail" TEXT;
