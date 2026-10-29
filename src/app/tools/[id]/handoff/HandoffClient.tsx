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

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Check,
  X,
  RotateCcw,
  Truck,
  Loader2,
  QrCode,
  Package,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { manageLoan, confirmHandoff } from "@/lib/actions/tools";

type ActionState = { success?: boolean; error?: string } | undefined;

interface HandoffLoan {
  id: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  borrower: { id: string; alias: string };
  owner: { id: string; alias: string };
}

interface HandoffClientProps {
  tool: { id: string; name: string; status: string; imageUrl: string | null };
  loan: HandoffLoan | null;
  viewerRole: "owner" | "borrower" | "observer";
}

/**
 * Scan-time action panel: resolves the current loan state into the single
 * transition the viewer is allowed to perform. Server state is re-fetched
 * (router.refresh) after every successful action so the panel always shows
 * the fresh lifecycle step.
 */
export default function HandoffClient({ tool, loan, viewerRole }: HandoffClientProps) {
  const [manageState, manageAction, managePending] = useActionState<ActionState, FormData>(
    manageLoan,
    undefined
  );
  const [handoffState, handoffAction, handoffPending] = useActionState<ActionState, FormData>(
    confirmHandoff,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (manageState?.success || handoffState?.success) {
      router.refresh();
    }
  }, [manageState, handoffState, router]);

  const actionError = manageState?.error ?? handoffState?.error;
  const pending = managePending || handoffPending;

  return (
    <div className="min-h-[calc(100dvh-4rem)] mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
          <QrCode className="h-4 w-4" aria-hidden="true" />
          QR HANDOFF
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">{tool.name}</h1>
        <Link
          href={`/tools/${tool.id}`}
          className="mt-1 inline-block font-mono text-xs text-zinc-500 transition-colors hover:text-cyan-400"
        >
          ← Back to tool listing
        </Link>
      </div>

      {tool.imageUrl && (
        <div className="border border-zinc-800 rounded-none bg-black p-2">
          <img
            src={`/api/uploads/${tool.imageUrl}`}
            alt={`${tool.name} photo`}
            className="w-full h-auto object-contain max-h-64"
          />
        </div>
      )}

      {actionError && (
        <div
          className="flex items-start gap-2 rounded-none border border-red-500/50 bg-red-500/5 p-4 font-mono text-xs text-red-400"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {actionError}
        </div>
      )}

      {!loan && (
        <div className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-zinc-600" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">
            NO ACTIVE HANDOFF
          </p>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            This tool has no pending or active loan right now.
          </p>
          {tool.status === "AVAILABLE" && viewerRole !== "owner" && (
            <Link
              href={`/tools/${tool.id}`}
              className="mt-4 inline-flex items-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10"
            >
              <Truck className="h-4 w-4" aria-hidden="true" />
              Request to borrow
            </Link>
          )}
        </div>
      )}

      {loan && (
        <div className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              LOAN STATUS
            </p>
            <span
              className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                loan.status === "ACTIVE"
                  ? "border-red-500/50 bg-red-500/5 text-red-400"
                  : "border-amber-500/50 bg-amber-500/5 text-amber-400"
              }`}
            >
              {loan.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-zinc-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            {format(new Date(loan.startDate), "MMM d")} –{" "}
            {format(new Date(loan.endDate), "MMM d, yyyy")}
          </p>

          {/* REQUESTED: owner decides */}
          {loan.status === "REQUESTED" && viewerRole === "owner" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-400">
                <span className="text-zinc-200">{loan.borrower.alias}</span> requested to borrow
                this tool.
              </p>
              <div className="flex flex-wrap gap-3">
                <form action={manageAction}>
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input type="hidden" name="decision" value="APPROVE" />
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex cursor-pointer items-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {managePending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                    Approve
                  </button>
                </form>
                <form action={manageAction}>
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input type="hidden" name="decision" value="REJECT" />
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex cursor-pointer items-center gap-2 border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Reject
                  </button>
                </form>
              </div>
            </div>
          )}

          {loan.status === "REQUESTED" && viewerRole === "borrower" && (
            <p className="mt-4 text-sm text-zinc-400">
              Waiting for <span className="text-zinc-200">{loan.owner.alias}</span> to approve your
              request.
            </p>
          )}

          {/* APPROVED: borrower confirms the physical pickup */}
          {loan.status === "APPROVED" && viewerRole === "borrower" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-400">
                <span className="text-zinc-200">{loan.owner.alias}</span> approved your loan.
                Confirm once you physically have the tool — this activates the loan.
              </p>
              <form action={handoffAction}>
                <input type="hidden" name="loanId" value={loan.id} />
                <button
                  type="submit"
                  disabled={handoffPending}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 border border-emerald-500/60 px-4 py-3 font-mono text-sm uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {handoffPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                  Confirm pickup
                </button>
              </form>
            </div>
          )}

          {loan.status === "APPROVED" && viewerRole === "owner" && (
            <p className="mt-4 text-sm text-zinc-400">
              Approved — waiting for <span className="text-zinc-200">{loan.borrower.alias}</span> to
              confirm pickup (they scan this label or use their dashboard).
            </p>
          )}

          {/* ACTIVE: owner marks the return */}
          {loan.status === "ACTIVE" && viewerRole === "owner" && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-zinc-400">
                On loan to <span className="text-zinc-200">{loan.borrower.alias}</span>. Mark the
                return once the tool is back in your hands.
              </p>
              <form action={manageAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="loanId" value={loan.id} />
                <input type="hidden" name="decision" value="MARK_RETURNED" />
                <select
                  name="returnCondition"
                  required
                  className="cursor-pointer appearance-none rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Select return condition</option>
                  <option value="GOOD">Good condition (+5 trust)</option>
                  <option value="DAMAGED">Damaged (-15 trust)</option>
                </select>
                <button
                  type="submit"
                  disabled={managePending}
                  className="flex cursor-pointer items-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {managePending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Mark returned
                </button>
              </form>
            </div>
          )}

          {loan.status === "ACTIVE" && viewerRole === "borrower" && (
            <p className="mt-4 text-sm text-zinc-400">
              The tool is on loan to you. Return it to{" "}
              <span className="text-zinc-200">{loan.owner.alias}</span> — they mark it returned and
              your trust score is adjusted.
            </p>
          )}

          {viewerRole === "observer" && (
            <p className="mt-4 text-sm text-zinc-400">
              This tool is part of a loan between{" "}
              <span className="text-zinc-200">{loan.owner.alias}</span> and{" "}
              <span className="text-zinc-200">{loan.borrower.alias}</span>. Only they can manage the
              handoff.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
