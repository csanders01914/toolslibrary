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
import { SKILL_CATEGORIES } from "@/lib/constants";

const ALL_CATEGORIES = ["All", ...SKILL_CATEGORIES];

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  owner: {
    id: string;
    alias: string;
    trustScore: number;
  };
  createdAt: Date | string;
}

interface SkillsClientProps {
  initialSkills: Skill[];
  totalCount: number;
}

const formatVouch = (trustScore: number) => {
  const vouch = trustScore - 100;
  return vouch >= 0 ? `+${vouch}` : `${vouch}`;
};

export default function SkillsClient({ initialSkills, totalCount }: SkillsClientProps) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [availableOnly, setAvailableOnly] = useState(true);

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(search.toLowerCase()) ||
      skill.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || skill.category === category;
    const matchesAvailability = !availableOnly || skill.available;
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-mono text-sm text-purple-400 tracking-[0.2em] uppercase">SKILLS EXCHANGE</h1>
        <span className="font-mono text-xs text-zinc-500">
          {filteredSkills.length} of {totalCount} listings
        </span>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => e.preventDefault()}
        role="search"
        aria-label="Search skills"
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="search"
          placeholder="SEARCH EXCHANGE..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
          aria-label="Search skills"
        />
        <button
          type="submit"
          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors cursor-pointer"
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
                  ? "border-purple-500/60 text-purple-400 bg-purple-500/10"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white active:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <label className="tap-target gap-2 cursor-pointer font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="w-4 h-4 bg-black border border-zinc-700 accent-purple-500 cursor-pointer"
            aria-label="Show only available skills"
          />
          AVAILABLE ONLY
        </label>
        <Link
          href="/skills/new"
          className="ml-auto font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors cursor-pointer"
        >
          OFFER A SKILL
        </Link>
      </div>

      {/* Skills grid */}
      {filteredSkills.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-zinc-800 p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">NO SKILLS FOUND</p>
          <p className="text-sm text-zinc-400 mt-2">
            Try adjusting your search or filters, or be the first to offer a skill.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <Link
              key={skill.id}
              href={`/skills/${skill.id}`}
              className="block bg-[#0a0a0a] border border-zinc-800 rounded-none p-5 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-white">{skill.name}</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-purple-500/50 text-purple-400 whitespace-nowrap">
                  {skill.category}
                </span>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-2 mt-2">{skill.description}</p>
              <div className="font-mono text-xs space-y-1 pt-3 mt-3 border-t border-zinc-900">
                <p>
                  <span className="text-zinc-500">PROVIDER: </span>
                  <span className="text-zinc-300">{skill.owner.alias}</span>
                </p>
                <p>
                  <span className="text-zinc-500">STATUS: </span>
                  {skill.available ? (
                    <span className="text-emerald-400">OFFERED</span>
                  ) : (
                    <span className="text-zinc-500">UNAVAILABLE</span>
                  )}
                </p>
                <p>
                  <span className="text-zinc-500">VOUCH: </span>
                  <span className="text-emerald-400">{formatVouch(skill.owner.trustScore)}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
