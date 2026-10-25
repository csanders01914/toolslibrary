"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
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

export async function createTool(
  prevState: { success?: boolean; error?: string; toolId?: string } | undefined,
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
    image: formData.get("image"),
  };

  const parsed = createToolSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { name, description, category, image } = parsed.data;

  if (!CATEGORIES.includes(category)) {
    return { success: false, error: "Invalid category" };
  }

  let imageUrl: string | null = null;

  if (image && image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) {
      return { success: false, error: "Image must be less than 5MB" };
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(image.type)) {
      return { success: false, error: "Invalid image type. Use JPEG, PNG, GIF, or WebP" };
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

  return { success: true, toolId: tool.id };
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
    returnCondition: formData.get("returnCondition"),
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

    await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id: loanId },
        data: { status: "ACTIVE" },
      });

      await tx.tool.update({
        where: { id: loan.toolId },
        data: { status: "BORROWED" },
      });
    });

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

    return { success: true };
  }

  return { success: false, error: "Invalid decision" };
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