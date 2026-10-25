import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import SkillDetailClient from "./SkillDetailClient";
import { toggleSkillAvailability, deleteSkill } from "@/lib/actions/skills";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;

  const skill = await prisma.skill.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true, bio: true, createdAt: true },
      },
    },
  });

  if (!skill) {
    notFound();
  }

  const toggleAvailabilityAction = async (formData: FormData) => {
    await toggleSkillAvailability(undefined, formData);
  };

  const deleteSkillAction = async (formData: FormData) => {
    await deleteSkill(undefined, formData);
  };

  return <SkillDetailClient skill={skill} toggleAvailability={toggleAvailabilityAction} deleteSkill={deleteSkillAction} />;
}