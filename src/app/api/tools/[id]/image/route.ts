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
 * POST /api/tools/[id]/image — owner (or admin) edit endpoint for an existing
 * listing, including its photo.
 *
 * This route exists to bypass Next.js Server Actions for photo-bearing
 * submissions: behind the Cloudflare Tunnel, the edge proxy rejects
 * multi-megabyte binary multipart POSTs aimed at Server Action endpoints with
 * an instant 403, while plain REST route handlers pass. The edit form
 * (src/app/tools/[id]/edit/ToolEditClient.tsx) therefore submits its FormData
 * here with a standard fetch instead of invoking the updateTool action.
 *
 * Contract: raw multipart/form-data with the fields name, description,
 * category, removeImage ("true"|"false"), image (File, optional), and
 * imageAlt (optional screen-reader photo description). The binary file is
 * extracted, validated, persisted to data/uploads, the Prisma SQLite record
 * is updated, and a JSON result is returned. Semantics mirror the former
 * updateTool server action exactly: a new upload supersedes the old file, an
 * explicit removeImage flag clears it, and otherwise the current photo is
 * kept. imageAlt follows the same edit semantics: non-empty replaces, empty
 * clears, absent keeps the stored description.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/uploads";

const updateToolSchema = z.object({
  name: z.string().min(1, "Tool name is required").max(100, "Name too long"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description too long"),
  category: z.string().min(1, "Category is required"),
  image: z.instanceof(File).optional().nullable(),
  removeImage: z.string().optional(), // "true" when the owner clears the existing photo
  // Screen-reader description of the photo (alt text). The edit form always
  // sends this field: a non-empty value replaces the stored description, an
  // empty string clears it, and an absent field (null) keeps the current one.
  imageAlt: z.string().max(500, "Visual description too long").optional().nullable(),
});

/**
 * Early body-size guard, checked before the multipart payload is buffered:
 * the 5MB client-validated image cap plus form fields and multipart boundary
 * overhead stays far below this bound. Chunked requests without a
 * content-length skip this check and are still caught by the per-file size
 * validation after parsing.
 */
const MAX_REQUEST_BYTES = 10 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: toolId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ success: false, error: "Expected multipart/form-data" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Malformed multipart payload" }, { status: 400 });
  }

  const parsed = updateToolSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    image: formData.get("image"),
    // Null (absent field) must normalize to undefined for the optional zod
    // schema — FormData.get() yields null, not undefined.
    removeImage: formData.get("removeImage") ?? undefined,
    imageAlt: formData.get("imageAlt"),
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { name, description, category, image, removeImage, imageAlt } = parsed.data;

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, error: "Invalid category" }, { status: 400 });
  }

  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) {
    return NextResponse.json({ success: false, error: "Tool not found" }, { status: 404 });
  }

  if (tool.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Not authorized to modify this tool" }, { status: 403 });
  }

  let imageUrl = tool.imageUrl;

  if (image && image instanceof File && image.size > 0) {
    const saved = await saveUploadedImage(image);
    if (saved.error) {
      return NextResponse.json({ success: false, error: saved.error }, { status: 400 });
    }
    if (saved.filename) {
      // Replace: the superseded file is removed only after the new one is
      // safely on disk, so a failed write never destroys the current photo.
      deleteUploadedImage(tool.imageUrl);
      imageUrl = saved.filename;
    }
  } else if (removeImage === "true" && tool.imageUrl) {
    deleteUploadedImage(tool.imageUrl);
    imageUrl = null;
  }

  // Visual description semantics: FormData.get() yields null when the field
  // is absent (unknown client — keep the stored description), an empty string
  // when the owner cleared it (store null), and the new text otherwise.
  const nextImageAlt =
    imageAlt === null || imageAlt === undefined
      ? tool.imageAlt
      : imageAlt.trim()
        ? imageAlt.trim()
        : null;

  const updated = await prisma.tool.update({
    where: { id: tool.id },
    data: { name, description, category, imageUrl, imageAlt: nextImageAlt },
  });

  return NextResponse.json({
    success: true,
    toolId: updated.id,
    imageUrl: updated.imageUrl,
  });
}
