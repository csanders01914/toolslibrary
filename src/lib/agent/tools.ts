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

import { prisma } from "@/lib/db";
import { SKILL_CATEGORIES } from "@/lib/constants";

/**
 * Automation tool registry.
 *
 * Every tool declares whether it is DESTRUCTIVE. The guardedToolCall
 * interceptor enforces the platform guardrail: destructive calls are NEVER
 * executed inline — they are persisted as status=PENDING in AgentAction and
 * return PENDING_APPROVAL to the model. Execution only happens through
 * confirmAgentAction after an explicit human (ADMIN) approval.
 *
 * queryDatabase is strictly read-only with whitelisted entities, whitelisted
 * filter fields, and curated select projections (credential hashes and
 * encrypted secrets are unreachable).
 */

type PropDef = {
  type: "string" | "number" | "boolean";
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  description: string;
};

type ToolJsonSchema = {
  type: "object";
  properties: Record<string, PropDef>;
  required: string[];
};

type ExecuteResult = { ok: true; result: unknown } | { ok: false; error: string };

export type AgentToolDef = {
  name: string;
  description: string;
  parameters: ToolJsonSchema;
  destructive: boolean;
  execute: (args: Record<string, unknown>) => Promise<ExecuteResult>;
};

const TOOL_STATUSES = ["AVAILABLE", "MAINTENANCE"] as const;

// ----------------------------------------------------------------
// queryDatabase — read-only structured queries
// ----------------------------------------------------------------

const QUERY_ENTITIES = ["tools", "skills", "users", "loans", "helpRequests"] as const;
type QueryEntity = (typeof QUERY_ENTITIES)[number];

const QUERY_FIELD_WHITELIST: Record<QueryEntity, string[]> = {
  tools: ["id", "name", "category", "status"],
  skills: ["id", "name", "category", "available"],
  users: ["id", "username", "alias", "role", "banned"],
  loans: ["id", "status"],
  helpRequests: ["id", "category", "route", "status", "urgency"],
};

const QUERY_SELECTS: Record<QueryEntity, Record<string, unknown>> = {
  tools: {
    id: true,
    name: true,
    description: true,
    category: true,
    status: true,
    createdAt: true,
    owner: { select: { alias: true, trustScore: true } },
  },
  skills: {
    id: true,
    name: true,
    description: true,
    category: true,
    available: true,
    createdAt: true,
    owner: { select: { alias: true, trustScore: true } },
  },
  users: {
    id: true,
    username: true,
    alias: true,
    role: true,
    trustScore: true,
    banned: true,
    createdAt: true,
  },
  loans: {
    id: true,
    status: true,
    startDate: true,
    endDate: true,
    returnedAt: true,
    returnCondition: true,
    tool: { select: { name: true, status: true } },
    borrower: { select: { alias: true, trustScore: true } },
  },
  helpRequests: {
    id: true,
    alias: true,
    category: true,
    message: true,
    urgency: true,
    route: true,
    status: true,
    resolution: true,
    createdAt: true,
  },
};

