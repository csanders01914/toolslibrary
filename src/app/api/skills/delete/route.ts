import { deleteSkill } from "@/lib/actions/skills";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await deleteSkill(undefined, formData);
  return Response.json(result);
}