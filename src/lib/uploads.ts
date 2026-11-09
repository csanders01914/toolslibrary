/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Shared server-side storage for uploaded images.
 *
 * Two isolated directories with one shared validation/deletion core:
 * - data/uploads/          — PUBLIC listing photos (Tool.imageUrl), served by
 *                            /api/uploads/<filename>, which serves a file only
 *                            when an existing Tool.imageUrl references it.
 * - data/uploads/secret/   — secret-link images (PublishedImage), served ONLY
 *                            by /i/<token> (PHASE_47, audit S1). Never listed,
 *                            never publicly cached, never reachable through
 *                            /api/uploads.
 *
 * Single source of truth for every write surface that persists an image —
 * the /api/tools/create and /api/tools/[id]/image route handlers (public) and
 * /api/images/create (secret) — so the validation rules, filename scheme, and
 * deletion guards cannot drift apart. Server-only by construction: the
 * node:fs import fails any client bundle.
 *
 * Security posture:
 * - Size and MIME type are validated BEFORE the bytes are read from the
 *   multipart payload, so an oversized or disallowed upload is never written.
 * - Every stored image is decoded and re-encoded through sharp (PHASE_49):
 *   the client-supplied Content-Type is untrusted, metadata (EXIF GPS) is
 *   stripped, and the written bytes are canonical libvips output rather than
 *   attacker-controlled originals.
 * - The stored extension is derived from the validated MIME type, never from
 *   the user-supplied filename, so a spoofed filename can never choose the
 *   stored extension.
 * - Filenames are system-generated (`<timestamp>-<CSPRNG hex><ext>`); the
 *   128-bit random component keeps stored names unguessable and
 *   non-enumerable. Deletion refuses anything else, including path
 *   separators and `..`.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";

export const UPLOADS_DIR = path.resolve(process.cwd(), "data/uploads");

/** Secret-link images live in an isolated subdirectory of the uploads volume. */
export const SECRET_UPLOADS_DIR = path.join(UPLOADS_DIR, "secret");

/** Hard cap mirrored by the client-side PhotoUpload validation. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/**
 * Validates an uploaded image against the size cap and MIME allowlist.
 * Returns the user-facing error message, or null when the file is accepted.
 */
export function validateImageFile(image: File): string | null {
  if (image.size > MAX_UPLOAD_BYTES) {
    return "Image must be less than 5MB";
  }
  if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
    return "Invalid image type. Use JPEG, PNG, GIF, or WebP";
  }
  return null;
}

/**
 * Shared persistence core: validates, decodes + re-encodes the bytes through
 * sharp, generates a CSPRNG filename, and writes the result into the given
 * directory. Returns the stored filename, an error string, or no filename
 * when the caller passed an empty file.
 *
 * The sharp pass (PHASE_49, audit S7) does three jobs at once:
 * - Magic-byte validation: the client-supplied multipart Content-Type is
 *   untrusted, so the bytes are actually DECODED — a spoofed type wrapping
 *   non-image payload throws and is rejected before anything is written.
 * - Metadata stripping: re-encoding drops ALL container metadata (EXIF GPS
 *   coordinates, camera identifiers, comments). The platform's privacy
 *   contract is a coarse self-declared location label only — precise
 *   coordinates embedded by phone cameras must never survive an upload.
 * - Canonical re-encode: stored bytes are a clean, libvips-produced image of
 *   the validated format, never attacker-controlled original bytes.
 */
