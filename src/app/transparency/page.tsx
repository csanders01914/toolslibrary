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

import { Activity, ShieldCheck, Server, Database, EyeOff, GitCommitHorizontal } from "lucide-react";

export const metadata = {
  title: "Transparency Report — Tool Library",
  description:
    "Warrant canary, third-party data sharing status, and local server metrics.",
};

const canaryStatements = [
  "As of the date below, this service has received zero government or law-enforcement requests for user data.",
  "No gag orders, national security letters, or secret subpoenas have been served on the operators.",
  "No warrants, court orders, or informal requests have been received from any local, state, or federal agency.",
  "No backdoors, lawful-intercept hooks, or deliberate weaknesses have been introduced into this software.",
];

const sharingRows = [
  { party: "Advertising networks", status: "$0 — none exist" },
  { party: "Analytics providers", status: "$0 — none exist" },
  { party: "Cloud hosting providers", status: "$0 — self-hosted on local hardware" },
  { party: "Payment processors", status: "$0 — no payments are processed" },
  { party: "Email delivery services", status: "$0 — no emails are collected or sent" },
  { party: "CDNs & font providers", status: "$0 — all assets served locally" },
];

const serverMetrics = [
  {
    icon: Server,
    label: "Hosting",
    value: "Fedora CoreOS, self-hosted",
    detail: "Single physical machine under operator physical control.",
    accent: "cyan",
  },
  {
    icon: Database,
    label: "Data Store",
    value: "SQLite (WAL mode)",
    detail: "One database file on a local volume. No managed cloud database.",
    accent: "purple",
  },
  {
    icon: EyeOff,
    label: "Application Logs",
    value: "Zero IP logging",
    detail: "The Next.js application performs no request-IP retention.",
    accent: "emerald",
  },
  {
    icon: GitCommitHorizontal,
    label: "Source Code",
    value: "AGPLv3, fully public",
    detail: "Every line running here is auditable in the public repository.",
    accent: "cyan",
  },
];

const accentMap: Record<string, string> = {
  cyan: "text-cyan-400",
  purple: "text-purple-400",
  emerald: "text-emerald-400",
};

export default function TransparencyPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          RADICAL TRANSPARENCY, VERIFIED BY ABSENCE
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // TRANSPARENCY</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Transparency Report
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          What we can't collect can't be seized, subpoenaed, or sold. This page is our standing
          declaration of what has — and has not — happened on this server.
        </p>
      </section>

      {/* Warrant Canary */}
      <section className="border border-emerald-500/50 bg-[#0a0a0a] rounded-none p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-3 text-xl font-bold text-white tracking-tight">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            Warrant Canary
          </h2>
          <span className="inline-flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            <span className="h-2 w-2 bg-emerald-400" aria-hidden="true" />
            STATUS: INTACT
          </span>
        </div>
        <ul className="space-y-3">
          {canaryStatements.map((statement) => (
            <li key={statement} className="flex items-start gap-3 text-sm text-zinc-400">
              <span className="mt-1.5 h-2 w-2 shrink-0 bg-emerald-400" aria-hidden="true" />
              <span>{statement}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 font-mono text-[11px] leading-relaxed text-zinc-500">
          If this canary is ever removed, altered, or goes stale without explanation, treat that as
          a signal to assume compromise and verify independently. Canary last affirmed:{" "}
          <span className="font-mono text-emerald-400">2026-10-25</span>.
        </p>
      </section>

      {/* Third-party sharing */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 text-xl font-bold text-white tracking-tight">Third-Party Data Sharing</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                <th className="py-3 pr-4 font-medium">Category</th>
                <th className="py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sharingRows.map((row) => (
                <tr key={row.party} className="border-b border-zinc-900 last:border-0">
                  <td className="py-3 pr-4 text-zinc-400">{row.party}</td>
                  <td className="py-3">
                    <span className="inline-flex border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Local server metrics */}
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // SERVER FACTS</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">Local Server Facts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {serverMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
              >
                <div className="mb-3 flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${accentMap[metric.accent] ?? accentMap.cyan}`} aria-hidden="true" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                    {metric.label}
                  </span>
                </div>
                <p className="mb-1 font-semibold text-white">{metric.value}</p>
                <p className="text-sm leading-relaxed text-zinc-400">{metric.detail}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
