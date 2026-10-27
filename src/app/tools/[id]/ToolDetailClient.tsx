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

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Truck, RotateCcw, Calendar, X, AlertTriangle, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  imageUrl: string | null;
  createdAt: Date | string;
  owner: {
    id: string;
    alias: string;
    trustScore: number;
    bio: string | null;
    createdAt: Date | string;
  };
  loans: Array<{
    id: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
    borrower: { id: string; alias: string };
  }>;
}

interface ManageLoanAction {
  (formData: FormData): Promise<void>;
}

interface ToolDetailClientProps {
  tool: Tool;
  manageLoan: ManageLoanAction;
}

const formatVouch = (trustScore: number) => {
  const vouch = trustScore - 100;
  return vouch >= 0 ? `+${vouch}` : `${vouch}`;
};

export default function ToolDetailClient({ tool, manageLoan }: ToolDetailClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanStart, setLoanStart] = useState("");
  const [loanEnd, setLoanEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isOwner = session?.user?.id === tool.owner.id;
  const isAdmin = session?.user?.role === "ADMIN";
  const activeLoan = tool.loans.find((l) => l.status === "ACTIVE" || l.status === "APPROVED");
  const pendingLoan = tool.loans.find((l) => l.status === "REQUESTED");

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanStart || !loanEnd) {
      setError("Please select both start and end dates");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/tools/loan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: tool.id, startDate: loanStart, endDate: loanEnd }),
    });

    const data = await res.json();
    if (data.success) {
      setShowLoanModal(false);
      router.refresh();
    } else {
      setError(data.error || "Failed to request loan");
    }
    setSubmitting(false);
  };

  const getStatusDisplay = () => {
    switch (tool.status) {
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-emerald-500/50 text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400" aria-hidden="true" />
            AVAILABLE
          </span>
        );
      case "BORROWED":
        return (
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-red-500/50 text-red-400">
            <Truck className="w-3 h-3" aria-hidden="true" />
            BORROWED
          </span>
        );
      case "MAINTENANCE":
        return (
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-amber-500/50 text-amber-400">
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            MAINTENANCE
          </span>
        );
      default:
        return (
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-zinc-700 text-zinc-300">
            {tool.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header: title + spec sheet */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-cyan-500/50 text-cyan-400">
            {tool.category}
          </span>
          {getStatusDisplay()}
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">{tool.name}</h1>
        <div className="font-mono text-xs space-y-1 pt-3 border-t border-zinc-900">
          <p>
            <span className="text-zinc-500">OWNER: </span>
            <span className="text-zinc-300">{tool.owner.alias}</span>
          </p>
          <p>
            <span className="text-zinc-500">STATUS: </span>
            <span className={tool.status === "AVAILABLE" ? "text-emerald-400" : tool.status === "BORROWED" ? "text-red-400" : tool.status === "MAINTENANCE" ? "text-amber-400" : "text-zinc-300"}>
              {tool.status}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">VOUCH: </span>
            <span className="text-emerald-400">{formatVouch(tool.owner.trustScore)}</span>
          </p>
          <p>
            <span className="text-zinc-500">LISTED: </span>
            <span className="text-zinc-300">{format(new Date(tool.createdAt), "yyyy-MM-dd")}</span>
          </p>
        </div>
      </div>

      {/* Photo */}
      {tool.imageUrl && (
        <div className="border border-zinc-800 rounded-none bg-black p-2">
          <img
            src={`/api/uploads/${tool.imageUrl}`}
            alt={`${tool.name} photo`}
            className="w-full h-auto object-contain max-h-96"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-3">DESCRIPTION</h2>
            <p className="text-zinc-400 whitespace-pre-wrap leading-relaxed">{tool.description}</p>
          </div>

          {/* Loan Status & Actions */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-4">LOAN STATUS</h2>

            {activeLoan && (
              <div className="space-y-3 p-4 bg-red-500/10 border border-red-500/50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-red-400">ACTIVE LOAN</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      Borrowed by <span className="text-zinc-200">{activeLoan.borrower.alias}</span>
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-red-500/50 text-red-400">
                    {activeLoan.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  {format(new Date(activeLoan.startDate), "MMM d")} – {format(new Date(activeLoan.endDate), "MMM d, yyyy")}
                </p>
                {isOwner && activeLoan.status === "ACTIVE" && (
                  <form action={manageLoan} className="mt-3 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="loanId" value={activeLoan.id} />
                    <input type="hidden" name="decision" value="MARK_RETURNED" />
                    <select
                      name="returnCondition"
                      className="bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Select return condition</option>
                      <option value="GOOD">Good Condition (+5 trust)</option>
                      <option value="DAMAGED">Damaged (-15 trust)</option>
                    </select>
                    <button
                      type="submit"
                      className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      MARK RETURNED
                    </button>
                  </form>
                )}
              </div>
            )}

            {pendingLoan && !activeLoan && (
              <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-amber-400">PENDING REQUEST</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      From <span className="text-zinc-200">{pendingLoan.borrower.alias}</span>
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-amber-500/50 text-amber-400">
                    REQUESTED
                  </span>
                </div>
                <p className="font-mono text-xs text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  {format(new Date(pendingLoan.startDate), "MMM d")} – {format(new Date(pendingLoan.endDate), "MMM d, yyyy")}
                </p>
                {isOwner && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    <form action={manageLoan}>
                      <input type="hidden" name="loanId" value={pendingLoan.id} />
                      <input type="hidden" name="decision" value="APPROVE" />
                      <button
                        type="submit"
                        className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      >
                        APPROVE
                      </button>
                    </form>
                    <form action={manageLoan}>
                      <input type="hidden" name="loanId" value={pendingLoan.id} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <button
                        type="submit"
                        className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        REJECT
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {!activeLoan && !pendingLoan && tool.status === "AVAILABLE" && session && !isOwner && (
              <div className="py-2">
                <p className="text-sm text-zinc-400 mb-4">This tool is available for borrowing.</p>
                <button
                  onClick={() => setShowLoanModal(true)}
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                  REQUEST TO BORROW
                </button>
              </div>
            )}

            {!session && tool.status === "AVAILABLE" && (
              <div className="py-2">
                <p className="text-sm text-zinc-400 mb-4">Sign in to request this tool.</p>
                <a
                  href="/login"
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                  LOGIN TO BORROW
                </a>
              </div>
            )}

            {isOwner && tool.status === "AVAILABLE" && (
              <p className="font-mono text-xs text-zinc-500 py-2">
                YOU OWN THIS TOOL. IT IS READY FOR LENDING.
              </p>
            )}
          </div>

          {/* Owner Info */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-4">OWNER</h2>
            <div className="font-mono text-xs space-y-1">
              <p>
                <span className="text-zinc-500">ALIAS: </span>
                <span className="text-zinc-200">{tool.owner.alias}</span>
              </p>
              <p>
                <span className="text-zinc-500">MEMBER SINCE: </span>
                <span className="text-zinc-300">{format(new Date(tool.owner.createdAt), "MMM yyyy")}</span>
              </p>
              <p>
                <span className="text-zinc-500">TRUST SCORE: </span>
                <span className="text-emerald-400">{tool.owner.trustScore}</span>
              </p>
            </div>
            {tool.owner.bio && (
              <p className="mt-4 text-sm text-zinc-400 italic">&quot;{tool.owner.bio}&quot;</p>
            )}
            {session && session.user.id !== tool.owner.id && (
              <a
                href={`/messages?to=${tool.owner.id}`}
                className="mt-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                MESSAGE OWNER
              </a>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-4">QUICK ACTIONS</h3>
            <div className="space-y-3">
              {session && session.user.id !== tool.owner.id && tool.status === "AVAILABLE" && !activeLoan && !pendingLoan && (
                <button
                  onClick={() => setShowLoanModal(true)}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                  REQUEST TO BORROW
                </button>
              )}
              {session && session.user.id !== tool.owner.id && (
                <a
                  href={`/messages?to=${tool.owner.id}`}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  MESSAGE OWNER
                </a>
              )}
              {isOwner && (
                <a
                  href={`/tools/${tool.id}/edit`}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  EDIT LISTING
                </a>
              )}
            </div>
          </div>

          {/* Tool Details */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-4">DETAILS</h3>
            <dl className="font-mono text-xs space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">CATEGORY</dt>
                <dd className="text-zinc-300">{tool.category}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">STATUS</dt>
                <dd className="text-zinc-300">{tool.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">LISTED</dt>
                <dd className="text-zinc-300">{format(new Date(tool.createdAt), "MMM d, yyyy")}</dd>
              </div>
              {activeLoan && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">DUE BACK</dt>
                    <dd className="text-zinc-300">{format(new Date(activeLoan.endDate), "MMM d, yyyy")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">BORROWER</dt>
                    <dd className="text-zinc-300">{activeLoan.borrower.alias}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Trust */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">OWNER TRUST SCORE</p>
            <p className="font-mono text-3xl font-bold text-white">{tool.owner.trustScore}</p>
            <p className="font-mono text-[11px] text-zinc-500 mt-2">BASED ON LOAN HISTORY &amp; RETURNS</p>
          </div>
        </div>
      </div>

      {/* Loan Request Modal */}
      <Modal open={showLoanModal} onClose={() => setShowLoanModal(false)} label="Request to borrow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">REQUEST TO BORROW</h3>
              <button
                onClick={() => setShowLoanModal(false)}
                data-autofocus
                className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-zinc-500 hover:text-white active:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleLoanSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="startDate" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-1">
                  START DATE
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  min={new Date().toISOString().split("T")[0]}
                  value={loanStart}
                  onChange={(e) => setLoanStart(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-1">
                  END DATE
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  min={loanStart || new Date().toISOString().split("T")[0]}
                  value={loanEnd}
                  onChange={(e) => setLoanEnd(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      REQUESTING...
                    </>
                  ) : (
                    "SUBMIT REQUEST"
                  )}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
