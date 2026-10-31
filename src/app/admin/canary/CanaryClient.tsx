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
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Feather,
  KeyRound,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  cancelCanaryStagingAction,
  setCanaryPassphraseAction,
  stageCanaryUpdateAction,
  type CanaryActionState,
} from "@/lib/actions/canary";
// Client-safe contract module: importing "@/lib/canary" here would drag
// node:crypto and the Prisma client into the browser bundle (webpack fails
// the build on `node:` scheme imports in client graphs).
import {
  CANARY_CONFIRM_TTL_MINUTES,
  CANARY_MIN_PASSPHRASE_LENGTH,
  type CanaryState,
  type CanaryStatus,
} from "@/lib/canaryShared";
// Date utilities live in the server-safe "@/lib/format" module (see its
// header) — AdminShared is a "use client" module and must not export plain
// functions that server components also need.
import { formatDate, formatTime } from "@/lib/format";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";

// ================================================================
// Warrant Canary Console (PHASE_30_CANARY_SIGNING) — terminal
// aesthetic, matching the admin command console. Three gates stand
// between a stolen session and a signed canary event: the dedicated
// canary passphrase, the out-of-band email approval link, and the
// Ed25519 signature that makes every committed event publicly
// verifiable on /transparency.
// ================================================================

interface CanaryClientProps {
  alias: string;
  hasPassphrase: boolean;
  notificationEmail: string | null;
  state: CanaryState;
  // SHA-256 fingerprint of the signing key's SPKI DER — the short value the
  // operator transcribes out-of-band (the full base64 key is displayed below
  // it for completeness).
  keyFingerprint: string | null;
}

const STATUS_META: Record<
  CanaryStatus,
  { chip: string; border: string; label: string }
> = {
  INTACT: {
    chip: "border-emerald-500/50 text-emerald-400",
    border: "border-emerald-500/50",
    label: "STATUS: INTACT",
  },
  STALE: {
    chip: "border-amber-500/50 text-amber-400",
    border: "border-amber-500/50",
    label: "STATUS: STALE — ASSUME COMPROMISE",
  },
  DISCLOSED: {
    chip: "border-red-500/50 text-red-400",
    border: "border-red-500/50",
    label: "STATUS: DISCLOSED",
  },
  NEVER_AFFIRMED: {
    chip: "border-amber-500/50 text-amber-400",
    border: "border-amber-500/50",
    label: "STATUS: NEVER AFFIRMED",
  },
};

function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function DetailPanel({ message }: { message: string }) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-none border border-emerald-500/50 bg-emerald-500/5 p-4 font-mono text-xs text-emerald-400"
      role="status"
    >
      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-40";
const labelClass =
  "mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500";

