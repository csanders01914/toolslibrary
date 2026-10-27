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

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const formatVouch = (trustScore: number) => {
  const vouch = trustScore - 100;
  return vouch >= 0 ? `+${vouch}` : `${vouch}`;
};

const statusValueClass = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'text-emerald-400';
    case 'BORROWED':
      return 'text-red-400';
    case 'MAINTENANCE':
      return 'text-amber-400';
    default:
      return 'text-zinc-300';
  }
};

const STEPS = [
  {
    step: '1 · BROWSE',
    accent: 'text-cyan-400',
    body: 'Search the catalog for anything from power drills to pressure washers — free to browse, no account needed.',
  },
  {
    step: '2 · REQUEST',
    accent: 'text-cyan-400',
    body: 'Pick your dates and send a borrow request. The owner gets a message and approves it.',
  },
  {
    step: '3 · MEET',
    accent: 'text-emerald-400',
    body: 'Meet the owner and verify the handoff with a one-time code, so both of you know the exchange happened.',
  },
  {
    step: '4 · RETURN',
    accent: 'text-emerald-400',
    body: 'Return the tool on time and leave a vouch for the owner. Good karma keeps the library healthy.',
  },
];

export default async function HomePage() {
  const [session, toolCount, skillCount, recentTools] = await Promise.all([
    auth(),
    prisma.tool.count(),
    prisma.skill.count(),
    prisma.tool.findMany({
      where: { status: 'AVAILABLE' },
      include: {
        owner: {
          select: { id: true, alias: true, trustScore: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="py-8 sm:py-12">
        <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight max-w-3xl">
          Borrow the tools you need. Share the ones you don&apos;t.
        </h1>
        <p className="mt-6 text-zinc-400 max-w-2xl">
          Zero-PII peer-to-peer tool lending and skills exchange. Share, borrow, and connect with
          your neighbors — no email, no phone, no tracking.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/tools"
            className="font-mono text-xs uppercase tracking-widest px-5 py-3 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
          >
            BROWSE TOOLS
          </Link>
          <Link
            href="/skills"
            className="font-mono text-xs uppercase tracking-widest px-5 py-3 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
          >
            BROWSE SKILLS
          </Link>
          {session?.user ? (
            <Link
              href="/dashboard"
              className="font-mono text-xs uppercase tracking-widest px-5 py-3 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              DASHBOARD
            </Link>
          ) : (
            <Link
              href="/login"
              className="font-mono text-xs uppercase tracking-widest px-5 py-3 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
            >
              SIGN IN
            </Link>
          )}
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">HOW IT WORKS</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step) => (
            <div key={step.step} className="bg-[#0a0a0a] border border-zinc-800 p-5">
              <h3 className={`font-mono text-xs tracking-widest ${step.accent}`}>{step.step}</h3>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live inventory */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LIVE INVENTORY</h2>
          <Link
            href="/tools"
            className="font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
          >
            VIEW ALL →
          </Link>
        </div>

        {recentTools.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-zinc-800 p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">NO TOOLS LISTED YET</p>
            <p className="text-sm text-zinc-400 mt-2">Be the first to share a tool with your community.</p>
            <Link
              href="/tools/new"
              className="inline-block mt-4 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
            >
              LEND A TOOL
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                className="block bg-[#0a0a0a] border border-zinc-800 rounded-none p-5 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-white">{tool.name}</h3>
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
      </section>

      {/* Stats strip */}
      <section className="bg-[#0a0a0a] border border-zinc-800 px-5 py-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs">
          <p>
            <span className="text-zinc-500">TOOLS IN LIBRARY: </span>
            <span className="text-cyan-400">{toolCount}</span>
          </p>
          <p>
            <span className="text-zinc-500">SKILLS OFFERED: </span>
            <span className="text-purple-400">{skillCount}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
