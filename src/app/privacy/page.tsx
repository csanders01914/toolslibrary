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
import { ShieldCheck, Lock, EyeOff, Server, FileX, Ban } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — ToolsLibrary",
  description: "Zero-PII privacy policy: no member email, no phone, no IP logging, no analytics.",
};

const neverCollected = [
  "Email addresses: member accounts never have an email field — the sign-up form has no place to enter one. The single exception is the operator's own admin account, which may store one notification email address (see the data inventory below).",
  "Phone numbers: never requested, never stored.",
  "Real names: your public identity is a self-chosen alias. We do not ask for your legal name.",
  "IP addresses: the application performs no IP logging.",
  "Analytics and telemetry: no analytics script, no beacons, no pixels, and no CDN.",
  "Third-party cookies or trackers: the only cookies are your session and your anonymous accessibility preferences.",
];

const whatIsStored = [
  {
    title: "Login Handle (username)",
    body: "A 3–24 character handle of letters, numbers, hyphens, and underscores, used to log in. It identifies your account and nothing else about you.",
  },
  {
    title: "Public Alias",
    body: "A display name shown to other members. It can be a first name, a nickname, or a pseudonym, and you can change it anytime from your dashboard.",
  },
  {
    title: "Password Hash",
    body: "Your password is hashed with bcrypt at cost factor 12. The plaintext password is never written to disk, logged, or transmitted anywhere except the login request itself.",
  },
  {
    title: "Recovery Key Hashes",
    body: "Eight single-use recovery codes are generated at registration. Only their SHA-256 hashes are stored; the plaintext codes are shown exactly once and exist nowhere else.",
  },
  {
    title: "Listing & Loan Data",
    body: "Tools, skills, loan requests, and messages you create. A lending library cannot run without these records.",
  },
  {
    title: "Anonymous Accessibility Preferences",
    body: "Optional JSON (contrast, font size, dyslexia font, spacing) synced to your account so your accessibility settings follow you between devices. It contains no identifying data.",
  },
  {
    title: "Operator Notification Email (admin account only)",
    body: "One email address on the administrator account, used exclusively as the destination for operational alert emails (support escalations, new registrations, and change alerts) delivered by the platform's own self-hosted local SMTP relay — never a third-party email provider. It is never requested from member accounts, never displayed publicly, and member-facing features never read it.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ZERO-PII BY ARCHITECTURE
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // PRIVACY</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Privacy Policy
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          This site holds very little about you, and this page lists all of it. There is no data
          broker relationship to disclose because there is no data to sell.
        </p>
      </section>

      {/* What we never collect */}
      <section className="border border-red-500/50 bg-[#0a0a0a] rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <Ban className="h-5 w-5 text-red-400" aria-hidden="true" />
          What we never collect
        </h2>
        <ul className="space-y-3">
          {neverCollected.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-zinc-400">
              <span className="mt-1.5 h-2 w-2 shrink-0 bg-red-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What is stored */}
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LEGAL // DATA INVENTORY</p>
        <h2 className="mb-6 mt-2 flex items-center gap-3 text-2xl font-bold text-white tracking-tight">
          <Lock className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          What is stored
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {whatIsStored.map((item) => (
            <div
              key={item.title}
              className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
            >
              <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-cyan-400">{item.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Infrastructure */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-white tracking-tight">
          <Server className="h-5 w-5 text-purple-400" aria-hidden="true" />
          Infrastructure and retention
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
          <p className="flex items-start gap-3">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" aria-hidden="true" />
            <span>
              The application runs on a self-hosted Fedora CoreOS server inside a rootless Podman
              container. There is no cloud hosting account, no managed database service, and no
              third-party log aggregation.
            </span>
          </p>
          <p className="flex items-start gap-3">
            <FileX className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" aria-hidden="true" />
            <span>
              All data lives in a single SQLite database file on the host volume. Deleting your
              account removes your user record, recovery keys, tools, skills, and messages via
              cascading deletes. Uploaded images are stored locally in the data volume and served
              directly by the application. No object-storage service is involved.
            </span>
          </p>
          <p>
            Because we collect no contact information, there is nothing to sell, share, or hand
            over in response to a data request about you. The strongest privacy guarantee that can
            exist is that the data does not exist.
          </p>
        </div>
      </section>

      <p className="text-center font-mono text-xs text-zinc-500">
        Questions about this policy? Read the{" "}
        <Link href="/transparency" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
          Transparency Report
        </Link>{" "}
        or reach the collective via{" "}
        <Link href="/matrix-chat" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
          Matrix Chat
        </Link>
        .
      </p>
    </div>
  );
}
