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
  cyan: "border-cyan-500/30 text-cyan-300",
  purple: "border-purple-500/30 text-purple-300",
  emerald: "border-emerald-500/30 text-emerald-300",
};

export default function TransparencyPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold mb-6">
          <Activity className="w-4 h-4" aria-hidden="true" />
          RADICAL TRANSPARENCY, VERIFIED BY ABSENCE
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Transparency Report
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          What we can't collect can't be seized, subpoenaed, or sold. This page is our standing
          declaration of what has — and has not — happened on this server.
        </p>
      </section>

      {/* Warrant Canary */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_-10px_rgba(16,185,129,0.25)]">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-emerald-300 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            Warrant Canary
          </h2>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            STATUS: INTACT
          </span>
        </div>
        <ul className="space-y-3">
          {canaryStatements.map((statement) => (
            <li key={statement} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1 w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              <span>{statement}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-slate-500 leading-relaxed">
          If this canary is ever removed, altered, or goes stale without explanation, treat that as
          a signal to assume compromise and verify independently. Canary last affirmed:{" "}
          <span className="font-mono text-emerald-300">2026-10-25</span>.
        </p>
      </section>

      {/* Third-party sharing */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-rose-300 mb-6">Third-Party Data Sharing</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-3 pr-4 font-semibold">Category</th>
                <th className="py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {sharingRows.map((row) => (
                <tr key={row.party} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pr-4 text-slate-300">{row.party}</td>
                  <td className="py-3">
                    <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
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
        <h2 className="text-2xl font-bold text-cyan-300 mb-6">Local Server Facts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {serverMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Icon className={`w-5 h-5 ${accentMap[metric.accent] ?? accentMap.cyan}`} aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {metric.label}
                  </span>
                </div>
                <p className="font-semibold text-slate-100 mb-1">{metric.value}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{metric.detail}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
