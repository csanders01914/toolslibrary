/**
 * Boot-time migration gate (PHASE_46 follow-up; outage 2026-11-08).
 *
 * `prisma migrate deploy` refuses to re-create tables that already exist, so
 * a database created by the old `prisma db push` boot (no `_prisma_migrations`
 * table) crashes the container on `migrate deploy` — which took the whole
 * site down, because deploy.sh replaces the old container before the new one
 * proves healthy. This script runs BEFORE `migrate deploy` on every boot and
 * reconciles the migration bookkeeping with the schema that is ACTUALLY in
 * the database:
 *
 * - For each migration, in order, it tests a concrete schema footprint
 *   (table or column the migration creates). A footprint that is present in
 *   the database but not recorded as applied — the db-push-era state, or a
 *   migration whose apply crashed mid-boot — is marked applied with
 *   `prisma migrate resolve --applied <name>`.
 * - The first migration whose footprint is ABSENT stops the scan: everything
 *   after it is genuinely pending and is left for `migrate deploy` to apply.
 * - Already-applied migrations are never touched (resolve would fail), and
 *   only the known baseline migrations are ever resolved — a failed NEW
 *   migration still fails the boot loudly for a human to reconcile.
 *
 * The result is idempotent across all three database vintages: fresh empty
 * volume (nothing resolved, deploy creates everything), db-push-era volume
 * (exactly the pre-existing migrations resolved, deploy applies the rest),
 * and fully migrated volume (no-op).
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Invoke the Prisma CLI through node on its JS entry rather than the
// platform-specific .bin shim: the shim is a bash script (unspawnable on
// Windows dev hosts) while this works identically in the alpine container.
const PRISMA_JS = path.join(path.dirname(require.resolve("prisma/package.json")), "build", "index.js");

/**
 * Ordered migration footprints. Each `present()` receives a schema view:
 * { tables: Set<string>, columns: (table) => Promise<Set<string>> } and
 * answers "does this migration's output already exist in the database?".
 */
const MIGRATIONS = [
  {
    name: "0_init",
    present: (s) => s.tables.has("User"),
  },
  {
    name: "20261029135445_add_vouch_model",
    present: (s) => s.tables.has("Vouch"),
  },
  {
    name: "20261029210713_add_vouch_decline",
    present: async (s) => s.tables.has("Vouch") && (await s.columns("Vouch")).has("declined"),
  },
  {
    name: "20261030220000_add_canary_models",
    present: (s) => s.tables.has("CanaryEvent"),
  },
  {
    name: "20261103185000_add_tool_image_alt",
    present: async (s) => s.tables.has("Tool") && (await s.columns("Tool")).has("imageAlt"),
  },
  {
    name: "20261107000000_add_published_image",
    present: (s) => s.tables.has("PublishedImage"),
  },
  {
    // Stage 1 reconciliation (KILO auth/security plan): location and
    // notificationEmail were db-push-era columns missing from the migration
    // history. On db-push-era volumes both columns already exist, so this
    // footprint marks the migration applied instead of letting
    // `migrate deploy` crash on a duplicate column. (20261109000000 is
    // deliberately NOT listed: recoveryCodesIssuedAt was genuinely new in
    // every vintage, so deploy applies it everywhere.)
    name: "20261109120000_add_user_location_notification_email",
    present: async (s) =>
      s.tables.has("User") &&
      (await s.columns("User")).has("location") &&
      (await s.columns("User")).has("notificationEmail"),
  },
];

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });

  try {
    const tables = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const tableNames = new Set(tables.map((t) => t.name));

    const columnCache = new Map();
    const columns = async (table) => {
      if (!columnCache.has(table)) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT name FROM pragma_table_info('${table.replace(/'/g, "''")}')`
        );
        columnCache.set(table, new Set(rows.map((r) => r.name)));
      }
      return columnCache.get(table);
    };

    // Migration bookkeeping: which migrations are recorded as applied?
    // (Prisma 5's _prisma_migrations has no rolled_back column — a failed
    // apply simply leaves finished_at NULL.)
    const applied = new Set();
    if (tableNames.has("_prisma_migrations")) {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT migration_name, finished_at FROM _prisma_migrations"
      );
      for (const row of rows) {
        if (row.finished_at != null) {
          applied.add(row.migration_name);
        }
      }
    }

    const schemaView = { tables: tableNames, columns };
    let resolved = 0;
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      const present = await migration.present(schemaView);
      if (!present) {
        // First genuinely pending migration: everything from here on is new
        // work for `migrate deploy`. (A db-push-era schema evolves in order,
        // so a later footprint cannot exist while an earlier one is missing.)
        break;
      }
      console.log(
        `[boot-migrate] schema for ${migration.name} already exists but is not recorded as applied — marking applied`
      );
      await prisma.$disconnect();
      execFileSync(process.execPath, [PRISMA_JS, "migrate", "resolve", "--applied", migration.name], {
        stdio: "inherit",
      });
      resolved++;
    }

    console.log(
      `[boot-migrate] baseline reconciliation done: ${resolved} migration(s) marked applied, ${applied.size} already recorded`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[boot-migrate] FAILED:", error);
  process.exit(1);
});
