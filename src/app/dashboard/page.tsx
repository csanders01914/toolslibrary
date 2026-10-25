import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, toolsLent, activeBorrows, skillsOffered, incomingRequests, activeLoansAsOwner, activeLoansAsBorrower] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, alias: true, bio: true, trustScore: true, role: true, createdAt: true },
    }),
    prisma.tool.count({ where: { ownerId: session.user.id } }),
    prisma.loan.count({ where: { borrowerId: session.user.id, status: { in: ["APPROVED", "ACTIVE"] } } }),
    prisma.skill.count({ where: { ownerId: session.user.id, available: true } }),
    prisma.loan.findMany({
      where: { tool: { ownerId: session.user.id }, status: "REQUESTED" },
      include: { tool: true, borrower: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.loan.findMany({
      where: { tool: { ownerId: session.user.id }, status: { in: ["APPROVED", "ACTIVE"] } },
      include: { tool: true, borrower: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.loan.findMany({
      where: { borrowerId: session.user.id, status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
      include: { tool: { include: { owner: { select: { id: true, alias: true } } } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  return (
    <DashboardClient
      user={user!}
      stats={{
        toolsLent,
        activeBorrows,
        skillsOffered,
        trustScore: user?.trustScore ?? 100,
      }}
      incomingRequests={incomingRequests}
      activeLoansAsOwner={activeLoansAsOwner}
      activeLoansAsBorrower={activeLoansAsBorrower}
    />
  );
}