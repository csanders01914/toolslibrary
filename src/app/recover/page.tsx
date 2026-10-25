"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { recoverAccount } from "@/lib/actions/auth";
import { AlertCircle, Loader2, Key, Shield, ArrowLeft } from "lucide-react";

export default function RecoverPage() {
  const router = useRouter();
  const [state, formAction] = useActionState(recoverAccount, undefined);

  if (state?.success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-4">
              <Shield className="w-8 h-8 text-emerald-400" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-400 bg-clip-text text-transparent">
              Password Reset Complete
            </h1>
            <p className="mt-2 text-slate-400">Your password has been updated. The recovery code has been consumed.</p>
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
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
      <div className="w-full max-w-md">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 mb-6" aria-label="Tool Library Home">
              <div className="relative p-2 bg-gradient-to-br from-purple-500/20 to-rose-500/20 rounded-xl border border-purple-500/30">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full opacity-70 blur-sm" />
              </div>
              <span className="font-extrabold text-xl bg-gradient-to-r from-purple-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                Tool Library
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-200 to-rose-400 bg-clip-text text-transparent">
              Emergency Recovery
            </h1>
            <p className="mt-2 text-slate-400">Use a single-use recovery code to reset your password</p>
          </div>

          {/* Warning Banner */}
          <div className="mb-6 p-4 rounded-xl bg-rose-950/30 border border-rose-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-rose-300 font-semibold text-sm">Zero-PII Recovery System</p>
                <p className="mt-1 text-rose-200/80 text-sm">
                  No email, no phone, no admin override. Enter one of your 8 single-use <code className="font-mono bg-slate-900/50 px-1.5 py-0.5 rounded text-cyan-300">XXXX-XXXX</code> codes.
                  Each code works <strong>once</strong>. Used codes are permanently invalidated.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {state?.error && (
            <div
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          )}

          {/* Recovery Form */}
          <form action={formAction} className="space-y-5" noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="recoveryCode" className="block text-sm font-medium text-slate-300 mb-2">
                Recovery Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="recoveryCode"
                  name="recoveryCode"
                  autoComplete="one-time-code"
                  required
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-mono text-center tracking-widest"
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
                  title="Format: XXXX-XXXX (8 alphanumeric characters)"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Enter one of your 8 single-use recovery codes (format: XXXX-XXXX)</p>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  placeholder="At least 10 characters"
                  minLength={10}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Minimum 10 characters. Use a strong passphrase.</p>
            </div>

            <button
              type="submit"
              className="w-full px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-rose-600 hover:from-purple-400 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" aria-hidden="true" />
              Reset Password
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 space-y-3 text-center text-sm text-slate-500">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Login
            </Link>
            <Link
              href="/"
              className="block text-slate-500 hover:text-slate-400 transition-colors inline-block"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}