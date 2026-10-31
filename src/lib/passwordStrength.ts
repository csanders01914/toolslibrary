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

/**
 * Client-safe password strength assessment.
 *
 * Pure functions and constants only — no Node built-ins, no Prisma, no
 * "use client" directive — so the same module is importable from client
 * components (register page, canary console) and server code alike,
 * following the canaryShared.ts split pattern.
 *
 * The contract that matters: a password NEVER reads as STRONG unless it
 * satisfies every gate at once —
 *   - at least PASSWORD_STRONG_MIN_LENGTH (20) characters,
 *   - both upper and lower case letters,
 *   - at least one number,
 *   - at least one symbol.
 * Everything below that is graded on a monotonic Weak → Fair → Good scale;
 * the STRONG tier is a hard gate, not a score ceiling.
 *
 * This is UX guidance for the real-time strength indicator. It does NOT
 * replace server-side validation: the register action still enforces its
 * own minimum (src/lib/actions/auth.ts) and the canary passphrase action
 * enforces CANARY_MIN_PASSPHRASE_LENGTH (src/lib/actions/canary.ts).
 */

/** A password cannot reach the STRONG tier below this length. */
export const PASSWORD_STRONG_MIN_LENGTH = 20;

export type PasswordStrengthTier =
  | "empty"
  | "too-short"
  | "weak"
  | "fair"
  | "good"
  | "strong";

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordAssessment {
  tier: PasswordStrengthTier;
  /** 0-4 — how many meter segments are filled. */
  score: number;
  /** Short human label for the meter ("Weak", "Fair", "Good", "Strong"...). */
  label: string;
  /** True only when every STRONG gate is met simultaneously. */
  strong: boolean;
  /** The full requirement checklist, in display order. */
  requirements: PasswordRequirement[];
}

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
// Any non-alphanumeric character counts as a symbol — spaces included, since
// they are legitimate passphrase separators.
const HAS_SYMBOL = /[^A-Za-z0-9]/;

/**
 * Grade a password in real time. Deterministic and cheap (a handful of
 * regex passes), so it can run on every keystroke.
 *
 * @param value     the current password value
 * @param minLength the hard floor enforced by the surface's server action
 *                  (10 for registration, CANARY_MIN_PASSPHRASE_LENGTH for
 *                  the canary passphrase). Below the floor the meter reads
 *                  "Too short" regardless of character variety.
 */
export function assessPassword(value: string, minLength: number): PasswordAssessment {
  const length = value.length;
  const hasCaseMix = HAS_LOWER.test(value) && HAS_UPPER.test(value);
  const hasDigit = HAS_DIGIT.test(value);
  const hasSymbol = HAS_SYMBOL.test(value);
  const longEnough = length >= PASSWORD_STRONG_MIN_LENGTH;
  const meetsFloor = length >= minLength;

  // The STRONG gate: every criterion at once. No partial credit.
  const strong = longEnough && hasCaseMix && hasDigit && hasSymbol;

  const requirements: PasswordRequirement[] = [
    { id: "floor", label: `At least ${minLength} characters`, met: meetsFloor },
    { id: "length", label: `At least ${PASSWORD_STRONG_MIN_LENGTH} characters`, met: longEnough },
    { id: "case", label: "Upper and lower case letters", met: hasCaseMix },
    { id: "digit", label: "At least one number", met: hasDigit },
    { id: "symbol", label: "At least one symbol", met: hasSymbol },
  ];

  if (length === 0) {
    return { tier: "empty", score: 0, label: "Enter a password", strong: false, requirements };
  }
  if (!meetsFloor) {
    return { tier: "too-short", score: 1, label: "Too short", strong: false, requirements };
  }
  if (strong) {
    return { tier: "strong", score: 4, label: "Strong", strong: true, requirements };
  }

  // Below the gate, grade by how many of the four STRONG criteria are met.
  // variety is 0-3 here (4 would have meant strong).
  const variety = [longEnough, hasCaseMix, hasDigit, hasSymbol].filter(Boolean).length;
  switch (variety) {
    case 0:
      return { tier: "weak", score: 1, label: "Weak", strong: false, requirements };
    case 1:
      return { tier: "fair", score: 2, label: "Fair", strong: false, requirements };
    default:
      // 2-3 criteria met: full or near-full bar, but never allowed to read
      // as Strong — the missing criterion stays visible in the checklist.
      return { tier: "good", score: variety === 3 ? 4 : 3, label: "Good", strong: false, requirements };
  }
}
