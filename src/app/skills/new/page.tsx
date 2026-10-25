"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Wrench, X, Check, Loader2, AlertTriangle } from "lucide-react";
import { SKILL_CATEGORIES } from "@/lib/constants";

export default function NewSkillPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
        <Wrench className="w-16 h-16 mx-auto text-slate-600 mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-slate-400 mb-6">Please sign in to offer a skill to the community.</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200"
        >
          <Wrench className="w-4 h-4" aria-hidden="true" />
          Sign In to Offer Skill
        </a>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Skill name is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }
    if (!category) {
      setError("Please select a category");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("category", category);

    try {
      const res = await fetch("/api/skills/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/skills/${data.skillId}`);
        router.refresh();
      } else {
        setError(data.error || "Failed to create skill listing");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <Wrench className="w-16 h-16 mx-auto text-purple-400 mb-4" aria-hidden="true" />
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-200 to-cyan-400 bg-clip-text text-transparent">
          Offer a Skill
        </h1>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto">
          Share your expertise with the community. List what you can teach or help with, and connect with neighbors who need your skills.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
            Skill Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Small Engine Repair, Python Scripting, Drywall Patching"
            maxLength={100}
            required
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
            Category <span className="text-rose-400">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all cursor-pointer"
          >
            <option value="">Select a category</option>
            {SKILL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
            Description <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your experience, what you can help with, any tools or materials you provide, and any special notes for those seeking help..."
            rows={6}
            maxLength={2000}
            required
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-y min-h-[120px]"
          />
          <p className="mt-1 text-xs text-slate-500 text-right">
            {description.length}/2000 characters (minimum 10)
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 rounded-xl font-medium text-sm bg-slate-800/50 border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Creating Listing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                Create Listing
              </>
            )}
          </button>
        </div>

        {/* Privacy Note */}
        <p className="text-xs text-slate-500 text-center">
          Zero-PII: Only your public alias and trust score are shown. No email, phone, or location shared.
        </p>
      </form>
    </div>
  );
}