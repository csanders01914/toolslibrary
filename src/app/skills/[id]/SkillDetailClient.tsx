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
import { Eye, EyeOff, MessageSquare, X, AlertTriangle, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  createdAt: Date | string;
  owner: {
    id: string;
    alias: string;
    trustScore: number;
    bio: string | null;
    createdAt: Date | string;
  };
}

interface ToggleAvailabilityAction {
  (formData: FormData): Promise<void>;
}

interface DeleteSkillAction {
  (formData: FormData): Promise<void>;
}

interface SkillDetailClientProps {
  skill: Skill;
  toggleAvailability: ToggleAvailabilityAction;
  deleteSkill: DeleteSkillAction;
}

const formatVouch = (trustScore: number) => {
  const vouch = trustScore - 100;
  return vouch >= 0 ? `+${vouch}` : `${vouch}`;
};

export default function SkillDetailClient({ skill, toggleAvailability, deleteSkill }: SkillDetailClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isOwner = session?.user?.id === skill.owner.id;
  const isAdmin = session?.user?.role === "ADMIN";

  const handleToggleAvailability = async () => {
    const formData = new FormData();
    formData.append("skillId", skill.id);
    await toggleAvailability(formData);
    router.refresh();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");

    const formData = new FormData();
    formData.append("skillId", skill.id);

    try {
      const res = await fetch("/api/skills/delete", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        router.push("/skills");
        router.refresh();
      } else {
        setDeleteError(data.error || "Failed to delete skill");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getAvailabilityDisplay = () => {
    if (skill.available) {
      return (
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-emerald-500/50 text-emerald-400">
          <span className="w-1.5 h-1.5 bg-emerald-400" aria-hidden="true" />
          OFFERED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-zinc-700 text-zinc-500">
        <EyeOff className="w-3 h-3" aria-hidden="true" />
        UNAVAILABLE
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header: title + spec sheet */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-purple-500/50 text-purple-400">
            {skill.category}
          </span>
          {getAvailabilityDisplay()}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">{skill.name}</h1>
        </div>
        <div className="font-mono text-xs space-y-1 pt-3 border-t border-zinc-900">
          <p>
            <span className="text-zinc-500">OWNER: </span>
            <span className="text-zinc-300">{skill.owner.alias}</span>
          </p>
          <p>
            <span className="text-zinc-500">STATUS: </span>
            {skill.available ? (
              <span className="text-emerald-400">OFFERED</span>
            ) : (
              <span className="text-zinc-500">UNAVAILABLE</span>
            )}
          </p>
          <p>
            <span className="text-zinc-500">VOUCH: </span>
            <span className="text-emerald-400">{formatVouch(skill.owner.trustScore)}</span>
          </p>
          <p>
            <span className="text-zinc-500">LISTED: </span>
            <span className="text-zinc-300">{format(new Date(skill.createdAt), "yyyy-MM-dd")}</span>
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-3">DESCRIPTION</h2>
            <p className="text-zinc-400 whitespace-pre-wrap leading-relaxed">{skill.description}</p>
          </div>

          {/* Availability Toggle (Owner/Admin only) */}
          {(isOwner || isAdmin) && (
            <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-4">AVAILABILITY</h2>
              <form action={toggleAvailability} className="flex flex-wrap items-center gap-4">
                <input type="hidden" name="skillId" value={skill.id} />
                <button
                  type="submit"
                  className={`font-mono text-xs uppercase tracking-widest px-4 py-2 border transition-colors cursor-pointer inline-flex items-center gap-2 ${
                    skill.available
                      ? "border-red-500/60 text-red-400 hover:bg-red-500/10"
                      : "border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                >
                  {skill.available ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      MARK UNAVAILABLE
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      MARK AVAILABLE
                    </>
                  )}
                </button>
                <span className="font-mono text-xs text-zinc-500">
                  {skill.available ? "You're open to helping neighbors" : "You're not accepting new requests"}
                </span>
              </form>
            </div>
          )}

          {/* Owner Info */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-4">OWNER</h2>
            <div className="font-mono text-xs space-y-1">
              <p>
                <span className="text-zinc-500">ALIAS: </span>
                <span className="text-zinc-200">{skill.owner.alias}</span>
              </p>
              <p>
                <span className="text-zinc-500">MEMBER SINCE: </span>
                <span className="text-zinc-300">{format(new Date(skill.owner.createdAt), "MMM yyyy")}</span>
              </p>
              <p>
                <span className="text-zinc-500">TRUST SCORE: </span>
                <span className="text-emerald-400">{skill.owner.trustScore}</span>
              </p>
            </div>
            {skill.owner.bio && (
              <p className="mt-4 text-sm text-zinc-400 italic">&quot;{skill.owner.bio}&quot;</p>
            )}
            {session && session.user.id !== skill.owner.id && (
              <a
                href={`/messages?to=${skill.owner.id}`}
                className="mt-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                MESSAGE NEIGHBOR TO COORDINATE
              </a>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-4">ACTIONS</h3>
            <div className="space-y-3">
              {session && session.user.id !== skill.owner.id && skill.available && (
                <a
                  href={`/messages?to=${skill.owner.id}`}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  MESSAGE OWNER
                </a>
              )}
              {(isOwner || isAdmin) && (
                <a
                  href={`/skills/${skill.id}/edit`}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  EDIT LISTING
                </a>
              )}
              {(isOwner || isAdmin) && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  DELETE LISTING
                </button>
              )}
            </div>
          </div>

          {/* Skill Details */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-4">DETAILS</h3>
            <dl className="font-mono text-xs space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">CATEGORY</dt>
                <dd className="text-zinc-300">{skill.category}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">STATUS</dt>
                <dd className="text-zinc-300">{skill.available ? "OFFERED" : "UNAVAILABLE"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">LISTED</dt>
                <dd className="text-zinc-300">{format(new Date(skill.createdAt), "MMM d, yyyy")}</dd>
              </div>
            </dl>
          </div>

          {/* Trust */}
          <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">OWNER TRUST SCORE</p>
            <p className="font-mono text-3xl font-bold text-white">{skill.owner.trustScore}</p>
            <p className="font-mono text-[11px] text-zinc-500 mt-2">BASED ON COMMUNITY INTERACTIONS</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0a0a0a] border border-red-500/50 rounded-none p-6 w-full max-w-md" role="dialog" aria-modal="true" aria-label="Delete skill listing">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">DELETE SKILL LISTING</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400">
                <p className="font-mono text-xs uppercase tracking-widest">THIS ACTION CANNOT BE UNDONE.</p>
                <p className="text-sm mt-2 text-zinc-400">
                  The skill listing &quot;{skill.name}&quot; will be permanently removed.
                </p>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
