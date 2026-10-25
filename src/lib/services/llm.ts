import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

/**
 * LLM provider service.
 *
 * Resolves the active LLM endpoint from the admin-managed configuration row
 * (LlmConfig table, API key stored AES-256-GCM encrypted) with a fallback to
 * legacy environment variables (AI_INFERENCE_URL / AI_INFERENCE_KEY /
 * AI_MODEL_NAME). All endpoints are OpenAI-compatible /chat/completions APIs
 * with function calling. No API key is ever hardcoded and no key material is
 * ever returned to the client — only a masked last-4 hint.
 */

export type ProviderId =
  | "OPENROUTER"
  | "OPENAI"
  | "DEEPSEEK"
  | "ZAI"
  | "OLLAMA_LOCAL"
  | "CUSTOM";

export const LLM_PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  baseUrl: string;
  requiresKey: boolean;
}> = [
  {
    id: "OPENROUTER",
    label: "OpenRouter (multi-provider gateway)",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    requiresKey: true,
  },
  {
    id: "OPENAI",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    requiresKey: true,
  },
  {
    id: "DEEPSEEK",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    requiresKey: true,
  },
  {
    id: "ZAI",
    label: "Z.ai / GLM",
    baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
    requiresKey: true,
  },
  {
    id: "OLLAMA_LOCAL",
    label: "Ollama (local, keyless)",
    baseUrl: "http://localhost:11434/v1/chat/completions",
    requiresKey: false,
  },
  {
    id: "CUSTOM",
    label: "Custom OpenAI-compatible endpoint",
    baseUrl: "",
    requiresKey: false,
  },
];

/** Suggested model ids surfaced as datalist options in the settings panel. */
export const LLM_MODEL_SUGGESTIONS = [
  "z-ai/glm-5.3",
  "deepseek-chat",
  "deepseek-reasoner",
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-haiku",
  "qwen/qwen-2.5-7b-instruct",
  "meta-llama/llama-3.1-8b-instruct",
  "llama3.1:8b",
];

export function getProviderPreset(id: string) {
  return LLM_PROVIDERS.find((p) => p.id === id) ?? null;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ResolvedLlm = {
  source: "DB" | "ENV";
  provider: string;
  url: string;
  model: string;
  apiKey: string | null;
};

/**
 * Resolves the active LLM endpoint. Returns null when neither the DB config
 * nor the legacy environment variables define a usable endpoint.
 */
export async function resolveLlm(): Promise<ResolvedLlm | null> {
  const row = await prisma.llmConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (row) {
    const preset = getProviderPreset(row.provider);
    const url =
      row.provider === "CUSTOM" ? row.baseUrl ?? "" : preset?.baseUrl ?? "";
    if (!url) return null;
    let apiKey: string | null = null;
    if (row.apiKeyEnc) {
      try {
        apiKey = decryptSecret(row.apiKeyEnc);
      } catch {
        return null; // Stored key undecryptable (e.g. AUTH_SECRET rotated)
      }
    }
    return { source: "DB", provider: row.provider, url, model: row.model, apiKey };
  }

  // Legacy environment fallback (pre-config-panel deployments).
  const envUrl = process.env.AI_INFERENCE_URL;
  const envModel = process.env.AI_MODEL_NAME;
  if (!envUrl && !envModel) return null;
  return {
    source: "ENV",
    provider: "CUSTOM",
    url: envUrl || "https://openrouter.ai/api/v1/chat/completions",
    model: envModel || "qwen/qwen-2.5-7b-instruct",
    apiKey: process.env.AI_INFERENCE_KEY || null,
  };
}

export type PublicLlmConfig = {
  configured: boolean;
  source: "DB" | "ENV" | "NONE";
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  keyHint: string | null; // masked last-4 only
};

/** Masked, client-safe view of the active configuration. Never includes key material. */
export async function getPublicLlmConfig(): Promise<PublicLlmConfig> {
  const row = await prisma.llmConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (row) {
    let keyHint: string | null = null;
    if (row.apiKeyEnc) {
      try {
        keyHint = maskSecret(decryptSecret(row.apiKeyEnc));
      } catch {
        keyHint = "••••????"; // Undecryptable (rotated master secret)
      }
    }
    return {
      configured: true,
      source: "DB",
      provider: row.provider,
      model: row.model,
      baseUrl: row.baseUrl ?? null,
      hasApiKey: Boolean(row.apiKeyEnc),
      keyHint,
    };
  }

  if (process.env.AI_INFERENCE_URL || process.env.AI_MODEL_NAME) {
    const envKey = process.env.AI_INFERENCE_KEY;
    return {
      configured: true,
      source: "ENV",
      provider: "CUSTOM",
      model: process.env.AI_MODEL_NAME || "qwen/qwen-2.5-7b-instruct",
      baseUrl: process.env.AI_INFERENCE_URL || "https://openrouter.ai/api/v1/chat/completions",
      hasApiKey: Boolean(envKey),
      keyHint: envKey ? maskSecret(envKey) : null,
    };
  }

  return {
    configured: false,
    source: "NONE",
    provider: null,
    model: null,
    baseUrl: null,
    hasApiKey: false,
    keyHint: null,
  };
}

export type CompletionResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: string };

/**
 * Runs one non-streaming chat completion against the resolved endpoint with
 * optional function-calling tools. Returns the raw assistant message
 * (including any tool_calls) for the caller's agent loop to handle.
 */
export async function chatCompletion(
  resolved: ResolvedLlm,
  messages: ChatMessage[],
  tools?: LlmToolSchema[],
  temperature = 0.2
): Promise<CompletionResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (resolved.apiKey) {
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }
  if (resolved.provider === "OPENROUTER") {
    // OpenRouter attribution headers (optional, no PII).
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "ToolsLibrary Admin Agent";
  }

  const body: Record<string, unknown> = {
    model: resolved.model,
    messages,
    temperature,
    max_tokens: 1200,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  let response: Response;
  try {
    response = await fetch(resolved.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    return { ok: false, error: "LLM endpoint unreachable" };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errPayload = (await response.json()) as { error?: { message?: string } };
      detail = errPayload?.error?.message ? `: ${errPayload.error.message}` : "";
    } catch {
      detail = "";
    }
    return { ok: false, error: `LLM endpoint returned ${response.status}${detail}` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "LLM endpoint returned invalid JSON" };
  }

  const choice = (payload as {
    choices?: Array<{ message?: ChatMessage }>;
  })?.choices?.[0]?.message;

  if (!choice || (typeof choice.content !== "string" && !choice.tool_calls)) {
    return { ok: false, error: "LLM response contained no message content" };
  }

  return { ok: true, message: choice };
}
