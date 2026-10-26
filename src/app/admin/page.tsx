import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [
    totalMembers,
    totalTools,
    availableTools,
    borrowedTools,
    maintenanceTools,
    activeLoans,
    skillsCount,
    recentTools,
    recentSkills,
    users,
    helpRequests,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tool.count(),
    prisma.tool.count({ where: { status: "AVAILABLE" } }),
    prisma.tool.count({ where: { status: "BORROWED" } }),
    prisma.tool.count({ where: { status: "MAINTENANCE" } }),
    prisma.loan.count({ where: { status: { in: ["APPROVED", "ACTIVE"] } } }),
    prisma.skill.count(),
    prisma.tool.findMany({
      take: 20,
      include: { owner: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.skill.findMany({
      take: 20,
      include: { owner: { select: { id: true, alias: true, trustScore: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        alias: true,
        role: true,
        trustScore: true,
        banned: true,
        createdAt: true,
        _count: { select: { tools: true, skills: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.helpRequest.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const userRows = users.map((user) => ({
    id: user.id,
    username: user.username,
    alias: user.alias,
    role: user.role,
    trustScore: user.trustScore,
    banned: user.banned,
    toolCount: user._count.tools,
    skillCount: user._count.skills,
    createdAt: user.createdAt,
  }));

  return (
    <AdminClient
      currentUserId={session.user.id}
      stats={{
        totalMembers,
        totalTools,
        availableTools,
        borrowedTools,
        maintenanceTools,
        activeLoans,
        skillsCount,
      }}
      auditTools={recentTools}
      auditSkills={recentSkills}
      users={userRows}
      helpRequests={helpRequests}
    />
  );
}