const queryDatabaseTool: AgentToolDef = {
  name: "queryDatabase",
  description:
    "Read-only query over platform data. Entities: tools, skills, users, loans, helpRequests. " +
    "Optionally filter by one whitelisted field with an exact-match value. Never returns credentials.",
  parameters: {
    type: "object",
    properties: {
      entity: {
        type: "string",
        enum: [...QUERY_ENTITIES],
        description: "Which table to query",
      },
      field: {
        type: "string",
        description: "Optional exact-match filter field (must be whitelisted for the entity)",
      },
      value: {
        type: "string",
        maxLength: 200,
        description: "Optional exact-match filter value",
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "Max rows to return (default 20, hard cap 50)",
      },
    },
    required: ["entity"],
  },
  destructive: false,
  execute: async (args) => {
    const entity = args.entity as QueryEntity;
    if (!QUERY_ENTITIES.includes(entity)) {
      return { ok: false, error: `Unknown entity "${String(args.entity)}"` };
    }
    const limitRaw = typeof args.limit === "number" ? Math.floor(args.limit) : 20;
    const limit = Math.max(1, Math.min(50, limitRaw));

    const where: Record<string, unknown> = {};
    if (args.field !== undefined && args.value !== undefined) {
      const field = String(args.field);
      if (!QUERY_FIELD_WHITELIST[entity].includes(field)) {
        return {
          ok: false,
          error: `Field "${field}" is not queryable on ${entity}. Allowed: ${QUERY_FIELD_WHITELIST[entity].join(", ")}`,
        };
      }
      let value: string | boolean = String(args.value);
      if (field === "available" || field === "banned") {
        value = value === "true";
      }
      where[field] = value;
    }

    const rows = await (prisma as unknown as Record<string, { findMany: (q: unknown) => Promise<unknown[]> }>)[
      // Map entity name to a Prisma delegate (all five are whitelisted above).
      ({ tools: "tool", skills: "skill", users: "user", loans: "loan", helpRequests: "helpRequest" } as const)[entity]
    ].findMany({
      where,
      select: QUERY_SELECTS[entity],
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, result: { entity, count: rows.length, rows } };
  },
};

// ----------------------------------------------------------------
// updateToolStatus — safe moderation action
// ----------------------------------------------------------------

const updateToolStatusTool: AgentToolDef = {
  name: "updateToolStatus",
  description:
    "Set a tool listing's status to AVAILABLE or MAINTENANCE. Cannot release a tool that is on an active loan.",
  parameters: {
    type: "object",
    properties: {
      toolId: { type: "string", minLength: 1, maxLength: 64, description: "Tool id" },
      status: {
        type: "string",
        enum: [...TOOL_STATUSES],
        description: "New status",
      },
    },
    required: ["toolId", "status"],
  },
  destructive: false,
  execute: async (args) => {
    const tool = await prisma.tool.findUnique({ where: { id: String(args.toolId) } });
    if (!tool) return { ok: false, error: "Tool not found" };
    const status = String(args.status);
    if (status === "AVAILABLE" && tool.status === "BORROWED") {
      const activeLoan = await prisma.loan.findFirst({
        where: { toolId: tool.id, status: { in: ["APPROVED", "ACTIVE"] } },
      });
      if (activeLoan) {
        return { ok: false, error: "Tool is on an active loan; resolve the loan first" };
      }
    }
    const updated = await prisma.tool.update({ where: { id: tool.id }, data: { status } });
    return {
      ok: true,
      result: { toolId: updated.id, name: updated.name, status: updated.status },
    };
  },
};

// ----------------------------------------------------------------
// modifySkillListing — safe moderation action
// ----------------------------------------------------------------

const modifySkillListingTool: AgentToolDef = {
  name: "modifySkillListing",
  description:
    "Edit a skill listing: toggle availability, change category, or rewrite the description (max 2000 chars). Only provided fields are applied.",
  parameters: {
    type: "object",
    properties: {
      skillId: { type: "string", minLength: 1, maxLength: 64, description: "Skill id" },
      available: { type: "boolean", description: "Set listing availability" },
      category: {
        type: "string",
        enum: [...SKILL_CATEGORIES],
        description: "New category (must be a platform skill category)",
      },
      description: {
        type: "string",
        minLength: 10,
        maxLength: 2000,
        description: "Replacement description",
      },
    },
    required: ["skillId"],
  },
  destructive: false,
  execute: async (args) => {
    const skill = await prisma.skill.findUnique({ where: { id: String(args.skillId) } });
    if (!skill) return { ok: false, error: "Skill not found" };

    const data: { available?: boolean; category?: string; description?: string } = {};
    if (typeof args.available === "boolean") data.available = args.available;
    if (typeof args.category === "string") {
      if (!SKILL_CATEGORIES.includes(args.category)) {
        return { ok: false, error: `Invalid category. Allowed: ${SKILL_CATEGORIES.join(", ")}` };
      }
      data.category = args.category;
    }
    if (typeof args.description === "string") {
      const desc = args.description.trim();
      if (desc.length < 10 || desc.length > 2000) {
        return { ok: false, error: "Description must be 10-2000 characters" };
      }
      data.description = desc;
    }
    if (Object.keys(data).length === 0) {
      return { ok: false, error: "No changes provided" };
    }
    const updated = await prisma.skill.update({ where: { id: skill.id }, data });
    return {
      ok: true,
      result: {
        skillId: updated.id,
        name: updated.name,
        available: updated.available,
        category: updated.category,
      },
    };
  },
};

// ----------------------------------------------------------------
// banUserAlias — DESTRUCTIVE (human approval required)
// ----------------------------------------------------------------

const banUserAliasTool: AgentToolDef = {
  name: "banUserAlias",
  description:
    "DESTRUCTIVE. Ban a community member by their public alias: sets banned=true, zeroes trust score, " +
    "pulls all their tool listings into MAINTENANCE and unpublishes all their skill listings. " +
    "Requires human approval before it executes.",
  parameters: {
    type: "object",
    properties: {
      alias: { type: "string", minLength: 2, maxLength: 32, description: "Exact public alias to ban" },
      reason: { type: "string", minLength: 10, maxLength: 500, description: "Why this ban is warranted" },
    },
    required: ["alias", "reason"],
  },
  destructive: true,
  execute: async (args) => {
    const alias = String(args.alias).trim();
    const user = await prisma.user.findFirst({ where: { alias } });
    if (!user) return { ok: false, error: `No user with alias "${alias}"` };
    if (user.role === "ADMIN") {
      return { ok: false, error: "Refusing to ban an ADMIN account" };
    }
    if (user.banned) return { ok: false, error: "User is already banned" };

    const [updatedUser, toolsPulled, skillsUnpublished] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { banned: true, trustScore: 0 } }),
      prisma.tool.updateMany({
        where: { ownerId: user.id, status: "AVAILABLE" },
        data: { status: "MAINTENANCE" },
      }),
      prisma.skill.updateMany({ where: { ownerId: user.id }, data: { available: false } }),
    ]);

    return {
      ok: true,
      result: {
        userId: updatedUser.id,
        alias: updatedUser.alias,
        banned: updatedUser.banned,
        trustScore: updatedUser.trustScore,
        toolsPulledToMaintenance: toolsPulled.count,
        skillsUnpublished: skillsUnpublished.count,
      },
    };
  },
};

