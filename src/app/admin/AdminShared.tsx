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

"use client";

// ================================================================
// Shared admin console primitives — terminal aesthetic building
// blocks used by both the Command Console (/admin) and the LLM
// Control console (/admin/llm).
// ================================================================

export interface OwnerRef {
  id: string;
  alias: string;
  trustScore: number;
}

export interface ToolRow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  createdAt: Date;
  owner: OwnerRef;
}

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  createdAt: Date;
  owner: OwnerRef;
}

export function chip(variant: string): string {
  const map: Record<string, string> = {
    cyan: "border-cyan-500/50 text-cyan-400",
    purple: "border-purple-500/50 text-purple-400",
    green: "border-emerald-500/50 text-emerald-400",
    red: "border-red-500/50 text-red-400",
    amber: "border-amber-500/50 text-amber-400",
    zinc: "border-zinc-700 text-zinc-400",
  };
  return `font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${map[variant] ?? map.zinc}`;
}

export const STATUS_CHIP: Record<string, string> = {
  AVAILABLE: "green",
  OFFERED: "green",
  BORROWED: "red",
  PAUSED: "red",
  MAINTENANCE: "amber",
  PENDING: "red",
  AUTO_EXECUTED: "green",
  EXECUTED: "green",
  REJECTED: "zinc",
  FAILED: "amber",
  OPEN: "cyan",
  AGENT_DISPATCHED: "cyan",
  RESOLVED: "green",
  ESCALATED: "red",
  LLM_AGENT: "cyan",
  HUMAN_ADMIN: "red",
  CRITICAL: "red",
  HIGH: "amber",
  MEDIUM: "cyan",
  LOW: "zinc",
};

// Public-safe chip labels for internal enum values.
export const CHIP_LABEL: Record<string, string> = {
  LLM_AGENT: "AUTOMATED",
  AGENT_DISPATCHED: "DISPATCHED",
};

export function StatusChip({ value }: { value: string }) {
  return <span className={chip(STATUS_CHIP[value] ?? "zinc")}>{CHIP_LABEL[value] ?? value}</span>;
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
