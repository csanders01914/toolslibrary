/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import {
  getPublicLlmConfig,
  getProviderPreset,
  LLM_PROVIDERS,
  LLM_MODEL_SUGGESTIONS,
} from "@/lib/services/llm";

/**
 * Automation configuration endpoint. ADMIN-gated.
 * GET  → masked, client-safe view of the active config (never returns keys).
 * POST → upserts the config row; the API key is encrypted at rest with
 *        AES-256-GCM and never echoed back to the client.
 */

const PROVIDER_IDS = LLM_PROVIDERS.map((p) => p.id) as [string, ...string[]];

const saveSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  // Empty string = keep the currently stored key; "CLEAR" = remove it.
  apiKey: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
  }

  const config = await getPublicLlmConfig();
  return NextResponse.json({
    config,
    providers: LLM_PROVIDERS,
    modelSuggestions: LLM_MODEL_SUGGESTIONS,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation failed: ${parsed.error.errors[0].message}` },
      { status: 400 }
    );
  }

  const { provider, model, baseUrl, apiKey } = parsed.data;
  const preset = getProviderPreset(provider);

  let resolvedBaseUrl: string | null = null;
  if (provider === "CUSTOM") {
    if (!baseUrl) {
      return NextResponse.json(
        { error: "A base URL is required for the CUSTOM provider" },
        { status: 400 }
      );
    }
    resolvedBaseUrl = baseUrl;
  } else if (baseUrl) {
    // Allow overriding the preset URL for known providers too (e.g. self-hosted gateways).
    resolvedBaseUrl = baseUrl;
  } else {
    resolvedBaseUrl = preset?.baseUrl || null;
  }

  if (preset?.requiresKey && !preset.baseUrl.startsWith("http://localhost")) {
    // Key-required providers: allow saving without a key only if one is already stored.
    const existing = await prisma.llmConfig.findFirst({ orderBy: { updatedAt: "desc" } });
    const keyProvided = apiKey !== undefined && apiKey !== "" && apiKey !== "CLEAR";
    if (!keyProvided && !(existing && existing.apiKeyEnc)) {
      return NextResponse.json(
        { error: `${preset.label} requires an API key` },
        { status: 400 }
      );
    }
  }

  const existing = await prisma.llmConfig.findFirst({ orderBy: { updatedAt: "desc" } });

  const data: {
    provider: string;
    model: string;
    baseUrl: string | null;
    apiKeyEnc?: string | null;
  } = {
    provider,
    model,
    baseUrl: resolvedBaseUrl,
  };

  if (apiKey === "CLEAR") {
    data.apiKeyEnc = null;
  } else if (apiKey !== undefined && apiKey !== "") {
    data.apiKeyEnc = encryptSecret(apiKey);
  }
  // apiKey undefined or empty → keep whatever is stored.

  if (existing) {
    await prisma.llmConfig.update({ where: { id: existing.id }, data });
  } else {
    await prisma.llmConfig.create({ data });
  }

  const config = await getPublicLlmConfig();
  return NextResponse.json({ ok: true, config });
}
