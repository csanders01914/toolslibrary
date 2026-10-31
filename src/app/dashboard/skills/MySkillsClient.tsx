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
import { AlertTriangle, ArrowLeft, Loader2, Pencil, Trash2, Wrench, X } from "lucide-react";
import { deleteSkill, toggleSkillAvailability } from "@/lib/actions/skills";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/format";

type ActionState = { success?: boolean; error?: string } | undefined;

interface SkillRow {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  createdAt: Date | string;
}

const actionButton =
  "inline-flex min-h-[44px] items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * One management card per listed skill. Each card owns its toggle and delete
 * action state so pending/error feedback is scoped to the skill being acted
 * on, mirroring the per-action useActionState pattern used across the
 * dashboard.
 */
function SkillCard({ skill }: { skill: SkillRow }) {
  const [toggleState, toggleAction, togglePending] = useActionState<ActionState, FormData>(
    toggleSkillAvailability,
    undefined
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteSkill, undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();

  // Availability flips and deletions change the server-rendered listing —
  // re-fetch so the card (and the header count) reflects the new state.
  useEffect(() => {
    if (toggleState?.success) {
      router.refresh();
    }
  }, [toggleState, router]);

  useEffect(() => {
    if (deleteState?.success) {
      setShowDeleteModal(false);
      router.refresh();
    }
  }, [deleteState, router]);

  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-white truncate">
          <Link href={`/skills/${skill.id}`} className="hover:text-purple-400 transition-colors">
            {skill.name}
          </Link>
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-purple-500/50 text-purple-400 whitespace-nowrap">
          {skill.category}
        </span>
      </div>

      <p className="text-sm text-zinc-400 line-clamp-2 mt-2">{skill.description}</p>

      <div className="font-mono text-xs space-y-1 pt-3 mt-3 border-t border-zinc-900">
        <p>
          <span className="text-zinc-500">LISTED: </span>
          <span className="text-zinc-300">{formatDate(skill.createdAt)}</span>
        </p>
        <p>
          <span className="text-zinc-500">STATUS: </span>
          {skill.available ? (
            <span className="text-emerald-400">OFFERED</span>
          ) : (
            <span className="text-zinc-500">UNAVAILABLE</span>
          )}
        </p>
      </div>

      {toggleState?.error && (
        <div
          className="mt-3 p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2"
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {toggleState.error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-4 mt-auto">
        <Link href={`/skills/${skill.id}`} className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}>
          View
        </Link>
        <Link href={`/skills/${skill.id}/edit`} className={`${actionButton} border-purple-500/60 text-purple-400 hover:bg-purple-500/10`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
        <form action={toggleAction}>
          <input type="hidden" name="skillId" value={skill.id} />
          <button
            type="submit"
            disabled={togglePending}
            className={`${actionButton} border-amber-500/60 text-amber-400 hover:bg-amber-500/10`}
          >
            {togglePending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {skill.available ? "Mark Unavailable" : "Mark Offered"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className={`${actionButton} border-red-500/60 text-red-400 hover:bg-red-500/10`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>

      {/* Delete confirmation */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} label={`Delete ${skill.name}`}>
        <form action={deleteAction} className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">DELETE SKILL</h3>
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
              <span className="font-mono text-zinc-300">{skill.name}</span> will be permanently removed from the skill
              exchange.
            </p>
          </div>

          {deleteState?.error && (
            <div
              className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {deleteState.error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deletePending}
              className={`${actionButton} border-red-500/60 text-red-400 hover:bg-red-500/10`}
            >
              {deletePending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              Delete Skill
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function MySkillsClient({ skills }: { skills: SkillRow[] }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400">
            MY SKILLS // {skills.length} LISTED
          </p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">My Skills</h1>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Every skill you have offered to the exchange — add more, pause, or remove listings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <Link href="/skills/new" className={`${actionButton} border-purple-500/60 text-purple-400 hover:bg-purple-500/10`}>
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Offer a Skill
          </Link>
        </div>
      </section>

      {/* Skills grid */}
      {skills.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-12 text-center">
          <Wrench className="h-8 w-8 text-zinc-600 mx-auto" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-4">NO SKILLS LISTED</p>
          <p className="text-sm text-zinc-400 mt-2">Offer your first skill so neighbors can learn from you.</p>
          <Link
            href="/skills/new"
            className={`${actionButton} border-purple-500/60 text-purple-400 hover:bg-purple-500/10 mt-6`}
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Offer a Skill
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