// ----------------------------------------------------------------
// deleteTool / deleteSkill — DESTRUCTIVE (human approval required)
// ----------------------------------------------------------------

const deleteToolTool: AgentToolDef = {
  name: "deleteTool",
  description:
    "DESTRUCTIVE. Permanently delete a tool listing and its loan history. Requires human approval.",
  parameters: {
    type: "object",
    properties: {
      toolId: { type: "string", minLength: 1, maxLength: 64, description: "Tool id" },
      reason: { type: "string", minLength: 10, maxLength: 500, description: "Why deletion is warranted" },
    },
    required: ["toolId", "reason"],
  },
  destructive: true,
  execute: async (args) => {
    const tool = await prisma.tool.findUnique({ where: { id: String(args.toolId) } });
    if (!tool) return { ok: false, error: "Tool not found" };
    if (tool.status === "BORROWED") {
      return { ok: false, error: "Tool is on an active loan; resolve the loan first" };
    }
    await prisma.tool.delete({ where: { id: tool.id } });
    return { ok: true, result: { deleted: tool.id, name: tool.name } };
  },
};

const deleteSkillTool: AgentToolDef = {
  name: "deleteSkill",
  description:
    "DESTRUCTIVE. Permanently delete a skill listing. Requires human approval.",
  parameters: {
    type: "object",
    properties: {
      skillId: { type: "string", minLength: 1, maxLength: 64, description: "Skill id" },
      reason: { type: "string", minLength: 10, maxLength: 500, description: "Why deletion is warranted" },
    },
    required: ["skillId", "reason"],
  },
  destructive: true,
  execute: async (args) => {
    const skill = await prisma.skill.findUnique({ where: { id: String(args.skillId) } });
    if (!skill) return { ok: false, error: "Skill not found" };
    await prisma.skill.delete({ where: { id: skill.id } });
    return { ok: true, result: { deleted: skill.id, name: skill.name } };
  },
};

