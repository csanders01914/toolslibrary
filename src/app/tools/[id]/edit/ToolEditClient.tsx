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
import { AlertTriangle, Loader2, Save, Trash2, X } from "lucide-react";
import { updateTool, deleteTool } from "@/lib/actions/tools";
import { CATEGORIES } from "@/lib/constants";
import { Modal } from "@/components/ui/Modal";

type ActionState = { success?: boolean; error?: string; toolId?: string } | undefined;

interface ToolEditClientProps {
  tool: {
    id: string;
    name: string;
    description: string;
    category: string;
    status: string;
    imageUrl: string | null;
  };
}

export default function ToolEditClient({ tool }: ToolEditClientProps) {
  const router = useRouter();

  const [updateState, updateAction, updatePending] = useActionState<ActionState, FormData>(updateTool, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteTool, undefined);

  const [name, setName] = useState(tool.name);
  const [description, setDescription] = useState(tool.description);
  const [category, setCategory] = useState(tool.category);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(tool.imageUrl ? `/api/uploads/${tool.imageUrl}` : null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const onLoan = tool.status === "BORROWED";

  useEffect(() => {
    if (updateState?.success && updateState.toolId) {
      router.push(`/tools/${updateState.toolId}`);
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (deleteState?.success) {
      router.push("/tools");
      router.refresh();
    }
  }, [deleteState, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setImageError("Image must be less than 5MB");
        return;
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setImageError("Invalid image type. Use JPEG, PNG, GIF, or WebP");
        return;
      }
      setImage(file);
      setImageRemoved(false);
      setImageError("");
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview(tool.imageUrl ? `/api/uploads/${tool.imageUrl}` : null);
    setImageRemoved(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-3">EDIT LISTING</p>
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Edit Tool</h1>
        <p className="mt-3 text-zinc-400 max-w-xl">
          Update the listing details, replace the photo, or remove the listing from the library.
        </p>
      </div>

      {onLoan && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/50 text-amber-400 font-mono text-xs flex items-start gap-2" role="status">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            This tool is on an active loan. You can update the listing details, but deletion stays
            locked until the loan is resolved.
          </p>
        </div>
      )}

      {/* Edit Form */}
      <form action={updateAction} className="space-y-6">
        <input type="hidden" name="toolId" value={tool.id} />
        <input type="hidden" name="removeImage" value={imageRemoved ? "true" : "false"} />

        {(updateState?.error || imageError) && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs" role="alert">
            {updateState?.error || imageError}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            TOOL NAME <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
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
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
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
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-y min-h-[120px]"
          />
          <p className="mt-1 font-mono text-[11px] text-zinc-500 text-right">
            {description.length}/2000 characters (minimum 10)
          </p>
        </div>

        {/* Photo — the file input stays mounted so a selected file always
            reaches the server action; the preview renders above it. */}
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            TOOL PHOTO (OPTIONAL, MAX 5MB)
          </span>
          <div className="border border-zinc-800 bg-black">
            {imagePreview && (
              <div className="relative">
                <img src={imagePreview} alt="Photo preview" className="w-full h-auto object-contain max-h-64" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-2 bg-black border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  aria-label={image ? "Remove selected photo" : "Remove existing photo"}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className={`relative w-full h-24 flex flex-col items-center justify-center text-center ${imagePreview ? "border-t border-zinc-800" : "h-40"}`}>
              <p className="font-mono text-xs text-zinc-400">
                {imagePreview ? "CLICK TO REPLACE" : "CLICK TO UPLOAD"}
              </p>
              <p className="font-mono text-[11px] text-zinc-600 mt-1">JPEG, PNG, GIF, WebP · MAX 5MB</p>
              <input
                id="image-upload"
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Upload tool photo"
              />
            </div>
          </div>
          {tool.imageUrl && !imageRemoved && !image && (
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              Current photo is kept unless you remove or replace it.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.push(`/tools/${tool.id}`)}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={updatePending}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </form>

      {/* Danger Zone */}
      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400 mb-2">DANGER ZONE</h2>
        <p className="font-mono text-[11px] text-zinc-500 mb-4">
          Permanently remove this listing from the library. Loan history for this tool is purged with it.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          disabled={onLoan}
          title={onLoan ? "Resolve the active loan first" : undefined}
          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          Delete Listing
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} label="Delete tool listing">
        <form action={deleteAction} className="space-y-4">
          <input type="hidden" name="toolId" value={tool.id} />
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">DELETE TOOL LISTING</h3>
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
              The tool listing &quot;{tool.name}&quot; and its loan history will be permanently removed.
            </p>
          </div>

          {deleteState?.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {deleteState.error}
            </div>
          )}

          <label className="flex items-start gap-2 font-mono text-[11px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer"
            />
            <span>I authorize permanent deletion of this listing.</span>
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
              disabled={!acknowledged || deletePending}
              className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deletePending ? (
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
