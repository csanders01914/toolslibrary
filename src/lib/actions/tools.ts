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

const deleteToolSchema = z.object({
  toolId: z.string().min(1),
});

const requestLoanSchema = z.object({
  toolId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const manageLoanSchema = z.object({
  loanId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT", "MARK_RETURNED"]),
  returnCondition: z.enum(["GOOD", "DAMAGED"]).optional(),
});

/**
 * Listing creation and metadata edits (including photo upload/replace/remove)
 * are handled by the REST route handlers /api/tools/create and
 * /api/tools/[id]/image — plain fetch endpoints that pass the Cloudflare
 * Tunnel edge, which rejects multi-megabyte multipart POSTs aimed at Server
 * Action endpoints with an instant 403. Only text-only server actions remain
 * here.
 */

/**
 * Owner (or admin) removal of a listing. Blocked while the tool is on an
 * active/approved loan (status BORROWED) so a borrower cannot return a tool
 * that no longer exists; the loan must be resolved first. Loan rows for
 * rejected/returned history cascade away with the tool.
 */
export async function deleteTool(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const parsed = deleteToolSchema.safeParse({
    toolId: formData.get("toolId"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const tool = await prisma.tool.findUnique({ where: { id: parsed.data.toolId } });
  if (!tool) {
    return { success: false, error: "Tool not found" };
  }

  if (tool.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Not authorized to delete this tool" };
  }

  if (tool.status === "BORROWED") {
    return { success: false, error: "Tool is on an active loan; resolve the loan first" };
  }

  await prisma.tool.delete({ where: { id: tool.id } });
  deleteUploadedImage(tool.imageUrl);

  return { success: true };
}

export async function requestLoan(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const rawData = {
    toolId: formData.get("toolId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  };

  const parsed = requestLoanSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { toolId, startDate, endDate } = parsed.data;

  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: { owner: true },
  });

  if (!tool) {
    return { success: false, error: "Tool not found" };
  }

  if (tool.ownerId === session.user.id) {
    return { success: false, error: "Cannot borrow your own tool" };
  }

  if (tool.status !== "AVAILABLE") {
    return { success: false, error: "Tool is not available for borrowing" };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (start < now) {
    return { success: false, error: "Start date must be in the future" };
  }

  if (end <= start) {
    return { success: false, error: "End date must be after start date" };
  }

  const existingLoan = await prisma.loan.findFirst({
    where: {
      toolId,
      status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] },
    },
  });

  if (existingLoan) {
    return { success: false, error: "Tool already has a pending or active loan" };
  }

  await prisma.loan.create({
    data: {
      toolId,
      borrowerId: session.user.id,
      startDate: start,
      endDate: end,
      status: "REQUESTED",
    },
  });

  return { success: true };
}

export async function manageLoan(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const rawData = {
    loanId: formData.get("loanId"),
    decision: formData.get("decision"),
    // FormData.get() yields null (not undefined) for absent fields, and zod
    // .optional() rejects null — normalize so approve/reject forms that omit
    // the return-condition select parse correctly.
    returnCondition: formData.get("returnCondition") ?? undefined,
  };

  const parsed = manageLoanSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { loanId, decision, returnCondition } = parsed.data;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { tool: true, borrower: true },
  });

  if (!loan) {
    return { success: false, error: "Loan not found" };
  }

  if (loan.tool.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false, error: "Not authorized to manage this loan" };
  }

  if (decision === "APPROVE") {
    if (loan.status !== "REQUESTED") {
      return { success: false, error: "Can only approve requested loans" };
    }

    // APPROVED = the owner agreed to lend; the tool is still physically with
    // the owner, so it stays AVAILABLE. The loan becomes ACTIVE (and the tool
    // BORROWED) only when the borrower confirms the physical handoff — by
    // scanning the tool's QR label or via the dashboard
    // (PHASE_24_QR_LOAN_LIFECYCLE: REQUESTED → APPROVED → ACTIVE → RETURNED).
    await prisma.loan.update({
      where: { id: loanId },
      data: { status: "APPROVED" },
    });

    revalidateLoanViews(loan.toolId);
    return { success: true };
  }

  if (decision === "REJECT") {
    if (loan.status !== "REQUESTED") {
      return { success: false, error: "Can only reject requested loans" };
    }

    await prisma.loan.update({
      where: { id: loanId },
      data: { status: "REJECTED" },
    });

    revalidateLoanViews(loan.toolId);
    return { success: true };
  }

  if (decision === "MARK_RETURNED") {
    if (loan.status !== "ACTIVE") {
      return { success: false, error: "Can only mark active loans as returned" };
    }

    if (!returnCondition) {
      return { success: false, error: "Return condition is required" };
    }

    const trustAdjustment = returnCondition === "GOOD" ? 5 : -15;

    await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id: loanId },
        data: {
          status: "RETURNED",
          returnedAt: new Date(),
          returnCondition,
        },
      });

      await tx.tool.update({
        where: { id: loan.toolId },
        data: { status: "AVAILABLE" },
      });

      await tx.user.update({
        where: { id: loan.borrowerId },
        data: {
          trustScore: {
            increment: trustAdjustment,
          },
        },
      });
    });

    revalidateLoanViews(loan.toolId);
    return { success: true };
  }

  return { success: false, error: "Invalid decision" };
}

