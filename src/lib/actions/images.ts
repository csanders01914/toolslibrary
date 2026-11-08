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

"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deleteUploadedImage } from "@/lib/uploads";

/**
 * Text-only server actions for the secret-link image dashboard
 * (/dashboard/images). Publishing carries the binary payload, so it goes
 * through the REST route handler /api/images/create instead — same
 * Cloudflare-Tunnel multipart constraint as the tool listing photos
 * (PHASE_31). Only the delete action lives here.
 */

const deleteImageSchema = z.object({
  imageId: z.string().min(1),
});

/**
 * Owner (or admin) removal of a published image. The DB row and the stored
 * file are both destroyed, so the secret URL stops resolving immediately —
 * any page still embedding it shows a broken image. There is no loan-style
 * guard: a published image has no dependents.
 */
export async function deleteImage(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const parsed = deleteImageSchema.safeParse({
    imageId: formData.get("imageId"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const image = await prisma.publishedImage.findUnique({ where: { id: parsed.data.imageId } });
  if (!image) {
    return { success: false, error: "Image not found" };
  }

  if (image.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Not authorized to delete this image" };
  }

  await prisma.publishedImage.delete({ where: { id: image.id } });
  deleteUploadedImage(image.filename);

  revalidatePath("/dashboard/images");

  return { success: true };
}

/**
 * Every published image owned by the member, newest first. Only the fields
 * the management dashboard renders — the token doubles as the URL slug and
 * is shown to the owner there by design (it is their secret to share).
 */
export async function getUserImages(userId: string) {
  const images = await prisma.publishedImage.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      token: true,
      title: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return images;
}
