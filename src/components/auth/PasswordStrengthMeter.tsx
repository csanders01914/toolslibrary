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

import { Check, X } from "lucide-react";
import {
  assessPassword,
  type PasswordStrengthTier,
} from "@/lib/passwordStrength";

// ================================================================
// PasswordStrengthMeter — real-time strength indicator for every
// new-credential surface (registration "join" page, canary passphrase
// setter). Fully controlled: it re-grades on every keystroke because the
// parent owns the input value. The STRONG tier is a hard gate (20+
// characters AND upper/lower case AND a number AND a symbol) — see
// assessPassword in src/lib/passwordStrength.ts.
// ================================================================

const TIER_META: Record<PasswordStrengthTier, { bar: string; text: string }> = {
  empty: { bar: "bg-zinc-800", text: "text-zinc-500" },
  "too-short": { bar: "bg-red-500", text: "text-red-400" },
  weak: { bar: "bg-red-500", text: "text-red-400" },
  fair: { bar: "bg-amber-500", text: "text-amber-400" },
  good: { bar: "bg-cyan-400", text: "text-cyan-300" },
  strong: { bar: "bg-emerald-400", text: "text-emerald-400" },
};

const SEGMENTS = 4;

export default function PasswordStrengthMeter({
  value,
  minLength,
  describedById,
}: {
  value: string;
  /** Hard floor enforced server-side by this surface's action. */
  minLength: number;
  /**
   * id for the live strength label — point the password input's
   * aria-describedby at it so screen readers announce tier changes.
   */
  describedById?: string;
}) {
  const assessment = assessPassword(value, minLength);
  const meta = TIER_META[assessment.tier];

  return (
    <div className="mt-3 space-y-2.5">
      {/* Meter bar + live tier label */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 ${i < assessment.score ? meta.bar : "bg-zinc-800"}`}
            />
          ))}
        </div>
        <span
          id={describedById}
          role="status"
          aria-live="polite"
          className={`shrink-0 font-mono text-[10px] uppercase tracking-widest ${meta.text}`}
        >
          {assessment.label}
        </span>
      </div>

      {/* Requirement checklist — updates live, but is not a live region so
          screen readers are not spammed on every keystroke; the tier label
          above carries the polite announcements. */}
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Password requirements">
        {assessment.requirements.map((req) => (
          <li key={req.id} className="flex items-center gap-1.5 font-mono text-[11px] leading-relaxed">
            {req.met ? (
              <Check className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
            ) : (
              <X className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden="true" />
            )}
            <span className={req.met ? "text-emerald-400" : "text-zinc-500"}>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
