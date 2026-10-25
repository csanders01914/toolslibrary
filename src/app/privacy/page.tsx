import Link from "next/link";
import { ShieldCheck, Lock, EyeOff, Server, FileX, Ban } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Tool Library",
  description: "Zero-PII privacy policy: no email, no phone, no IP logging, no analytics.",
};

const neverCollected = [
  "Email addresses — we do not ask for them and there is no field to enter one.",
  "Phone numbers — never requested, never stored.",
  "Real names — your public identity is a self-chosen alias, nothing more.",
  "IP addresses — the server performs zero IP logging at the application layer.",
  "Analytics & telemetry — there is no analytics script, no beacon, no pixel, no CDN.",
  "Third-party cookies or trackers — the only cookie is your session and your anonymous accessibility preferences.",
];

const whatIsStored = [
  {
    title: "Login Handle (username)",
    body: "A 3–24 character handle of letters, numbers, hyphens, and underscores used to log in. It is your account key, not your identity.",
  },
  {
    title: "Public Alias",
    body: "A display name shown to neighbors. Choose anything — a first name, a nickname, or a pseudonym. Change it anytime from your dashboard.",
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
    body: "Tools, skills, loan requests, and messages you create. These are the operational minimum for a functioning lending collective.",
  },
  {
    title: "Anonymous Accessibility Preferences",
    body: "Optional JSON (contrast, font size, dyslexia font, spacing) synced to your account so your accessibility settings follow you between devices. It contains no identifying data.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold mb-6">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          ZERO-PII BY ARCHITECTURE, NOT BY PROMISE
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          This service is engineered so that it is structurally incapable of surveilling you. There
          is no data broker relationship to disclose, because there is no data to broker.
        </p>
      </section>

      {/* What we never collect */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-rose-300 flex items-center gap-3 mb-6">
          <Ban className="w-6 h-6" aria-hidden="true" />
          What We Never Collect
        </h2>
        <ul className="space-y-3">
          {neverCollected.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1 w-2 h-2 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What is stored */}
      <section>
        <h2 className="text-2xl font-bold text-cyan-300 flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6" aria-hidden="true" />
          The Complete Inventory of Stored Data
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {whatIsStored.map((item) => (
            <div
              key={item.title}
              className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]"
            >
              <h3 className="font-semibold text-cyan-200 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Infrastructure */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-purple-300 flex items-center gap-3 mb-6">
          <Server className="w-6 h-6" aria-hidden="true" />
          Infrastructure & Retention
        </h2>
        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p className="flex items-start gap-3">
            <EyeOff className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              The application runs on a self-hosted Fedora CoreOS server inside a rootless Podman
              container. There is no cloud provider account, no managed database service, and no
              third-party log aggregation.
            </span>
          </p>
          <p className="flex items-start gap-3">
            <FileX className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              All data lives in a single SQLite database file on the host volume. Deleting your
              account removes your user record, recovery keys, tools, skills, and messages via
              cascading deletes. Uploaded images are stored locally in the data volume and served
              directly by the application — never by an object-storage provider.
            </span>
          </p>
          <p>
            Because we collect no contact information, we cannot and will not sell, share, or
            respond to data requests about you: there is nothing to hand over. This is the
            strongest privacy guarantee that can exist — absence.
          </p>
        </div>
      </section>

      <p className="text-center text-sm text-slate-500">
        Questions about this policy? Read the{" "}
        <Link href="/transparency" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4">
          Transparency Report
        </Link>{" "}
        or reach the collective via{" "}
        <a
          href="https://matrix.to/#/#tools-library:matrix.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
        >
          Matrix Chat
        </a>
        .
      </p>
    </div>
  );
}
