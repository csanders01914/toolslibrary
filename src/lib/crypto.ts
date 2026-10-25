import crypto from 'node:crypto';

/**
 * Generates single-use recovery codes in the format XXXX-XXXX.
 * Each code is 8 hex characters (4 bytes) split into two groups.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Normalizes a recovery code and returns its SHA-256 hash.
 * Normalization: trim, uppercase, strip non-alphanumeric characters.
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
