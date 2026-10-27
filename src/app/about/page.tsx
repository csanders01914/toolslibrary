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
  title: "About / Manifesto — Tool Library",
  description:
    "Right-to-repair, anti-surveillance capitalism, local resilience, and decentralization.",
};

const pillars = [
  {
    icon: Wrench,
    accent: "hover:border-cyan-500/50",
    title: "Right to Repair",
    body: "Every drill, saw, and sander that gets thrown away because a $4 part failed is a small act of violence against the planet and the neighborhood budget. We share tools so people can fix things themselves — and we share the skills to fix the tools too. Repair is a political act: it refuses the upgrade treadmill.",
  },
  {
    icon: ShieldOff,
    accent: "hover:border-red-500/50",
    title: "Anti-Surveillance Capitalism",
    body: "Most platforms harvest your identity and sell your attention. This one is built so it cannot. There is no email field, no phone number, no IP logging, no analytics, and no third-party CDN. You can borrow a circular saw from your neighbor without a corporation building a profile of your life. Privacy here is not a setting — it is the architecture.",
  },
  {
    icon: Recycle,
    accent: "hover:border-emerald-500/50",
    title: "Local Resilience",
    body: "When supply chains stutter, the neighborhood that can fix its own fence, rewire its own lamp, and rebuild its own garden beds is the neighborhood that stays standing. A tool library converts every household's rarely-used equipment into shared infrastructure — resilience measured in neighbors, not warehouses.",
  },
  {
    icon: Network,
    accent: "hover:border-purple-500/50",
    title: "Decentralization",
    body: "The code is AGPLv3 and self-hostable in a single rootless Podman container on a single machine. No cloud account required, no platform lock-in possible. If this instance ever disappears, any community can fork the source, run its own node, and keep the commons alive. Software that cannot be owned cannot be used against you.",
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
          Tool Library is a cypherpunk mutual-aid project: a community tool-lending and
          skill-exchange platform that answers surveillance capitalism with shared hammers and
          strong cryptography.
        </p>
      </section>

      {/* Origin */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-4 text-xl font-bold text-white tracking-tight">Why This Exists</h2>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            The average power drill is used for roughly thirteen minutes in its entire life. Yet
            every household is expected to buy one, store one, and eventually landfill one. Multiply
            that by every tool in every garage and you get an economy of duplicated, idle, decaying
            capacity — while neighbors two doors apart cannot hang a shelf without a trip to the
            big-box store.
          </p>
          <p>
            The obvious fix is sharing. The hard part is trust: who lends a $400 impact driver to a
            stranger? Our answer is cryptographic rather than corporate. Members are known by a
            self-chosen handle and a public alias, protected by bcrypt-hashed passwords and
            single-use recovery keys, and ranked by a transparent Trust Score that rises with every
            on-time return and falls with every damaged one. Trust is earned in the open, computed
            from behavior, and visible to everyone — not extracted from your social graph.
          </p>
          <p>
            The platform itself is part of the argument. It runs on a self-hosted Fedora CoreOS
            server, in a rootless container, on a SQLite file, with zero telemetry. It is a
            demonstration that community software can be sleek, modern, and completely
            surveillance-free at the same time.
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
        <h2 className="mb-6 text-xl font-bold text-white tracking-tight">Plug Into the Collective</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/register"
            className="group border border-zinc-800 bg-black p-5 transition-colors hover:border-cyan-500/50"
          >
            <p className="font-semibold text-white transition-colors group-hover:text-cyan-400">
              Join the Collective
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
              Browse the Inventory
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
              Read the Wiki
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
