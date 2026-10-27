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
import { resolveLlm } from "@/lib/services/llm";
import { triageHelpRequest, HELP_CATEGORIES } from "@/lib/services/triage";
import { AGENT_SYSTEM_PROMPT, runAgentTurn } from "@/lib/agent/run";

/**
 * Help request pipeline: public submission → triage →
 * either automated dispatch (safe tools only; destructive calls
 * are guardrail-intercepted) or the admin intervention queue.
 */

export type HelpActionState = {
  success?: boolean;
  error?: string;
  ticket?: {
    id: string;
    route: string; // public-safe: "AUTO" | "ADMIN"
    urgency: string;
    status: string; // public-safe: "OPEN" | "HANDLED" | "RESOLVED" | "ESCALATED"
    resolution: string | null;
  };
} | undefined;

/**
 * Public-safe ticket view: internal route/status enum values and classifier
 * internals (confidence, triage reason) never leave the server.
 */
function publicTicket(t: {
  route: string;
  urgency: string;
  status: string;
  resolution: string | null;
  id: string;
}) {
  return {
    id: t.id,
    route: t.route === "LLM_AGENT" ? "AUTO" : "ADMIN",
    urgency: t.urgency,
    status: t.status === "AGENT_DISPATCHED" ? "HANDLED" : t.status,
    resolution: t.resolution,
  };
}

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

  // Fail-safe: if triage routed to automated handling but no endpoint is
  // configured, fall back to the admin queue.
  const resolved = route === "LLM_AGENT" ? await resolveLlm() : null;
  if (route === "LLM_AGENT" && !resolved) {
    route = "HUMAN_ADMIN";
    triageReason += "; automated dispatch unavailable — queued for admin review";
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

  // Automated resolution attempt for auto-routed tickets.
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
        return { success: true, ticket: publicTicket(updated) };
      }
      // Automated turn failed — leave OPEN for the admin queue.
      const updated = await prisma.helpRequest.update({
        where: { id: created.id },
        data: {
          triageReason: `${triageReason}; automated dispatch failed (${turn.error})`,
        },
      });
      return { success: true, ticket: publicTicket(updated) };
    } catch {
      return { success: true, ticket: publicTicket(created) };
    }
  }

  return { success: true, ticket: publicTicket(created) };
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