// ----------------------------------------------------------------
// resolveHelpRequest — safe triage outcome
// ----------------------------------------------------------------

const resolveHelpRequestTool: AgentToolDef = {
  name: "resolveHelpRequest",
  description:
    "Mark a help request RESOLVED with a resolution note (10-2000 chars) after handling it.",
  parameters: {
    type: "object",
    properties: {
      requestId: { type: "string", minLength: 1, maxLength: 64, description: "HelpRequest id" },
      resolution: { type: "string", minLength: 10, maxLength: 2000, description: "Resolution note" },
    },
    required: ["requestId", "resolution"],
  },
  destructive: false,
  execute: async (args) => {
    const request = await prisma.helpRequest.findUnique({ where: { id: String(args.requestId) } });
    if (!request) return { ok: false, error: "Help request not found" };
    const resolution = String(args.resolution).trim();
    const updated = await prisma.helpRequest.update({
      where: { id: request.id },
      data: { status: "RESOLVED", resolution },
    });
    return { ok: true, result: { requestId: updated.id, status: updated.status } };
  },
};

// ----------------------------------------------------------------
// Registry + argument validation + GUARDRAIL INTERCEPTOR
// ----------------------------------------------------------------

export const AGENT_TOOLS: AgentToolDef[] = [
  queryDatabaseTool,
  updateToolStatusTool,
  modifySkillListingTool,
  resolveHelpRequestTool,
  banUserAliasTool,
  deleteToolTool,
  deleteSkillTool,
];

export function getAgentToolDef(name: string): AgentToolDef | null {
  return AGENT_TOOLS.find((t) => t.name === name) ?? null;
}

/** Function-calling schema array for the chat completions API. */
export function agentToolSchemas() {
  return AGENT_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.destructive
        ? `${t.description} (GUARDRAIL: intercepted and queued for human approval)`
        : t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }));
}

type ArgsValidation =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string };

/** Strict validator over the tool JSON-schema subset declared above. */
export function validateToolArgs(def: AgentToolDef, raw: unknown): ArgsValidation {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Arguments must be a JSON object" };
  }
  const input = raw as Record<string, unknown>;
  const args: Record<string, unknown> = {};

  for (const key of def.parameters.required) {
    if (!(key in input)) {
      return { ok: false, error: `Missing required argument "${key}"` };
    }
  }

  for (const [key, value] of Object.entries(input)) {
    const prop = def.parameters.properties[key];
    if (!prop) {
      return { ok: false, error: `Unknown argument "${key}"` };
    }
    if (value === null || value === undefined) continue;

    if (prop.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, error: `Argument "${key}" must be a number` };
      }
      if (prop.minimum !== undefined && value < prop.minimum) {
        return { ok: false, error: `Argument "${key}" must be >= ${prop.minimum}` };
      }
      if (prop.maximum !== undefined && value > prop.maximum) {
        return { ok: false, error: `Argument "${key}" must be <= ${prop.maximum}` };
      }
      args[key] = value;
      continue;
    }

    if (typeof value !== "string") {
      if (!(prop.type === "boolean" && typeof value === "boolean")) {
        return { ok: false, error: `Argument "${key}" must be a ${prop.type}` };
      }
      args[key] = value;
      continue;
    }

    if (prop.enum && !prop.enum.includes(value)) {
      return {
        ok: false,
        error: `Argument "${key}" must be one of: ${prop.enum.join(", ")}`,
      };
    }
    if (prop.minLength !== undefined && value.length < prop.minLength) {
      return { ok: false, error: `Argument "${key}" must be at least ${prop.minLength} characters` };
    }
    if (prop.maxLength !== undefined && value.length > prop.maxLength) {
      return { ok: false, error: `Argument "${key}" must be at most ${prop.maxLength} characters` };
    }
    args[key] = value;
  }

  return { ok: true, args };
}

