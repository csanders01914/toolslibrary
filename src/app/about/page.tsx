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
    accent: "border-cyan-500/40",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]",
    title: "Right to Repair",
    body: "Every drill, saw, and sander that gets thrown away because a $4 part failed is a small act of violence against the planet and the neighborhood budget. We share tools so people can fix things themselves — and we share the skills to fix the tools too. Repair is a political act: it refuses the upgrade treadmill.",
  },
  {
    icon: ShieldOff,
    accent: "border-rose-500/40",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.2)]",
    title: "Anti-Surveillance Capitalism",
    body: "Most platforms harvest your identity and sell your attention. This one is built so it cannot. There is no email field, no phone number, no IP logging, no analytics, and no third-party CDN. You can borrow a circular saw from your neighbor without a corporation building a profile of your life. Privacy here is not a setting — it is the architecture.",
  },
  {
    icon: Recycle,
    accent: "border-emerald-500/40",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]",
    title: "Local Resilience",
    body: "When supply chains stutter, the neighborhood that can fix its own fence, rewire its own lamp, and rebuild its own garden beds is the neighborhood that stays standing. A tool library converts every household's rarely-used equipment into shared infrastructure — resilience measured in neighbors, not warehouses.",
  },
  {
    icon: Network,
    accent: "border-purple-500/40",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]",
    title: "Decentralization",
    body: "The code is AGPLv3 and self-hostable in a single rootless Podman container on a single machine. No cloud account required, no platform lock-in possible. If this instance ever disappears, any community can fork the source, run its own node, and keep the commons alive. Software that cannot be owned cannot be used against you.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold mb-6">
          <Hammer className="w-4 h-4" aria-hidden="true" />
          THE MANIFESTO
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          About / Manifesto
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          Tool Library is a cypherpunk mutual-aid project: a community tool-lending and
          skill-exchange platform that answers surveillance capitalism with shared hammers and
          strong cryptography.
        </p>
      </section>

      {/* Origin */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-cyan-300 mb-4">Why This Exists</h2>
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
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
              className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 ${pillar.accent} ${pillar.glow}`}
            >
              <Icon className="w-6 h-6 text-cyan-300 mb-4" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-100 mb-3">{pillar.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{pillar.body}</p>
            </section>
          );
        })}
      </div>

      {/* How to plug in */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-purple-300 mb-6">Plug Into the Collective</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/register"
            className="group bg-slate-950/80 border border-white/10 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-200"
          >
            <p className="font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
              Join the Collective
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Register with just a handle, alias, and password.
            </p>
          </Link>
          <Link
            href="/tools"
            className="group bg-slate-950/80 border border-white/10 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-200"
          >
            <p className="font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
              Browse the Inventory
            </p>
            <p className="text-sm text-slate-400 mt-1">
              See what neighbors are lending right now.
            </p>
          </Link>
          <a
            href="https://wiki.tools-library.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-slate-950/80 border border-white/10 rounded-xl p-5 hover:border-purple-500/40 transition-all duration-200"
          >
            <p className="font-semibold text-slate-100 group-hover:text-purple-300 transition-colors flex items-center gap-2">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              Read the Wiki
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Guides, safety primers, and self-hosting docs.
            </p>
          </a>
        </div>
      </section>
    </div>
  );
}
