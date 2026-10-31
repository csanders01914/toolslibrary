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

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Image as ImageIcon, X } from "lucide-react";

/**
 * Client-side mirror of the server checks in lib/actions/tools.ts and
 * api/tools/create/route.ts so a file that passes here never bounces at 400.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface PhotoUploadProps {
  /** id for the file input, for aria wiring. */
  id: string;
  /** Preview to render: data URL of a newly picked file, or /api/uploads/<name> for the stored photo. */
  previewUrl: string | null;
  /** Newly selected, validated file; null when the preview is the existing stored photo. */
  file: File | null;
  /** FormData key for server-action forms ("image"); omit when the form builds its own FormData. */
  name?: string;
  /** Optional note rendered under the upload zone. */
  hint?: ReactNode;
  /** Called with a validated file and its data-URL preview once it passes client validation. */
  onAccept: (file: File, previewDataUrl: string) => void;
  /** Called when the user removes the selected or existing photo. */
  onClear: () => void;
  /** Accessible label for the remove button. */
  clearLabel: string;
}

/**
 * Shared listing-photo picker with explicit visual verdicts:
 *  - emerald border + "PHOTO ACCEPTED" badge (filename, size) once a file passes validation;
 *  - red border + inline alert when a file is rejected (too large / wrong type). The input
 *    value is reset on rejection so re-picking the same file re-triggers validation;
 *  - neutral "CURRENT PHOTO" strip when an existing stored photo is displayed.
 * The file input stays mounted in every state so server-action forms always receive the
 * selected file, and it is reset on clear so a removed photo is never silently submitted.
 */
export default function PhotoUpload({
  id,
  previewUrl,
  file,
  name,
  hint,
  onAccept,
  onClear,
  clearLabel,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (picked.size > MAX_UPLOAD_BYTES) {
      setRejectError(`"${picked.name}" is ${formatFileSize(picked.size)} — image must be less than 5MB`);
      e.target.value = ""; // allow re-picking the same rejected file
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(picked.type)) {
      setRejectError(`"${picked.name}" was rejected — use JPEG, PNG, GIF, or WebP`);
      e.target.value = "";
      return;
    }

    setRejectError(null);
    const reader = new FileReader();
    reader.onloadend = () => onAccept(picked, reader.result as string);
    reader.readAsDataURL(picked);
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    setRejectError(null);
    onClear();
  };

  const rejected = rejectError !== null;
  const accepted = previewUrl !== null && file !== null && !rejected;
  const existing = previewUrl !== null && file === null && !rejected;

  const containerBorder = rejected
    ? "border-red-500/60"
    : accepted
      ? "border-emerald-500/60"
      : "border-zinc-800";

  return (
    <div>
      <div className={`border bg-black transition-colors ${containerBorder}`}>
        {previewUrl && (
          <div className="relative">
            <img
              src={previewUrl}
              alt={accepted && file ? `Selected photo: ${file.name}` : "Current photo preview"}
              className="w-full h-auto object-contain max-h-64"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-2 bg-black border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              aria-label={clearLabel}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div
          className={`relative w-full flex flex-col items-center justify-center text-center ${
            previewUrl ? "h-24 border-t border-zinc-800" : "h-40"
          }`}
        >
          {rejected ? (
            <>
              <p
                id={`${id}-error`}
                role="alert"
                className="px-4 font-mono text-xs text-red-400 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {rejectError}
              </p>
              <p className="font-mono text-[11px] text-zinc-600 mt-1">JPEG, PNG, GIF, WebP · MAX 5MB</p>
            </>
          ) : accepted && file ? (
            <>
              <p role="status" className="font-mono text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                PHOTO ACCEPTED
              </p>
              <p className="font-mono text-[11px] text-zinc-500 mt-1 max-w-full truncate px-4">
                {file.name} · {formatFileSize(file.size)}
              </p>
            </>
          ) : existing ? (
            <>
              <p className="font-mono text-xs text-zinc-400 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                CURRENT PHOTO — CLICK TO REPLACE
              </p>
              <p className="font-mono text-[11px] text-zinc-600 mt-1">JPEG, PNG, GIF, WebP · MAX 5MB</p>
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-zinc-400">CLICK TO UPLOAD</p>
              <p className="font-mono text-[11px] text-zinc-600 mt-1">JPEG, PNG, GIF, WebP · MAX 5MB</p>
            </>
          )}
          <input
            ref={inputRef}
            id={id}
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Upload tool photo"
            aria-invalid={rejected || undefined}
            aria-describedby={rejected ? `${id}-error` : undefined}
          />
        </div>
      </div>
      {hint}
    </div>
  );
}
