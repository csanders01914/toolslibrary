"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";
import { SKILL_CATEGORIES } from "@/lib/constants";

const createSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required").max(100, "Name too long"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description too long"),
  category: z.string().min(1, "Category is required"),
});

export async function createSkill(
  prevState: { success?: boolean; error?: string; skillId?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const rawData = {
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
  };

  const parsed = createSkillSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { name, description, category } = parsed.data;

  if (!SKILL_CATEGORIES.includes(category)) {
    return { success: false, error: "Invalid category" };
  }

  const skill = await prisma.skill.create({
    data: {
      name,
      description,
      category,
      ownerId: session.user.id,
    },
  });

  return { success: true, skillId: skill.id };
}

export async function toggleSkillAvailability(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const skillId = formData.get("skillId") as string;
  if (!skillId) {
    return { success: false, error: "Skill ID is required" };
  }

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!skill) {
    return { success: false, error: "Skill not found" };
  }

  if (skill.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Not authorized to modify this skill" };
  }

  await prisma.skill.update({
    where: { id: skillId },
    data: { available: !skill.available },
  });

  return { success: true };
}

export async function deleteSkill(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const skillId = formData.get("skillId") as string;
  if (!skillId) {
    return { success: false, error: "Skill ID is required" };
  }

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!skill) {
    return { success: false, error: "Skill not found" };
  }

  if (skill.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Not authorized to delete this skill" };
  }

  await prisma.skill.delete({
    where: { id: skillId },
  });

  return { success: true };
}

export async function getSkills(filters?: { category?: string; available?: boolean; search?: string }) {
  const where: Record<string, unknown> = {};

  if (filters?.category && filters.category !== "All") {
    where.category = filters.category;
  }

  if (filters?.available !== undefined) {
    where.available = filters.available;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const skills = await prisma.skill.findMany({
    where,
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return skills;
}

export async function getSkillById(id: string) {
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true, bio: true, createdAt: true },
      },
    },
  });

  return skill;
}

export async function getUserSkills(userId: string) {
  const skills = await prisma.skill.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });

  return skills;
}