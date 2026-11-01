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
 * End-to-end encryption for outbound email bodies (operator-directed work;
 * the single encryption layer for all outbound mail — admin alerts in
 * src/lib/email.ts and the operator test email both encrypt here).
 *
 * Threat model: outbound mail leaves the local Postfix relay through Resend,
 * a third-party smart-host SaaS, because the residential ISP blocks direct
 * port-25 delivery. Resend must act strictly as a dumb pipe: every email
 * body is PGP-encrypted HERE, before the message ever touches SMTP, so the
 * only content Resend can observe is routing metadata (envelope From/To and
 * the Subject header) — never the body.
 *
 * Key material: the operator's ProtonMail public key is hardcoded below as
 * an armored string. ProtonMail ECC keys are Curve25519 (Ed25519 signing
 * key + cv25519 ECDH encryption subkey), which openpgp reads and encrypts
 * to natively. The embedded constant IS the operator's real ProtonMail
 * public key (operator-confirmed 2026-11-01) — there is no stand-in and
 * nothing to swap. Authenticity check after any edit of this constant:
 * compare getOperatorKeyFingerprint() against the fingerprint shown in
 * ProtonMail → Settings → Encryption & keys; a mismatch means the deployed
 * constant is not the key whose private half ProtonMail holds, and mail
 * encrypted to it would be unreadable (fail closed).
 *
 * Zero-plaintext guarantees, enforced by construction:
 * - the plaintext body exists only as the caller's in-memory argument and
 *   is dropped after encryption — it is never written to disk, never
 *   persisted anywhere, and never placed in any error, log line, or
 *   returned value (JavaScript cannot zero freed string memory; the
 *   guarantee is that plaintext never crosses a process or wire boundary);
 * - every failure path throws a fixed-message EmailEncryptionError carrying
 *   only a coarse code — the underlying openpgp error (which can embed
 *   message fragments) is swallowed, never chained as `cause`, never
 *   logged;
 * - nothing in this module logs at all.
 */

import { createMessage, encrypt, readKey, type Key } from "openpgp";

/**
 * Operator's ProtonMail public key — the real key, not a stand-in (see
 * module documentation above). After any edit of this constant, verify it
 * by comparing getOperatorKeyFingerprint() with the fingerprint displayed
 * in ProtonMail's key settings.
 */
