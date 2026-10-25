import { z } from "zod";

/**
 * Qwen 2.5 7B Admin Helper Service
 *
 * Strictly gated to ADMIN sessions. Connects to an OpenAI-compatible chat
 * completions endpoint (default: OpenRouter serving qwen/qwen-2.5-7b-instruct)
 * and evaluates tool/skill listings or free-form admin prompts. All model
 * output is validated with Zod before it ever reaches the admin console.
 */

export const AdminAuditSchema = z.object({
  decision: z.enum(["APPROVE", "FLAG", "NEEDS_REVIEW", "NO_ACTION"]),
  confidenceScore: z.number().min(0).max(1),
  suggestedCategory: z.string().optional(),
  auditSummary: z.string(),
});

export type AdminAudit = z.infer<typeof AdminAuditSchema>;

export type AuditTarget =
  | {
      kind: "TOOL";
      id: string;
      name: string;
      description: string;
      category: string;
      status: string;
      ownerAlias: string;
      ownerTrustScore: number;
    }
  | {
      kind: "SKILL";
      id: string;
      name: string;
      description: string;
      category: string;
      available: boolean;
      ownerAlias: string;
      ownerTrustScore: number;
    }
  | {
      kind: "PROMPT";
      prompt: string;
    };

export type AdminAuditResult =
  | { ok: true; audit: AdminAudit }
  | { ok: false; error: string };

const SYSTEM_PROMPT = [
  "You are the automated moderation assistant for the Tool Library,",
  "a zero-PII community tool lending and skills exchange.",
  "You audit community-submitted tool and skill listings for policy compliance.",
  "Policies: no illegal or dangerous weapon listings, no PII in descriptions",
  "(no emails, phone numbers, addresses), no spam or advertising,",
  "listings must be a genuine tool or community skill offer,",
  "and descriptions must be safe, accurate, and community-appropriate.",
  "Respond with ONLY a single JSON object, no markdown fences, no prose:",
  '{"decision": "APPROVE" | "FLAG" | "NEEDS_REVIEW" | "NO_ACTION",',
  ' "confidenceScore": <number between 0 and 1>,',
  ' "suggestedCategory": "<one of the platform categories, only if a better fit exists>",',
  ' "auditSummary": "<one or two sentence explanation>" }',
].join(" ");

function buildUserMessage(target: AuditTarget): string {
  if (target.kind === "PROMPT") {
    return `Admin prompt: ${target.prompt}\n\nAudit this request and respond with the JSON object only.`;
  }

  const listing = [
    `Type: ${target.kind === "TOOL" ? "Tool listing" : "Skill listing"}`,
    `Name: ${target.name}`,
    `Category: ${target.category}`,
    `Description: ${target.description}`,
    target.kind === "TOOL"
      ? `Current status: ${target.status}`
      : `Currently available: ${target.available ? "yes" : "no"}`,
    `Owner alias: ${target.ownerAlias}`,
    `Owner trust score: ${target.ownerTrustScore}`,
  ].join("\n");

  return `Audit the following community listing for policy compliance:\n\n${listing}\n\nRespond with the JSON object only.`;
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Model may wrap the JSON in prose or code fences; extract the outermost object.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Runs an AI audit. The caller must pass the live NextAuth session; the
 * service refuses to run for anyone without the ADMIN role.
 */
export async function runAdminAudit(
  session: { user?: { id?: string; role?: string } | null } | null,
  target: AuditTarget
): Promise<AdminAuditResult> {
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Admin privileges required to run AI audits" };
  }

  const endpoint = process.env.AI_INFERENCE_URL || "https://openrouter.ai/api/v1/chat/completions";
  const model = process.env.AI_MODEL_NAME || "qwen/qwen-2.5-7b-instruct";
  const apiKey = process.env.AI_INFERENCE_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(target) },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return { ok: false, error: "AI inference endpoint unreachable" };
  }

  if (!response.ok) {
    return { ok: false, error: `AI inference endpoint returned ${response.status}` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "AI inference endpoint returned invalid JSON" };
  }

  const choices = (payload as { choices?: Array<{ message?: { content?: string } }> })?.choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return { ok: false, error: "AI response contained no message content" };
  }

  const parsed = AdminAuditSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    return { ok: false, error: "AI response failed schema validation" };
  }

  return { ok: true, audit: parsed.data };
}
