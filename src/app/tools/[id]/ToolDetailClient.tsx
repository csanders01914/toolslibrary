"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Hammer, Shield, User, Calendar, MapPin, Truck, RotateCcw, X, Check, AlertTriangle, MessageSquare, ExternalLink } from "lucide-react";
import { format } from "date-fns";

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
          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-sm font-medium">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            Available for Borrowing
          </span>
        );
      case "BORROWED":
        return (
          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-sm font-medium">
            <Truck className="w-4 h-4" aria-hidden="true" />
            Currently Borrowed
          </span>
        );
      case "MAINTENANCE":
        return (
          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-sm font-medium">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Under Maintenance
          </span>
        );
      default:
        return (
          <span className="px-4 py-2 rounded-xl bg-slate-500/10 text-slate-300 border border-slate-500/30 text-sm font-medium">
            {tool.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Image & Status */}
      <div className="relative aspect-video sm:aspect-[16/10] overflow-hidden rounded-2xl bg-slate-950/80 border border-white/10">
        {tool.imageUrl ? (
          <img
            src={`/api/uploads/${tool.imageUrl}`}
            alt={`${tool.name} photo`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Hammer className="w-24 h-24 text-slate-700" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-4 right-4">
          {getStatusDisplay()}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Meta */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-slate-800/50 text-slate-300 border border-white/10 text-sm font-medium">
                {tool.category}
              </span>
              <span className="text-slate-500 text-sm">Listed {format(new Date(tool.createdAt), "MMM d, yyyy")}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {tool.name}
            </h1>
          </div>

          {/* Description */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Description</h2>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{tool.description}</p>
          </div>

          {/* Loan Status & Actions */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" aria-hidden="true" />
              Loan Status
            </h2>

            {activeLoan && (
              <div className="space-y-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-rose-300">Active Loan</p>
                    <p className="text-sm text-slate-400">
                      Borrowed by <span className="text-slate-200">{activeLoan.borrower.alias}</span>
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-medium">
                    {activeLoan.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {format(new Date(activeLoan.startDate), "MMM d")} – {format(new Date(activeLoan.endDate), "MMM d, yyyy")}
                  </span>
                </div>
                {isOwner && activeLoan.status === "ACTIVE" && (
                  <form action={manageLoan} className="mt-3">
                    <input type="hidden" name="loanId" value={activeLoan.id} />
                    <input type="hidden" name="decision" value="MARK_RETURNED" />
                    <select name="returnCondition" className="w-full sm:w-auto bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none" required>
                      <option value="">Select return condition</option>
                      <option value="GOOD">Good Condition (+5 trust)</option>
                      <option value="DAMAGED">Damaged (-15 trust)</option>
                    </select>
                    <button type="submit" className="mt-2 sm:mt-0 px-4 py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-200">
                      Mark Returned
                    </button>
                  </form>
                )}
              </div>
            )}

            {pendingLoan && !activeLoan && (
              <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-amber-300">Pending Request</p>
                    <p className="text-sm text-slate-400">
                      From <span className="text-slate-200">{pendingLoan.borrower.alias}</span>
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                    REQUESTED
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {format(new Date(pendingLoan.startDate), "MMM d")} – {format(new Date(pendingLoan.endDate), "MMM d, yyyy")}
                  </span>
                </div>
                {isOwner && (
                  <div className="flex gap-3 mt-3">
                    <form action={manageLoan}>
                      <input type="hidden" name="loanId" value={pendingLoan.id} />
                      <input type="hidden" name="decision" value="APPROVE" />
                      <button type="submit" className="px-4 py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-200">
                        Approve
                      </button>
                    </form>
                    <form action={manageLoan}>
                      <input type="hidden" name="loanId" value={pendingLoan.id} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <button type="submit" className="px-4 py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-[0_0_20px_rgba(251,113,133,0.4)] transition-all duration-200">
                        Reject
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {!activeLoan && !pendingLoan && tool.status === "AVAILABLE" && session && !isOwner && (
              <div className="text-center py-4">
                <p className="text-slate-300 mb-4">This tool is available for borrowing.</p>
                <button
                  onClick={() => setShowLoanModal(true)}
                  className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer flex items-center gap-2 mx-auto"
                >
                  <Truck className="w-4 h-4" aria-hidden="true" />
                  Request to Borrow
                </button>
              </div>
            )}

            {!session && tool.status === "AVAILABLE" && (
              <div className="text-center py-4">
                <p className="text-slate-300 mb-4">Sign in to request this tool.</p>
                <a
                  href="/login"
                  className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer inline-flex items-center gap-2"
                >
                  <Truck className="w-4 h-4" aria-hidden="true" />
                  Login to Borrow
                </a>
              </div>
            )}

            {isOwner && tool.status === "AVAILABLE" && (
              <div className="text-center py-4 text-slate-400">
                <p>You own this tool. It's ready for lending!</p>
              </div>
            )}
          </div>

          {/* Owner Info */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" aria-hidden="true" />
              Owner
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
                <User className="w-7 h-7 text-purple-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-white">{tool.owner.alias}</p>
                <p className="text-sm text-slate-400">Member since {format(new Date(tool.owner.createdAt), "MMM yyyy")}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-medium">
                    <Shield className="w-3 h-3" aria-hidden="true" />
                    Trust Score: {tool.owner.trustScore}
                  </span>
                </div>
              </div>
            </div>
            {tool.owner.bio && (
              <p className="mt-4 text-slate-300 italic">"{tool.owner.bio}"</p>
            )}
            {session && session.user.id !== tool.owner.id && (
              <a
                href={`/messages?to=${tool.owner.id}`}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Message Owner
              </a>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-slate-100 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {session && session.user.id !== tool.owner.id && tool.status === "AVAILABLE" && !activeLoan && !pendingLoan && (
                <button
                  onClick={() => setShowLoanModal(true)}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" aria-hidden="true" />
                  Request to Borrow
                </button>
              )}
              {session && session.user.id !== tool.owner.id && (
                <a
                  href={`/messages?to=${tool.owner.id}`}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  Message Owner
                </a>
              )}
              {isOwner && (
                <a
                  href={`/tools/${tool.id}/edit`}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-slate-800/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-300 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  Edit Listing
                </a>
              )}
            </div>
          </div>

          {/* Tool Details */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-slate-100 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Category</dt>
                <dd className="text-slate-100 font-medium">{tool.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Status</dt>
                <dd className="text-slate-100 font-medium capitalize">{tool.status.toLowerCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Listed</dt>
                <dd className="text-slate-100 font-medium">{format(new Date(tool.createdAt), "MMM d, yyyy")}</dd>
              </div>
              {activeLoan && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Due Back</dt>
                    <dd className="text-slate-100 font-medium">{format(new Date(activeLoan.endDate), "MMM d, yyyy")}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Borrower</dt>
                    <dd className="text-slate-100 font-medium">{activeLoan.borrower.alias}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Trust Badge */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-cyan-400 mb-3" aria-hidden="true" />
            <p className="text-slate-400 text-sm mb-1">Owner Trust Score</p>
            <p className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              {tool.owner.trustScore}
            </p>
            <p className="text-xs text-slate-500 mt-2">Based on loan history & returns</p>
          </div>
        </div>
      </div>

      {/* Loan Request Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-[0_0_50px_-12px_rgba(6,182,212,0.25)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Request to Borrow</h3>
              <button
                onClick={() => setShowLoanModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleLoanSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  min={new Date().toISOString().split("T")[0]}
                  value={loanStart}
                  onChange={(e) => setLoanStart(e.target.value)}
                  required
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  min={loanStart || new Date().toISOString().split("T")[0]}
                  value={loanEnd}
                  onChange={(e) => setLoanEnd(e.target.value)}
                  required
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-800/50 border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" aria-hidden="true" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}