const OPERATOR_PGP_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEaEnhdhYJKwYBBAHaRw8BAQdAuGp34DtGfofWK/V4cXk0VGQQkh0GH9O64wDn
7GiFb5O0L2NzYW5kZXJzMDE5MUBwcm90b24ubWUgPGNzYW5kZXJzMDE5MUBwcm90
b24ubWU+iNEEExYKAIMFgmhJ4XYDCwkHCZBCpSQr0WQ16kUUAAAAAAAcACBzYWx0
QG5vdGF0aW9ucy5vcGVucGdwanMub3JnRHg5Y3i9Bvf/9Q1JpKnuPITW0ELmVKr1
Ln8+xvSbx2EDFQoIBBYAAgECGQECmwMCHgEWIQTBddBPsgJgpy5DxqVCpSQr0WQ1
6gAANkoBAJIBox9WX9sc6JeMJXz2/u07U8Qe1MGmWB2HeLxfIrqfAQDmdPxoa3+K
hNYtKkgRRA6dJzeb3ExShYPluq5b2WiZCLg4BGhJ4XYSCisGAQQBl1UBBQEBB0DT
tBX6iBYGONVW2ObZMZi3EZaqDFdVfzmD96WEZ4bVMAMBCAeIvgQYFgoAcAWCaEnh
dgmQQqUkK9FkNepFFAAAAAAAHAAgc2FsdEBub3RhdGlvbnMub3BlbnBncGpzLm9y
Z/vyiKREkN7GFJsQarzErQhNd/Dwn1YG774hmwvVRuDkApsMFiEEwXXQT7ICYKcu
Q8alQqUkK9FkNeoAAAVwAQDwwxoatVevV7qAnX4jedP033lYMvZn2hsx0pB8whL7
0AD/csXhtTHZsw9yj4JCI8xdikZIaGCyakPxP+T05ijQzwo=
=IPCZ
-----END PGP PUBLIC KEY BLOCK-----`;

/** Coarse failure codes — deliberately the only diagnostic detail emitted. */
export type EmailEncryptionErrorCode = "KEY_UNAVAILABLE" | "ENCRYPTION_FAILED";

/**
 * Fixed-message encryption error: carries a coarse code only. Never wraps,
 * chains, or exposes the underlying openpgp error, which can embed fragments
 * of the message being processed.
 */
export class EmailEncryptionError extends Error {
  public readonly code: EmailEncryptionErrorCode;

  constructor(code: EmailEncryptionErrorCode) {
    super(
      code === "KEY_UNAVAILABLE"
        ? "Email encryption key could not be loaded"
        : "Email body could not be encrypted"
    );
    this.name = "EmailEncryptionError";
    this.code = code;
  }
}

/**
 * Parsed public key, loaded lazily on first use (no import-time side
 * effects — Next.js must be able to evaluate this module during build) and
 * cached for the process lifetime. A failed load resets the cache so a
 * corrected key constant is picked up without a restart.
 */
let cachedPublicKey: Promise<Key> | null = null;

function loadOperatorPublicKey(): Promise<Key> {
  cachedPublicKey ??= readKey({ armoredKey: OPERATOR_PGP_PUBLIC_KEY }).then(
    async (key) => {
      // Guard against a private key ever being pasted into the constant:
      // private key material must never ship in source.
      if (key.isPrivate()) {
        throw new EmailEncryptionError("KEY_UNAVAILABLE");
      }
      // Fail closed unless the key actually carries an encryption-capable
      // (ECDH/X25519) subkey — a signing-only key would produce mail nobody
      // can decrypt.
      if (!(await key.getEncryptionKey())) {
        throw new EmailEncryptionError("KEY_UNAVAILABLE");
      }
      return key;
    }
  );
  cachedPublicKey.catch(() => {
    cachedPublicKey = null;
  });
  return cachedPublicKey;
}

/** Drop the cached key promise so a corrected key constant is picked up. */
function invalidateKeyCache(): void {
  cachedPublicKey = null;
}

/**
 * Encrypt one email body to the operator's ProtonMail public key. Returns
 * the ASCII-armored PGP message (-----BEGIN PGP MESSAGE----- …) ready to be
 * dispatched as the email's text body. Throws only EmailEncryptionError
 * with a coarse code — never the payload, never the underlying error.
 */
export async function encryptEmailBody(plaintextBody: string): Promise<string> {
  let encryptionKey: Key;
  try {
    encryptionKey = await loadOperatorPublicKey();
  } catch (error) {
    // Key-load failure: drop the cached promise so a corrected key constant
    // is picked up without a restart, and rethrow the sanitized error.
    invalidateKeyCache();
    throw error instanceof EmailEncryptionError
      ? error
      : new EmailEncryptionError("KEY_UNAVAILABLE");
  }
  try {
    const message = await createMessage({ text: plaintextBody });
    return await encrypt({
      message,
      encryptionKeys: encryptionKey,
      format: "armored",
    });
  } catch {
    // Encryption failure with a validated key: the cached key stays valid,
    // so only the error is sanitized here.
    throw new EmailEncryptionError("ENCRYPTION_FAILED");
  }
}

/**
 * SHA-1 fingerprint of the embedded public key (uppercased hex). Operators
 * compare this against the fingerprint displayed in ProtonMail's key
 * settings to confirm the deployed constant is the key whose private half
 * ProtonMail actually holds. Throws only EmailEncryptionError if the
 * embedded constant is not a usable public key — the underlying openpgp
 * error is swallowed, same as everywhere else in this module.
 */
export async function getOperatorKeyFingerprint(): Promise<string> {
  try {
    const key = await loadOperatorPublicKey();
    return key.getFingerprint().toUpperCase();
  } catch (error) {
    invalidateKeyCache();
    throw error instanceof EmailEncryptionError
      ? error
      : new EmailEncryptionError("KEY_UNAVAILABLE");
  }
}
