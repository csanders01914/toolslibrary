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
import { VOUCH_DELTA } from "@/lib/constants";

/**
 * Peer trust vouching (PHASE_25_TRUST_VOUCHING).
 *
 * The platform is zero-PII: members are known only by their alias, so lending
 * expensive tools to a stranger requires a transparent, peer-verified trust
 * metric. Participants of a RETURNED loan make exactly one decision per loan
 * per direction (unique on loanId+voucherId): vouch for their counterparty —
 * applying the fixed bounded VOUCH_DELTA to the counterparty's trustScore —
 * or decline to vouch, which records a delta-0 declined row so the queue
 * stops asking without touching anyone's trust score. Self-vouching is
 * impossible by construction (the vouchee is always the counterparty) and
 * re-checked as a belt-and-braces guard.
 */

const vouchSchema = z.object({
  loanId: z.string().min(1),
});

export interface VouchState {
  success?: boolean;
  error?: string;
}

/**
 * Shared guard logic for both vouch decisions (vouch / decline): resolves the
 * authenticated participant's counterparty on a RETURNED loan, or returns an
 * error message.
 */
async function resolveVouchContext(
  formData: FormData
): Promise<{ error: string } | { loanId: string; toolId: string; voucheeId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Authentication required" };
  }

  const parsed = vouchSchema.safeParse({ loanId: formData.get("loanId") });
  if (!parsed.success) {
    return { error: "Loan id is required" };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: parsed.data.loanId },
    include: { tool: { select: { id: true, ownerId: true } } },
  });
  if (!loan) {
    return { error: "Loan not found" };
  }

  // Only the two loan participants may decide, and only once the loan is
  // physically complete (RETURNED).
  const isBorrower = loan.borrowerId === session.user.id;
  const isOwner = loan.tool.ownerId === session.user.id;
  if (!isBorrower && !isOwner) {
    return { error: "Only the loan participants can vouch" };
  }
  if (loan.status !== "RETURNED") {
    return { error: "Vouching opens after the tool is returned" };
  }

  // The counterparty is always the other participant of the loan.
  const voucheeId = isBorrower ? loan.tool.ownerId : loan.borrowerId;
  if (voucheeId === session.user.id) {
    return { error: "You cannot vouch for yourself" };
  }

  return { loanId: loan.id, toolId: loan.toolId, voucheeId };
}

/**
 * Returns the participant's recorded decision for this loan, if any.
 */
async function getExistingDecision(loanId: string, voucherId: string) {
  return prisma.vouch.findUnique({
    where: {
      loanId_voucherId: { loanId, voucherId },
    },
  });
}

export async function vouchForUser(
  prevState: VouchState | undefined,
  formData: FormData
): Promise<VouchState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const context = await resolveVouchContext(formData);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const existing = await getExistingDecision(context.loanId, session.user.id);
  if (existing) {
    return {
      success: false,
      error: existing.declined
        ? "You already declined to vouch for this loan"
        : "You already vouched for this loan",
    };
  }

  try {
    await prisma.$transaction([
      prisma.vouch.create({
        data: {
          loanId: context.loanId,
          voucherId: session.user.id,
          voucheeId: context.voucheeId,
          delta: VOUCH_DELTA,
        },
      }),
      prisma.user.update({
        where: { id: context.voucheeId },
        data: { trustScore: { increment: VOUCH_DELTA } },
      }),
    ]);
  } catch {
    // Unique-constraint race (double submit): treat as already decided.
    return { success: false, error: "You already vouched for this loan" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/tools/${context.toolId}`);
  return { success: true };
}

/**
 * Decline to vouch: dismisses the loan from the participant's "vouch your
 * counterparts" queue without adjusting any trust score. The decision is
 * final for the loan (one decision per loan per direction) and is recorded
 * as a delta-0 declined Vouch row, reusing the loanId+voucherId uniqueness
 * so a decline and a vouch can never both exist for the same direction.
 */
export async function declineVouch(
  prevState: VouchState | undefined,
  formData: FormData
): Promise<VouchState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const context = await resolveVouchContext(formData);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const existing = await getExistingDecision(context.loanId, session.user.id);
  if (existing) {
    return {
      success: false,
      error: existing.declined
        ? "You already declined to vouch for this loan"
        : "You already vouched for this loan",
    };
  }

  try {
    // No trustScore write: a decline is a neutral, private non-endorsement.
    await prisma.vouch.create({
      data: {
        loanId: context.loanId,
        voucherId: session.user.id,
        voucheeId: context.voucheeId,
        delta: 0,
        declined: true,
      },
    });
  } catch {
    // Unique-constraint race (double submit): treat as already decided.
    return { success: false, error: "You already declined to vouch for this loan" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/tools/${context.toolId}`);
  return { success: true };
}

export interface VouchableLoan {
  id: string;
  returnedAt: Date | string | null;
  tool: { id: string; name: string; owner: { id: string; alias: string } };
  borrower: { id: string; alias: string };
}

/**
 * Completed (RETURNED) loans where `userId` participated and has not recorded
 * a decision (vouch or decline) yet — the dashboard's "vouch your
 * counterparts" queue. A declined loan carries a delta-0 Vouch row for the
 * voucher, so the existing `vouches: { none }` filter dismisses it too.
 * Newest returns first, capped to keep the section light.
 */
export async function getVouchableLoans(userId: string): Promise<VouchableLoan[]> {
  const loans = await prisma.loan.findMany({
    where: {
      status: "RETURNED",
      OR: [{ borrowerId: userId }, { tool: { ownerId: userId } }],
      vouches: { none: { voucherId: userId } },
    },
    include: {
      tool: {
        select: { id: true, name: true, owner: { select: { id: true, alias: true } } },
      },
      borrower: { select: { id: true, alias: true } },
    },
    orderBy: { returnedAt: "desc" },
    take: 20,
  });

  return loans.map((loan) => ({
    id: loan.id,
    returnedAt: loan.returnedAt,
    tool: {
      id: loan.tool.id,
      name: loan.tool.name,
      owner: loan.tool.owner,
    },
    borrower: loan.borrower,
  }));
}
