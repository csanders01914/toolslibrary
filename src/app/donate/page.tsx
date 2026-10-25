import Link from "next/link";
import { Heart, Wrench, Code2, Landmark, Users } from "lucide-react";

export const metadata = {
  title: "Donate / Support Us — Tool Library",
  description: "Support the collective via Open Collective, Liberapay, or the hardware fund.",
};

const channels = [
  {
    icon: Landmark,
    accent: "border-cyan-500/40",
    title: "Open Collective",
    body: "Our transparent fiscal host publishes every expense and contribution publicly. Monthly recurring contributions fund hosting hardware, replacement parts, and shared consumables like sandpaper, blades, and fasteners.",
    note: "opencollective.com/tool-library",
  },
  {
    icon: Users,
    accent: "border-purple-500/40",
    title: "Liberapay",
    body: "Recurring donations with zero platform tracking. Liberapay is itself a free-software, self-hostable patronage network — aligned with our values of decentralization and no-surveillance funding.",
    note: "liberapay.com/tool-library",
  },
  {
    icon: Wrench,
    accent: "border-emerald-500/40",
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
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold mb-6">
          <Heart className="w-4 h-4" aria-hidden="true" />
          NO ADS. NO INVESTORS. NO PAYWALLS.
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Donate / Support Us
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
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
              className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 ${channel.accent} hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]`}
            >
              <Icon className="w-6 h-6 text-cyan-300 mb-4" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-100 mb-3">{channel.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{channel.body}</p>
              <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-400">
                {channel.note}
              </span>
            </section>
          );
        })}
      </div>

      {/* Non-monetary */}
      <section>
        <h2 className="text-2xl font-bold text-purple-300 mb-6">Give Without Money</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {nonMonetary.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.25)]"
              >
                <Icon className="w-6 h-6 text-purple-300 mb-4" aria-hidden="true" />
                <h3 className="font-semibold text-slate-100 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Transparency note */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-xl font-bold text-cyan-300 mb-4">Where the Money Goes</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Every funded expense falls into one of three buckets: <strong className="text-slate-100">hardware</strong>{" "}
          (the FCOS server, drives, and replacement parts), <strong className="text-slate-100">consumables</strong>{" "}
          (shared wear items that keep borrowed tools safe), and <strong className="text-slate-100">domain &amp; infrastructure</strong>{" "}
          (DNS for tools-library.com and the self-hosted BookStack wiki). No salaries, no
          consulting fees, no marketing spend. Financial summaries are posted to the wiki and
          discussed openly in Matrix.
        </p>
      </section>
    </div>
  );
}
