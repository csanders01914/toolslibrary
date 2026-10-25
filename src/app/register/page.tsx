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
        <div className="w-full max-w-2xl">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" aria-hidden="true" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-400 bg-clip-text text-transparent">
                Account Created
              </h1>
              <p className="mt-2 text-slate-400">Your account is ready. Now secure your recovery keys.</p>
            </div>

            {/* Warning Banner */}
            <div className="mb-8 p-4 rounded-xl bg-rose-950/30 border border-rose-500/40">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-rose-300 font-semibold text-sm">Critical: Save These Keys Offline</p>
                  <p className="mt-1 text-rose-200/80 text-sm">
                    There is <strong>no email recovery</strong>, no phone verification, and no admin reset.
                    These 8 single-use codes are the <strong>only way</strong> to recover your account if you forget your password.
                    Each code can be used <strong>once</strong>. Store them in a password manager, print them, or write them down.
                  </p>
                </div>
              </div>
            </div>

            {/* Recovery Codes Grid */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                Your 8 Single-Use Recovery Codes
              </h2>
              <div className="grid grid-cols-2 gap-3" role="list" aria-label="Recovery codes">
                {state.recoveryCodes.map((code, index) => (
                  <div
                    key={code}
                    className="relative group bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 text-cyan-300 font-mono text-base shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)] transition-all duration-200 hover:border-cyan-400/50 hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)]"
                    role="listitem"
                  >
                    <span className="block text-center tracking-widest select-all">{code}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(code);
                        setCopiedIndex(index);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-slate-900/50 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300"
                      aria-label={`Copy code ${index + 1}`}
                    >
                      {copiedIndex === index ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Copy className="w-4 h-4" aria-hidden="true" />
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
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-900/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all duration-200"
                >
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  Copy All Keys
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-900/50 border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300 transition-all duration-200"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Download (.txt)
                </button>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-slate-900/50 border border-white/10 hover:border-emerald-500/30 transition-all duration-200">
                <input
                  type="checkbox"
                  checked={keysConfirmed}
                  onChange={(e) => setKeysConfirmed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-white/20 bg-slate-900 border-white/15 text-emerald-500 focus:ring-emerald-500 focus:ring-2"
                  required
                />
                <div className="text-sm text-slate-300 leading-relaxed">
                  <span className="font-medium text-emerald-300">I have saved these recovery keys offline.</span>{" "}
                  I understand there is no email password reset and no account recovery without these keys.
                </div>
              </label>

              <button
                onClick={handleProceed}
                disabled={!keysConfirmed}
                className="w-full px-5 py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" aria-hidden="true" />
                Proceed to Login
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      <div className="w-full max-w-md">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3 mb-6" aria-label="Tool Library Home">
              <div className="relative p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full opacity-70 blur-sm" />
              </div>
              <span className="font-extrabold text-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                Tool Library
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
              Join the Collective
            </h1>
            <p className="mt-2 text-slate-400">Create your zero-PII account in seconds</p>
          </div>

          {/* Privacy Badge */}
          <div className="mb-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium mx-auto">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            Zero PII • No Email • No Tracking
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

          {/* Registration Form */}
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
                  disabled={state?.success}
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all disabled:opacity-50"
                  placeholder="alphanumeric, underscore, hyphen (3-24 chars)"
                  pattern="[a-zA-Z0-9_-]{3,24}"
                  title="3-24 characters, alphanumeric, underscore, or hyphen"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">3-24 characters. Alphanumeric, underscore, or hyphen only.</p>
            </div>

            <div>
              <label htmlFor="alias" className="block text-sm font-medium text-slate-300 mb-2">
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
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all disabled:opacity-50"
                  placeholder="Your public display name (2-32 chars)"
                  minLength={2}
                  maxLength={32}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">This is how others will see you. Not used for login.</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
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
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all disabled:opacity-50 pr-12"
                  placeholder="At least 10 characters"
                  minLength={10}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Minimum 10 characters. Use a passphrase for best security.</p>
            </div>

            <button
              type="submit"
              disabled={state?.success}
              className="w-full px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state?.success ? (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  Account Created
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Create Account
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 text-center text-sm text-slate-500">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign In
              </Link>
            </p>
            <Link
              href="/"
              className="mt-3 block text-slate-500 hover:text-slate-400 transition-colors inline-block"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}