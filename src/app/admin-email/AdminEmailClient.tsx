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

import { useActionState, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { setAdminEmail } from "@/lib/actions/admin";
import { AlertCircle, CheckCircle, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";

type AdminEmailActionState = { success?: boolean; error?: string; email?: string } | undefined;

interface AdminEmailClientProps {
  mode: "setup" | "already-set";
  alias: string;
}

export default function AdminEmailClient({ mode, alias }: AdminEmailClientProps) {
  const { update } = useSession();
  const [state, formAction, isPending] = useActionState<AdminEmailActionState, FormData>(setAdminEmail, undefined);
  const [email, setEmail] = useState("");
  const [updateFailed, setUpdateFailed] = useState(false);
  const [continuePending, setContinuePending] = useState(false);

  // PHASE_29: after the email is stored, the session JWT can still carry the
  // stale needsAdminEmail flag. update() makes the server re-derive the flag
  // from database truth (client payloads are never trusted) and re-issue the
  // session cookie; only then is it safe to navigate to /dashboard, because
  // the middleware would bounce a stale flag straight back to /admin-email.
  // If the refresh fails, fall back to an explicit retry button instead of a
  // redirect loop.
  const continueToDashboard = async () => {
    setContinuePending(true);
    try {
      await update({ needsAdminEmail: false });
      window.location.assign("/dashboard");
    } catch {
      setUpdateFailed(true);
    } finally {
      setContinuePending(false);
    }
  };

  // Setup mode only: the server action succeeded — clear the stale flag and
  // navigate. On failure the success panel below offers a manual retry.
  useEffect(() => {
    if (mode !== "setup" || !state?.success) return;
    let cancelled = false;
    const run = async () => {
      try {
        await update({ needsAdminEmail: false });
        if (!cancelled) window.location.assign("/dashboard");
      } catch {
        if (!cancelled) setUpdateFailed(true);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [state?.success, mode, update]);

  if (mode === "already-set") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-cyan-500/50 bg-cyan-500/5 text-cyan-400">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">ADMIN // NOTIFICATION EMAIL</p>
            <h1 className="mt-4 text-2xl sm:text-4xl font-bold text-white tracking-tight">Email Already Set</h1>
            <p className="mt-3 text-sm text-zinc-400">
              A notification email is already on record for this account. Manage it from your dashboard profile settings.
            </p>
            {updateFailed && (
              <p className="mt-3 font-mono text-[11px] text-red-400" role="alert">
                Session refresh failed — retry the continue step.
              </p>
            )}
            <button
              type="button"
              onClick={continueToDashboard}
              disabled={continuePending}
              className="mt-6 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {continuePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Refreshing session...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Continue to Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Setup mode — the action succeeded but the session refresh failed: render
  // a success panel with a manual retry instead of silently looping.
  if (state?.success && updateFailed) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">ADMIN // NOTIFICATION EMAIL</p>
            <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center border border-emerald-500/50 bg-emerald-500/5 text-emerald-400">
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-2xl sm:text-4xl font-bold text-white tracking-tight">Email Saved</h1>
            <p className="mt-3 text-sm text-zinc-400">
              Your notification email is on record. Operational alerts will be sent to this address.
            </p>
            <button
              type="button"
              onClick={continueToDashboard}
              disabled={continuePending}
              className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {continuePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Refreshing session...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Continue to Dashboard
                </>
              )}
            </button>
            <p className="mt-3 font-mono text-[11px] text-zinc-500">
              Session refresh failed — retry the continue step.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Setup mode — success with the session refresh still in flight: replace
  // the form view so it cannot be double-submitted while navigating.
  if (state?.success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden="true" />
        <span role="status" className="sr-only">
          Email saved — redirecting to the dashboard
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center border border-red-500/50 bg-red-500/5 text-red-400">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">ADMIN // NOTIFICATION EMAIL</p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Email Required</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Signed in as {alias}. This admin account has no notification email on record. Set one to
              continue — all other routes are locked until you do.
            </p>
          </div>

          {/* Warning Banner */}
          <div
            className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Operational alerts (support escalations, new registrations) are emailed to this address
              via the self-hosted local SMTP relay. It is the only email stored on this platform — operator account only.
              Members never have an email field.
            </p>
          </div>

          {/* Error Messages */}
          {state?.error && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          )}

          {/* Setup Form — no password field: first-time setup, the server
              skips the password check while no email is on record. */}
          <form action={formAction} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Notification Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                disabled={isPending}
                className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Save Email &amp; Continue
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
