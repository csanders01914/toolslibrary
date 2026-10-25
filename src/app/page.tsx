import { prisma } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const toolCount = await prisma.tool.count();
  const skillCount = await prisma.skill.count();

  return (
    <div className="space-y-12">
      <section className="text-center py-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Community Tool Library
        </h1>
        <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
          Zero-PII peer-to-peer tool lending and skills exchange. Share, borrow, and connect
          with your neighbors — no email, no phone, no tracking.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/tools"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer"
          >
            Browse Tools
          </Link>
          <Link
            href="/skills"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer"
          >
            Skills Exchange
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]">
          <h3 className="text-lg font-semibold text-cyan-300 mb-2">Tools Available</h3>
          <p className="text-3xl font-bold text-white">{toolCount}</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]">
          <h3 className="text-lg font-semibold text-purple-300 mb-2">Skills Offered</h3>
          <p className="text-3xl font-bold text-white">{skillCount}</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_0_30px_-5px_rgba(16,185,137,0.2)]">
          <h3 className="text-lg font-semibold text-emerald-300 mb-2">Trust Score</h3>
          <p className="text-3xl font-bold text-white">100</p>
        </div>
      </section>
    </div>
  );
}
