import { createSkill } from "@/lib/actions/skills";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await createSkill(undefined, formData);
  return Response.json(result);
}