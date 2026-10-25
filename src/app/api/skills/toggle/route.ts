import { toggleSkillAvailability } from "@/lib/actions/skills";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await toggleSkillAvailability(undefined, formData);
  return Response.json(result);
}