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
 * Shared server-side storage for listing photos (data/uploads).
 *
 * Single source of truth for every write surface that persists a tool photo —
 * the /api/tools/create and /api/tools/[id]/image route handlers — so the
 * validation rules, filename scheme, and deletion guard cannot drift apart.
 * Server-only by construction: the node:fs import fails any client bundle.
 *
 * Security posture:
 * - Size and MIME type are validated BEFORE the bytes are read from the
 *   multipart payload, so an oversized or disallowed upload is never written.
 * - The stored extension is derived from the validated MIME type, never from
 *   the user-supplied filename. The public /api/uploads/<filename> route
 *   serves files by extension (e.g. .svg as image/svg+xml), so a spoofed
 *   filename must never choose the stored extension.
 * - Filenames are system-generated (`<timestamp>-<random><ext>`); deletion
 *   refuses anything else, including path separators and `..`.
 */

import fs from "node:fs";
import path from "node:path";

export const UPLOADS_DIR = path.resolve(process.cwd(), "data/uploads");

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
 * Validates and persists an uploaded listing photo into data/uploads.
 * Returns the stored filename, an error string, or no filename when the
 * caller passed an empty file.
 */
export async function saveUploadedImage(image: File): Promise<{ filename?: string; error?: string }> {
  const validationError = validateImageFile(image);
  if (validationError) {
    return { error: validationError };
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const ext = EXTENSION_BY_TYPE[image.type];
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  const buffer = Buffer.from(await image.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return { filename };
}

/** Removes a previously stored upload. Filenames are system-generated; anything else is refused. */
export function deleteUploadedImage(filename: string | null | undefined): void {
  if (!filename || filename.includes("..") || !/^[a-zA-Z0-9._-]+$/.test(filename)) return;
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
