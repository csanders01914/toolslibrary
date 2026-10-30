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

import { useActionState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle,
  Feather,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import {
  confirmCanaryCommitAction,
  type CanaryActionState,
} from "@/lib/actions/canary";
// Client-safe contract module (see src/lib/canaryShared.ts header): the
// server module "@/lib/canary" must never enter the client bundle.
import type { CanaryPendingPublic } from "@/lib/canaryShared";
// Server-safe utility module (see src/lib/format.ts header).
import { formatTime } from "@/lib/format";

// ================================================================
// Canary approval confirmation (PHASE_30_CANARY_SIGNING). The final
// gate of the out-of-band factor: the operator followed the emailed
// single-use link while signed in as an administrator and now sees
// exactly what is about to be signed and published before pressing
// Approve. The token is untrusted input — the server action
// re-validates session, role, hash, TTL, and the terminal-disclosure
// guard; this page only renders what the server already verified.
// ================================================================

interface ConfirmClientProps {
  token: string;
  ok: boolean;
  pending: CanaryPendingPublic | null;
}

const labelClass = "font-mono text-[11px] uppercase tracking-widest text-zinc-500";
const valueClass = "font-mono text-sm text-zinc-200";

export default function ConfirmClient({ token, ok, pending }: ConfirmClientProps) {
  const [state, formAction, isPending] = useActionState<CanaryActionState, FormData>(
    confirmCanaryCommitAction,
    undefined
  );

  // Invalid, expired, or already-consumed link: neutral terminal state with
  // a path back to the console. No detail about WHICH check failed — an
  // attacker probing tokens learns nothing.
  if (!ok || !pending) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-zinc-700 bg-zinc-500/5 text-zinc-400">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              ADMIN // CANARY APPROVAL
            </p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Link not valid
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              This confirmation link is invalid, expired, or already used.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Confirmation links are single-use and expire after 15 minutes.
              Stage the update again from the canary console.
            </p>
            <Link
              href="/admin/canary"
              className="mt-6 flex min-h-[44px] w-full cursor-pointer items-center justify-center border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10"
            >
              Back to canary console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Committed: the event is signed, durable, and public. Terminal success
  // state with links to the public page and the console.
  if (state?.success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-none border border-emerald-500/50 bg-[#0a0a0a] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-emerald-500/50 bg-emerald-500/5 text-emerald-400">
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              ADMIN // CANARY APPROVAL
            </p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Canary update committed
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-emerald-400" role="status">
              {state.detail}
            </p>
            <div className="mt-6 space-y-3">
              <Link
                href="/transparency"
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-center border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10"
              >
                View the public canary →
              </Link>
              <Link
                href="/admin/canary"
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-center border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-cyan-500/60 hover:text-cyan-400"
              >
                Back to canary console →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Valid link: show exactly what is about to be signed and published.
  const isDisclose = pending.action === "DISCLOSE";
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-8">
          <div className="mb-6">
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center border ${isDisclose ? "border-red-500/50 bg-red-500/5 text-red-400" : "border-emerald-500/50 bg-emerald-500/5 text-emerald-400"}`}
            >
              {isDisclose ? (
                <ShieldAlert className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Feather className="h-6 w-6" aria-hidden="true" />
              )}
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              ADMIN // CANARY APPROVAL
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Approve canary update
            </h1>
          </div>

          <dl className="mb-6 space-y-3">
            <div>
              <dt className={labelClass}>Action</dt>
              <dd className={valueClass}>
                {isDisclose ? "Disclose a canary event" : "Affirm canary for another month"}
              </dd>
            </div>
            <div>
              <dt className={labelClass}>Note</dt>
              <dd className={`${valueClass} break-words`}>{pending.note ?? "—"}</dd>
            </div>
            <div>
              <dt className={labelClass}>Link expires</dt>
              <dd className={valueClass}>{formatTime(pending.expiresAt)}</dd>
            </div>
          </dl>

          <div
            className="mb-6 flex items-start gap-3 rounded-none border border-amber-500/50 bg-amber-500/5 p-4 font-mono text-xs leading-relaxed text-amber-400"
            role="note"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Approving signs this event with the server&apos;s Ed25519 key and
              publishes it immediately on the public transparency page. This
              cannot be undone.
            </p>
          </div>

          {state?.error && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          )}

          <form action={formAction} noValidate>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              disabled={isPending}
              className={`flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isDisclose
                  ? "border-red-500/60 text-red-400 hover:bg-red-500/10"
                  : "border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing...
                </>
              ) : (
                <>
                  <Feather className="h-4 w-4" aria-hidden="true" />
                  Approve &amp; sign
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
