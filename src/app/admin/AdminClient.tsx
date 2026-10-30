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
  Shield,
  ShieldCheck,
  Save,
  Minus,
  Plus,
  LifeBuoy,
  Trash2,
} from "lucide-react";
import {
  updateUserRole,
  adjustTrustScore,
  setToolStatus,
  deleteUser,
  type AdminActionState,
} from "@/lib/actions/admin";
import {
  resolveHelpRequestAction,
  clearHelpQueueAction,
  type HelpActionState,
} from "@/lib/actions/help";
// Type-only import from the client-safe contract module (see
// src/lib/canaryShared.ts header): the server module "@/lib/canary" must
// never enter the client bundle.
import type {
  CanaryEventPublic,
  CanaryPendingPublic,
  CanaryStatus,
} from "@/lib/canaryShared";
import {
  chip,
  StatusChip,
  formatDate,
  formatTime,
  type ToolRow,
  type SkillRow,
} from "./AdminShared";

// ================================================================
// Admin Command Console — terminal aesthetic.
// Sections: telemetry, HELP QUEUE (triage outcomes), moderation
// queues, member governance.
// ================================================================

interface UserRow {
  id: string;
  username: string;
  alias: string;
  role: string;
  trustScore: number;
  banned: boolean;
  toolCount: number;
  skillCount: number;
  createdAt: Date;
}

interface HelpRequestRow {
  id: string;
  alias: string | null;
  category: string;
  message: string;
  urgency: string;
  route: string;
  triageReason: string;
  confidence: number;
  status: string;
  resolution: string | null;
  createdAt: Date;
}

interface Stats {
  totalMembers: number;
  totalTools: number;
  availableTools: number;
  borrowedTools: number;
  maintenanceTools: number;
  activeLoans: number;
  skillsCount: number;
}

interface AdminClientProps {
  currentUserId: string;
  stats: Stats;
  auditTools: ToolRow[];
  auditSkills: SkillRow[];
  users: UserRow[];
  helpRequests: HelpRequestRow[];
  // PHASE_30: warrant-canary strip state (public data, safe to render).
  canary: {
    status: CanaryStatus;
    latest: CanaryEventPublic | null;
    pending: CanaryPendingPublic | null;
  };
}

type ActionState = AdminActionState;

// ---- Help queue purge control (destructive, confirmation-gated) ----

function ClearAllQueueControl({
  total,
  clearAction,
  clearPending,
}: {
  total: number;
  clearAction: (formData: FormData) => void;
  clearPending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        Clear All ({total})
      </button>
    );
  }

  return (
    <form action={clearAction} className="space-y-2 min-w-[260px]">
      <input type="hidden" name="scope" value="ALL" />
      <p className="font-mono text-[10px] text-red-400 leading-relaxed">
        PERMANENT: purges all {total} ticket(s), open and closed, including triage outcomes and
        resolutions. Cannot be undone.
      </p>
      <label className="flex items-start gap-2 font-mono text-[10px] text-zinc-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer"
        />
        <span>I authorize permanent deletion of every help queue ticket.</span>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!acknowledged || clearPending}
          className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {clearPending ? "Clearing..." : "Confirm Clear All"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setAcknowledged(false);
          }}
          className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:border-zinc-500 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---- Member deletion control (destructive, confirmation-gated) ----

function DeleteUserControl({
  user,
  deleteAction,
  deletePending,
}: {
  user: UserRow;
  deleteAction: (formData: FormData) => void;
  deletePending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        Delete
      </button>
    );
  }

  return (
    <form action={deleteAction} className="space-y-2 min-w-[260px]">
      <input type="hidden" name="userId" value={user.id} />
      <p className="font-mono text-[10px] text-red-400 leading-relaxed">
        PERMANENT: deletes @{user.username}, their {user.toolCount} tool(s), {user.skillCount}{" "}
        skill(s), and all their loans and messages. Cannot be undone.
      </p>
      <label className="flex items-start gap-2 font-mono text-[10px] text-zinc-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer"
        />
        <span>I authorize permanent deletion of this member and all their data.</span>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!acknowledged || deletePending}
          className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deletePending ? "Deleting..." : "Confirm Delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setAcknowledged(false);
          }}
          className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:border-zinc-500 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ================================================================

