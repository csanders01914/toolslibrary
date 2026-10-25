"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Hammer,
  Package,
  Users,
  Check,
  X,
  RotateCcw,
  Pencil,
  Save,
  Clock,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { manageLoan } from "@/lib/actions/tools";
import { updateProfile } from "@/lib/actions/messages";

interface User {
  id: string;
  alias: string;
  bio: string | null;
  trustScore: number;
  role: string;
  createdAt: Date;
}

interface Stats {
  toolsLent: number;
  activeBorrows: number;
  skillsOffered: number;
  trustScore: number;
}

interface LoanRow {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  returnedAt: Date | null;
  tool: { id: string; name: string; status: string };
  borrower?: { id: string; alias: string; trustScore: number };
  toolOwner?: { id: string; alias: string };
}

interface DashboardClientProps {
  user: User;
  stats: Stats;
  incomingRequests: LoanRow[];
  activeLoansAsOwner: LoanRow[];
  activeLoansAsBorrower: LoanRow[];
}

type ActionState = { success?: boolean; error?: string } | undefined;

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardClient({
  user,
  stats,
  incomingRequests,
  activeLoansAsOwner,
  activeLoansAsBorrower,
}: DashboardClientProps) {
  const [loanState, loanAction, loanPending] = useActionState<ActionState, FormData>(manageLoan, undefined);
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(updateProfile, undefined);
  const [editingProfile, setEditingProfile] = useState(false);
  const [localAlias, setLocalAlias] = useState(user.alias);
  const [localBio, setLocalBio] = useState(user.bio ?? "");
  const profileFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (profileState?.success) {
      setEditingProfile(false);
    }
  }, [profileState]);

  const trustColor =
    stats.trustScore >= 90
      ? "from-emerald-400 to-teal-400"
      : stats.trustScore >= 60
        ? "from-cyan-400 to-blue-400"
        : "from-rose-400 to-red-400";

  const statCards = [
    {
      label: "Trust Score",
      value: String(stats.trustScore),
      icon: Shield,
      accent: "text-emerald-400",
      border: "hover:border-emerald-500/40",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(16,185,137,0.2)]",
      gradient: trustColor,
    },
    {
      label: "Tools Lent",
      value: String(stats.toolsLent),
      icon: Hammer,
      accent: "text-cyan-400",
      border: "hover:border-cyan-500/40",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]",
      gradient: "from-cyan-400 to-blue-400",
    },
    {
      label: "Active Borrows",
      value: String(stats.activeBorrows),
      icon: ArrowLeftRight,
      accent: "text-purple-400",
      border: "hover:border-purple-500/40",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]",
      gradient: "from-purple-400 to-fuchsia-400",
    },
    {
      label: "Skills Offered",
      value: String(stats.skillsOffered),
      icon: Wrench,
      accent: "text-emerald-400",
      border: "hover:border-emerald-500/40",
      glow: "hover:shadow-[0_0_30px_-5px_rgba(16,185,137,0.2)]",
      gradient: "from-emerald-400 to-teal-400",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
            Command Dashboard
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Self-sovereign control center — member since {formatDate(user.createdAt)}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-medium self-start">
          <Shield className="w-4 h-4" aria-hidden="true" />
          {user.alias}
          {user.role === "ADMIN" && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              ADMIN
            </span>
          )}
        </span>
      </section>

      {/* Bento Stat Row */}
      <section aria-label="Account statistics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 ${card.border} ${card.glow}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <Icon className={`w-8 h-8 ${card.accent}`} aria-hidden="true" />
                </div>
                <p className={`text-4xl font-extrabold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                  {card.value}
                </p>
                <p className="text-slate-400 mt-1 text-sm">{card.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Action feedback */}
      {(loanState?.error || profileState?.error || profileState?.success) && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-sm ${
            loanState?.error || profileState?.error
              ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
          }`}
        >
          {loanState?.error || profileState?.error || "Profile updated successfully."}
        </div>
      )}

      {/* Profile Editor */}
      <section aria-label="Profile settings">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-cyan-400" aria-hidden="true" />
              Public Profile
            </h2>
            {!editingProfile && (
              <button
                onClick={() => setEditingProfile(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-slate-800/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
                Edit Profile
              </button>
            )}
          </div>

          {editingProfile ? (
            <form ref={profileFormRef} action={profileAction} className="space-y-4">
              <div>
                <label htmlFor="alias" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Public Alias
                </label>
                <input
                  id="alias"
                  name="alias"
                  type="text"
                  value={localAlias}
                  onChange={(e) => setLocalAlias(e.target.value)}
                  required
                  minLength={2}
                  maxLength={32}
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                />
              </div>
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Bio (optional)
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={localBio}
                  onChange={(e) => setLocalBio(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Tell your neighbors what you build, fix, and share..."
                  className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={profilePending}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {profilePending ? "Saving..." : "Save Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(false);
                    setLocalAlias(user.alias);
                    setLocalBio(user.bio ?? "");
                  }}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-300 bg-slate-800/50 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                <span className="font-medium text-slate-300">Alias:</span> {user.alias}
              </p>
              <p className="text-sm text-slate-400">
                <span className="font-medium text-slate-300">Bio:</span>{" "}
                {user.bio || <span className="italic text-slate-500">No bio yet</span>}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Incoming Loan Requests */}
      <section aria-label="Incoming loan requests">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent mb-6">
          Incoming Loan Requests ({incomingRequests.length})
        </h2>
        {incomingRequests.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
            <Clock className="w-12 h-12 mx-auto text-slate-600 mb-3" aria-hidden="true" />
            <p className="text-slate-500 text-sm">No pending loan requests on your tools.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {incomingRequests.map((loan) => (
              <div
                key={loan.id}
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-cyan-500/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white hover:text-cyan-300 transition-colors">
                        {loan.tool.name}
                      </Link>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium">
                        REQUESTED
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Requested by <span className="text-cyan-300 font-medium">{loan.borrower?.alias}</span>
                      <span className="mx-2 text-slate-600">•</span>
                      Trust: <span className="text-cyan-300">{loan.borrower?.trustScore}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(loan.startDate)} → {formatDate(loan.endDate)}
                    </p>
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    <form action={loanAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="decision" value="APPROVE" />
                      <button
                        type="submit"
                        disabled={loanPending}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,137,0.3)] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" />
                        Approve
                      </button>
                    </form>
                    <form action={loanAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <button
                        type="submit"
                        disabled={loanPending}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Loans (Lent by me) */}
      <section aria-label="Active loans on your tools">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent mb-6">
          Tools Currently Lent ({activeLoansAsOwner.length})
        </h2>
        {activeLoansAsOwner.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
            <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" aria-hidden="true" />
            <p className="text-slate-500 text-sm">None of your tools are out on loan right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoansAsOwner.map((loan) => {
              const overdue = new Date(loan.endDate) < new Date();
              return (
                <div
                  key={loan.id}
                  className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-cyan-500/40"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white hover:text-cyan-300 transition-colors">
                          {loan.tool.name}
                        </Link>
                        {overdue && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Borrowed by <span className="text-cyan-300 font-medium">{loan.borrower?.alias}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Due {formatDate(loan.endDate)}
                      </p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <form action={loanAction}>
                        <input type="hidden" name="loanId" value={loan.id} />
                        <input type="hidden" name="decision" value="MARK_RETURNED" />
                        <input type="hidden" name="returnCondition" value="GOOD" />
                        <button
                          type="submit"
                          disabled={loanPending}
                          className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,137,0.3)] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                          Mark Returned (Good)
                        </button>
                      </form>
                      <form action={loanAction}>
                        <input type="hidden" name="loanId" value={loan.id} />
                        <input type="hidden" name="decision" value="MARK_RETURNED" />
                        <input type="hidden" name="returnCondition" value="DAMAGED" />
                        <button
                          type="submit"
                          disabled={loanPending}
                          className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                          Returned Damaged
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* My Borrows */}
      <section aria-label="Tools you are borrowing">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent mb-6">
          Your Active Borrows ({activeLoansAsBorrower.length})
        </h2>
        {activeLoansAsBorrower.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" aria-hidden="true" />
            <p className="text-slate-500 text-sm mb-4">You are not borrowing any tools yet.</p>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200"
            >
              <Hammer className="w-4 h-4" aria-hidden="true" />
              Browse Tools
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoansAsBorrower.map((loan) => (
              <div
                key={loan.id}
                className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-purple-500/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white hover:text-cyan-300 transition-colors">
                        {loan.tool.name}
                      </Link>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          loan.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {loan.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Owner: <span className="text-purple-300 font-medium">{loan.toolOwner?.alias ?? "Community Member"}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(loan.startDate)} → {formatDate(loan.endDate)}
                    </p>
                  </div>
                  <Link
                    href="/messages"
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 flex items-center gap-2 self-start sm:self-auto flex-shrink-0"
                  >
                    Message Owner
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}