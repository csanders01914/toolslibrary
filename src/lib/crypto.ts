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

// ============================================================
// Server-side secret encryption (AES-256-GCM) for integration
// API keys. The master key is derived from AUTH_SECRET (or a
// dedicated LLM_ENCRYPTION_KEY) via scrypt and never leaves the
// server. Ciphertext format: iv:tag:ciphertext (all hex).
// ============================================================

const SECRET_SALT = 'toolslibrary.llm-key.v1';

function getMasterKey(): Buffer {
  const material = process.env.LLM_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!material || material.length < 16) {
    throw new Error(
      'Missing LLM_ENCRYPTION_KEY or AUTH_SECRET (min 16 chars) required to encrypt integration credentials'
    );
  }
  return crypto.scryptSync(material, SECRET_SALT, 32);
}

/** Encrypts a plaintext secret for storage. Returns iv:tag:ciphertext hex. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypts a stored secret. Throws if the ciphertext or key material is invalid. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getMasterKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** Returns only the last 4 characters of a secret, for safe display. */
export function maskSecret(plain: string): string {
  if (plain.length <= 4) return '••••';
  return `••••${plain.slice(-4)}`;
}
