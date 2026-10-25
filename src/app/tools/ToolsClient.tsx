"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Filter, Hammer, Package, Truck, RotateCcw, Shield, User } from "lucide-react";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            Available
          </span>
        );
      case "BORROWED":
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-medium">
            Borrowed
          </span>
        );
      case "MAINTENANCE":
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium">
            Maintenance
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/30 text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Search Section */}
      <section className="relative">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-2 sm:p-4 shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search tools by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-12 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                aria-label="Search tools"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full sm:w-48 bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-10 pr-8 text-sm text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all appearance-none cursor-pointer"
                  aria-label="Filter by category"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full sm:w-40 bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-10 pr-8 text-sm text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all appearance-none cursor-pointer"
                  aria-label="Filter by status"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
            Tool Inventory ({filteredTools.length})
          </h2>
          <Link
            href="/tools/new"
            className="px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer flex items-center gap-2"
          >
            <Hammer className="w-4 h-4" aria-hidden="true" />
            Lend a Tool
          </Link>
        </div>

        {filteredTools.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
            <Package className="w-16 h-16 mx-auto text-slate-600 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No tools found</h3>
            <p className="text-slate-500">Try adjusting your search or filters, or be the first to lend a tool!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                className="group bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.25)]"
              >
                <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-slate-950/80">
                  {tool.imageUrl ? (
                    <img
                      src={`/api/uploads/${tool.imageUrl}`}
                      alt={`${tool.name} photo`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Hammer className="w-16 h-16 text-slate-700" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(tool.status)}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-slate-400 line-clamp-2">{tool.description}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                      <span className="text-xs font-medium text-cyan-300">{tool.owner.trustScore}</span>
                      <User className="w-4 h-4 text-slate-500" aria-hidden="true" />
                      <span className="text-xs text-slate-400">{tool.owner.alias}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800/50 text-slate-300 border border-white/10">
                      {tool.category}
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