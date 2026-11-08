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
 * POST /api/images/create — publish a secret-link image.
 *
 * A REST route handler rather than a Server Action for the same reason as
 * /api/tools/create and /api/tools/[id]/image (PHASE_31): behind the
 * Cloudflare Tunnel, the edge proxy rejects multi-megabyte binary multipart
 * POSTs aimed at Server Action endpoints with an instant 403, while plain
 * REST route handlers pass.
 *
 * Contract: raw multipart/form-data with the fields title (1–100 chars,
 * owner-facing label only) and image (File, required). The file is validated
 * against the shared lib/uploads.ts rules, persisted to data/uploads/secret/
 * (PHASE_47: an isolated directory served ONLY by /i/<token> — never by the
 * public /api/uploads route), and a PublishedImage row is created with a
 * fresh 256-bit CSPRNG token. The response carries the token and its
 * /i/<token> path — the ONLY way the image can ever be reached. No listing,
 * sitemap, or on-page link ever exposes it.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { saveSecretImage, readCappedForm, PayloadTooLargeError } from "@/lib/uploads";
import { generateImageToken } from "@/lib/images";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const createImageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title too long"),
  image: z.instanceof(File),
});

/**
 * Early body-size guard, checked before the multipart payload is buffered:
 * the 5MB client-validated image cap plus form fields and multipart boundary
 * overhead stays far below this bound. Chunked requests without a
 * content-length skip this check and are still caught by the per-file size
 * validation after parsing.
 */
const MAX_REQUEST_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  // Admin-only surface (operator directive, 2026-11-08): the publish pages
  // are role-gated too, so a general member can neither reach the UI nor
  // call this endpoint directly.
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Admin privileges required" }, { status: 403 });
  }

  // Binary write surface: throttle repeat publishing per client
  // (PHASE_23_RATE_LIMITING pattern).
  const limit = await enforceRateLimit("imagePublish");
  if (!limit.ok) {
    return NextResponse.json({ success: false, error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ success: false, error: "Expected multipart/form-data" }, { status: 415 });
  }

  let formData: FormData;
  try {
    // PHASE_53 (audit P7): real body cap — the declared Content-Length is
    // spoofable, and a chunked request omits it entirely.
    formData = await readCappedForm(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
    }
    return NextResponse.json({ success: false, error: "Malformed multipart payload" }, { status: 400 });
  }

  const parsed = createImageSchema.safeParse({
    title: formData.get("title"),
    image: formData.get("image"),
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { title, image } = parsed.data;

  // An empty File (no file picked) must be rejected explicitly: the image is
  // the payload of this surface, unlike the tool routes where it is optional.
  if (image.size === 0) {
    return NextResponse.json({ success: false, error: "Image is required" }, { status: 400 });
  }

  const saved = await saveSecretImage(image);
  if (saved.error || !saved.filename) {
    return NextResponse.json({ success: false, error: saved.error ?? "Image could not be saved" }, { status: 400 });
  }

  const token = generateImageToken();

  const published = await prisma.publishedImage.create({
    data: {
      token,
      title,
      filename: saved.filename,
      ownerId: session.user.id,
    },
  });

  return NextResponse.json({
    success: true,
    imageId: published.id,
    token: published.token,
    path: `/i/${published.token}`,
  });
}
