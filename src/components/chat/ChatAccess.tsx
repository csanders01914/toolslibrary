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

import { useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
} from "lucide-react";

import PowExplainerLink from "@/components/pow/PowExplainer";
import {
  extractNonce,
  fetchChallenge,
  PowChallengeError,
  solveProofOfWork,
} from "@/lib/powClient";

/**
 * Chat access gateway client flow: choose between entering the chat directly
 * or minting a one-time access token behind a variable-difficulty
 * proof-of-work puzzle solved locally with WebCrypto.
 *
 * Zero-PII invariants: the password lives in React state only for the
 * duration of the request and is cleared as soon as the request completes;
 * the one-time token is held in memory only and wiped on reset; nothing is
 * persisted to storage or logged.
 */

const CHAT_URL = "https://chat.tools-library.com";

type View = "options" | "form" | "token";

interface TokenResponse {
  ok?: unknown;
  token?: unknown;
  expiresInMs?: unknown;
  error?: unknown;
}

export default function ChatAccess() {
  const [view, setView] = useState<View>("options");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phase, setPhase] = useState("");
  const [hashes, setHashes] = useState(0);
  const [formError, setFormError] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  // Incremented on every reset so an in-flight proof-of-work loop can detect
  // that it has been superseded and stop without touching new state.
  const runIdRef = useRef(0);

  const resetAll = () => {
    runIdRef.current += 1;
    setView("options");
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setIsSubmitting(false);
    setPhase("");
    setHashes(0);
    setFormError("");
    setLoginToken("");
    setCopied(false);
    setCopyFailed(false);
    setAcknowledged(false);
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(loginToken);
      } else {
        // Fallback for non-secure contexts without the async clipboard API.
        const textarea = document.createElement("textarea");
        textarea.value = loginToken;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError("");
    setHashes(0);
    setIsSubmitting(true);
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const isCurrentRun = () => runIdRef.current === runId;

    try {
      // 1. Request a signed challenge; its difficulty reflects how suspicious
      // recent traffic from this client looks on the chat surface.
      setPhase("Requesting challenge…");
      const challengeData = await fetchChallenge("chat");
      const nonce = extractNonce(challengeData.challenge);
      if (!nonce) {
        setFormError("Received an invalid challenge. Try again.");
        return;
      }

      // 2. Solve the proof of work locally — the server never sees the search.
      // Wall-clock cap: stop just before the challenge would expire
      // server-side instead of burning CPU on an already-doomed solve.
      setPhase("Computing proof of work…");
      const deadline = Date.now() + challengeData.expiresInSeconds * 1000 - 5_000;
      const solve = await solveProofOfWork(
        nonce,
        challengeData.difficulty,
        isCurrentRun,
        deadline,
        setHashes
      );
      if (!solve.ok) {
        if (solve.reason === "timeout") {
          setFormError("The proof-of-work challenge expired before it could be solved. Please try again.");
        }
        return;
      }

      // 3. Verify server-side and mint the one-time login token.
      setPhase("Verifying and minting token…");
      const tokenResponse = await fetch("/api/chat/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: username,
          password,
          challenge: challengeData.challenge,
          counter: solve.counter,
        }),
      });
      const data = (await tokenResponse.json().catch(() => null)) as TokenResponse | null;
      if (!tokenResponse.ok || !data || typeof data.token !== "string" || !data.token) {
        const message =
          typeof data?.error === "string" && data.error
            ? data.error
            : "Could not create an access token. Try again.";
        setFormError(message);
        return;
      }

      setUsername("");
      setLoginToken(data.token);
      setCopied(false);
      setCopyFailed(false);
      setAcknowledged(false);
      setView("token");
    } catch (error) {
      // Challenge-fetch failures carry a user-safe message from the server;
      // everything else (network, unexpected) gets the generic message.
      setFormError(
        error instanceof PowChallengeError
          ? error.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      if (isCurrentRun()) {
        // The password is never retained after the request completes.
        setPassword("");
        setShowPassword(false);
        setPhase("");
        setHashes(0);
        setIsSubmitting(false);
      }
    }
  };

  const inputClasses =
    "w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed";
  const labelClasses =
    "mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500";

  return (
    <section className="mt-10">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-400">
        Choose your way in
      </h2>

      {view === "options" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col border border-zinc-800 bg-[#0a0a0a] rounded-none p-6 transition-colors hover:border-cyan-500/50 focus-visible:border-cyan-500 focus-visible:outline-none"
          >
            <LogIn className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <h3 className="mt-3 font-mono text-sm uppercase tracking-widest text-white">
              Enter Chat
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Already have a Matrix account and client? Open
              chat.tools-library.com directly.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-400">
              Open chat
              <ExternalLink
                className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-hidden="true"
              />
            </span>
          </a>

          <button
            type="button"
            onClick={() => {
              setFormError("");
              setView("form");
            }}
            className="group flex flex-col border border-zinc-800 bg-[#0a0a0a] rounded-none p-6 text-left transition-colors hover:border-cyan-500/50 focus-visible:border-cyan-500 focus-visible:outline-none cursor-pointer"
          >
            <KeyRound className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <h3 className="mt-3 font-mono text-sm uppercase tracking-widest text-white">
              Create an Access Token
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Prove you are a human with a small puzzle, then mint a one-time
              login token for the Element Web client.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-400">
              Start token flow
            </span>
          </button>
        </div>
      )}

      {view === "form" && (
        <div className="border border-zinc-800 bg-[#0a0a0a] rounded-none p-8">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              ACCESS // TOKEN REQUEST
            </p>
            <h3 className="mt-2 text-xl font-bold text-white tracking-tight">
              Create an Access Token
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Enter your chat username and password. A short proof-of-work
              puzzle runs in your browser before the token is minted.{" "}
              <PowExplainerLink />
            </p>
          </div>

          {formError && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{formError}</p>
            </div>
          )}

          {isSubmitting && (
            <div
              className="mb-6 flex items-start gap-3 rounded-none border border-cyan-500/50 bg-cyan-500/5 p-4 font-mono text-xs text-cyan-400"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              <p>
                {phase}
                {hashes > 0 ? ` ${hashes.toLocaleString()} hashes` : ""}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="chat-username" className={labelClasses}>
                Username
              </label>
              <input
                type="text"
                id="chat-username"
                name="username"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isSubmitting}
                className={inputClasses}
                placeholder="Your chat username"
              />
            </div>

            <div>
              <label htmlFor="chat-password" className={labelClasses}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="chat-password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className={`${inputClasses} pr-10`}
                  placeholder="Your chat password"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Working…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Mint Access Token
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <button
              type="button"
              onClick={resetAll}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back
            </button>
          </div>
        </div>
      )}

      {view === "token" && (
        <div
          className="border border-amber-500/60 bg-amber-500/5 rounded-none p-8"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <p className="font-mono text-xs leading-relaxed text-amber-400">
              This token will not be shown again. It is one-time use only and
              expires quickly. Copy it now.
            </p>
          </div>

          <code
            className="mt-6 block select-all break-all border border-zinc-800 bg-black p-3 font-mono text-xs leading-relaxed text-cyan-300"
            aria-label="Your one-time access token"
          >
            {loginToken}
          </code>

          <div className="mt-4 flex flex-wrap items-center gap-3" aria-live="polite">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 focus-visible:border-cyan-500 focus-visible:outline-none"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy Token
            </button>
            {copied && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <Check className="h-4 w-4" aria-hidden="true" />
                Copied
              </span>
            )}
            {copyFailed && (
              <span className="font-mono text-xs text-red-400">
                Copy failed — select the token text manually.
              </span>
            )}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <input
              type="checkbox"
              id="chat-token-ack"
              name="chat-token-ack"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            />
            <label htmlFor="chat-token-ack" className="font-mono text-xs text-zinc-300">
              I have copied my access token
            </label>
          </div>

          <button
            type="button"
            disabled={!acknowledged}
            onClick={() => {
              window.location.href = CHAT_URL;
            }}
            className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Verify &amp; Continue
          </button>

          <div className="mt-6">
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Start over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