const confirmHandoffSchema = z.object({
  loanId: z.string().min(1),
});

/**
 * Borrower-side handoff confirmation (PHASE_24_QR_LOAN_LIFECYCLE): stepping an
 * APPROVED loan to ACTIVE when the borrower physically receives the tool.
 * Reached by scanning the tool's printed QR label (/tools/<id>/handoff) or
 * from the dashboard borrow queue. Borrower-only by design — the owner's
 * counterpart actions are approve/reject/mark-returned — and guarded to the
 * APPROVED state so the tool flips to BORROWED exactly once per loan.
 */
export async function confirmHandoff(
  prevState: { success?: boolean; error?: string } | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Authentication required" };
  }

  const parsed = confirmHandoffSchema.safeParse({
    loanId: formData.get("loanId"),
  });
  if (!parsed.success) {
    return { success: false, error: "Loan id is required" };
  }

  const loan = await prisma.loan.findUnique({
    where: { id: parsed.data.loanId },
    include: { tool: true },
  });
  if (!loan) {
    return { success: false, error: "Loan not found" };
  }

  if (loan.borrowerId !== session.user.id) {
    return { success: false, error: "Only the borrower can confirm the handoff" };
  }

  if (loan.status !== "APPROVED") {
    return { success: false, error: "Can only confirm handoff for approved loans" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loan.id },
      data: { status: "ACTIVE" },
    });

    await tx.tool.update({
      where: { id: loan.toolId },
      data: { status: "BORROWED" },
    });
  });

  revalidateLoanViews(loan.toolId);
  return { success: true };
}

/**
 * Revalidate every surface that renders loan state after a lifecycle
 * transition: the dashboard queues, the tool listing, and the QR handoff
 * page — so a scan or dashboard action is reflected immediately.
 */
function revalidateLoanViews(toolId: string): void {
  revalidatePath("/dashboard");
  revalidatePath(`/tools/${toolId}`);
  revalidatePath(`/tools/${toolId}/handoff`);
}

export interface HandoffContext {
  tool: {
    id: string;
    name: string;
    status: string;
    imageUrl: string | null;
  };
  loan: {
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    borrower: { id: string; alias: string };
    owner: { id: string; alias: string };
  } | null;
}

/**
 * Data for the QR handoff page (/tools/<id>/handoff): the tool plus its
 * current live loan (REQUESTED, APPROVED, or ACTIVE) with only public-safe
 * identity fields (aliases, ids). Null when the tool does not exist.
 */
export async function getHandoffContext(toolId: string): Promise<HandoffContext | null> {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: {
      owner: { select: { id: true, alias: true } },
      loans: {
        where: { status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
        include: { borrower: { select: { id: true, alias: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!tool) return null;

  const loan = tool.loans[0] ?? null;
  return {
    tool: {
      id: tool.id,
      name: tool.name,
      status: tool.status,
      imageUrl: tool.imageUrl,
    },
    loan: loan
      ? {
          id: loan.id,
          status: loan.status,
          startDate: loan.startDate,
          endDate: loan.endDate,
          borrower: loan.borrower,
          owner: tool.owner,
        }
      : null,
  };
}

export async function getTools(filters?: { category?: string; status?: string; search?: string }) {
  const where: Record<string, unknown> = {};

  if (filters?.category && filters.category !== "All") {
    where.category = filters.category;
  }

  if (filters?.status && filters.status !== "All") {
    where.status = filters.status;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const tools = await prisma.tool.findMany({
    where,
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return tools;
}

export async function getToolById(id: string) {
  const tool = await prisma.tool.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true, bio: true },
      },
      loans: {
        where: { status: { in: ["ACTIVE", "APPROVED"] } },
        include: { borrower: { select: { id: true, alias: true } } },
        take: 1,
      },
    },
  });

  return tool;
}

export async function getUserTools(userId: string) {
  const tools = await prisma.tool.findMany({
    where: { ownerId: userId },
    include: {
      loans: {
        where: { status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
        include: { borrower: { select: { id: true, alias: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return tools;
}

export async function getUserLoans(userId: string) {
  const loans = await prisma.loan.findMany({
    where: { borrowerId: userId },
    include: {
      tool: {
        include: { owner: { select: { id: true, alias: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return loans;
}

export async function getIncomingLoanRequests(userId: string) {
  const loans = await prisma.loan.findMany({
    where: {
      tool: { ownerId: userId },
      status: "REQUESTED",
    },
    include: {
      tool: true,
      borrower: { select: { id: true, alias: true, trustScore: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return loans;
}

export async function getActiveLoansForOwner(userId: string) {
  const loans = await prisma.loan.findMany({
    where: {
      tool: { ownerId: userId },
      status: { in: ["APPROVED", "ACTIVE"] },
    },
    include: {
      tool: true,
      borrower: { select: { id: true, alias: true } },
    },
    orderBy: { endDate: "asc" },
  });

  return loans;
}