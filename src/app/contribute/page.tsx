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
    action: { href: "http://wiki.tools-library.com", label: "Visit the wiki", external: true },
  },
];

const accentMap: Record<string, { badge: string; hover: string; text: string }> = {
  cyan: {
    badge: "border-cyan-500/50 bg-cyan-500/5 text-cyan-400",
    hover: "hover:border-cyan-500/50",
    text: "text-cyan-400",
  },
  rose: {
    badge: "border-red-500/50 bg-red-500/5 text-red-400",
    hover: "hover:border-red-500/50",
    text: "text-red-400",
  },
  emerald: {
    badge: "border-emerald-500/50 bg-emerald-500/5 text-emerald-400",
    hover: "hover:border-emerald-500/50",
    text: "text-emerald-400",
  },
  purple: {
    badge: "border-purple-500/50 bg-purple-500/5 text-purple-400",
    hover: "hover:border-purple-500/50",
    text: "text-purple-400",
  },
};

export default function ContributePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
          THE COMMONS IS BUILT BY ITS USERS
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // CONTRIBUTE</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Contribute / Get Involved
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
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
              className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors ${colors.hover}`}
            >
              <div className="mb-4 flex items-center gap-3">
                <Icon className={`h-4 w-4 ${colors.text}`} aria-hidden="true" />
                <h2 className="font-semibold text-white">{path.title}</h2>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-zinc-400">{path.body}</p>
              {path.action.external ? (
                <a
                  href={path.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex cursor-pointer items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:border-cyan-500/60 hover:text-cyan-400"
                >
                  {path.action.label}
                </a>
              ) : (
                <Link
                  href={path.action.href}
                  className="inline-flex cursor-pointer items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:border-cyan-500/60 hover:text-cyan-400"
                >
                  {path.action.label}
                </Link>
              )}
            </section>
          );
        })}
      </div>

      {/* Development principles */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
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
            <li key={item} className="flex items-start gap-3 text-sm text-zinc-400">
              <span className="mt-1.5 h-2 w-2 shrink-0 bg-emerald-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
