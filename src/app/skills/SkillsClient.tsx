"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Filter, Wrench, Users, Shield, User, Plus } from "lucide-react";
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

  const getAvailabilityBadge = (available: boolean) => {
    if (available) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
          Available
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/30 text-xs font-medium">
        Unavailable
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero Search Section */}
      <section className="relative">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-2 sm:p-4 shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)]">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search skills by name, description, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-12 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                aria-label="Search skills"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full sm:w-56 bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-10 pr-8 text-sm text-slate-100 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all appearance-none cursor-pointer"
                  aria-label="Filter by category"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-white/15 bg-slate-950/80 text-purple-500 focus:ring-purple-500/20 focus:ring-2"
                  aria-label="Show only available skills"
                />
                <span className="text-sm text-slate-300">Available only</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-400 bg-clip-text text-transparent">
            Skills Exchange ({filteredSkills.length} of {totalCount})
          </h2>
          <Link
            href="/skills/new"
            className="px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Offer a Skill
          </Link>
        </div>

        {filteredSkills.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
            <Wrench className="w-16 h-16 mx-auto text-slate-600 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No skills found</h3>
            <p className="text-slate-500 mb-6">Try adjusting your search or filters, or be the first to offer a skill!</p>
            <Link
              href="/skills/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Offer a Skill
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSkills.map((skill) => (
              <Link
                key={skill.id}
                href={`/skills/${skill.id}`}
                className="group bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.25)]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Wrench className="w-7 h-7 text-purple-400" aria-hidden="true" />
                  </div>
                  {getAvailabilityBadge(skill.available)}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                    {skill.name}
                  </h3>
                  <p className="text-sm text-slate-400 line-clamp-2">{skill.description}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-400" aria-hidden="true" />
                      <span className="text-xs font-medium text-purple-300">{skill.owner.trustScore}</span>
                      <User className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      <span className="text-xs text-slate-400">{skill.owner.alias}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800/50 text-slate-300 border border-white/10">
                      {skill.category}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}