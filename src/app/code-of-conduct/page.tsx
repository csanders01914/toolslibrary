import Link from "next/link";
import { HeartHandshake, Shield, Hammer, Megaphone, Scale, Ban } from "lucide-react";

export const metadata = {
  title: "Code of Conduct — Tool Library",
  description: "Mutual aid respect, harassment-free workshops, and moderation accountability.",
};

const pillars = [
  {
    icon: HeartHandshake,
    accent: "border-cyan-500/40",
    title: "Mutual Aid Respect",
    body: "Every member here is a neighbor lending a hand, not a customer or a service worker. Say thank you, return tools clean, communicate when plans change, and remember that the person on the other side of a listing is taking a real risk by trusting the community with their property.",
  },
  {
    icon: Ban,
    accent: "border-rose-500/40",
    title: "Zero Tolerance Harassment Policy",
    body: "Harassment, slurs, threats, sexual advances, doxxing, and intimidation are prohibited in all messages, listings, and profiles. One warning may be issued for a minor first offense at moderator discretion; severe violations result in immediate account suspension. We are building a workshop culture where everyone feels safe picking up a wrench.",
  },
  {
    icon: Hammer,
    accent: "border-emerald-500/40",
    title: "Workshop Culture",
    body: "Teach, don't gatekeep. If a borrower is unfamiliar with a tool, share knowledge patiently. If you see unsafe practice, speak up kindly. Skill-sharing is half of this platform's purpose — condescension and gatekeeping starve the commons that all of us depend on.",
  },
  {
    icon: Scale,
    accent: "border-purple-500/40",
    title: "Moderation Accountability",
    body: "Administrators act only against accounts and listings, never against the community's right to know. Every moderation action (listing removal, account suspension) is expected to be explainable to the affected member. If you believe a moderation decision was wrong, raise it in the Matrix chat — decisions are reviewable and reversible.",
  },
];

const expectations = [
  "Describe tools and skills honestly, including known defects.",
  "Honor loan dates you accept, or renegotiate before the deadline.",
  "Keep messages on-platform and on-topic; no spam or solicitation.",
  "Respect that aliases may be pseudonymous — do not press for real identities.",
  "Report safety issues with tools immediately to the owner and moderators.",
];

export default function CodeOfConductPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-semibold mb-6">
          <HeartHandshake className="w-4 h-4" aria-hidden="true" />
          COMMUNITY GOVERNANCE
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Code of Conduct
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          A lending collective only works when trust is the default. These four pillars define how
          we treat each other and how power is held accountable.
        </p>
      </section>

      {/* Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <section
              key={pillar.title}
              className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 ${pillar.accent} hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]`}
            >
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-cyan-300" aria-hidden="true" />
                {pillar.title}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">{pillar.body}</p>
            </section>
          );
        })}
      </div>

      {/* Expectations */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-3 mb-6">
          <Megaphone className="w-6 h-6" aria-hidden="true" />
          Everyday Expectations
        </h2>
        <ul className="space-y-3">
          {expectations.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1 w-2 h-2 rounded-full bg-cyan-400 shrink-0" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Enforcement */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-rose-300 flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6" aria-hidden="true" />
          Reporting & Enforcement
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          To report a violation, message any administrator through the platform's built-in
          messenger, or post in the public{" "}
          <a
            href="https://matrix.to/#/#tools-library:matrix.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
          >
            Matrix room
          </a>
          . Include what happened and, if relevant, the involved alias. Reports are reviewed by at
          least one administrator; because the platform stores no contact information, all
          follow-up happens on-platform or in Matrix.
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          This code is enforced alongside the{" "}
          <Link href="/terms" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4">
            Terms of Service
          </Link>
          . Moderation exists to protect the commons, not to police thought — and it is always
          subject to community review.
        </p>
      </section>
    </div>
  );
}