export default function CanaryClient({
  alias,
  hasPassphrase,
  notificationEmail,
  state,
  keyFingerprint,
}: CanaryClientProps) {
  const router = useRouter();

  const [passphraseState, passphraseAction, passphrasePending] = useActionState<
    CanaryActionState,
    FormData
  >(setCanaryPassphraseAction, undefined);
  const [affirmState, affirmAction, affirmPending] = useActionState<
    CanaryActionState,
    FormData
  >(stageCanaryUpdateAction, undefined);
  const [discloseState, discloseAction, disclosePending] = useActionState<
    CanaryActionState,
    FormData
  >(stageCanaryUpdateAction, undefined);
  const [cancelState, cancelAction, cancelPending] = useActionState<
    CanaryActionState,
    FormData
  >(cancelCanaryStagingAction, undefined);

  // Controlled new-passphrase fields so the strength meter re-grades on
  // every keystroke. Setup (first enrollment) and change keep separate
  // state — they are independent forms that never render simultaneously.
  const [setupPassphrase, setSetupPassphrase] = useState("");
  const [changePassphrase, setChangePassphrase] = useState("");

  // Refresh server data after any successful action so the status panel,
  // pending banner, and setup/operate mode switch reflect database truth.
  useEffect(() => {
    if (
      passphraseState?.success ||
      affirmState?.success ||
      discloseState?.success ||
      cancelState?.success
    ) {
      router.refresh();
    }
  }, [passphraseState, affirmState, discloseState, cancelState, router]);

  const meta = STATUS_META[state.status];
  const disclosed = state.status === "DISCLOSED";
  const stagedDetail = affirmState?.staged
    ? affirmState.detail
    : discloseState?.staged
      ? discloseState.detail
      : null;

  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <section>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
          ADMIN // WARRANT CANARY
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
          Warrant canary control
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Signed in as {alias}. The canary is the public promise that no lawful
          request for member data has been received. Updating it requires your
          canary passphrase <span className="text-zinc-300">and</span> an
          out-of-band approval from your notification email — a stolen session
          alone can sign nothing.
        </p>
      </section>

      {/* Status panel */}
      <section
        aria-label="Current canary status"
        className={`rounded-none border bg-[#0a0a0a] p-6 ${meta.border}`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
            {disclosed ? (
              <ShieldAlert className="h-5 w-5 text-red-400" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            )}
            Current status
          </h2>
          <span
            className={`inline-flex items-center gap-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${meta.chip}`}
          >
            <span
              className={`h-2 w-2 ${disclosed ? "bg-red-400" : state.status === "INTACT" ? "bg-emerald-400" : "bg-amber-400"}`}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        </div>
        {state.latest ? (
          <p className="font-mono text-[11px] leading-relaxed text-zinc-500">
            {state.latest.action === "AFFIRM" ? (
              <>
                Last affirmed {formatDate(state.latest.committedAt)} by{" "}
                {state.latest.adminAlias}
                {state.latest.expiresAt && (
                  <> · valid through {formatDate(state.latest.expiresAt)}</>
                )}
                {state.status === "STALE" &&
                  " — the 30-day freshness window has lapsed"}
              </>
            ) : (
              <>
                The canary was dropped {formatDate(state.latest.committedAt)} by{" "}
                {state.latest.adminAlias} and cannot be re-affirmed.
              </>
            )}
          </p>
        ) : (
          <p className="font-mono text-[11px] leading-relaxed text-zinc-500">
            No canary event has ever been committed on this deployment.
          </p>
        )}
        {disclosed && state.latest?.note && (
          <p className="mt-3 border-l-2 border-red-500/50 pl-3 text-sm leading-relaxed text-red-300">
            {state.latest.note}
          </p>
        )}
        <Link
          href="/transparency"
          className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-cyan-400 hover:text-cyan-300"
        >
          View public canary →
        </Link>
      </section>

      {/* Pending approval banner */}
      {state.pending && (
        <section
          aria-label="Staged update awaiting email approval"
          className="rounded-none border border-amber-500/50 bg-[#0a0a0a] p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
                <Mail className="h-4 w-4" aria-hidden="true" />
                AWAITING EMAIL APPROVAL
              </h2>
              <p className="text-sm leading-relaxed text-zinc-400">
                A {state.pending.action === "AFFIRM" ? "canary affirmation" : "canary disclosure"}{" "}
                was staged and a confirmation link was sent to{" "}
                <span className="font-mono text-zinc-300">{notificationEmail ?? "your notification email"}</span>.
                It expires {formatTime(state.pending.expiresAt)} — nothing changes
                until you approve it there.
              </p>
            </div>
            <form action={cancelAction} className="shrink-0">
              <button
                type="submit"
                disabled={cancelPending}
                className="min-h-[44px] cursor-pointer border border-red-500/60 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cancelPending ? "Cancelling..." : "Cancel staging"}
              </button>
            </form>
          </div>
          {cancelState?.detail && (
            <p className="mt-3 font-mono text-[11px] text-emerald-400" role="status">
              {cancelState.detail}
            </p>
          )}
        </section>
      )}

      {/* Staged success panel */}
      {stagedDetail && <DetailPanel message={stagedDetail} />}

      {/* Setup mode: no canary passphrase on record yet */}
      {!hasPassphrase && (
        <section aria-label="Set canary passphrase" className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6 sm:p-8">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center border border-cyan-500/50 bg-cyan-500/5 text-cyan-400">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Set your canary passphrase
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              The canary passphrase is a separate credential, required in
              addition to your admin login and independent of it — a leaked or
              reused login password must not open the canary signing authority
              on its own. Staging a canary update also requires out-of-band
              approval from your notification email, and every committed update
              is signed with the server&apos;s Ed25519 key and published on the
              transparency page.
            </p>
          </div>
          {passphraseState?.error && <ErrorPanel message={passphraseState.error} />}
          {passphraseState?.detail && <DetailPanel message={passphraseState.detail} />}
          <form action={passphraseAction} className="space-y-5" noValidate>
            <div>
              <label htmlFor="canary-new-passphrase" className={labelClass}>
                New canary passphrase (min {CANARY_MIN_PASSPHRASE_LENGTH} characters)
              </label>
              <input
                type="password"
                id="canary-new-passphrase"
                name="passphrase"
                autoComplete="new-password"
                minLength={CANARY_MIN_PASSPHRASE_LENGTH}
                maxLength={128}
                required
                disabled={passphrasePending}
                value={setupPassphrase}
                onChange={(e) => setSetupPassphrase(e.target.value)}
                aria-describedby="canary-setup-passphrase-strength"
                className={inputClass}
              />
              {/* Real-time strength meter: STRONG requires 20+ characters,
                  upper/lower case, a number, and a symbol. The server action
                  still enforces the CANARY_MIN_PASSPHRASE_LENGTH floor. */}
              <PasswordStrengthMeter
                value={setupPassphrase}
                minLength={CANARY_MIN_PASSPHRASE_LENGTH}
                describedById="canary-setup-passphrase-strength"
              />
            </div>
            <div>
              <label htmlFor="canary-confirm-passphrase" className={labelClass}>
                Confirm passphrase
              </label>
              <input
                type="password"
                id="canary-confirm-passphrase"
                name="confirmPassphrase"
                autoComplete="new-password"
                minLength={CANARY_MIN_PASSPHRASE_LENGTH}
                maxLength={128}
                required
                disabled={passphrasePending}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={passphrasePending}
              className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {passphrasePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Set canary passphrase
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* Operate mode */}
      {hasPassphrase && (
        <>
          {/* Affirm */}
          <section aria-label="Affirm canary" className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Affirm for another month
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Re-affirms all four canary statements and extends the freshness
              window by 30 days. Requires your canary passphrase, then
              out-of-band email approval.
            </p>
            {affirmState?.error && <div className="mt-4"><ErrorPanel message={affirmState.error} /></div>}
            {disclosed ? (
              <p className="mt-4 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs leading-relaxed text-red-400" role="note">
                A disclosure is terminal — the canary cannot be re-affirmed
                after it has been dropped.
              </p>
            ) : (
              <form action={affirmAction} className="mt-5 space-y-5" noValidate>
                <input type="hidden" name="action" value="AFFIRM" />
                <div>
                  <label htmlFor="affirm-passphrase" className={labelClass}>
                    Canary passphrase
                  </label>
                  <input
                    type="password"
                    id="affirm-passphrase"
                    name="passphrase"
                    autoComplete="current-password"
                    required
                    disabled={affirmPending}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="affirm-note" className={labelClass}>
                    Context note (optional)
                  </label>
                  <textarea
                    id="affirm-note"
                    name="note"
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. routine monthly affirmation"
                    disabled={affirmPending}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <AffirmCheckbox
                  id="affirm-ack"
                  label="I affirm that every canary statement is true today."
                  pending={affirmPending}
                />
                <button
                  type="submit"
                  disabled={affirmPending}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {affirmPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Staging...
                    </>
                  ) : (
                    <>
                      <Feather className="h-4 w-4" aria-hidden="true" />
                      Stage affirmation
                    </>
                  )}
                </button>
              </form>
            )}
          </section>

          {/* Disclose */}
          <section aria-label="Disclose canary event" className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Disclose an event
            </h2>
            <div
              className="mt-2 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs leading-relaxed text-red-400"
              role="note"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Drops the canary permanently: the public page switches to
                STATUS: DISCLOSED and the canary can never be re-affirmed. Use
                only when a canary statement is no longer true.
              </p>
            </div>
            {discloseState?.error && <div className="mt-4"><ErrorPanel message={discloseState.error} /></div>}
            <form action={discloseAction} className="mt-5 space-y-5" noValidate>
              <input type="hidden" name="action" value="DISCLOSE" />
              <div>
                <label htmlFor="disclose-passphrase" className={labelClass}>
                  Canary passphrase
                </label>
                <input
                  type="password"
                  id="disclose-passphrase"
                  name="passphrase"
                  autoComplete="current-password"
                  required
                  disabled={disclosePending}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="disclose-note" className={labelClass}>
                  What occurred (public)
                </label>
                <textarea
                  id="disclose-note"
                  name="note"
                  rows={3}
                  minLength={10}
                  maxLength={2000}
                  required
                  placeholder="State plainly what happened. This text is published on the transparency page and signed."
                  disabled={disclosePending}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <AffirmCheckbox
                id="disclose-ack"
                label="I am disclosing that a canary statement is no longer true."
                pending={disclosePending}
                destructive
              />
              <button
                type="submit"
                disabled={disclosePending}
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {disclosePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Staging...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Stage disclosure
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Passphrase change */}
          <section aria-label="Change canary passphrase" className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Change canary passphrase
            </h2>
            {passphraseState?.error && <div className="mt-4"><ErrorPanel message={passphraseState.error} /></div>}
            {passphraseState?.detail && <div className="mt-4"><DetailPanel message={passphraseState.detail} /></div>}
            <form action={passphraseAction} className="mt-5 space-y-5" noValidate>
              <div>
                <label htmlFor="change-current-passphrase" className={labelClass}>
                  Current canary passphrase
                </label>
                <input
                  type="password"
                  id="change-current-passphrase"
                  name="currentPassphrase"
                  autoComplete="current-password"
                  required
                  disabled={passphrasePending}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="change-new-passphrase" className={labelClass}>
                  New canary passphrase (min {CANARY_MIN_PASSPHRASE_LENGTH} characters)
                </label>
                <input
                  type="password"
                  id="change-new-passphrase"
                  name="passphrase"
                  autoComplete="new-password"
                  minLength={CANARY_MIN_PASSPHRASE_LENGTH}
                  maxLength={128}
                  required
                  disabled={passphrasePending}
                  value={changePassphrase}
                  onChange={(e) => setChangePassphrase(e.target.value)}
                  aria-describedby="canary-change-passphrase-strength"
                  className={inputClass}
                />
                <PasswordStrengthMeter
                  value={changePassphrase}
                  minLength={CANARY_MIN_PASSPHRASE_LENGTH}
                  describedById="canary-change-passphrase-strength"
                />
              </div>
              <div>
                <label htmlFor="change-confirm-passphrase" className={labelClass}>
                  Confirm new passphrase
                </label>
                <input
                  type="password"
                  id="change-confirm-passphrase"
                  name="confirmPassphrase"
                  autoComplete="new-password"
                  minLength={CANARY_MIN_PASSPHRASE_LENGTH}
                  maxLength={128}
                  required
                  disabled={passphrasePending}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={passphrasePending}
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-cyan-500/60 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {passphrasePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Update passphrase
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Signing key */}
          <section aria-label="Canary signing key" className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Signing key
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Record this fingerprint externally (notes, git, print). If the
              server database is ever tampered with, a swapped key would no
              longer match the fingerprint you recorded, and forged canary
              signatures would be detectable.
            </p>
            {state.publicKey ? (
              <>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  Fingerprint (SHA-256 of public key DER) — record this
                </p>
                <pre className="mt-1 overflow-x-auto rounded-none border border-zinc-800 bg-black p-3 font-mono text-[10px] leading-relaxed text-cyan-400">
                  {keyFingerprint ?? "unavailable"}
                </pre>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  Public key (base64 SPKI DER)
                </p>
                <pre className="mt-1 overflow-x-auto rounded-none border border-zinc-800 bg-black p-3 font-mono text-[10px] leading-relaxed text-zinc-500">
                  {state.publicKey}
                </pre>
              </>
            ) : (
              <p className="mt-4 font-mono text-[11px] text-zinc-500">
                No signing key yet — it is generated on the first committed
                update.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Shared acknowledgment checkbox for the staging forms: the submit stays
 * disabled until the operator explicitly acknowledges the consequence. The
 * checkbox is UX friction, not authorization — the server re-derives every
 * decision from the session and the database.
 */
function AffirmCheckbox({
  id,
  label,
  pending,
  destructive = false,
}: {
  id: string;
  label: string;
  pending: boolean;
  destructive?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer select-none items-start gap-2 font-mono text-[10px] leading-relaxed text-zinc-400"
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        disabled={pending}
        className={`mt-0.5 h-4 w-4 cursor-pointer ${destructive ? "accent-red-500" : "accent-emerald-500"}`}
      />
      <span>{label}</span>
    </label>
  );
}
