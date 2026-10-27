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
import { Heart, Wrench, Code2, Landmark, Users } from "lucide-react";

export const metadata = {
  title: "Donate / Support Us — Tool Library",
  description: "Support the collective via Open Collective, Liberapay, or the hardware fund.",
};

const channels = [
  {
    icon: Landmark,
    accent: "hover:border-cyan-500/50",
    iconColor: "text-cyan-400",
    title: "Open Collective",
    body: "Our transparent fiscal host publishes every expense and contribution publicly. Monthly recurring contributions fund hosting hardware, replacement parts, and shared consumables like sandpaper, blades, and fasteners.",
    note: "opencollective.com/tool-library",
  },
  {
    icon: Users,
    accent: "hover:border-purple-500/50",
    iconColor: "text-purple-400",
    title: "Liberapay",
    body: "Recurring donations with zero platform tracking. Liberapay is itself a free-software, self-hostable patronage network — aligned with our values of decentralization and no-surveillance funding.",
    note: "liberapay.com/tool-library",
  },
  {
    icon: Wrench,
    accent: "hover:border-emerald-500/50",
    iconColor: "text-emerald-400",
    title: "Community Hardware Fund",
    body: "Prefer your money to become something you can hold? The hardware fund buys shared equipment the library lacks: a pressure washer, a tile saw, a stud finder set. Funded purchases are added to the public inventory and lent like any other tool.",
    note: "Coordinated in the Matrix room",
  },
];

const nonMonetary = [
  {
    icon: Wrench,
    title: "Donate a Tool",
    body: "List a tool you own and keep it in circulation — the most direct donation there is.",
    href: "/tools/new",
  },
  {
    icon: Code2,
    title: "Donate Code",
    body: "Pull requests, bug reports, and documentation edits keep the platform free forever.",
    href: "/contribute",
  },
];

export default function DonatePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          NO ADS. NO INVESTORS. NO PAYWALLS.
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // DONATE</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Donate / Support Us
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          This platform will never charge users, show ads, or take venture capital. It runs on
          community money and community labor — here is how to add yours.
        </p>
      </section>

      {/* Funding channels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <section
              key={channel.title}
              className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors ${channel.accent}`}
            >
              <Icon className={`mb-4 h-5 w-5 ${channel.iconColor}`} aria-hidden="true" />
              <h2 className="mb-3 font-semibold text-white">{channel.title}</h2>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">{channel.body}</p>
              <span className="inline-flex border border-zinc-800 bg-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {channel.note}
              </span>
            </section>
          );
        })}
      </div>

      {/* Non-monetary */}
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // GIVE WITHOUT MONEY</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">Give Without Money</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {nonMonetary.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-purple-500/50"
              >
                <Icon className="mb-4 h-5 w-5 text-purple-400" aria-hidden="true" />
                <h3 className="mb-2 font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Transparency note */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-4 text-xl font-bold text-white tracking-tight">Where the Money Goes</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Every funded expense falls into one of three buckets: <strong className="text-white">hardware</strong>{" "}
          (the FCOS server, drives, and replacement parts), <strong className="text-white">consumables</strong>{" "}
          (shared wear items that keep borrowed tools safe), and <strong className="text-white">domain &amp; infrastructure</strong>{" "}
          (DNS for tools-library.com and the self-hosted BookStack wiki). No salaries, no
          consulting fees, no marketing spend. Financial summaries are posted to the wiki and
          discussed openly in Matrix.
        </p>
      </section>
    </div>
  );
}
