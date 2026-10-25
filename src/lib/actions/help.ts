"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { z } from "zod";
import { resolveLlm } from "@/lib/services/llm";
import { triageHelpRequest, HELP_CATEGORIES } from "@/lib/services/triage";
import { AGENT_SYSTEM_PROMPT, runAgentTurn } from "@/lib/agent/run";

/**
 * Help request pipeline: public submission → random forest triage →
 * either automated LLM agent dispatch (safe tools only; destructive calls
 * are guardrail-intercepted) or the human admin intervention queue.
 */

export type HelpActionState = {
  success?: boolean;
  error?: string;
  ticket?: {
    id: string;
    route: string;
    urgency: string;
    confidence: number;
    triageReason: string;
    status: string;
    resolution: string | null;
  };
} | undefined;

const submitSchema = z.object({
  category: z.enum(HELP_CATEGORIES),
  message: z.string().min(10).max(2000),
  alias: z
    .string()
    .trim()
    .max(32)
    .regex(/^[a-zA-Z0-9_\- ]*$/, "Alias may only contain letters, numbers, spaces, - and _")
    .optional()
    .or(z.literal("")),
});

export async function submitHelpRequest(
  prevState: HelpActionState,
  formData: FormData
): Promise<HelpActionState> {
  const parsed = submitSchema.safeParse({
    category: formData.get("category"),
    message: formData.get("message"),
    alias: formData.get("alias") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const alias = session?.user?.alias ?? (parsed.data.alias || null);

  const { category, message } = parsed.data;
  const verdict = triageHelpRequest(category, message, Boolean(userId));

  let route = verdict.route;
  let triageReason = verdict.reason;

  // Fail-safe: if the forest routed to the agent but no LLM is configured,
  // fall back to the human queue.
  const resolved = route === "LLM_AGENT" ? await resolveLlm() : null;
  if (route === "LLM_AGENT" && !resolved) {
    route = "HUMAN_ADMIN";
    triageReason += "; LLM agent not configured — fell back to human queue";
  }

  const created = await prisma.helpRequest.create({
    data: {
      userId,
      alias,
      category,
      message,
      urgency: verdict.urgency,
      route,
      triageReason,
      confidence: verdict.confidence,
      status: "OPEN",
    },
  });

  // Automated resolution attempt for agent-routed tickets.
  if (route === "LLM_AGENT" && resolved) {
    try {
      const turn = await runAgentTurn(resolved, [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `HELP REQUEST TICKET ${created.id}`,
            `Category: ${category}`,
            `Triage urgency: ${verdict.urgency} (confidence ${verdict.confidence})`,
            `Submitted by: ${userId ? "authenticated member" : "guest"}${alias ? ` (${alias})` : ""}`,
            "",
            "Message:",
            message,
            "",
            "Handle this request with your tools if appropriate (query the database first, act only with safe tools, resolve or escalate the ticket when done). Destructive tools will be guardrail-intercepted and require human approval — prefer escalateHelpRequest instead for anything like that.",
          ].join("\n"),
        },
      ]);

      if (turn.ok) {
        const updated = await prisma.helpRequest.update({
          where: { id: created.id },
          data: { status: "AGENT_DISPATCHED", resolution: turn.reply },
        });
        return {
          success: true,
          ticket: {
            id: updated.id,
            route: updated.route,
            urgency: updated.urgency,
            confidence: updated.confidence,
            triageReason: updated.triageReason,
            status: updated.status,
            resolution: updated.resolution,
          },
        };
      }
      // Agent turn failed — leave OPEN for the human queue.
      const updated = await prisma.helpRequest.update({
        where: { id: created.id },
        data: {
          triageReason: `${triageReason}; agent dispatch failed (${turn.error})`,
        },
      });
      return {
        success: true,
        ticket: {
          id: updated.id,
          route: updated.route,
          urgency: updated.urgency,
          confidence: updated.confidence,
          triageReason: updated.triageReason,
          status: updated.status,
          resolution: null,
        },
      };
    } catch {
      return {
        success: true,
        ticket: {
          id: created.id,
          route: created.route,
          urgency: created.urgency,
          confidence: created.confidence,
          triageReason: created.triageReason,
          status: created.status,
          resolution: null,
        },
      };
    }
  }

  return {
    success: true,
    ticket: {
      id: created.id,
      route: created.route,
      urgency: created.urgency,
      confidence: created.confidence,
      triageReason: created.triageReason,
      status: created.status,
      resolution: null,
    },
  };
}

// ----------------------------------------------------------------
// Admin queue actions
// ----------------------------------------------------------------

const resolveSchema = z.object({
  requestId: z.string().min(1),
  resolution: z.string().min(10).max(2000),
});

export async function resolveHelpRequestAction(
  prevState: HelpActionState,
  formData: FormData
): Promise<HelpActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = resolveSchema.safeParse({
    requestId: formData.get("requestId"),
    resolution: formData.get("resolution"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const request = await prisma.helpRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request) return { success: false, error: "Help request not found" };

  await prisma.helpRequest.update({
    where: { id: request.id },
    data: { status: "RESOLVED", resolution: parsed.data.resolution },
  });
  return { success: true };
}

const escalateSchema = z.object({
  requestId: z.string().min(1),
});

export async function escalateHelpRequestAction(
  prevState: HelpActionState,
  formData: FormData
): Promise<HelpActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = escalateSchema.safeParse({
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const request = await prisma.helpRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request) return { success: false, error: "Help request not found" };

  await prisma.helpRequest.update({
    where: { id: request.id },
    data: { status: "ESCALATED" },
  });
  return { success: true };
}
