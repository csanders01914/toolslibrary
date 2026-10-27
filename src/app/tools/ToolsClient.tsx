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

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";

const ALL_CATEGORIES = ["All", ...CATEGORIES];
const STATUS_OPTIONS = ["All", "AVAILABLE", "BORROWED", "MAINTENANCE"];

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  imageUrl: string | null;
  owner: {
    id: string;
    alias: string;
    trustScore: number;
  };
  createdAt: string;
}

interface ToolsClientProps {
  initialTools: Tool[];
}

const formatVouch = (trustScore: number) => {
  const vouch = trustScore - 100;
  return vouch >= 0 ? `+${vouch}` : `${vouch}`;
};

const statusValueClass = (status: string) => {
  switch (status) {
    case "AVAILABLE":
      return "text-emerald-400";
    case "BORROWED":
      return "text-red-400";
    case "MAINTENANCE":
      return "text-amber-400";
    default:
      return "text-zinc-300";
  }
};

export default function ToolsClient({ initialTools }: ToolsClientProps) {
  const [tools, setTools] = useState<Tool[]>(initialTools);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || tool.category === category;
    const matchesStatus = status === "All" || tool.status === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-mono text-sm text-cyan-400 tracking-[0.2em] uppercase">TOOLS CATALOG</h1>
        <span className="font-mono text-xs text-zinc-500">{filteredTools.length} listings</span>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => e.preventDefault()}
        role="search"
        aria-label="Search tools"
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="search"
          placeholder="SEARCH CATALOG..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
          aria-label="Search tools"
        />
        <button
          type="submit"
          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors cursor-pointer"
        >
          SEARCH
        </button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={`tap-target font-mono text-[10px] uppercase tracking-wider px-3 border transition-colors cursor-pointer ${
                category === cat
                  ? "border-cyan-500/60 text-cyan-400 bg-cyan-500/10"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white active:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Link
          href="/tools/new"
          className="ml-auto font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors cursor-pointer"
        >
          LEND A TOOL
        </Link>
      </div>

      {/* Tools grid */}
      {filteredTools.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-zinc-800 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">NO TOOLS FOUND</p>
          <p className="text-sm text-zinc-400 mt-2">
            Try adjusting your search or filters, or be the first to lend a tool.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className="block bg-[#0a0a0a] border border-zinc-800 rounded-none p-5 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-white">{tool.name}</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-cyan-500/50 text-cyan-400 whitespace-nowrap">
                  {tool.category}
                </span>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-2 mt-2">{tool.description}</p>
              <div className="font-mono text-xs space-y-1 pt-3 mt-3 border-t border-zinc-900">
                <p>
                  <span className="text-zinc-500">OWNER: </span>
                  <span className="text-zinc-300">{tool.owner.alias}</span>
                </p>
                <p>
                  <span className="text-zinc-500">STATUS: </span>
                  <span className={statusValueClass(tool.status)}>{tool.status}</span>
                </p>
                <p>
                  <span className="text-zinc-500">VOUCH: </span>
                  <span className="text-emerald-400">{formatVouch(tool.owner.trustScore)}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
