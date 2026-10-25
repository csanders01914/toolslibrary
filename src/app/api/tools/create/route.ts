import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "@/lib/constants";

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
    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Image must be less than 5MB" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json({ success: false, error: "Invalid image type. Use JPEG, PNG, GIF, or WebP" }, { status: 400 });
    }

    const uploadsDir = path.resolve(process.cwd(), "data/uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(image.name).toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    const buffer = Buffer.from(await image.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    imageUrl = filename;
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