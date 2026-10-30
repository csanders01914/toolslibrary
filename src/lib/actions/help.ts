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
import { resolveSupportMessage } from "@/lib/supportChannel";
import { getRequestClientHash, recordFailure, verifySolution } from "@/lib/pow";
import { enforceRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { notifyAdmins } from "@/lib/email";

/**
 * Help request pipeline: public submission → deterministic intent routing →
 * either an instant pre-written reply or the admin intervention queue.
 * Classification is pure Regular Expressions (src/lib/intentRouter.ts);
 * no external services are involved at any step.
 */

export type HelpActionState = {
  success?: boolean;
  error?: string;
  detail?: string;
  ticket?: {
    id: string;
    route: string; // public-safe: "AUTO" | "ADMIN"
    urgency: string;
    status: string; // public-safe: "OPEN" | "RESOLVED"
    resolution: string | null;
  };
} | undefined;

/**
 * Public-safe ticket view: internal routing values never leave the server
 * in anything other than the two public-safe route labels.
 */
function publicTicket(t: {
  id: string;
  route: string;
  urgency: string;
  status: string;
  resolution: string | null;
}) {
  return {
    id: t.id,
    route: t.route === "ADMIN" ? "ADMIN" : "AUTO",
    urgency: t.urgency,
    status: t.status,
    resolution: t.resolution,
  };
}

const submitSchema = z.object({
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
  // Public, unauthenticated write surface: throttle ticket spam before any
  // database or webhook work (PHASE_23_RATE_LIMITING).
  const limit = await enforceRateLimit("help");
  if (!limit.ok) {
    return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
  }

  // Hidden proof-of-work gate: the browser solved a challenge silently on
  // submit. Missing or malformed fields take the same failure path as a
  // wrong solution.
  const powCounterValue = formData.get("powCounter");
  const powCounter = powCounterValue === null ? Number.NaN : Number(powCounterValue);
  const clientHash = await getRequestClientHash();
  const pow = verifySolution(
    "help",
    formData.get("powChallenge"),
    Number.isInteger(powCounter) ? powCounter : undefined,
    clientHash
  );
  if (!pow.ok) {
    recordFailure("help", clientHash);
    return {
      success: false,
      error:
        "This form is protected by a proof-of-work check. Please retry — the check failed or expired.",
    };
  }

  const parsed = submitSchema.safeParse({
    message: formData.get("message"),
    alias: formData.get("alias") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const alias = session?.user?.alias ?? (parsed.data.alias || "Guest");

  const { message } = parsed.data;
  const verdict = await resolveSupportMessage(message, "website", alias);

  const created = await prisma.helpRequest.create({
    data: {
      userId,
      alias,
      category: verdict.intent,
      message,
      urgency: verdict.needsAdmin ? "HIGH" : "LOW",
      route: verdict.needsAdmin ? "ADMIN" : "AUTO",
      triageReason: `deterministic intent match: ${verdict.intent}`,
      confidence: 1,
      status: verdict.needsAdmin ? "OPEN" : "RESOLVED",
      resolution: verdict.needsAdmin ? null : verdict.replyText,
    },
  });

  // PHASE_29: alert the operator by email when a ticket lands in the admin
  // queue — fire-and-forget so the alert can never block or fail the ticket
  // write (notifyAdmins never throws).
  if (verdict.needsAdmin) {
    void notifyAdmins({
      type: "help_escalation",
      ticketId: created.id,
      alias,
      category: verdict.intent,
      excerpt: message.slice(0, 200),
    });
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

const clearQueueSchema = z.object({
  scope: z.enum(["CLOSED", "ALL"]).default("CLOSED"),
});

/**
 * Admin queue hygiene: purge closed tickets (RESOLVED) so the triage
 * queue stays readable, or wipe the entire queue. The ALL scope is destructive
 * and is gated in the console behind an explicit acknowledgment checkbox.
 */
export async function clearHelpQueueAction(
  prevState: HelpActionState,
  formData: FormData
): Promise<HelpActionState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Admin privileges required" };
  }

  const parsed = clearQueueSchema.safeParse({
    scope: formData.get("scope") ?? "CLOSED",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { scope } = parsed.data;
  const deleted = await prisma.helpRequest.deleteMany({
    where: scope === "ALL" ? {} : { status: "RESOLVED" },
  });

  return {
    success: true,
    detail:
      scope === "ALL"
        ? `Help queue cleared — ${deleted.count} ticket(s) purged.`
        : `Closed tickets cleared — ${deleted.count} ticket(s) purged.`,
  };
}
