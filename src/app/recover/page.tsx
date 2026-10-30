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
import { recoverAccount } from "@/lib/actions/auth";
import { AlertCircle, Key, Shield, ArrowLeft } from "lucide-react";

export default function RecoverPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(recoverAccount, undefined);

  if (state?.success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // RECOVERY</p>
            <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center border border-emerald-500/50 bg-emerald-500/5 text-emerald-400">
              <Shield className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Password Reset Complete
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Your password has been updated. The recovery code has been consumed.</p>
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Login
              </Link>
            </div>
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
            <Link href="/" className="mb-6 inline-flex items-center gap-2" aria-label="ToolsLibrary Home">
              <span
                className="flex h-8 w-8 items-center justify-center border border-purple-500/50 text-purple-400"
                aria-hidden="true"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">ToolsLibrary</span>
            </Link>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // RECOVERY</p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Emergency Recovery</h1>
            <p className="mt-2 text-sm text-zinc-400">Use a single-use recovery code to reset your password</p>
          </div>

          {/* Warning Banner */}
          <div className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Zero-PII Recovery System</p>
              <p className="mt-1">
                No email, no phone, no admin override. Enter one of your 8 single-use <code className="border border-zinc-800 bg-black px-1.5 py-0.5 font-mono text-cyan-400">XXXX-XXXX</code> codes.
                Each code works <strong>once</strong>. Used codes are permanently invalidated.
              </p>
            </div>
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

          {/* Recovery Form */}
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
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="recoveryCode" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Recovery Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="recoveryCode"
                  name="recoveryCode"
                  autoComplete="one-time-code"
                  required
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 text-center font-mono text-sm tracking-widest text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
                  title="Format: XXXX-XXXX (8 alphanumeric characters)"
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">Enter one of your 8 single-use recovery codes (format: XXXX-XXXX)</p>
            </div>

            <div>
              <label htmlFor="newPassword" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                New Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                  placeholder="At least 10 characters"
                  minLength={10}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">Minimum 10 characters. Use a strong passphrase.</p>
            </div>

            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2 border border-purple-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-purple-400 transition-colors hover:bg-purple-500/10"
            >
              <Key className="h-4 w-4" aria-hidden="true" />
              Reset Password
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 space-y-3 text-center font-mono text-xs text-zinc-500">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Login
            </Link>
            <Link
              href="/"
              className="block text-zinc-400 transition-colors hover:text-white"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
