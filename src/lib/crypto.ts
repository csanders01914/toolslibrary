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

import crypto from 'node:crypto';

/**
 * Full case-sensitive alphanumeric alphabet (62 symbols, ~5.95 bits per
 * character) for modern recovery codes.
 */
const RECOVERY_CODE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Characters in a modern recovery code, excluding separators. */
export const RECOVERY_CODE_LENGTH = 12;

/** Characters between hyphens in the displayed form (XXXX-XXXX-XXXX). */
const RECOVERY_CODE_GROUP_SIZE = 4;

/** Characters in a legacy (pre-upgrade) recovery code, excluding separators. */
export const LEGACY_RECOVERY_CODE_LENGTH = 8;

/**
 * Generates single-use recovery codes in the format XXXX-XXXX-XXXX
 * (e.g. Fw4C-g5Rf-3EDu). Each code is 12 case-sensitive alphanumeric
 * characters (~71 bits of entropy) drawn with crypto.randomInt, which is
 * unbiased, and split into three groups for readability.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let body = '';
    for (let j = 0; j < RECOVERY_CODE_LENGTH; j++) {
      body += RECOVERY_CODE_ALPHABET[crypto.randomInt(RECOVERY_CODE_ALPHABET.length)];
    }
    codes.push(
      `${body.slice(0, RECOVERY_CODE_GROUP_SIZE)}-${body.slice(
        RECOVERY_CODE_GROUP_SIZE,
        RECOVERY_CODE_GROUP_SIZE * 2
      )}-${body.slice(RECOVERY_CODE_GROUP_SIZE * 2)}`
    );
  }
  return codes;
}

/**
 * Normalizes a recovery code and returns its SHA-256 hash.
 * Normalization: trim, strip separator characters (hyphens, spaces).
 * Case is preserved — modern codes are case-sensitive.
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().replace(/[^A-Za-z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Legacy (pre-upgrade) normalization: trim, uppercase, strip non-alphanumeric
 * characters. Legacy codes were 8 hex characters and matched
 * case-insensitively; this path keeps them working for accounts that have not
 * yet been re-issued a modern set at sign-in (recoverAccount discriminates the
 * two formats by normalized length).
 */
export function hashLegacyRecoveryCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
