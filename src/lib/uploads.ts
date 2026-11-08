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
 * - The stored extension is derived from the validated MIME type, never from
 *   the user-supplied filename, so a spoofed filename can never choose the
 *   stored extension.
 * - Filenames are system-generated (`<timestamp>-<CSPRNG hex><ext>`); the
 *   128-bit random component keeps stored names unguessable and
 *   non-enumerable. Deletion refuses anything else, including path
 *   separators and `..`.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
 * Shared persistence core: validates, generates a CSPRNG filename, and writes
 * the bytes into the given directory. Returns the stored filename, an error
 * string, or no filename when the caller passed an empty file.
 */
async function persistImage(
  image: File,
  dir: string
): Promise<{ filename?: string; error?: string }> {
  const validationError = validateImageFile(image);
  if (validationError) {
    return { error: validationError };
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = EXTENSION_BY_TYPE[image.type];
  const filename = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
  const filePath = path.join(dir, filename);

  const buffer = Buffer.from(await image.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

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

/** Shared deletion core. Filenames are system-generated; anything else is refused. */
function removeStoredImage(dir: string, filename: string | null | undefined): void {
  if (!filename || filename.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(filename)) return;
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/** Removes a previously stored PUBLIC listing photo from data/uploads. */
export function deleteUploadedImage(filename: string | null | undefined): void {
  removeStoredImage(UPLOADS_DIR, filename);
}

/** Removes a previously stored SECRET-link image from data/uploads/secret. */
export function deleteSecretImage(filename: string | null | undefined): void {
  removeStoredImage(SECRET_UPLOADS_DIR, filename);
}
