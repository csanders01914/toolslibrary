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

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/lib/actions/auth";
import { AlertCircle, CheckCircle, Copy, Download, Shield, Loader2, Key } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(registerUser, undefined);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [keysConfirmed, setKeysConfirmed] = useState(false);

  const handleCopyAll = () => {
    const codes = state?.recoveryCodes?.join("\n") || "";
    navigator.clipboard.writeText(codes);
    setCopiedIndex(-1);
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

  const handleProceed = () => {
    router.push("/login");
    router.refresh();
  };

  if (state?.success && state.recoveryCodes) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8">
            {/* Success Header */}
            <div className="mb-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // REGISTER</p>
              <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Account Created</h1>
              <p className="mt-2 text-sm text-zinc-400">Your account is ready. Now secure your recovery keys.</p>
            </div>

            {/* Warning Banner */}
            <div className="mb-8 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Critical: Save These Keys Offline</p>
                <p className="mt-1">
                  There is <strong>no email recovery</strong>, no phone verification, and no admin reset.
                  These 8 single-use codes are the <strong>only way</strong> to recover your account if you forget your password.
                  Each code can be used <strong>once</strong>. Store them in a password manager, print them, or write them down.
                </p>
              </div>
            </div>

            {/* Recovery Codes Grid */}
            <div className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400">
                <Key className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                Your 8 Single-Use Recovery Codes
              </h2>
              <div className="grid grid-cols-2 gap-2 bg-black p-4" role="list" aria-label="Recovery codes">
                {state.recoveryCodes.map((code, index) => (
                  <div
                    key={code}
                    className="group relative border border-zinc-800 bg-black p-4 font-mono text-sm text-emerald-400"
                    role="listitem"
                  >
                    <span className="block text-center tracking-widest select-all">{code}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        setCopiedIndex(index);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                      className="absolute right-1 top-1 p-1.5 text-zinc-500 transition-colors hover:text-white"
                      aria-label={`Copy code ${index + 1}`}
                    >
                      {copiedIndex === index ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCopyAll}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy All Keys
                </button>
                <button
                  onClick={handleDownload}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download (.txt)
                </button>
              </div>

              <label className="flex cursor-pointer items-start gap-3 border border-zinc-800 bg-black p-4 transition-colors hover:border-zinc-600">
                <input
                  type="checkbox"
                  checked={keysConfirmed}
                  onChange={(e) => setKeysConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                  required
                />
                <div className="font-mono text-xs leading-relaxed text-zinc-400">
                  <span className="text-emerald-400">I have saved these recovery keys offline.</span>{" "}
                  I understand there is no email password reset and no account recovery without these keys.
                </div>
              </label>

              <button
                onClick={handleProceed}
                disabled={!keysConfirmed}
                className="flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                Proceed to Login
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 transition-colors hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Already have an account? Sign In
            </Link>
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
            <Link href="/" className="mb-6 inline-flex items-center gap-2" aria-label="Tool Library Home">
              <span
                className="flex h-8 w-8 items-center justify-center border border-cyan-500/50 text-cyan-400"
                aria-hidden="true"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">Tool Library</span>
            </Link>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // REGISTER</p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Join the Collective</h1>
            <p className="mt-2 text-sm text-zinc-400">Create your zero-PII account in seconds</p>
          </div>

          {/* Privacy Badge */}
          <div className="mb-6 inline-flex items-center gap-1.5 border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            <Shield className="h-3 w-3" aria-hidden="true" />
            Zero PII • No Email • No Tracking
          </div>

          {/* Error Message */}
          {state?.error && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          )}

          {/* Registration Form */}
          <form action={formAction} className="space-y-5" noValidate>
            <div>
              <label htmlFor="username" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  disabled={state?.success}
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                  placeholder="alphanumeric, underscore, hyphen (3-24 chars)"
                  pattern="[a-zA-Z0-9_-]{3,24}"
                  title="3-24 characters, alphanumeric, underscore, or hyphen"
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">3-24 characters. Alphanumeric, underscore, or hyphen only.</p>
            </div>

            <div>
              <label htmlFor="alias" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Display Name (Alias)
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="alias"
                  name="alias"
                  autoComplete="name"
                  required
                  disabled={state?.success}
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                  placeholder="Your public display name (2-32 chars)"
                  minLength={2}
                  maxLength={32}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">This is how others will see you. Not used for login.</p>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  disabled={state?.success}
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                  placeholder="At least 10 characters"
                  minLength={10}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">Minimum 10 characters. Use a passphrase for best security.</p>
            </div>

            <button
              type="submit"
              disabled={state?.success}
              className="flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state?.success ? (
                <>
                  <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  Account Created
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 text-center font-mono text-xs text-zinc-500">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-zinc-400 transition-colors hover:text-white">
                Sign In
              </Link>
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-zinc-400 transition-colors hover:text-white"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