async function persistImage(
  image: File,
  dir: string
): Promise<{ filename?: string; error?: string }> {
  const validationError = validateImageFile(image);
  if (validationError) {
    return { error: validationError };
  }

  const raw = Buffer.from(await image.arrayBuffer());

  let reencoded: Buffer;
  try {
    // rotate() with no arguments bakes the EXIF orientation into the pixels
    // (so stripped-EXIF output renders upright); animated GIF/WebP keep their
    // frames via { animated: true }. Metadata is NOT carried over: sharp
    // strips it unless withMetadata/withExif is explicitly requested.
    const pipeline = sharp(raw, { failOn: "error", animated: true }).rotate();
    switch (image.type) {
      case "image/jpeg":
        reencoded = await pipeline.jpeg({ quality: 85 }).toBuffer();
        break;
      case "image/png":
        reencoded = await pipeline.png().toBuffer();
        break;
      case "image/webp":
        reencoded = await pipeline.webp().toBuffer();
        break;
      case "image/gif":
        reencoded = await pipeline.gif().toBuffer();
        break;
      default:
        // Unreachable: validateImageFile already gated the allowlist.
        return { error: "Invalid image type. Use JPEG, PNG, GIF, or WebP" };
    }
  } catch {
    return { error: "Invalid image file" };
  }

  // PHASE_53 (audit P1): async fs — the upload path must never block the
  // event loop on disk I/O.
  await fsp.mkdir(dir, { recursive: true });

  const ext = EXTENSION_BY_TYPE[image.type];
  const filename = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
  const filePath = path.join(dir, filename);

  await fsp.writeFile(filePath, reencoded);

  return { filename };
}

/**
 * Validates and persists an uploaded PUBLIC listing photo into data/uploads.
 * The stored filename becomes Tool.imageUrl and is served via
 * /api/uploads/<filename>.
 */
export async function saveUploadedImage(image: File): Promise<{ filename?: string; error?: string }> {
  return persistImage(image, UPLOADS_DIR);
}

/**
 * Validates and persists a SECRET-link image into data/uploads/secret/.
 * The stored filename becomes PublishedImage.filename and is served ONLY via
 * /i/<token> — never through the public /api/uploads route.
 */
export async function saveSecretImage(image: File): Promise<{ filename?: string; error?: string }> {
  return persistImage(image, SECRET_UPLOADS_DIR);
}

/**
 * Shared deletion core. Filenames are system-generated; anything else is
 * refused (path-traversal guard — Stage 6: the sweep reuses this exact
 * guard, so a poisoned purge record can never address an arbitrary path).
 *
 * Returns true when the file is GONE or there was nothing to do (refused
 * name, already deleted); false only on a real fs failure, which the
 * durable purge record (Stage 6) keeps alive for the boot-time sweep to
 * retry. Deletion is never a user-facing failure, but it is no longer
 * silently swallowed while claiming removal.
 */
async function removeStoredImage(dir: string, filename: string | null | undefined): Promise<boolean> {
  if (!filename || filename.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(filename)) return true;
  try {
    await fsp.unlink(path.join(dir, filename));
    return true;
  } catch (error) {
    // ENOENT (already gone) is the expected idempotent case.
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return true;
    return false;
  }
}

/** Removes a previously stored PUBLIC listing photo from data/uploads. */
export async function deleteUploadedImage(filename: string | null | undefined): Promise<boolean> {
  return removeStoredImage(UPLOADS_DIR, filename);
}

/**
 * Removes a previously stored SECRET-link image. Tries the isolated secret
 * directory first, then the legacy data/uploads/ location used before
 * PHASE_47, so pre-split rows still clean up fully.
 */
export async function deleteSecretImage(filename: string | null | undefined): Promise<boolean> {
  if (!filename || filename.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(filename)) return true;
  const removedFromSecret = await removeStoredImage(SECRET_UPLOADS_DIR, filename);
  if (removedFromSecret) return true;
  return removeStoredImage(UPLOADS_DIR, filename);
}

/**
 * Stage 6: writes durable purge records INSIDE the caller's deletion
 * transaction, so the bytes-outlived-the-process failure mode (process dies
 * between commit and unlink) still converges: the boot-time sweep drains
 * whatever the immediate purge could not. Duplicate filenames (two tools
 * referencing one stored file) are collapsed — the filename is unique here
 * and one unlink covers all references.
 */
