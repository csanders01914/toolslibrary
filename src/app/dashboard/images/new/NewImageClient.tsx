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
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import PhotoUpload from "@/components/tools/PhotoUpload";

interface PublishResult {
  path: string;
  url: string;
}

const actionButton =
  "inline-flex min-h-[44px] items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Publish form for secret-link images. Submits raw multipart FormData to the
 * REST route handler /api/images/create — the same fetch-based pattern as the
 * tool photo surfaces, because the Cloudflare Tunnel edge rejects
 * multi-megabyte multipart POSTs aimed at Server Action endpoints with an
 * instant 403 (PHASE_31). On success the generated /i/<token> URL is shown
 * with copy/open controls; the token is generated server-side and revealed
 * exactly once here, then only ever on the management dashboard.
 */
export default function NewImageClient() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setTitle("");
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  const copyUrl = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(published.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: the URL remains visible and selectable.
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError("Choose an image to publish");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("image", file);

      const response = await fetch("/api/images/create", { method: "POST", body: formData });
      const data = (await response.json()) as { success?: boolean; error?: string; path?: string };

      if (!response.ok || !data.success || !data.path) {
        setError(data.error ?? "Publishing failed — try again");
        return;
      }

      // The success panel only renders after this user event, so reading
      // window.location here is safe (no SSR/hydration concern).
      setPublished({ path: data.path, url: `${window.location.origin}${data.path}` });
    } catch {
      setError("Publishing failed — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">PUBLISH IMAGE // SECRET LINK</p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">Publish an Image</h1>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            The image becomes reachable only at an unguessable random URL that serves nothing but the image — no
            page chrome, no title, no index. The URL is never listed anywhere; share it manually.
          </p>
        </div>
        <Link
          href="/dashboard/images"
          className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white self-start`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
      </section>

      {published ? (
        /* Success panel */
        <section className="bg-[#0a0a0a] border border-emerald-500/50 p-6" aria-label="Image published">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <Check className="h-4 w-4" aria-hidden="true" />
            IMAGE PUBLISHED
          </p>
          <div className="mt-4 border border-zinc-900 bg-black p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">SECRET URL</p>
            <p className="font-mono text-xs text-cyan-400 break-all select-all">{published.url}</p>
          </div>
          <p className="mt-3 font-mono text-[11px] text-zinc-500">
            Anyone with this exact URL can view the image — treat it like a password. Nothing else on this site
            links to it, and search engines are told to ignore it.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button type="button" onClick={copyUrl} className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10`}>
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy URL"}
            </button>
            <a
              href={published.path}
              target="_blank"
              rel="noopener noreferrer"
              className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open
            </a>
            <button type="button" onClick={resetForm} className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}>
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              Publish Another
            </button>
            <Link href="/dashboard/images" className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}>
              Manage Images
            </Link>
          </div>
        </section>
      ) : (
        /* Publish form */
        <form onSubmit={handleSubmit} className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-6 space-y-5">
          <div>
            <label htmlFor="image-title" className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Title
            </label>
            <input
              id="image-title"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={1}
              maxLength={100}
              placeholder="e.g. Workshop bench rebuild"
              autoComplete="off"
              className="w-full rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
            />
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              Shown only to you on the image dashboard — never on the public image URL.
            </p>
          </div>

          <div>
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Image
            </span>
            <PhotoUpload
              id="image-file"
              previewUrl={previewUrl}
              file={file}
              onAccept={(acceptedFile, url) => {
                setFile(acceptedFile);
                setPreviewUrl(url);
              }}
              onClear={() => {
                setFile(null);
                setPreviewUrl(null);
              }}
              clearLabel="Remove selected image"
            />
          </div>

          {error && (
            <div
              className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !file}
              className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? "Publishing..." : "Publish Image"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
