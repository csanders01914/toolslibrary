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

import { PrismaClient } from "@prisma/client";

/**
 * Inventory data access — live, read-only queries against the platform's
 * SQLite database (the same volume the website uses; the Prisma client is
 * generated from the repository root's single schema).
 *
 * The command module talks only to this interface. Queries are read-only
 * (SELECT equivalents) with a short in-memory cache so chat commands never
 * hammer the database. Methods may throw on infrastructure failure; commands
 * catch and reply with a friendly "temporarily unavailable" message.
 * health() never throws.
 */

export const TOOL_CATEGORIES = [
  "Hand Tools",
  "Power Tools",
  "Gardening",
  "Automotive",
  "Electrical",
  "Plumbing",
  "Woodworking",
  "Measuring & Layout",
  "Safety Equipment",
  "Other",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export type ToolStatus = "AVAILABLE" | "BORROWED" | "MAINTENANCE";

export interface ToolRecord {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  status: ToolStatus;
  ownerAlias: string;
}

export interface ToolRepository {
  /** All available (not borrowed, not in maintenance) tools, optionally filtered by category. */
  listAvailable(category?: ToolCategory): Promise<ToolRecord[]>;
  /** Case-insensitive substring search across name and description. */
  search(keyword: string): Promise<ToolRecord[]>;
  /** Count of tools per category, for the category overview. */
  countByCategory(): Promise<ReadonlyMap<ToolCategory, number>>;
  /** Connection/health summary for the !status command. Never throws. */
  health(): Promise<{ connected: boolean; toolCount: number }>;
  /** Release underlying resources on shutdown. */
  destroy(): Promise<void>;
}

const CACHE_TTL_MS = 60_000;

export class PrismaToolRepository implements ToolRepository {
  private readonly prisma = new PrismaClient();
  private cache: { tools: ToolRecord[]; fetchedAt: number } | null = null;

  private async loadTools(): Promise<ToolRecord[]> {
    if (this.cache !== null && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.tools;
    }

    const rows = await this.prisma.tool.findMany({
      include: { owner: { select: { alias: true } } },
      orderBy: { name: "asc" },
    });

    const tools: ToolRecord[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as ToolCategory,
      description: row.description,
      status: row.status as ToolStatus,
      ownerAlias: row.owner.alias,
    }));

    this.cache = { tools, fetchedAt: Date.now() };
    return tools;
  }

  async listAvailable(category?: ToolCategory): Promise<ToolRecord[]> {
    const tools = await this.loadTools();
    return tools.filter(
      (tool) =>
        tool.status === "AVAILABLE" && (category === undefined || tool.category === category)
    );
  }

  async search(keyword: string): Promise<ToolRecord[]> {
    const needle = keyword.trim().toLowerCase();
    if (needle.length === 0) return [];
    const tools = await this.loadTools();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(needle) ||
        tool.description.toLowerCase().includes(needle)
    );
  }

  async countByCategory(): Promise<ReadonlyMap<ToolCategory, number>> {
    const tools = await this.loadTools();
    const counts = new Map<ToolCategory, number>();
    for (const category of TOOL_CATEGORIES) counts.set(category, 0);
    for (const tool of tools) {
      counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    }
    return counts;
  }

  async health(): Promise<{ connected: boolean; toolCount: number }> {
    try {
      const toolCount = await this.prisma.tool.count();
      return { connected: true, toolCount };
    } catch (error) {
      console.error(
        "[data] database health check failed:",
        error instanceof Error ? error.message : error
      );
      return { connected: false, toolCount: 0 };
    }
  }

  async destroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

let repository: ToolRepository | null = null;

/** Active data source — the platform database (constructed on first use). */
export function getToolRepository(): ToolRepository {
  if (repository === null) {
    repository = new PrismaToolRepository();
  }
  return repository;
}