export async function recordPendingFileDeletions(
  tx: Prisma.TransactionClient,
  files: { filename: string | null | undefined; kind: "public" | "secret" }[]
): Promise<void> {
  const seen = new Set<string>();
  const records = files.filter((f) => {
    if (!f.filename || seen.has(f.filename)) return false;
    seen.add(f.filename);
    return true;
  });
  if (records.length === 0) return;
  await tx.pendingFileDeletion.createMany({
    data: records.map((f) => ({ filename: f.filename as string, kind: f.kind })),
  });
}

/**
 * Stage 6: the post-commit purge used by the deletion actions. Attempts the
 * unlink immediately (the common case — no wait for the sweep); on success
 * the durable record is drained; on failure the record stays and the
 * boot-time sweep retries. Never throws for fs reasons — the record is the
 * durability guarantee, not this call's outcome.
 */
export async function purgeStoredImage(
  filename: string | null | undefined,
  kind: "public" | "secret"
): Promise<void> {
  if (!filename) return;
  const ok =
    kind === "secret" ? await deleteSecretImage(filename) : await deleteUploadedImage(filename);
  if (ok) {
    const { prisma } = await import("@/lib/db");
    await prisma.pendingFileDeletion.deleteMany({ where: { filename } });
  }
}

/**
 * Stage 6: the boot-time sweep (wired in src/instrumentation.ts). Drains
 * pending purge records idempotently: a missing file counts as removed
 * (already gone), a guard-refused filename is drained with an error log
 * (it can never be a stored name — retrying would loop forever), and a
 * real fs failure keeps the record with an incremented attempt counter for
 * the next boot. Bounded per invocation so a large backlog cannot block
 * boot; the next boot continues the drain.
 */
export async function drainPendingFileDeletions(
  limit = 200
): Promise<{ removed: number; failed: number }> {
  const { prisma } = await import("@/lib/db");
  const pending = await prisma.pendingFileDeletion.findMany({
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  let removed = 0;
  let failed = 0;
  for (const record of pending) {
    const ok =
      record.kind === "secret"
        ? await deleteSecretImage(record.filename)
        : await deleteUploadedImage(record.filename);
    if (ok) {
      await prisma.pendingFileDeletion.delete({ where: { id: record.id } });
      removed += 1;
    } else {
      await prisma.pendingFileDeletion.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      failed += 1;
      console.error(
        `[file-purge] unlink failed; record kept for retry: kind=${record.kind} filename=${record.filename} attempts=${record.attempts + 1}`
      );
    }
  }
  return { removed, failed };
}

/** Hard cap on any multipart request body (10MB image cap + field overhead). */
export const MAX_MULTIPART_BODY_BYTES = 12 * 1024 * 1024;

/** Thrown by readCappedForm when the request body exceeds the cap. */
export class PayloadTooLargeError extends Error {}

/**
 * Audit P7: parse a multipart form under a REAL body cap. request.formData()
 * RAM-buffers the whole payload bounded only by the client-declared
 * Content-Length — a spoofable header that a chunked request simply omits.
 * The declared length is still checked first (cheap fast-fail), then a
 * streamed body is consumed with a hard byte cap before the multipart
 * parser ever sees the bytes, so no request can make the server buffer
 * unbounded input.
 */
export async function readCappedForm(
  request: Request,
  maxBytes: number = MAX_MULTIPART_BODY_BYTES
): Promise<FormData> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const declared = Number(declaredLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new PayloadTooLargeError();
    }
  }

  if (!request.body) {
    return request.formData();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  // Rebuild the request around the capped body: the multipart parser needs
  // the original Content-Type (boundary), but any stale Content-Length must
  // go — the runtime recomputes it from the buffered blob.
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, {
    method: "POST",
    headers,
    // The stream chunks are plain Uint8Array views over ordinary ArrayBuffers;
    // the DOM BlobPart type is narrower than TS's ArrayBufferLike view type,
    // so the cast documents that no SharedArrayBuffer ever flows here.
    body: new Blob(chunks as unknown as BlobPart[]),
  }).formData();
}
