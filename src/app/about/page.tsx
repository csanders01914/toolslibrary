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

import Link from "next/link";
import { Wrench, ShieldOff, Recycle, Network, Hammer, BookOpen } from "lucide-react";

export const metadata = {
  title: "About / Manifesto — ToolsLibrary",
  description:
    "Right-to-repair, anti-surveillance capitalism, local resilience, and decentralization.",
};

const pillars = [
  {
    icon: Wrench,
    accent: "hover:border-cyan-500/50",
    title: "Right to repair",
    body: "Every drill, saw, or sander thrown away over a $4 part is a waste of money and materials. We share tools so people can fix things themselves, and we share the skills needed to repair the tools too. Repair is a political act: it refuses the upgrade treadmill.",
  },
  {
    icon: ShieldOff,
    accent: "hover:border-red-500/50",
    title: "Anti-surveillance capitalism",
    body: "Most platforms harvest your identity and sell your attention. This one is built so it cannot. There is no email field, no phone number, no IP logging, no analytics, and no third-party CDN. You can borrow a circular saw from your neighbor without a corporation building a profile of your life. Privacy is part of the architecture here.",
  },
  {
    icon: Recycle,
    accent: "hover:border-emerald-500/50",
    title: "Local resilience",
    body: "When supply chains stutter, a neighborhood that can fix its own fence and rewire its own lamp gets by. A tool library turns the equipment sitting idle in garages into shared infrastructure.",
  },
  {
    icon: Network,
    accent: "hover:border-purple-500/50",
    title: "Decentralization",
    body: "The code is AGPLv3 and self-hostable in a single rootless Podman container on a single machine. No cloud account is required and there is no platform lock-in. If this instance ever disappears, any community can fork the source and run its own node.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-purple-500/50 bg-purple-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-purple-400">
          <Hammer className="h-3.5 w-3.5" aria-hidden="true" />
          THE MANIFESTO
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // ABOUT</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          About / Manifesto
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          ToolsLibrary is a cypherpunk mutual-aid project: a tool-lending and skill-exchange
          platform for local communities, built to collect no personal data and run on self-hosted
          hardware.
        </p>
      </section>

      {/* Origin */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-4 text-xl font-bold text-white tracking-tight">Why this exists</h2>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            The average power drill gets used for about thirteen minutes in its life, yet every
            household is expected to buy one, store it, and eventually throw it away. Multiply that
            by every tool in every garage and you get a lot of duplicated, idle equipment, while
            neighbors two doors apart drive to a big-box store to hang a shelf.
          </p>
          <p>
            The obvious fix is sharing. The hard part is trust: who lends a $400 impact driver to a
            stranger? Our answer is cryptographic. Members are known by a self-chosen handle and a
            public alias, passwords are bcrypt-hashed, recovery keys are single-use, and a Trust
            Score rises with every on-time return and drops with every damaged one. The score is
            computed from lending behavior and visible to everyone.
          </p>
          <p>
            The platform itself is part of the argument. It runs on a self-hosted Fedora CoreOS
            server, in a rootless container, on a SQLite file, with zero telemetry. Community
            software can be pleasant to use and surveillance-free at the same time.
          </p>
        </div>
      </section>

      {/* Four pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <section
              key={pillar.title}
              className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors ${pillar.accent}`}
            >
              <Icon className="mb-4 h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h2 className="mb-3 font-semibold text-white">{pillar.title}</h2>
              <p className="text-sm leading-relaxed text-zinc-400">{pillar.body}</p>
            </section>
          );
        })}
      </div>

      {/* How to plug in */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 text-xl font-bold text-white tracking-tight">Get involved</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/register"
            className="group border border-zinc-800 bg-black p-5 transition-colors hover:border-cyan-500/50"
          >
            <p className="font-semibold text-white transition-colors group-hover:text-cyan-400">
              Join the collective
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Register with just a handle, alias, and password.
            </p>
          </Link>
          <Link
            href="/tools"
            className="group border border-zinc-800 bg-black p-5 transition-colors hover:border-cyan-500/50"
          >
            <p className="font-semibold text-white transition-colors group-hover:text-cyan-400">
              Browse the inventory
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              See what neighbors are lending right now.
            </p>
          </Link>
          <a
            href="http://wiki.tools-library.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group border border-zinc-800 bg-black p-5 transition-colors hover:border-purple-500/50"
          >
            <p className="flex items-center gap-2 font-semibold text-white transition-colors group-hover:text-purple-400">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Read the wiki
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Guides, safety primers, and self-hosting docs.
            </p>
          </a>
        </div>
      </section>
    </div>
  );
}
