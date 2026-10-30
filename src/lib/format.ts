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

/**
 * Server-safe date formatting utilities (PHASE_30 hotfix).
 *
 * Deliberately NO "use client" directive: these are plain functions shared by
 * BOTH server components (e.g. /transparency) and client components (the
 * admin console). They previously lived in src/app/admin/AdminShared.tsx,
 * which is a "use client" module — importing them from a Server Component
 * turned them into client references, and the first server-side invocation
 * (the transparency page rendering a committed canary event) threw
 * "Attempted to call formatDate() from the server". Pure formatting logic
 * belongs in a directive-free module so the import graph never crosses the
 * server/client boundary for function calls.
 */

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
