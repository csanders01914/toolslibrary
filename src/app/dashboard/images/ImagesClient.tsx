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
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Image as ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { deleteImage } from "@/lib/actions/images";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/format";

type ActionState = { success?: boolean; error?: string } | undefined;

interface ImageRow {
  id: string;
  title: string;
  url: string;
  createdAt: Date | string;
}

const actionButton =
  "inline-flex min-h-[44px] items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * One management card per published image. Each card owns its delete action
 * state so pending/error feedback is scoped to the image being deleted,
 * mirroring the per-action useActionState pattern used across the dashboard.
 * The URL is the secret — shown in full so the owner can copy and share it.
 */
function ImageCard({ image }: { image: ImageRow }) {
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteImage, undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // A successful delete removes the row server-side — re-fetch the listing so
  // the card disappears and the header count drops without a full navigation.
  useEffect(() => {
    if (deleteState?.success) {
      setShowDeleteModal(false);
      router.refresh();
    }
  }, [deleteState, router]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable: the URL remains visible
      // and selectable, so no error surface is needed.
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-white truncate">{image.title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-zinc-700 text-zinc-400 whitespace-nowrap">
          {formatDate(image.createdAt)}
        </span>
      </div>

      <div className="mt-3 border border-zinc-900 bg-black p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">SECRET URL</p>
        <p className="font-mono text-xs text-cyan-400 break-all select-all">{image.url}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 mt-auto">
        <button
          type="button"
          onClick={copyUrl}
          className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10`}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy URL"}
        </button>
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open
        </a>
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
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} label={`Delete ${image.title}`}>
        <form action={deleteAction} className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">DELETE IMAGE</h3>
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
              <span className="font-mono text-zinc-300">{image.title}</span> will be permanently removed and its
              secret URL will stop working immediately. Any page still embedding it will show a broken image.
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
              Delete Image
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function ImagesClient({ images }: { images: ImageRow[] }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            PUBLISHED IMAGES // {images.length} LIVE
          </p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Published Images</h1>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Each image lives at an unguessable secret URL — nothing but the image is served there. Share the URL
            with anyone who should see it; delete it here to kill the link.
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
          <Link
            href="/dashboard/images/new"
            className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10`}
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Publish Image
          </Link>
        </div>
      </section>

      {/* Images grid */}
      {images.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-12 text-center">
          <ImageIcon className="h-8 w-8 text-zinc-600 mx-auto" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-4">NO IMAGES PUBLISHED</p>
          <p className="text-sm text-zinc-400 mt-2">Publish an image to get a private, unguessable share URL.</p>
          <Link
            href="/dashboard/images/new"
            className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 mt-6`}
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Publish Image
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {images.map((image) => (
            <ImageCard key={image.id} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}
