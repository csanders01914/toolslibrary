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
import { Loader2 } from "lucide-react";
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
      <div className="text-center py-16 bg-[#0a0a0a] border border-zinc-800">
        <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-zinc-400 mb-6">Please sign in to offer a skill to the community.</p>
        <a
          href="/login"
          className="inline-block font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
        >
          SIGN IN TO OFFER SKILL
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
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-3">NEW LISTING</p>
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Offer a Skill</h1>
        <p className="mt-3 text-zinc-400 max-w-xl">
          Share your expertise with the community. List what you can teach or help with, and connect
          with neighbors who need your skills.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs" role="alert">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            SKILL NAME <span className="text-red-400">*</span>
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
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            CATEGORY <span className="text-red-400">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 focus:border-purple-500 focus:outline-none appearance-none cursor-pointer"
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
          <label htmlFor="description" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            DESCRIPTION <span className="text-red-400">*</span>
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
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none resize-y min-h-[120px]"
          />
          <p className="mt-1 font-mono text-[11px] text-zinc-500 text-right">
            {description.length}/2000 characters (minimum 10)
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                CREATING LISTING...
              </>
            ) : (
              "CREATE LISTING"
            )}
          </button>
        </div>

        {/* Privacy Note */}
        <p className="font-mono text-[11px] text-zinc-500 text-center">
          ZERO-PII: Only your public alias and trust score are shown. No email, phone, or location shared.
        </p>
      </form>
    </div>
  );
}