export type ToolCallOutcome =
  | { kind: "EXECUTED"; actionId: string; result: unknown }
  | { kind: "PENDING_APPROVAL"; actionId: string }
  | { kind: "ERROR"; error: string };

/**
 * THE GUARDRAIL. Every automated tool call passes through here.
 *
 * - Destructive tools are intercepted: the call is persisted as PENDING and
 *   nothing is executed. It surfaces in the admin guardrail queue and only
 *   runs after confirmAgentAction() with approve=true.
 * - Safe tools execute immediately and are recorded for audit.
 * - Unknown tools and malformed arguments are rejected without execution.
 */
export async function guardedToolCall(
  toolName: string,
  rawArgs: unknown
): Promise<ToolCallOutcome> {
  const def = getAgentToolDef(toolName);
  if (!def) {
    return { kind: "ERROR", error: `Unknown tool "${toolName}" — rejected by guardrail` };
  }

  const parsed = validateToolArgs(def, rawArgs);
  if (!parsed.ok) {
    return { kind: "ERROR", error: `Invalid arguments for ${toolName}: ${parsed.error}` };
  }

  if (def.destructive) {
    const action = await prisma.agentAction.create({
      data: {
        toolName: def.name,
        argsJson: JSON.stringify(parsed.args),
        destructive: true,
        status: "PENDING",
      },
    });
    return { kind: "PENDING_APPROVAL", actionId: action.id };
  }

  const outcome = await def.execute(parsed.args);
  const action = await prisma.agentAction.create({
    data: {
      toolName: def.name,
      argsJson: JSON.stringify(parsed.args),
      destructive: false,
      status: outcome.ok ? "AUTO_EXECUTED" : "FAILED",
      resultJson: outcome.ok ? JSON.stringify(outcome.result) : null,
      error: outcome.ok ? null : outcome.error,
      decidedAt: new Date(),
    },
  });

  return outcome.ok
    ? { kind: "EXECUTED", actionId: action.id, result: outcome.result }
    : { kind: "ERROR", error: outcome.error };
}

export type ConfirmResult =
  | { ok: true; status: "EXECUTED" | "REJECTED" | "FAILED"; result?: unknown; error?: string }
  | { ok: false; error: string };

/**
 * Human-in-the-loop confirmation gate. ADMIN-only. Approves (executes now) or
 * rejects a previously intercepted destructive action.
 */
export async function confirmAgentAction(
  actionId: string,
  approve: boolean,
  session: { user?: { id?: string; role?: string } | null } | null
): Promise<ConfirmResult> {
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Admin privileges required to confirm automated actions" };
  }

  const action = await prisma.agentAction.findUnique({ where: { id: actionId } });
  if (!action) return { ok: false, error: "Action not found" };
  if (action.status !== "PENDING") {
    return { ok: false, error: `Action is not pending (status: ${action.status})` };
  }

  if (!approve) {
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    return { ok: true, status: "REJECTED" };
  }

  const def = getAgentToolDef(action.toolName);
  if (!def) {
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: "FAILED", error: "Tool no longer exists in registry", decidedAt: new Date() },
    });
    return { ok: true, status: "FAILED", error: "Tool no longer exists in registry" };
  }

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(action.argsJson) as Record<string, unknown>;
  } catch {
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: "FAILED", error: "Corrupted argument payload", decidedAt: new Date() },
    });
    return { ok: true, status: "FAILED", error: "Corrupted argument payload" };
  }

  const outcome = await def.execute(args);
  await prisma.agentAction.update({
    where: { id: action.id },
    data: {
      status: outcome.ok ? "EXECUTED" : "FAILED",
      resultJson: outcome.ok ? JSON.stringify(outcome.result) : null,
      error: outcome.ok ? null : outcome.error,
      decidedAt: new Date(),
    },
  });

  return outcome.ok
    ? { ok: true, status: "EXECUTED", result: outcome.result }
    : { ok: true, status: "FAILED", error: outcome.error };
}
