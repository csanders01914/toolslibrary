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
import { HeartHandshake, Shield, Hammer, Megaphone, Scale, Ban } from "lucide-react";

export const metadata = {
  title: "Code of Conduct — Tool Library",
  description: "Mutual aid respect, harassment-free workshops, and moderation accountability.",
};

const pillars = [
  {
    icon: HeartHandshake,
    accent: "hover:border-cyan-500/50",
    title: "Mutual Aid Respect",
    body: "Every member here is a neighbor lending a hand, not a customer or a service worker. Say thank you, return tools clean, communicate when plans change, and remember that the person on the other side of a listing is taking a real risk by trusting the community with their property.",
  },
  {
    icon: Ban,
    accent: "hover:border-red-500/50",
    title: "Zero Tolerance Harassment Policy",
    body: "Harassment, slurs, threats, sexual advances, doxxing, and intimidation are prohibited in all messages, listings, and profiles. One warning may be issued for a minor first offense at moderator discretion; severe violations result in immediate account suspension. We are building a workshop culture where everyone feels safe picking up a wrench.",
  },
  {
    icon: Hammer,
    accent: "hover:border-emerald-500/50",
    title: "Workshop Culture",
    body: "Teach, don't gatekeep. If a borrower is unfamiliar with a tool, share knowledge patiently. If you see unsafe practice, speak up kindly. Skill-sharing is half of this platform's purpose — condescension and gatekeeping starve the commons that all of us depend on.",
  },
  {
    icon: Scale,
    accent: "hover:border-purple-500/50",
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
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-purple-500/50 bg-purple-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-purple-400">
          <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
          COMMUNITY GOVERNANCE
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // CODE OF CONDUCT</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Code of Conduct
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
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
              className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors ${pillar.accent}`}
            >
              <h2 className="mb-3 flex items-center gap-3 font-semibold text-white">
                <Icon className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                {pillar.title}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400">{pillar.body}</p>
            </section>
          );
        })}
      </div>

      {/* Expectations */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <Megaphone className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          Everyday Expectations
        </h2>
        <ul className="space-y-3">
          {expectations.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-zinc-400">
              <span className="mt-1.5 h-2 w-2 shrink-0 bg-cyan-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Enforcement */}
      <section className="border border-red-500/50 bg-[#0a0a0a] rounded-none p-6 sm:p-8">
        <h2 className="mb-4 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <Shield className="h-5 w-5 text-red-400" aria-hidden="true" />
          Reporting & Enforcement
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-zinc-400">
          To report a violation, message any administrator through the platform's built-in
          messenger, or post in the public{" "}
          <a
            href="http://matrix.tools-library.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
          >
            Matrix room
          </a>
          . Include what happened and, if relevant, the involved alias. Reports are reviewed by at
          least one administrator; because the platform stores no contact information, all
          follow-up happens on-platform or in Matrix.
        </p>
        <p className="text-sm leading-relaxed text-zinc-400">
          This code is enforced alongside the{" "}
          <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
            Terms of Service
          </Link>
          . Moderation exists to protect the commons, not to police thought — and it is always
          subject to community review.
        </p>
      </section>
    </div>
  );
}
