"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Wrench, Shield, User, Calendar, MessageSquare, X, Check, AlertTriangle, RotateCcw, Trash2, Eye, EyeOff } from "lucide-react";
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
        <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-sm font-medium">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          Available for Coordination
        </span>
      );
    }
    return (
      <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-500/10 text-slate-300 border border-slate-500/30 text-sm font-medium">
        <EyeOff className="w-4 h-4" aria-hidden="true" />
        Currently Unavailable
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header & Status */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full bg-slate-800/50 text-slate-300 border border-white/10 text-sm font-medium">
            {skill.category}
          </span>
          <span className="text-slate-500 text-sm">Listed {format(new Date(skill.createdAt), "MMM d, yyyy")}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-200 to-cyan-400 bg-clip-text text-transparent">
            {skill.name}
          </h1>
          {getAvailabilityDisplay()}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-400" aria-hidden="true" />
              Description
            </h2>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{skill.description}</p>
          </div>

          {/* Availability Toggle (Owner/Admin only) */}
          {(isOwner || isAdmin) && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                Availability
              </h2>
              <form action={toggleAvailability} className="flex items-center gap-4">
                <input type="hidden" name="skillId" value={skill.id} />
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                    skill.available
                      ? "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-[0_0_20px_rgba(251,113,133,0.4)]"
                      : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  }`}
                >
                  {skill.available ? (
                    <>
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                      Mark Unavailable
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" aria-hidden="true" />
                      Mark Available
                    </>
                  )}
                </button>
                <span className="text-sm text-slate-400">
                  {skill.available ? "You're open to helping neighbors" : "You're not accepting new requests"}
                </span>
              </form>
            </div>
          )}

          {/* Owner Info */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" aria-hidden="true" />
              Provider
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
                <User className="w-7 h-7 text-purple-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-white">{skill.owner.alias}</p>
                <p className="text-sm text-slate-400">Member since {format(new Date(skill.owner.createdAt), "MMM yyyy")}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-medium">
                    <Shield className="w-3 h-3" aria-hidden="true" />
                    Trust Score: {skill.owner.trustScore}
                  </span>
                </div>
              </div>
            </div>
            {skill.owner.bio && (
              <p className="mt-4 text-slate-300 italic">"{skill.owner.bio}"</p>
            )}
            {session && session.user.id !== skill.owner.id && (
              <a
                href={`/messages?to=${skill.owner.id}`}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Message Provider to Coordinate
              </a>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-slate-100 mb-4">Actions</h3>
            <div className="space-y-3">
              {session && session.user.id !== skill.owner.id && skill.available && (
                <a
                  href={`/messages?to=${skill.owner.id}`}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  Message Provider
                </a>
              )}
              {(isOwner || isAdmin) && (
                <a
                  href={`/skills/${skill.id}/edit`}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-slate-800/50 border border-white/10 hover:border-purple-500/30 hover:bg-purple-500/10 text-slate-300 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  Edit Listing
                </a>
              )}
              {(isOwner || isAdmin) && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 text-rose-300 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Delete Listing
                </button>
              )}
            </div>
          </div>

          {/* Skill Details */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="font-semibold text-slate-100 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Category</dt>
                <dd className="text-slate-100 font-medium">{skill.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Status</dt>
                <dd className="text-slate-100 font-medium capitalize">{skill.available ? "available" : "unavailable"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Listed</dt>
                <dd className="text-slate-100 font-medium">{format(new Date(skill.createdAt), "MMM d, yyyy")}</dd>
              </div>
            </dl>
          </div>

          {/* Trust Badge */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-purple-400 mb-3" aria-hidden="true" />
            <p className="text-slate-400 text-sm mb-1">Provider Trust Score</p>
            <p className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {skill.owner.trustScore}
            </p>
            <p className="text-xs text-slate-500 mt-2">Based on community interactions</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-6 w-full max-w-md shadow-[0_0_50px_-12px_rgba(251,113,133,0.25)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Delete Skill Listing</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <p className="font-medium">This action cannot be undone.</p>
                <p className="text-sm mt-1">The skill listing "{skill.name}" will be permanently removed.</p>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-800/50 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 text-slate-300 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-[0_0_20px_rgba(251,113,133,0.4)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Delete Permanently
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