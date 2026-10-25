import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Hammer, Shield, Users, Search, Filter, Package, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

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

export default async function HomePage() {
  const [toolCount, skillCount, recentTools] = await Promise.all([
    prisma.tool.count(),
    prisma.skill.count(),
    prisma.tool.findMany({
      where: { status: "AVAILABLE" },
      include: {
        owner: {
          select: { id: true, alias: true, trustScore: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

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
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent relative z-10">
          Community Tool Library
        </h1>
        <p className="mt-4 text-slate-300 max-w-2xl mx-auto relative z-10 text-lg">
          Zero-PII peer-to-peer tool lending and skills exchange. Share, borrow, and connect
          with your neighbors — no email, no phone, no tracking.
        </p>
        <div className="mt-10 flex justify-center gap-4 relative z-10">
          <Link
            href="/tools"
            className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer flex items-center gap-2"
          >
            <Hammer className="w-4 h-4" aria-hidden="true" />
            Browse Tools
          </Link>
          <Link
            href="/skills"
            className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer flex items-center gap-2"
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            Skills Exchange
          </Link>
        </div>

        {/* Search Dock */}
        <div className="mt-12 max-w-3xl mx-auto relative z-10">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-2 sm:p-4 shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search tools by name, description, or category..."
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-12 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  aria-label="Search tools"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                <select className="w-full sm:w-48 bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 pl-10 pr-8 text-sm text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all appearance-none cursor-pointer" aria-label="Filter by category">
                  <option value="All">All Categories</option>
                  <option value="Power Tools">Power Tools</option>
                  <option value="Hand Tools">Hand Tools</option>
                  <option value="Gardening">Gardening</option>
                  <option value="Automotive">Automotive</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Woodworking">Woodworking</option>
                  <option value="Measuring & Layout">Measuring & Layout</option>
                  <option value="Safety Equipment">Safety Equipment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Feature Grid */}
      <section>
        <h2 className="sr-only">Core Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Zero-PII Identity */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)] group">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
              <Shield className="w-7 h-7 text-cyan-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Zero-PII Cypherpunk Identity</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Only a username, public alias, and password. No email, no phone, no tracking.
              Your identity stays yours — cryptographic recovery codes replace traditional resets.
            </p>
          </div>

          {/* Cryptographic Trust Scores */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_0_30px_-5px_rgba(16,185,137,0.2)] group">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
              <Package className="w-7 h-7 text-emerald-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-emerald-300 mb-2">Cryptographic Trust Scores</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every loan builds reputation. On-time returns in good condition earn +5 trust.
              Damaged or overdue items lose -15. Transparent, tamper-proof community accountability.
            </p>
          </div>

          {/* Community Skills & Tool Sharing */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)] group">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
              <Users className="w-7 h-7 text-purple-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-purple-300 mb-2">Community Skills & Tool Sharing</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Lend tools you own, borrow what you need, offer skills you've mastered.
              Build local resilience through mutual aid — no platforms, no middlemen.
            </p>
          </div>
        </div>
      </section>

      {/* Live Inventory Showcase */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
            Recently Listed Tools ({toolCount} total)
          </h2>
          <Link
            href="/tools"
            className="px-4 py-2 rounded-xl font-semibold text-sm bg-slate-800/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-300 transition-all duration-200 flex items-center gap-2"
          >
            View All
            <Truck className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {recentTools.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
            <Package className="w-16 h-16 mx-auto text-slate-600 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No tools listed yet</h3>
            <p className="text-slate-500 mb-6">Be the first to share a tool with your community!</p>
            <Link
              href="/tools/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200"
            >
              <Hammer className="w-4 h-4" aria-hidden="true" />
              Lend a Tool
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentTools.map((tool) => (
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
                      <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
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

        {/* Stats Row */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <Hammer className="w-12 h-12 mx-auto text-cyan-400 mb-3" aria-hidden="true" />
            <p className="text-3xl font-extrabold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
              {toolCount}
            </p>
            <p className="text-slate-400 mt-1">Tools in Library</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <Users className="w-12 h-12 mx-auto text-purple-400 mb-3" aria-hidden="true" />
            <p className="text-3xl font-extrabold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
              {skillCount}
            </p>
            <p className="text-slate-400 mt-1">Skills Offered</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-emerald-400 mb-3" aria-hidden="true" />
            <p className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              100
            </p>
            <p className="text-slate-400 mt-1">Starting Trust Score</p>
          </div>
        </div>
      </section>
    </div>
  );
}