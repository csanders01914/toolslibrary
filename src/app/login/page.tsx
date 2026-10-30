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

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, AlertCircle, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Post-auth open-redirect guard: only same-origin relative paths are
  // honored. A callbackUrl like "https://evil.example" or "//evil.example"
  // would otherwise bounce a freshly authenticated session to an attacker-
  // controlled host (the canary approval flow constructs safe relative
  // callbacks, but this receiver must not trust arbitrary query input).
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const callbackUrl =
    rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";
  const error = searchParams.get("error");
  const passwordChanged = searchParams.get("changed") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setFormError("Invalid username or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/" className="mb-6 inline-flex items-center gap-2" aria-label="ToolsLibrary Home">
              <span
                className="flex h-8 w-8 items-center justify-center border border-cyan-500/50 text-cyan-400"
                aria-hidden="true"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">ToolsLibrary</span>
            </Link>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">AUTH // LOGIN</p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Welcome Back</h1>
            <p className="mt-2 text-sm text-zinc-400">Sign in to access your dashboard</p>
          </div>

          {/* Password Changed Confirmation */}
          {passwordChanged && !error && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-emerald-500/50 bg-emerald-500/5 p-4 font-mono text-xs text-emerald-400"
              role="status"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Password updated successfully. Sign in with your new password.</p>
            </div>
          )}

          {/* Error Messages */}
          {(error || formError) && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{formError || (error === "CredentialsSignin" ? "Invalid username or password" : "Authentication failed. Please try again.")}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 pr-10 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition-colors hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                href="/recover"
                className="font-mono text-xs text-zinc-400 transition-colors hover:text-white"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 space-y-3 text-center font-mono text-xs text-zinc-500">
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-zinc-400 transition-colors hover:text-white">
                Join the Collective
              </Link>
            </p>
            <Link
              href="/"
              className="inline-block text-zinc-400 transition-colors hover:text-white"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Privacy Badge */}
        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-1.5 border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Zero PII • No Email • No Tracking
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
