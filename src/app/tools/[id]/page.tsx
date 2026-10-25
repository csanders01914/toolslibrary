import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import ToolDetailClient from "./ToolDetailClient";
import { manageLoan } from "@/lib/actions/tools";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ToolDetailPage({ params }: PageProps) {
  const { id } = await params;

  const tool = await prisma.tool.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true, bio: true, createdAt: true },
      },
      loans: {
        where: { status: { in: ["ACTIVE", "APPROVED", "REQUESTED"] } },
        include: { borrower: { select: { id: true, alias: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!tool) {
    notFound();
  }

  // Wrap manageLoan to only accept FormData for form actions and return void
  const manageLoanAction = async (formData: FormData) => {
    await manageLoan(undefined, formData);
  };

  return <ToolDetailClient tool={tool} manageLoan={manageLoanAction} />;
}