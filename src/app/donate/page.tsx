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
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Heart, Wrench, Code2, Landmark, Users, ExternalLink } from "lucide-react";

export const metadata = {
  title: "Donate / Support Us — ToolsLibrary",
  description: "Support the collective via Open Collective, Liberapay, or the hardware fund.",
};

const LIBERAPAY_PROFILE_URL = "https://liberapay.com/toolslibrary";
const LIBERAPAY_DONATE_URL = "https://liberapay.com/toolslibrary/donate";

type Channel = {
  icon: LucideIcon;
  accent: string;
  iconColor: string;
  title: string;
  body: string;
  note: string;
  href?: string;
  cta?: ReactNode;
};

const channels: Channel[] = [
  {
    icon: Landmark,
    accent: "hover:border-cyan-500/50",
    iconColor: "text-cyan-400",
    title: "Open Collective",
    body: "Our transparent fiscal host publishes every expense and contribution publicly. Monthly recurring contributions fund hosting hardware, replacement parts, and shared consumables like sandpaper, blades, and fasteners.",
    note: "Coming Soon",
  },
  {
    icon: Users,
    accent: "hover:border-purple-500/50",
    iconColor: "text-purple-400",
    title: "Liberapay",
    body: "Recurring donations with zero platform tracking. Liberapay is a website that processes anonymous donations, which suits how this project is funded.",
    note: "Now Live",
    href: LIBERAPAY_PROFILE_URL,
    cta: <LiberapayDonateButton />,
  },
  {
    icon: Wrench,
    accent: "hover:border-emerald-500/50",
    iconColor: "text-emerald-400",
    title: "Community hardware fund",
    body: "Prefer your money to become something you can hold? The hardware fund buys shared equipment the library lacks: a pressure washer, a tile saw, a stud finder set. Funded purchases are added to the public inventory and lent like any other tool.",
    note: "Coordinated in the Matrix room",
  },
];

const nonMonetary = [
  {
    icon: Wrench,
    title: "Donate a tool",
    body: "List a tool you own and keep it in circulation. That is the most direct way to give.",
    href: "/tools/new",
  },
  {
    icon: Code2,
    title: "Donate code",
    body: "Pull requests, bug reports, and documentation edits keep the platform free.",
    href: "/contribute",
  },
];

/**
 * Static server-rendered replica of the official Liberapay donate button
 * widget (https://liberapay.com/toolslibrary/widgets/button.js). The upstream
 * widget injects itself via document.write(), which is incompatible with
 * Next.js client-side navigation: executed after page load it implicitly
 * calls document.open() and blanks the document. Rendering the exact markup
 * the widget emits keeps the official appearance while working on both hard
 * and soft navigation, without JavaScript and without any third-party
 * script request.
 */
function LiberapayDonateButton() {
  return (
    <>
      <style>{`
html > body .liberapay-btn {
    background-color: #f6c915;
    border-radius: 4px;
    color: #1a171b;
    display: inline-block;
    font-family: Helvetica Neue,Helvetica,sans-serif;
    font-size: 14px;
    font-weight: 700;
    line-height: 22px;
    padding: 5px 7px 3px;
    position: relative;
    text-decoration: none;
}
html > body .liberapay-btn:hover {
    background-color: #fbce1a;
}
.liberapay-btn > svg {
    position: absolute;
    left: 7px;
    top: 7px;
}
.liberapay-btn > span {
    margin-left: 19px;
}
      `}</style>
      <a
        className="liberapay-btn"
        href={LIBERAPAY_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 80 80" height="16" width="16" aria-hidden="true">
          <g transform="translate(-78.37-208.06)" fill="#1a171b">
            <path d="m104.28 271.1c-3.571 0-6.373-.466-8.41-1.396-2.037-.93-3.495-2.199-4.375-3.809-.88-1.609-1.308-3.457-1.282-5.544.025-2.086.313-4.311.868-6.675l9.579-40.05 11.69-1.81-10.484 43.44c-.202.905-.314 1.735-.339 2.489-.026.754.113 1.421.415 1.999.302.579.817 1.044 1.546 1.395.729.353 1.747.579 3.055.679l-2.263 9.278" />
            <path d="m146.52 246.14c0 3.671-.604 7.03-1.811 10.07-1.207 3.043-2.879 5.669-5.01 7.881-2.138 2.213-4.702 3.935-7.693 5.167-2.992 1.231-6.248 1.848-9.767 1.848-1.71 0-3.42-.151-5.129-.453l-3.394 13.651h-11.162l12.52-52.19c2.01-.603 4.311-1.143 6.901-1.622 2.589-.477 5.393-.716 8.41-.716 2.815 0 5.242.428 7.278 1.282 2.037.855 3.708 2.024 5.02 3.507 1.307 1.484 2.274 3.219 2.904 5.205.627 1.987.942 4.11.942 6.373m-27.378 15.461c.854.202 1.91.302 3.167.302 1.961 0 3.746-.364 5.355-1.094 1.609-.728 2.979-1.747 4.111-3.055 1.131-1.307 2.01-2.877 2.64-4.714.628-1.835.943-3.858.943-6.071 0-2.161-.479-3.998-1.433-5.506-.956-1.508-2.615-2.263-4.978-2.263-1.61 0-3.118.151-4.525.453l-5.28 21.948" />
          </g>
        </svg>
        <span>Donate</span>
      </a>
    </>
  );
}

export default function DonatePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="py-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          COMMUNITY FUNDED, NO ADS OR INVESTORS
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // DONATE</p>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Donate / Support Us
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
          This platform will never charge users, show ads, or take venture capital. It runs on
          community money and community labor. Here is how to add yours.
        </p>
      </section>

      {/* Funding channels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <section
              key={channel.title}
              className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors ${channel.accent}`}
            >
              <Icon className={`mb-4 h-5 w-5 ${channel.iconColor}`} aria-hidden="true" />
              <h2 className="mb-3 font-semibold text-white">{channel.title}</h2>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">{channel.body}</p>
              <span className="inline-flex border border-zinc-800 bg-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {channel.note}
              </span>
              {channel.href && (
                <div className="mt-4 flex flex-col items-start gap-2.5">
                  {channel.cta}
                  <a
                    href={channel.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    {channel.href.replace("https://", "")}
                  </a>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Non-monetary */}
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">COMMUNITY // GIVE WITHOUT MONEY</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">Give Without Money</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {nonMonetary.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-purple-500/50"
              >
                <Icon className="mb-4 h-5 w-5 text-purple-400" aria-hidden="true" />
                <h3 className="mb-2 font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Transparency note */}
      <section className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 sm:p-8">
        <h2 className="mb-4 text-xl font-bold text-white tracking-tight">Where the money goes</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Every funded expense falls into one of three buckets: <strong className="text-white">hardware</strong>{" "}
          (the FCOS server, drives, and replacement parts), <strong className="text-white">consumables</strong>{" "}
          (shared wear items that keep borrowed tools safe), and <strong className="text-white">domain &amp; infrastructure</strong>{" "}
          (DNS for tools-library.com and the self-hosted BookStack wiki). No salaries, no
          consulting fees, no marketing spend. Financial summaries are posted to the wiki and
          discussed openly in Matrix.
        </p>
      </section>
    </div>
  );
}
