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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { CATEGORIES } from "@/lib/constants";
import { saveUploadedImage } from "@/lib/uploads";

const createToolSchema = z.object({
  name: z.string().min(1, "Tool name is required").max(100, "Name too long"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description too long"),
  category: z.string().min(1, "Category is required"),
  image: z.instanceof(File).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const formData = await request.formData();
  const rawData = {
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    image: formData.get("image"),
  };

  const parsed = createToolSchema.safeParse(rawData);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { name, description, category, image } = parsed.data;

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, error: "Invalid category" }, { status: 400 });
  }

  let imageUrl: string | null = null;

  if (image && image instanceof File && image.size > 0) {
    const saved = await saveUploadedImage(image);
    if (saved.error) {
      return NextResponse.json({ success: false, error: saved.error }, { status: 400 });
    }
    imageUrl = saved.filename ?? null;
  }

  const tool = await prisma.tool.create({
    data: {
      name,
      description,
      category,
      imageUrl,
      ownerId: session.user.id,
    },
  });

  return NextResponse.json({ success: true, toolId: tool.id });
}