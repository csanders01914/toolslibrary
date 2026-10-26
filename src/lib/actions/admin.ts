"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";
import { runAdminAudit, type AdminAudit } from "@/lib/services/admin-ai";

export type AdminActionState = {
  success?: boolean;
  error?: string;
  audit?: AdminAudit;
  targetType?: string;
  targetId?: string;
} | undefined;

const runAuditSchema = z.object({
  targetType: z.enum(["TOOL", "SKILL", "PROMPT"]),
  targetId: z.string().optional().nullable(),
  prompt: z.string().max(2000).optional().nullable(),
});

const applyDecisionSchema = z.object({
  targetType: z.enum(["TOOL", "SKILL"]),
  targetId: z.string().min(1),
  decision: z.enum(["APPROVE", "FLAG", "NEEDS_REVIEW", "NO_ACTION"]),
  suggestedCategory: z.string().optional().nullable(),
});

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN"]),
});

const trustSchema = z.object({
  userId: z.string().min(1),
  delta: z.coerce.number().int().min(-100).max(100),
});

const toolStatusSchema = z.object({
  toolId: z.string().min(1),
  status: z.enum(["AVAILABLE", "MAINTENANCE"]),
});

export async function runAiAudit(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = runAuditSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { targetType, targetId, prompt } = parsed.data;

  if (targetType === "PROMPT") {
    if (!prompt || prompt.trim().length === 0) {
      return { success: false, error: "Prompt is required" };
    }
    const result = await runAdminAudit(session, { kind: "PROMPT", prompt: prompt.trim() });
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, audit: result.audit, targetType, targetId: undefined };
  }

  if (!targetId) {
    return { success: false, error: "Target ID is required" };
  }

  if (targetType === "TOOL") {
    const tool = await prisma.tool.findUnique({
      where: { id: targetId },
      include: { owner: { select: { alias: true, trustScore: true } } },
    });
    if (!tool) {
      return { success: false, error: "Tool not found" };
    }
    const result = await runAdminAudit(session, {
      kind: "TOOL",
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      status: tool.status,
      ownerAlias: tool.owner.alias,
      ownerTrustScore: tool.owner.trustScore,
    });
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, audit: result.audit, targetType, targetId };
  }

  const skill = await prisma.skill.findUnique({
    where: { id: targetId },
    include: { owner: { select: { alias: true, trustScore: true } } },
  });
  if (!skill) {
    return { success: false, error: "Skill not found" };
  }
  const result = await runAdminAudit(session, {
    kind: "SKILL",
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    available: skill.available,
    ownerAlias: skill.owner.alias,
    ownerTrustScore: skill.owner.trustScore,
  });
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, audit: result.audit, targetType, targetId };
}

/**
 * Applies a previously returned audit decision. Requires explicit human
 * confirmation — the console only calls this after the admin has reviewed the
 * audit summary and checked the confirmation box.
 */
export async function applyAuditDecision(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = applyDecisionSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    decision: formData.get("decision"),
    suggestedCategory: formData.get("suggestedCategory"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { targetType, targetId, decision, suggestedCategory } = parsed.data;

  if (targetType === "TOOL") {
    const tool = await prisma.tool.findUnique({ where: { id: targetId } });
    if (!tool) {
      return { success: false, error: "Tool not found" };
    }

    if (decision === "FLAG") {
      await prisma.tool.update({
        where: { id: targetId },
        data: { status: "MAINTENANCE" },
      });
    } else if (decision === "APPROVE") {
      if (tool.status === "MAINTENANCE") {
        await prisma.tool.update({
          where: { id: targetId },
          data: { status: "AVAILABLE" },
        });
      }
      if (suggestedCategory && suggestedCategory !== tool.category) {
        await prisma.tool.update({
          where: { id: targetId },
          data: { category: suggestedCategory },
        });
      }
    }
    // NEEDS_REVIEW and NO_ACTION apply no status change.
    return { success: true };
  }

  const skill = await prisma.skill.findUnique({ where: { id: targetId } });
  if (!skill) {
    return { success: false, error: "Skill not found" };
  }

  if (decision === "FLAG") {
    await prisma.skill.update({
      where: { id: targetId },
      data: { available: false },
    });
  } else if (decision === "APPROVE") {
    if (!skill.available) {
      await prisma.skill.update({
        where: { id: targetId },
        data: { available: true },
      });
    }
    if (suggestedCategory && suggestedCategory !== skill.category) {
      await prisma.skill.update({
        where: { id: targetId },
        data: { category: suggestedCategory },
      });
    }
  }

  return { success: true };
}

export async function updateUserRole(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { userId, role } = parsed.data;

  if (userId === session.user.id) {
    return { success: false, error: "Cannot change your own role" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return { success: true };
}

export async function adjustTrustScore(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = trustSchema.safeParse({
    userId: formData.get("userId"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { userId, delta } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const nextScore = Math.max(0, Math.min(100, user.trustScore + delta));

  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: nextScore },
  });

  return { success: true };
}

export async function setToolStatus(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = toolStatusSchema.safeParse({
    toolId: formData.get("toolId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { toolId, status } = parsed.data;

  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool) {
    return { success: false, error: "Tool not found" };
  }

  if (tool.status === "BORROWED" && status === "AVAILABLE") {
    return { success: false, error: "Tool is on an active loan; resolve the loan first" };
  }

  await prisma.tool.update({
    where: { id: toolId },
    data: { status },
  });

  return { success: true };
}
