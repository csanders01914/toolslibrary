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
import type { Metadata } from "next";
import { LogIn, MessagesSquare, ShieldCheck, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Discord Chat — ToolsLibrary",
  description:
    "Join the ToolsLibrary community on Discord. The invite link takes you straight to the server — this platform never sees your Discord credentials.",
};

// The current community invite link — the single place it is configured.
// Update it here and every Discord entry point on the page follows.
const DISCORD_INVITE_URL = "https://discord.gg/mw37N9DNum";

const accessSteps = [
  "The community also gathers on Discord for lending coordination, skill-sharing, and moderation questions.",
  "Open the invite link below — it takes you straight to the server. Sign in with an existing Discord account, or create one on Discord itself.",
  "Your Discord account is managed by Discord, not by this platform. This website never sees your Discord credentials.",
];

export default function DiscordChatPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <section className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
            COMMUNITY SERVER
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            COMMUNITY // DISCORD CHAT
          </p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Discord Chat
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
            The ToolsLibrary community also gathers on Discord for lending
            coordination, skill-sharing, and moderation questions. The invite
            link below takes you straight to the server.
          </p>
        </section>

        {/* Explainer */}
        <section className="mt-10 border border-zinc-800 bg-[#0a0a0a] rounded-none p-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
            How access works
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 font-mono text-xs leading-relaxed text-zinc-500">
            {accessSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div
            className="mt-6 flex items-start gap-3 rounded-none border border-emerald-500/50 bg-emerald-500/5 p-4 font-mono text-xs text-emerald-400"
            role="note"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              No email, no phone, no IP logging. This website only links to
              Discord — it never receives your Discord credentials or anything
              else from Discord.
            </p>
          </div>
        </section>

        {/* Access options */}
        <section className="mt-10">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-400">
            Choose your way in
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col border border-zinc-800 bg-[#0a0a0a] rounded-none p-6 transition-colors hover:border-cyan-500/50 focus-visible:border-cyan-500 focus-visible:outline-none"
            >
              <LogIn className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h3 className="mt-3 font-mono text-sm uppercase tracking-widest text-white">
                Enter Chat
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Open the community Discord server with the current invite
                link.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-400">
                Open chat
                <ExternalLink
                  className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                />
              </span>
            </a>

            <Link
              href="/matrix-chat"
              className="group flex flex-col border border-zinc-800 bg-[#0a0a0a] rounded-none p-6 transition-colors hover:border-cyan-500/50 focus-visible:border-cyan-500 focus-visible:outline-none"
            >
              <MessagesSquare className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              <h3 className="mt-3 font-mono text-sm uppercase tracking-widest text-white">
                Prefer Matrix?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                The community also runs its own self-hosted Matrix homeserver
                with a web client and one-time access tokens.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-400">
                Go to Matrix Chat
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
