import Link from "next/link";
import { Code2, Wrench, BookOpen, Bug, GitPullRequest, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Contribute — Tool Library",
  description: "Contribute code, donate tools, or improve documentation to the collective.",
};

const paths = [
  {
    icon: Code2,
    accent: "cyan" as const,
    title: "Code Contributions",
    body: "The entire stack is AGPLv3 free software: Next.js 15 App Router, React 19, TypeScript, Prisma with SQLite, and Tailwind CSS v4. Clone the repository, pick an issue, and open a pull request. Every merged PR is reviewed for the project's privacy invariants — no analytics, no PII, no external CDNs.",
    action: { href: "https://github.com/csanders01914/tool-library", label: "Open the repository", external: true },
  },
  {
    icon: Bug,
    accent: "rose" as const,
    title: "Bug Reports & Security Disclosures",
    body: "Found a bug or a security issue? Open a GitHub issue for bugs. For security vulnerabilities, use a private GitHub security advisory rather than a public issue — we coordinate disclosure and credit reporters in the release notes.",
    action: { href: "https://github.com/csanders01914/tool-library", label: "Report an issue", external: true },
  },
  {
    icon: Wrench,
    accent: "emerald" as const,
    title: "Tool Donations",
    body: "Have a working tool you no longer use? List it on the platform and mark it as a permanent loan — that is a donation to the commons. Local drop-off points are coordinated through the Matrix room. Donated tools stay in the community inventory for everyone's benefit.",
    action: { href: "/tools/new", label: "List a tool now", external: false },
  },
  {
    icon: BookOpen,
    accent: "purple" as const,
    title: "Documentation & Wiki",
    body: "The self-hosted BookStack wiki at wiki.tools-library.com hosts guides: tool maintenance walkthroughs, safety primers, and self-hosting documentation. Good documentation is as valuable as good code — and it never requires an account to read.",
    action: { href: "https://wiki.tools-library.com", label: "Visit the wiki", external: true },
  },
];

const accentMap: Record<string, { badge: string; hover: string; text: string }> = {
  cyan: {
    badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    hover: "hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]",
    text: "text-cyan-300",
  },
  rose: {
    badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    hover: "hover:border-rose-500/40 hover:shadow-[0_0_30px_-5px_rgba(244,63,94,0.2)]",
    text: "text-rose-300",
  },
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    hover: "hover:border-emerald-500/40 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]",
    text: "text-emerald-300",
  },
  purple: {
    badge: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    hover: "hover:border-purple-500/40 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]",
    text: "text-purple-300",
  },
};

export default function ContributePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold mb-6">
          <GitPullRequest className="w-4 h-4" aria-hidden="true" />
          THE COMMONS IS BUILT BY ITS USERS
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Contribute / Get Involved
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          Four ways to strengthen the collective: write code, break things responsibly, donate
          tools, and document what you know.
        </p>
      </section>

      {/* Contribution paths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {paths.map((path) => {
          const Icon = path.icon;
          const colors = accentMap[path.accent];
          return (
            <section
              key={path.title}
              className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 ${colors.hover}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <Icon className={`w-5 h-5 ${colors.text}`} aria-hidden="true" />
                <h2 className="text-lg font-bold text-slate-100">{path.title}</h2>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">{path.body}</p>
              {path.action.external ? (
                <a
                  href={path.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-950/80 border border-white/15 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-all duration-200"
                >
                  {path.action.label}
                </a>
              ) : (
                <Link
                  href={path.action.href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-950/80 border border-white/15 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-all duration-200"
                >
                  {path.action.label}
                </Link>
              )}
            </section>
          );
        })}
      </div>

      {/* Development principles */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-emerald-300 flex items-center gap-3 mb-6">
          <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          Non-Negotiable Development Principles
        </h2>
        <ul className="space-y-3">
          {[
            "Zero PII: no email, phone, or real-name fields may ever be added to the schema.",
            "Zero external CDNs: all assets, fonts, and scripts are served from the origin.",
            "Zero analytics: no telemetry, beacons, or third-party observability.",
            "AGPLv3: every derivative of this code must remain free and source-available.",
            "Self-hostable: the project must always run on a single rootless Podman container.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1 w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
