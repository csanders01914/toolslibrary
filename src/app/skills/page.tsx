import { prisma } from "@/lib/db";
import SkillsClient from "./SkillsClient";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const [skillCount, recentSkills] = await Promise.all([
    prisma.skill.count(),
    prisma.skill.findMany({
      where: { available: true },
      include: {
        owner: {
          select: { id: true, alias: true, trustScore: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return <SkillsClient initialSkills={recentSkills} totalCount={skillCount} />;
}