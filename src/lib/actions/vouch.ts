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
 * metric. Participants of a RETURNED loan may vouch for their counterparty —
 * exactly one vouch per loan per direction (unique on loanId+voucherId),
 * each applying the fixed bounded VOUCH_DELTA to the counterparty's
 * trustScore. Self-vouching is impossible by construction (the vouchee is
 * always the counterparty) and re-checked as a belt-and-braces guard.
 */

const vouchSchema = z.object({
  loanId: z.string().min(1),
});

export interface VouchState {
  success?: boolean;
  error?: string;
}

export async function vouchForUser(
  prevState: VouchState | undefined,
  formData: FormData
): Promise<VouchState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const parsed = vouchSchema.safeParse({ loanId: formData.get("loanId") });
  if (!parsed.success) {
    return { success: false, error: "Loan id is required" };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: parsed.data.loanId },
    include: { tool: { select: { id: true, ownerId: true } } },
  });
  if (!loan) {
    return { success: false, error: "Loan not found" };
  }

  // Only the two loan participants may vouch, and only once the loan is
  // physically complete (RETURNED).
  const isBorrower = loan.borrowerId === session.user.id;
  const isOwner = loan.tool.ownerId === session.user.id;
  if (!isBorrower && !isOwner) {
    return { success: false, error: "Only the loan participants can vouch" };
  }
  if (loan.status !== "RETURNED") {
    return { success: false, error: "Vouching opens after the tool is returned" };
  }

  // The vouchee is always the counterparty of the voucher.
  const voucheeId = isBorrower ? loan.tool.ownerId : loan.borrowerId;
  if (voucheeId === session.user.id) {
    return { success: false, error: "You cannot vouch for yourself" };
  }

  const existing = await prisma.vouch.findUnique({
    where: {
      loanId_voucherId: { loanId: loan.id, voucherId: session.user.id },
    },
  });
  if (existing) {
    return { success: false, error: "You already vouched for this loan" };
  }

  try {
    await prisma.$transaction([
      prisma.vouch.create({
        data: {
          loanId: loan.id,
          voucherId: session.user.id,
          voucheeId,
          delta: VOUCH_DELTA,
        },
      }),
      prisma.user.update({
        where: { id: voucheeId },
        data: { trustScore: { increment: VOUCH_DELTA } },
      }),
    ]);
  } catch {
    // Unique-constraint race (double submit): treat as already vouched.
    return { success: false, error: "You already vouched for this loan" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/tools/${loan.toolId}`);
  return { success: true };
}

export interface VouchableLoan {
  id: string;
  returnedAt: Date | string | null;
  tool: { id: string; name: string; owner: { id: string; alias: string } };
  borrower: { id: string; alias: string };
}

/**
 * Completed (RETURNED) loans where `userId` participated and has not vouched
 * yet — the dashboard's "vouch your counterparts" queue. Newest returns
 * first, capped to keep the section light.
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
