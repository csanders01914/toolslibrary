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

"use client";

/**
 * Recovery-code regeneration client (Stage 2 of the KILO auth/security
 * plan). Two-phase flow:
 *
 * 1. CONFIRM — the member re-enters their current password (a live session
 *    alone cannot rotate recovery codes; the server re-verifies the
 *    credential fresh on every attempt).
 * 2. VAULT — the 8 fresh codes are shown exactly once, in the same
 *    copy/download/confirm-gate vault UX as registration and the login-time
 *    legacy rotation. Leaving this page without saving cannot be undone:
 *    the old codes are already dead.
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import { regenerateRecoveryCodes } from "@/lib/actions/auth";
import { AlertCircle, CheckCircle, Copy, Download, KeyRound, Loader2 } from "lucide-react";

export default function RecoveryCodesClient() {
  const [state, formAction, isPending] = useActionState(regenerateRecoveryCodes, undefined);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [keysConfirmed, setKeysConfirmed] = useState(false);

  const handleCopyAll = () => {
    const codes = state?.recoveryCodes?.join("\n") || "";
    navigator.clipboard.writeText(codes);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyOne = (index: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = () => {
    const codes = state?.recoveryCodes?.join("\n") || "";
    const blob = new Blob([codes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state?.success && state.recoveryCodes) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="border border-rose-500/40 bg-rose-500/5 p-6 rounded-none">
          <h1 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-rose-400">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            RECOVERY CODES REGENERATED
          </h1>
          <p className="mt-3 font-mono text-xs text-zinc-400">
            Your old recovery codes are dead. These 8 new single-use codes are shown{" "}
            <span className="text-rose-300">only this once</span> — store them somewhere safe
            before leaving this page. There is no email recovery; this is the only way back in.
          </p>

          {/* Recovery Codes Grid */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {state.recoveryCodes.map((code, index) => (
              <div
                key={index}
                className="flex items-center justify-between border border-zinc-800 bg-black px-3 py-2"
              >
                <span className="font-mono text-sm text-zinc-100 select-all">{code}</span>
                <button
                  type="button"
                  onClick={() => handleCopyOne(index, code)}
                  className="text-zinc-500 transition-colors hover:text-white"
                  aria-label={`Copy recovery code ${index + 1}`}
                >
                  {copiedIndex === index ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              {copiedIndex === -1 ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedIndex === -1 ? "Copied" : "Copy All"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </button>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={keysConfirmed}
              onChange={(e) => setKeysConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-500"
            />
            <span className="font-mono text-xs text-zinc-400">
              I have stored my recovery codes somewhere safe. I understand they will never be
              shown again.
            </span>
          </label>

          <Link
            href="/dashboard"
            aria-disabled={!keysConfirmed}
            onClick={(e) => {
              if (!keysConfirmed) e.preventDefault();
            }}
            className={`mt-5 inline-flex items-center gap-2 px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors ${
              keysConfirmed
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:from-cyan-400 hover:to-blue-500"
                : "pointer-events-none border border-zinc-800 text-zinc-600"
            }`}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="border border-zinc-800 bg-[#0a0a0a] p-6 rounded-none">
        <h1 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          REGENERATE RECOVERY CODES
        </h1>
        <p className="mt-3 font-mono text-xs text-zinc-400">
          This issues 8 brand-new single-use recovery codes and permanently deletes the current
          ones. You must confirm your current password. The new codes are shown{" "}
          <span className="text-rose-300">only once</span> right after regeneration.
        </p>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          No email recovery exists on this platform — if you lose both your password and your
          recovery codes, the account cannot be recovered.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="block font-mono text-xs uppercase tracking-widest text-zinc-400"
            >
              Current Password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
              placeholder="Your current password"
              disabled={isPending}
            />
          </div>

          {state?.error && (
            <p
              role="alert"
              className="flex items-center gap-2 border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 border border-rose-500/60 px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            )}
            {isPending ? "Regenerating…" : "Regenerate Codes"}
          </button>
        </form>
      </div>
    </div>
  );
}
