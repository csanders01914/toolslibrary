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
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { updateSkill } from "@/lib/actions/skills";
import { SKILL_CATEGORIES } from "@/lib/constants";

type ActionState = { success?: boolean; error?: string; skillId?: string } | undefined;

interface SkillEditClientProps {
  skill: {
    id: string;
    name: string;
    description: string;
    category: string;
  };
}

export default function SkillEditClient({ skill }: SkillEditClientProps) {
  const router = useRouter();

  const [updateState, updateAction, updatePending] = useActionState<ActionState, FormData>(updateSkill, undefined);

  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [category, setCategory] = useState(skill.category);

  useEffect(() => {
    if (updateState?.success && updateState.skillId) {
      router.push(`/skills/${updateState.skillId}`);
      router.refresh();
    }
  }, [updateState, router]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-3">EDIT LISTING</p>
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Edit Skill</h1>
        <p className="mt-3 text-zinc-400 max-w-xl">
          Update what you offer to the community. Availability is managed from the listing page.
        </p>
      </div>

      {/* Edit Form */}
      <form action={updateAction} className="space-y-6">
        <input type="hidden" name="skillId" value={skill.id} />

        {updateState?.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs" role="alert">
            {updateState.error}
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
            maxLength={100}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
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
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 focus:border-purple-500 focus:outline-none appearance-none cursor-pointer"
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
            rows={6}
            maxLength={2000}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none resize-y min-h-[120px]"
          />
          <p className="mt-1 font-mono text-[11px] text-zinc-500 text-right">
            {description.length}/2000 characters (minimum 10)
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.push(`/skills/${skill.id}`)}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={updatePending}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {updatePending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                SAVING...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                SAVE CHANGES
              </>
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
