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

import type { Metadata } from "next";
import { MessagesSquare, ShieldCheck } from "lucide-react";

import ChatAccess from "@/components/chat/ChatAccess";

export const metadata: Metadata = {
  title: "Matrix Chat — ToolsLibrary",
  description:
    "Join the ToolsLibrary community chat on our self-hosted Matrix server. Create a one-time access token behind a proof-of-work gate — no email, no phone, no IP logging.",
};

const accessSteps = [
  "Enter the chat directly if you already have a Matrix account and client.",
  "Otherwise, create a one-time access token: solve a small proof-of-work puzzle in your browser, verify your chat username and password, and paste the token into the Element Web client as your login credentials.",
  "The token works exactly once and expires quickly. It cannot be reused, replayed, or stolen twice.",
];

export default function MatrixChatPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <section className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
            SELF-HOSTED SYNAPSE
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            COMMUNITY // MATRIX CHAT
          </p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Matrix Chat
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base leading-relaxed">
            The ToolsLibrary runs its own Matrix homeserver for lending
            coordination, skill-sharing, and moderation questions. Choose how
            you want to get in.
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
              No email, no phone, no IP logging. Your password is sent only to
              our own Synapse server and never stored by this website.
            </p>
          </div>
        </section>

        {/* Access options + token flow */}
        <ChatAccess />
      </div>
    </div>
  );
}
