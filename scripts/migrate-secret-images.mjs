#!/usr/bin/env node
/**
 * One-off operational migration for PHASE_47 (audit S1).
 *
 * Moves existing PublishedImage files from data/uploads/ into the isolated
 * data/uploads/secret/ directory so they are no longer reachable through the
 * public /api/uploads route (which now serves only filenames referenced by an
 * existing Tool.imageUrl). Secret-link images remain reachable exclusively at
 * /i/<token>.
 *
 * Usage (host or container, from the app working directory):
 *   node scripts/migrate-secret-images.mjs
 *
 * Idempotent: files already present in secret/ are skipped; source files that
 * are missing everywhere are reported and left for the operator to inspect.
 * Safe to re-run. No rows are modified — PublishedImage.filename is the bare
 * filename and stays valid in the new directory.
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const uploadsDir = path.resolve(process.cwd(), "data/uploads");
const secretDir = path.join(uploadsDir, "secret");

const prisma = new PrismaClient();

try {
  const images = await prisma.publishedImage.findMany({ select: { filename: true } });

  let moved = 0;
  let alreadyMigrated = 0;
  let missing = 0;

  for (const { filename } of images) {
    const safe = path.basename(filename);
    const src = path.join(uploadsDir, safe);
    const dest = path.join(secretDir, safe);

    if (fs.existsSync(dest)) {
      alreadyMigrated++;
      continue;
    }
    if (!fs.existsSync(src)) {
      missing++;
      console.error(`[migrate-secret-images] MISSING (not found in either directory): ${safe}`);
      continue;
    }

    fs.mkdirSync(secretDir, { recursive: true });
    fs.renameSync(src, dest);
    moved++;
  }

  console.log(
    `[migrate-secret-images] done: moved=${moved} alreadyMigrated=${alreadyMigrated} missing=${missing} totalRows=${images.length}`
  );
  if (missing > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
