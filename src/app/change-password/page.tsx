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

import { useState, useActionState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { changePassword } from "@/lib/actions/auth";
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock, ShieldAlert } from "lucide-react";

type ActionState = { success?: boolean; error?: string } | undefined;

function ChangePasswordForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(changePassword, undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [clientError, setClientError] = useState("");

  // Forced mode: the session is flagged with stock seeded credentials and the
  // middleware locks every other route until the password is replaced.
  // Voluntary mode: a signed-in member changing their password by choice.
  const forced = session?.user?.mustChangePassword === true;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // NOTE: no auto-signout timer. Navigating away immediately after the change
  // races the browser password manager's save prompt, which can leave the user
  // without the new password saved (and autofill then offers the old one).
  // Sign-out is explicit, via the button on the success panel.

  const handleSubmit = (e: React.FormEvent) => {
    // Only block submission on client-side validation failure; otherwise let
    // the server action run.
    if (newPassword !== confirmPassword) {
      e.preventDefault();
      setClientError("New password and confirmation do not match");
      return;
    }
    setClientError("");
  };

  if (status === "loading") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" aria-hidden="true" />
      </div>
    );
  }

  if (state?.success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // PASSWORD CHANGE</p>
            <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center border border-emerald-500/50 bg-emerald-500/5 text-emerald-400">
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Password Updated
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Your new password is active. If your browser offers to save it, accept the prompt — there is no email recovery.
            </p>
            {/* PHASE_29: the forced-email flag is computed at sign-in, so this
                heads-up is precise for the stock-credential first-login flow. */}
            {session?.user?.needsAdminEmail === true && (
              <p className="mt-3 font-mono text-[11px] text-cyan-400" role="status">
                Admin setup: after signing back in you will be asked to add a notification email address.
              </p>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login?changed=1" })}
              className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Sign Out &amp; Continue to Login
            </button>
            <p className="mt-3 font-mono text-[11px] text-zinc-500">
              You will sign in with the new password you just set.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8">
          {/* Header */}
          <div className="mb-8">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center border ${forced ? "border-red-500/50 bg-red-500/5 text-red-400" : "border-cyan-500/50 bg-cyan-500/5 text-cyan-400"}`}>
              {forced ? <ShieldAlert className="h-6 w-6" aria-hidden="true" /> : <Lock className="h-6 w-6" aria-hidden="true" />}
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // PASSWORD CHANGE</p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
              {forced ? "Change Required" : "Change Password"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {session?.user?.alias ? `Signed in as ${session.user.alias}. ` : ""}
              {forced
                ? "This account is using stock seeded credentials and must set a new password before continuing."
                : "Set a new password for this account. You will stay signed in until you sign out."}
            </p>
          </div>

          {/* Warning Banner — forced stock-credential rotation only */}
          {forced && (
            <div className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                The stock password is publicly documented. All other actions are locked until you replace it.
              </p>
            </div>
          )}

          {/* Error Messages */}
          {(clientError || state?.error) && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{clientError || state?.error}</p>
            </div>
          )}

          {/* Change Password Form */}
          <form action={formAction} onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="currentPassword" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                {forced ? "Current (Stock) Password" : "Current Password"}
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  id="currentPassword"
                  name="currentPassword"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={isPending}
                   className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 pr-10 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                   placeholder={forced ? "Enter the stock password" : "Enter your current password"}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
                  aria-label={showCurrent ? "Hide current password" : "Show current password"}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isPending}
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 pr-10 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                  placeholder="At least 10 characters"
                  minLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
                  aria-label={showNew ? "Hide new password" : "Show new password"}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">Minimum 10 characters. Use a passphrase for best security.</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isPending}
                className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                placeholder="Repeat the new password"
                minLength={10}
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
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Set New Password
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-block font-mono text-xs text-zinc-400 transition-colors hover:text-white"
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
