import { prisma } from "@/lib/db";
import ToolsClient from "./ToolsClient";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const tools = await prisma.tool.findMany({
    include: {
      owner: {
        select: { id: true, alias: true, trustScore: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ToolsClient
      initialTools={tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        status: tool.status,
        imageUrl: tool.imageUrl,
        owner: tool.owner,
        createdAt: tool.createdAt.toISOString(),
      }))}
    />
  );
}