export default function AdminClient({
  currentUserId,
  stats,
  auditTools,
  auditSkills,
  users,
  helpRequests,
  canary,
}: AdminClientProps) {
  const router = useRouter();

  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(updateUserRole, undefined);
  const [trustState, trustAction, trustPending] = useActionState<ActionState, FormData>(adjustTrustScore, undefined);
  const [statusState, statusAction, statusPending] = useActionState<ActionState, FormData>(setToolStatus, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteUser, undefined);
  const [resolveState, resolveAction, resolvePending] = useActionState<HelpActionState, FormData>(
    resolveHelpRequestAction,
    undefined
  );
  const [clearState, clearAction, clearPending] = useActionState<HelpActionState, FormData>(
    clearHelpQueueAction,
    undefined
  );

  // Refresh server data after help queue and member governance actions.
  useEffect(() => {
    if (resolveState?.success || clearState?.success || deleteState?.success) {
      router.refresh();
    }
  }, [resolveState, clearState, deleteState, router]);

  // ---------------- Derived ----------------

  const statCards = [
    { label: "MEMBERS", value: stats.totalMembers, accent: "text-cyan-400" },
    { label: "TOOLS", value: stats.totalTools, accent: "text-purple-400" },
    { label: "ACTIVE LOANS", value: stats.activeLoans, accent: "text-emerald-400" },
    { label: "SKILLS", value: stats.skillsCount, accent: "text-red-400" },
  ];

  const moderationError =
    roleState?.error || trustState?.error || statusState?.error || deleteState?.error;
  const moderationSuccess =
    (roleState?.success || trustState?.success || statusState?.success || deleteState?.success) &&
    !moderationError;
  const moderationDetail = deleteState?.detail;

  const openHelp = helpRequests.filter((r) => r.status === "OPEN");
  const closedHelp = helpRequests.filter((r) => r.status === "RESOLVED");

  // PHASE_30: warrant-canary strip presentation, derived from DB truth.
  const canaryChip =
    canary.status === "INTACT"
      ? "green"
      : canary.status === "DISCLOSED"
        ? "red"
        : "amber";
  const canaryLabel =
    canary.status === "INTACT"
      ? `INTACT UNTIL ${canary.latest?.expiresAt ? formatDate(canary.latest.expiresAt) : "—"}`
      : canary.status === "STALE"
        ? "STALE — RE-AFFIRM REQUIRED"
        : canary.status === "DISCLOSED"
          ? "DISCLOSED"
          : "NEVER AFFIRMED";
  const canaryBorder =
    canary.status === "INTACT"
      ? "border-emerald-500/50"
      : canary.status === "DISCLOSED"
        ? "border-red-500/50"
        : "border-amber-500/50";

  const renderToolCard = (tool: ToolRow) => {
    return (
      <div key={tool.id} className="bg-[#0a0a0a] border border-zinc-800 p-5 transition-colors hover:border-zinc-600">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Link href={`/tools/${tool.id}`} className="font-semibold text-white hover:text-cyan-400 transition-colors">
              {tool.name}
            </Link>
            <p className="font-mono text-[11px] text-zinc-500 mt-1">
              {tool.category} · OWNER: <span className="text-zinc-300">{tool.owner.alias}</span> · TRUST:{" "}
              {tool.owner.trustScore}
            </p>
          </div>
          <StatusChip value={tool.status} />
        </div>

        <div className="mt-4 flex gap-3 flex-wrap">
          {tool.status !== "BORROWED" && (
            <>
              <form action={statusAction}>
                <input type="hidden" name="toolId" value={tool.id} />
                <input type="hidden" name="status" value="AVAILABLE" />
                <button
                  type="submit"
                  disabled={statusPending}
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set Available
                </button>
              </form>
              <form action={statusAction}>
                <input type="hidden" name="toolId" value={tool.id} />
                <input type="hidden" name="status" value="MAINTENANCE" />
                <button
                  type="submit"
                  disabled={statusPending}
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lock for Maintenance
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSkillCard = (skill: SkillRow) => {
    return (
      <div key={skill.id} className="bg-[#0a0a0a] border border-zinc-800 p-5 transition-colors hover:border-zinc-600">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Link href={`/skills/${skill.id}`} className="font-semibold text-white hover:text-purple-400 transition-colors">
              {skill.name}
            </Link>
            <p className="font-mono text-[11px] text-zinc-500 mt-1">
              {skill.category} · OWNER: <span className="text-zinc-300">{skill.owner.alias}</span> · TRUST:{" "}
              {skill.owner.trustScore}
            </p>
          </div>
          <StatusChip value={skill.available ? "OFFERED" : "PAUSED"} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2">
            ADMIN // COMMAND CONSOLE
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Fleet telemetry, moderation, and member governance.
          </h1>
        </div>
        <span className={`self-start ${chip("red")} px-3 py-1`}>
          <Shield className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
          ADMIN
        </span>
      </section>

      {/* Warrant canary strip (PHASE_30) — status must be visible on the
          console without visiting the canary page: a STALE or DISCLOSED
          canary is exactly the thing an operator cannot afford to miss. */}
      <section aria-label="Warrant canary status">
        <div className={`flex flex-wrap items-center justify-between gap-3 border bg-[#0a0a0a] p-4 ${canaryBorder}`}>
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              WARRANT CANARY:
            </span>
            <span className={chip(canaryChip)}>{canaryLabel}</span>
            {canary.pending && <span className={chip("amber")}>AWAITING EMAIL APPROVAL</span>}
          </div>
          <Link
            href="/admin/canary"
            className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            Update canary
          </Link>
        </div>
      </section>

      {/* Telemetry */}
      <section aria-label="Fleet telemetry">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-[#0a0a0a] border border-zinc-800 p-5">
              <p className={`font-mono text-3xl font-bold ${card.accent}`}>{card.value}</p>
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mt-2">{card.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            AVAILABLE: <span className="text-emerald-400">{stats.availableTools}</span>
          </span>
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            BORROWED: <span className="text-red-400">{stats.borrowedTools}</span>
          </span>
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            MAINTENANCE: <span className="text-amber-400">{stats.maintenanceTools}</span>
          </span>
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            MEMBERS: <span className="text-cyan-400">{stats.totalMembers}</span>
          </span>
        </div>
      </section>

      {/* Action feedback */}
      {(moderationError || moderationSuccess) && (
        <div
          role="status"
          className={`px-4 py-3 border font-mono text-xs ${
            moderationError
              ? "border-red-500/50 text-red-400 bg-red-500/5"
              : "border-emerald-500/50 text-emerald-400 bg-emerald-500/5"
          }`}
        >
          {moderationError || moderationDetail || "Action applied successfully."}
        </div>
      )}

      {/* HELP QUEUE */}
      <section aria-label="Help request queue">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-1">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2 mb-1">
                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                HELP QUEUE — TRIAGE OUTCOMES
              </h2>
              <p className="font-mono text-[11px] text-zinc-500">
                Requests are triaged automatically and routed here when a person needs to review them.
              </p>
            </div>
            {helpRequests.length > 0 && (
              <div className="flex gap-2 flex-wrap shrink-0">
                {closedHelp.length > 0 && (
                  <form action={clearAction}>
                    <input type="hidden" name="scope" value="CLOSED" />
                    <button
                      type="submit"
                      disabled={clearPending}
                      className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:border-emerald-500/60 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {clearPending ? "..." : `Clear Closed (${closedHelp.length})`}
                    </button>
                  </form>
                )}
                <ClearAllQueueControl
                  total={helpRequests.length}
                  clearAction={clearAction}
                  clearPending={clearPending}
                />
              </div>
            )}
          </div>

          {(resolveState?.error || clearState?.error) && (
            <p role="status" className="mb-4 px-4 py-3 border border-red-500/50 text-red-400 bg-red-500/5 font-mono text-xs">
              {resolveState?.error || clearState?.error}
            </p>
          )}
          {(resolveState?.success || clearState?.success) && (
            <p role="status" className="mb-4 px-4 py-3 border border-emerald-500/50 text-emerald-400 bg-emerald-500/5 font-mono text-xs">
              {clearState?.detail || "Help queue updated."}
            </p>
          )}

          {openHelp.length === 0 ? (
            <p className="font-mono text-[11px] text-zinc-600">No open help requests.</p>
          ) : (
            <div className="space-y-4">
              {openHelp.map((request) => (
                <div key={request.id} className="border border-zinc-800 bg-black p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-zinc-500">TICKET {request.id.slice(0, 10)}</span>
                    <StatusChip value={request.category} />
                    <StatusChip value={request.route} />
                    <StatusChip value={request.urgency} />
                    <StatusChip value={request.status} />
                    <span className="font-mono text-[10px] text-zinc-600">
                      CONF {Math.round(request.confidence * 100)}% · {formatTime(request.createdAt)}
                      {request.alias ? ` · ${request.alias}` : " · guest"}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-600">{request.triageReason}</p>
                  <p className="text-sm text-zinc-300">{request.message}</p>
                  {request.resolution && (
                    <p className="font-mono text-[11px] text-emerald-400 border-l-2 border-emerald-500/50 pl-3">
                      {request.resolution}
                    </p>
                  )}
                  {request.status !== "RESOLVED" && (
                    <div className="space-y-3">
                      <form action={resolveAction} className="space-y-2">
                        <input type="hidden" name="requestId" value={request.id} />
                        <label htmlFor={`resolution-${request.id}`} className="sr-only">
                          Resolution for ticket {request.id}
                        </label>
                        <textarea
                          id={`resolution-${request.id}`}
                          name="resolution"
                          rows={2}
                          maxLength={2000}
                          required
                          placeholder="Resolution note (min 10 chars)..."
                          className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-none"
                        />
                        <button
                          type="submit"
                          disabled={resolvePending}
                          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {resolvePending ? "..." : "Resolve"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {closedHelp.length > 0 && (
            <div className="mt-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">CLOSED TICKETS</p>
              <ul className="space-y-1">
                {closedHelp.map((request) => (
                  <li key={request.id} className="font-mono text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
                    <StatusChip value={request.status} />
                    <span className="text-zinc-400">{request.category}</span>
                    <span>{request.id.slice(0, 10)}</span>
                    <span>{formatTime(request.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Moderation Queue — Tools */}
      <section aria-label="Tool moderation queue">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-6">
          TOOL MODERATION QUEUE ({auditTools.length})
        </h2>
        {auditTools.length === 0 ? (
          <div className="py-10 bg-[#0a0a0a] border border-zinc-800 text-center">
            <p className="font-mono text-[11px] text-zinc-600">No tool listings to moderate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {auditTools.map(renderToolCard)}
          </div>
        )}
      </section>

      {/* Moderation Queue — Skills */}
      <section aria-label="Skill moderation queue">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-6">
          SKILL MODERATION QUEUE ({auditSkills.length})
        </h2>
        {auditSkills.length === 0 ? (
          <div className="py-10 bg-[#0a0a0a] border border-zinc-800 text-center">
            <p className="font-mono text-[11px] text-zinc-600">No skill listings to moderate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {auditSkills.map(renderSkillCard)}
          </div>
        )}
      </section>

      {/* User Management */}
      <section aria-label="User role and trust score management">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-6">
          MEMBER GOVERNANCE ({users.length})
        </h2>
        <div className="bg-[#0a0a0a] border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Member</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Handle</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Joined</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Trust</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Role</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">{user.alias}</span>
                    {user.banned && (
                      <span className={`ml-2 ${chip("red")}`}>BANNED</span>
                    )}
                    {user.id === currentUserId && (
                      <span className={`ml-2 ${chip("cyan")}`}>you</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">@{user.username}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-zinc-500">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-semibold ${
                          user.trustScore >= 90
                            ? "text-emerald-400"
                            : user.trustScore >= 60
                              ? "text-cyan-400"
                              : "text-red-400"
                        }`}
                      >
                        {user.trustScore}
                      </span>
                      <form action={trustAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="delta" value="-5" />
                        <button
                          type="submit"
                          disabled={trustPending}
                          aria-label={`Decrease trust score for ${user.alias} by 5`}
                          className="w-11 h-11 border border-red-500/60 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>
                      <form action={trustAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="delta" value="5" />
                        <button
                          type="submit"
                          disabled={trustPending}
                          aria-label={`Increase trust score for ${user.alias} by 5`}
                          className="w-11 h-11 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.id === currentUserId ? (
                      <span className={chip("red")}>{user.role}</span>
                    ) : (
                      <form action={roleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label htmlFor={`role-${user.id}`} className="sr-only">
                          Role for {user.alias}
                        </label>
                        <select
                          id={`role-${user.id}`}
                          name="role"
                          defaultValue={user.role}
                          className="bg-black border border-zinc-800 px-3 py-2 min-h-[44px] font-mono text-base text-zinc-100 focus:border-cyan-500 focus:outline-none cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <button
                          type="submit"
                          disabled={rolePending}
                          className="font-mono text-xs uppercase tracking-widest px-3 min-h-[44px] border border-zinc-700 text-zinc-400 hover:border-cyan-500/60 hover:text-cyan-400 active:text-cyan-400 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" aria-hidden="true" />
                          Save
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.id === currentUserId || user.role === "ADMIN" ? (
                      <span className="font-mono text-[11px] text-zinc-600" title="Administrators cannot be deleted directly — demote to USER first">
                        —
                      </span>
                    ) : (
                      <DeleteUserControl user={user} deleteAction={deleteAction} deletePending={deletePending} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
