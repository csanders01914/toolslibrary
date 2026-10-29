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

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Shield,
  ShieldCheck,
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
  KeyRound,
  Trash2,
  Loader2,
} from "lucide-react";
import { manageLoan, confirmHandoff } from "@/lib/actions/tools";
import { vouchForUser, declineVouch } from "@/lib/actions/vouch";
import { updateProfile } from "@/lib/actions/messages";
import { deleteOwnAccount } from "@/lib/actions/auth";
import { VOUCH_DELTA } from "@/lib/constants";
import { Modal } from "@/components/ui/Modal";
import { NOTIFICATION_REFRESH_EVENT } from "@/components/layout/NotificationBell";

interface User {
  id: string;
  username: string;
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
  skillsTotal: number;
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

interface VouchableLoanRow {
  id: string;
  returnedAt: Date | string | null;
  tool: { id: string; name: string; owner: { id: string; alias: string } };
  borrower: { id: string; alias: string };
}

interface DashboardClientProps {
  user: User;
  stats: Stats;
  incomingRequests: LoanRow[];
  activeLoansAsOwner: LoanRow[];
  activeLoansAsBorrower: LoanRow[];
  vouchableLoans: VouchableLoanRow[];
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
  vouchableLoans,
}: DashboardClientProps) {
  const [loanState, loanAction, loanPending] = useActionState<ActionState, FormData>(manageLoan, undefined);
  const [handoffState, handoffAction, handoffPending] = useActionState<ActionState, FormData>(confirmHandoff, undefined);
  const [vouchState, vouchAction, vouchPending] = useActionState<ActionState, FormData>(vouchForUser, undefined);
  const [declineState, declineAction, declinePending] = useActionState<ActionState, FormData>(declineVouch, undefined);
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(updateProfile, undefined);
  const [deleteAccountState, deleteAccountAction, deleteAccountPending] = useActionState<ActionState, FormData>(
    deleteOwnAccount,
    undefined
  );
  const [editingProfile, setEditingProfile] = useState(false);
  const [localAlias, setLocalAlias] = useState(user.alias);
  const [localBio, setLocalBio] = useState(user.bio ?? "");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const profileFormRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (profileState?.success) {
      setEditingProfile(false);
      // Re-fetch the server component data so the header reflects the saved
      // alias/bio immediately instead of showing stale props.
      router.refresh();
    }
  }, [profileState, router]);

  // A confirmed handoff activates the loan (APPROVED → ACTIVE) — re-fetch so
  // the borrow queue reflects the new lifecycle state, and ping the navbar
  // indicator so its pending counts update without waiting for the next poll.
  useEffect(() => {
    if (handoffState?.success) {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT));
      router.refresh();
    }
  }, [handoffState, router]);

  // Approve/reject/return move rows between the loan queues — re-fetch the
  // server component data so the queues reflect the new lifecycle state
  // immediately (same pattern as the profile editor above), and ping the
  // navbar indicator for the same reason.
  useEffect(() => {
    if (loanState?.success) {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT));
      router.refresh();
    }
  }, [loanState, router]);

  // A vouch bumps the counterparty's trust score; a decline records a neutral
  // non-endorsement. Either decision removes the loan from the vouch queue —
  // re-fetch so both reflect it, and ping the navbar indicator so the
  // "vouches waiting" count drops at once.
  useEffect(() => {
    if (vouchState?.success || declineState?.success) {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT));
      router.refresh();
    }
  }, [vouchState, declineState, router]);

  // The account row is gone after a successful purge — burn the session and
  // land on the public homepage as a signed-out visitor.
  useEffect(() => {
    if (deleteAccountState?.success) {
      signOut({ callbackUrl: "/" });
    }
  }, [deleteAccountState]);

  const statCards = [
    {
      label: "Trust Score",
      value: String(stats.trustScore),
      icon: Shield,
      accent: "text-emerald-400",
      hover: "hover:border-emerald-500/50",
    },
    {
      label: "Tools Lent",
      value: String(stats.toolsLent),
      icon: Hammer,
      accent: "text-cyan-400",
      hover: "hover:border-cyan-500/50",
    },
    {
      label: "Active Borrows",
      value: String(stats.activeBorrows),
      icon: ArrowLeftRight,
      accent: "text-amber-400",
      hover: "hover:border-amber-500/50",
    },
    {
      label: "Skills Offered",
      value: String(stats.skillsOffered),
      icon: Wrench,
      accent: "text-purple-400",
      hover: "hover:border-purple-500/50",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">COMMAND DASHBOARD</p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Command Dashboard
          </h1>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Self-sovereign control center — member since {formatDate(user.createdAt)}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start border border-cyan-500/50 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <Shield className="h-3 w-3" aria-hidden="true" />
          {user.alias}
          {user.role === "ADMIN" && (
            <span className="ml-1 border border-red-500/50 bg-red-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-400">
              ADMIN
            </span>
          )}
        </span>
      </section>

      {/* Stat Row */}
      <section aria-label="Account statistics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors ${card.hover}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon className={`h-6 w-6 ${card.accent}`} aria-hidden="true" />
                </div>
                <p className={`font-mono text-4xl font-bold ${card.accent}`}>
                  {card.value}
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-zinc-500">{card.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Action feedback */}
      {(loanState?.error || handoffState?.error || vouchState?.error || declineState?.error || profileState?.error || profileState?.success) && (
        <div
          role="status"
          className={`rounded-none border p-4 font-mono text-xs ${
            loanState?.error || handoffState?.error || vouchState?.error || declineState?.error || profileState?.error
              ? "border-red-500/50 bg-red-500/5 text-red-400"
              : "border-emerald-500/50 bg-emerald-500/5 text-emerald-400"
          }`}
        >
          {loanState?.error || handoffState?.error || vouchState?.error || declineState?.error || profileState?.error || "Profile updated successfully."}
        </div>
      )}

      {/* Profile Editor */}
      <section aria-label="Profile settings">
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              PROFILE // PUBLIC IDENTITY
            </h2>
            {!editingProfile && (
              <button
                onClick={() => setEditingProfile(true)}
                className="flex cursor-pointer items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit Profile
              </button>
            )}
          </div>

          {editingProfile ? (
            <form ref={profileFormRef} action={profileAction} className="space-y-4">
              <div>
                <label htmlFor="alias" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
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
                  className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bio" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
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
                  className="w-full resize-none rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={profilePending}
                  className="flex cursor-pointer items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {profilePending ? "Saving..." : "Save Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(false);
                    setLocalAlias(user.alias);
                    setLocalBio(user.bio ?? "");
                  }}
                  className="cursor-pointer border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-xs text-zinc-400">
                <span className="uppercase tracking-widest text-zinc-500">Alias:</span>{" "}
                <span className="text-white">{user.alias}</span>
              </p>
              <p className="font-mono text-xs text-zinc-400">
                <span className="uppercase tracking-widest text-zinc-500">Bio:</span>{" "}
                {user.bio || <span className="italic text-zinc-500">No bio yet</span>}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Account Settings */}
      <section aria-label="Account settings">
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
          <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            ACCOUNT // SETTINGS
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-zinc-400">Password</p>
                <p className="font-mono text-[11px] text-zinc-500 mt-1">
                  No email recovery — keep your password and recovery codes safe.
                </p>
              </div>
              <Link
                href="/change-password"
                className="inline-flex items-center gap-2 self-start border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 sm:self-auto"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Change Password
              </Link>
            </div>
            <div className="border-t border-zinc-900 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-red-400">Danger Zone</p>
                <p className="font-mono text-[11px] text-zinc-500 mt-1">
                  Permanently delete this account, your {stats.toolsLent} tool(s), {stats.skillsTotal}{" "}
                  skill(s), and all loans and messages. Zero-PII purge — cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-2 self-start border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 sm:self-auto"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Incoming Loan Requests */}
      <section aria-label="Incoming loan requests">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LOANS // INCOMING REQUESTS</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">
          Incoming Loan Requests ({incomingRequests.length})
        </h2>
        {incomingRequests.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-10 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-zinc-600" aria-hidden="true" />
            <p className="font-mono text-xs text-zinc-500">No pending loan requests on your tools.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {incomingRequests.map((loan) => (
              <div
                key={loan.id}
                className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white transition-colors hover:text-cyan-400">
                        {loan.tool.name}
                      </Link>
                      <span className="border border-amber-500/50 bg-amber-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                        REQUESTED
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-zinc-300">
                      Requested by <span className="text-cyan-400">{loan.borrower?.alias}</span>
                      <span className="mx-2 text-zinc-600">•</span>
                      Trust: <span className="text-cyan-400">{loan.borrower?.trustScore}</span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
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
                        className="flex cursor-pointer items-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Approve
                      </button>
                    </form>
                    <form action={loanAction}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <button
                        type="submit"
                        disabled={loanPending}
                        className="flex cursor-pointer items-center gap-2 border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
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
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LOANS // LENT BY YOU</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">
          Tools Currently Lent ({activeLoansAsOwner.length})
        </h2>
        {activeLoansAsOwner.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-10 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-zinc-600" aria-hidden="true" />
            <p className="font-mono text-xs text-zinc-500">None of your tools are out on loan right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoansAsOwner.map((loan) => {
              const overdue = new Date(loan.endDate) < new Date();
              const awaitingPickup = loan.status === "APPROVED";
              return (
                <div
                  key={loan.id}
                  className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white transition-colors hover:text-cyan-400">
                          {loan.tool.name}
                        </Link>
                        {awaitingPickup && (
                          <span className="border border-amber-500/50 bg-amber-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                            Awaiting Pickup
                          </span>
                        )}
                        {overdue && (
                          <span className="flex items-center gap-1 border border-red-500/50 bg-red-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-400">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-zinc-300">
                        {awaitingPickup ? "Reserved for" : "Borrowed by"}{" "}
                        <span className="text-cyan-400">{loan.borrower?.alias}</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        Due {formatDate(loan.endDate)}
                      </p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0 items-center">
                      {awaitingPickup ? (
                        <p className="font-mono text-[11px] text-zinc-500">
                          Approved — the borrower confirms pickup by scanning the tool&apos;s QR
                          label or from their dashboard.
                        </p>
                      ) : (
                        <>
                          <form action={loanAction}>
                            <input type="hidden" name="loanId" value={loan.id} />
                            <input type="hidden" name="decision" value="MARK_RETURNED" />
                            <input type="hidden" name="returnCondition" value="GOOD" />
                            <button
                              type="submit"
                              disabled={loanPending}
                              className="flex cursor-pointer items-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
                              className="flex cursor-pointer items-center gap-2 border border-red-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                              Returned Damaged
                            </button>
                          </form>
                        </>
                      )}
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
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">LOANS // YOUR BORROWS</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">
          Your Active Borrows ({activeLoansAsBorrower.length})
        </h2>
        {activeLoansAsBorrower.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-zinc-600" aria-hidden="true" />
            <p className="mb-4 font-mono text-xs text-zinc-500">You are not borrowing any tools yet.</p>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10"
            >
              <Hammer className="h-4 w-4" aria-hidden="true" />
              Browse Tools
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeLoansAsBorrower.map((loan) => (
              <div
                key={loan.id}
                className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white transition-colors hover:text-cyan-400">
                        {loan.tool.name}
                      </Link>
                      <span
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          loan.status === "ACTIVE"
                            ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400"
                            : "border-amber-500/50 bg-amber-500/5 text-amber-400"
                        }`}
                      >
                        {loan.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-zinc-300">
                      Owner: <span className="text-purple-400">{loan.toolOwner?.alias ?? "Community Member"}</span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      {formatDate(loan.startDate)} → {formatDate(loan.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                    {loan.status === "APPROVED" && (
                      <form action={handoffAction}>
                        <input type="hidden" name="loanId" value={loan.id} />
                        <button
                          type="submit"
                          disabled={handoffPending}
                          className="flex w-full cursor-pointer items-center justify-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                        >
                          {handoffPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          )}
                          Confirm Pickup
                        </button>
                      </form>
                    )}
                    <Link
                      href="/messages"
                      className="flex items-center gap-2 self-start border border-purple-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-purple-400 transition-colors hover:bg-purple-500/10 sm:self-auto"
                    >
                      Message Owner
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trust // Vouch counterparts */}
      <section aria-label="Vouch your counterparts">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">TRUST // VOUCH YOUR COUNTERPARTS</p>
        <h2 className="mb-6 mt-2 text-2xl font-bold text-white tracking-tight">
          Completed Loans Awaiting Your Vouch ({vouchableLoans.length})
        </h2>
        {vouchableLoans.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-zinc-600" aria-hidden="true" />
            <p className="font-mono text-xs text-zinc-500">
              No completed loans are waiting for your vouch.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {vouchableLoans.map((loan) => {
              const counterparty =
                loan.tool.owner.id === user.id ? loan.borrower : loan.tool.owner;
              return (
                <div
                  key={loan.id}
                  className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 transition-colors hover:border-zinc-600"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/tools/${loan.tool.id}`} className="font-semibold text-white transition-colors hover:text-cyan-400">
                          {loan.tool.name}
                        </Link>
                        <span className="border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                          RETURNED
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-zinc-300">
                        Vouch for <span className="text-cyan-400">{counterparty.alias}</span>
                        {loan.returnedAt && (
                          <>
                            <span className="mx-2 text-zinc-600">•</span>
                            Returned {formatDate(loan.returnedAt)}
                          </>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        One decision per loan per direction — vouching adds +{VOUCH_DELTA} to their
                        trust score; declining is final and changes nothing.
                      </p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                      <form action={vouchAction}>
                        <input type="hidden" name="loanId" value={loan.id} />
                        <button
                          type="submit"
                          disabled={vouchPending || declinePending}
                          className="flex cursor-pointer items-center gap-2 border border-emerald-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {vouchPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          )}
                          Vouch +{VOUCH_DELTA}
                        </button>
                      </form>
                      <form action={declineAction}>
                        <input type="hidden" name="loanId" value={loan.id} />
                        <button
                          type="submit"
                          disabled={vouchPending || declinePending}
                          className="flex cursor-pointer items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {declinePending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <X className="h-4 w-4" aria-hidden="true" />
                          )}
                          Decline
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

      {/* Delete Account Confirmation Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} label="Delete account">
        <form action={deleteAccountAction} className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">DELETE ACCOUNT</h3>
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              data-autofocus
              className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-zinc-500 hover:text-white active:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400">
            <p className="font-mono text-xs uppercase tracking-widest">THIS ACTION CANNOT BE UNDONE.</p>
            <p className="text-sm mt-2 text-zinc-400">
              Your account <span className="font-mono">@{user.username}</span>, your {stats.toolsLent}{" "}
              tool(s), {stats.skillsTotal} skill(s), and all loans and messages will be permanently
              purged. Recovery codes become invalid.
            </p>
          </div>

          {deleteAccountState?.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {deleteAccountState.error}
            </div>
          )}

          <div>
            <label htmlFor="delete-password" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Current Password
            </label>
            <input
              type="password"
              id="delete-password"
              name="password"
              autoComplete="current-password"
              required
              className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 focus:outline-none"
              placeholder="Confirm your identity"
            />
          </div>

          <label className="flex items-start gap-2 font-mono text-[11px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              name="acknowledge"
              value="true"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer"
            />
            <span>I authorize permanent deletion of this account and all its data.</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={!acknowledged || deleteAccountPending}
              className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleteAccountPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  DELETING...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  DELETE PERMANENTLY
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
