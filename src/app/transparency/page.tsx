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
import {
  CANARY_STATEMENTS,
  getCanaryHistory,
  getCanaryState,
} from "@/lib/canary";
import { formatDate } from "@/app/admin/AdminShared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transparency Report — ToolsLibrary",
  description:
    "Warrant canary, third-party data sharing status, and local server metrics.",
};

// PHASE_30_CANARY_SIGNING: the canary section is now database-driven. The
// statements live in src/lib/canary.ts (embedded in every signed canonical
// payload — treat that list as immutable); this page renders the derived
// status, the latest signed event, and the append-only event history. A
// stale or disclosed canary is rendered as such — the whole value of a
// warrant canary is that its absence or alteration is loud, not quiet.

const sharingRows = [
  { party: "Advertising networks", status: "None exist" },
  { party: "Analytics services", status: "None exist" },
  { party: "Cloud hosting services", status: "None, self-hosted on local hardware" },
  { party: "Payment processors", status: "None, no payments are processed" },
  {
    party: "Email delivery services",
    status:
      "Only operator alert emails, via self-hosted local SMTP relay — members never have an email field",
  },
  { party: "CDNs & font services", status: "None, all assets are served locally" },
];

const serverMetrics = [
  {
    icon: Server,
    label: "Hosting",
    value: "Fedora CoreOS, self-hosted",
    detail: "A single physical machine under the operator's physical control.",
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

export default async function TransparencyPage() {
  const [canary, history] = await Promise.all([
    getCanaryState(),
    getCanaryHistory(6),
  ]);

  const status = canary.status;
  const latest = canary.latest;
  const disclosed = status === "DISCLOSED";
  const stale = status === "STALE";
  const neverAffirmed = status === "NEVER_AFFIRMED";

  // Section chrome follows the status: emerald while intact, amber when the
  // freshness window lapses or nothing was ever affirmed, red once dropped.
  const canaryBorder = disclosed
    ? "border-red-500/50"
    : stale || neverAffirmed
      ? "border-amber-500/50"
      : "border-emerald-500/50";
  const statusChipClass = disclosed
    ? "border-red-500/50 bg-red-500/5 text-red-400"
    : stale || neverAffirmed
      ? "border-amber-500/50 bg-amber-500/5 text-amber-400"
      : "border-emerald-500/50 bg-emerald-500/5 text-emerald-400";
  const statusDotClass = disclosed ? "bg-red-400" : stale || neverAffirmed ? "bg-amber-400" : "bg-emerald-400";
  const statusLabel = disclosed
    ? "STATUS: DISCLOSED"
    : stale
      ? "STATUS: STALE — ASSUME COMPROMISE"
      : neverAffirmed
        ? "STATUS: NEVER AFFIRMED"
        : "STATUS: INTACT";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          WARRANT CANARY AND SERVER FACTS
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // TRANSPARENCY</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Transparency Report
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          We cannot be forced to hand over data we do not have. This page records what has and has
          not happened on this server.
        </p>
      </section>

      {/* Warrant Canary */}
      <section className={`border bg-[#0a0a0a] rounded-none p-6 sm:p-8 ${canaryBorder}`}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-3 text-xl font-bold text-white tracking-tight">
            <ShieldCheck className={`h-5 w-5 ${disclosed ? "text-red-400" : stale || neverAffirmed ? "text-amber-400" : "text-emerald-400"}`} aria-hidden="true" />
            Warrant canary
          </h2>
          <span className={`inline-flex items-center gap-2 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusChipClass}`}>
            <span className={`h-2 w-2 ${statusDotClass}`} aria-hidden="true" />
            {statusLabel}
          </span>
        </div>

        {disclosed ? (
          <>
            <p className="text-sm leading-relaxed text-red-300">
              {latest?.note ?? "The operator has disclosed a canary event."}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              The canary was dropped on {latest ? formatDate(latest.committedAt) : "an unknown date"} by the
              operator. The statements below no longer stand.
            </p>
          </>
        ) : neverAffirmed ? (
          <p className="text-sm leading-relaxed text-zinc-400">
            This deployment has not published a canary affirmation yet. Assume
            compromise until an affirmation appears.
          </p>
        ) : (
          <ul className="space-y-3">
            {CANARY_STATEMENTS.map((statement) => (
              <li key={statement} className="flex items-start gap-3 text-sm text-zinc-400">
                <span className={`mt-1.5 h-2 w-2 shrink-0 ${disclosed ? "bg-red-400" : "bg-emerald-400"}`} aria-hidden="true" />
                <span>{statement}</span>
              </li>
            ))}
          </ul>
        )}

        {stale && (
          <p className="mt-4 border border-amber-500/50 bg-amber-500/5 p-4 font-mono text-xs leading-relaxed text-amber-400" role="note">
            The canary has not been re-affirmed within its 30-day freshness
            window (last affirmed {latest ? formatDate(latest.committedAt) : "an unknown date"}).
            Until an affirmation or an explanation is published, assume
            compromise and verify independently.
          </p>
        )}

        <p className="mt-6 font-mono text-[11px] leading-relaxed text-zinc-500">
          If this canary is ever removed, altered, or left stale without explanation, assume
          compromise and verify independently.{" "}
          {latest?.action === "AFFIRM" && latest.expiresAt ? (
            <>
              Canary last affirmed:{" "}
              <span className="font-mono text-emerald-400">{formatDate(latest.committedAt)}</span>{" "}
              · valid through{" "}
              <span className="font-mono text-emerald-400">{formatDate(latest.expiresAt)}</span>.
            </>
          ) : latest ? (
            <>
              Canary dropped:{" "}
              <span className="font-mono text-red-400">{formatDate(latest.committedAt)}</span>.
            </>
          ) : (
            <>No affirmation on record.</>
          )}
        </p>

        {/* Latest signed event (PHASE_30): the Ed25519 signature and public
            key are published so third parties can verify the canary offline —
            a tampered database cannot forge history without a detectable key
            swap against the operator's out-of-band fingerprint record. */}
        {latest && (
          <div className="mt-6 border border-zinc-800 bg-black p-4">
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Latest signed event
            </h3>
            <p className="mb-3 font-mono text-[11px] text-zinc-400">
              SEQ #{latest.seq} · {latest.action} · {formatDate(latest.committedAt)} · signed by{" "}
              {latest.adminAlias}
            </p>
            {/* The note is part of the signed canonical payload — publishing
                it here is what makes the signature independently verifiable:
                without it, a third party could not reconstruct the payload of
                an AFFIRM event to check the signature offline. */}
            <p className="mb-3 font-mono text-[11px] text-zinc-400">
              Note: <span className="break-words text-zinc-300">{latest.note ?? "—"}</span>
            </p>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Signature (hex)</p>
            <pre className="mb-3 overflow-x-auto whitespace-pre-wrap break-all border border-zinc-800 bg-black p-3 font-mono text-[10px] leading-relaxed text-zinc-500">
              {latest.signature}
            </pre>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">Public key (base64 SPKI DER)</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all border border-zinc-800 bg-black p-3 font-mono text-[10px] leading-relaxed text-zinc-500">
              {latest.publicKey}
            </pre>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-zinc-600">
              Verify offline: decode the base64 SPKI public key to PEM (openssl pkey -pubin -inform
              DER -pubout), reconstruct the canonical payload per src/lib/canary.ts
              (buildCanonicalPayload), then openssl dgst -sha256 -verify.
            </p>
          </div>
        )}

        {/* Append-only event history */}
        {history.length > 1 && (
          <div className="mt-6">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Event history
            </p>
            <ul className="space-y-1">
              {history.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
                  <span>
                    #{event.seq}{" "}
                    <span className={event.action === "DISCLOSE" ? "text-red-400" : "text-emerald-400"}>
                      {event.action}
                    </span>{" "}
                    {formatDate(event.committedAt)} by {event.adminAlias}
                    {event.note && <span className="text-zinc-600"> · {event.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Third-party sharing */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 text-xl font-bold text-white tracking-tight">Third-party data sharing</h2>
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
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">Local server facts</h2>
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
