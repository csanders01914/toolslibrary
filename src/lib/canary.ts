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
 * Warrant canary signing engine (PHASE_30_CANARY_SIGNING).
 *
 * A warrant canary is a periodically re-signed statement that no lawful
 * request for user data has been received. Its power comes from its absence:
 * if the monthly re-affirmation stops — or a DISCLOSE event is signed
 * instead — third parties must assume compromise. This module is the backend
 * slice: canonical payload construction, Ed25519 signing and verification,
 * staged updates gated by a dedicated canary passphrase plus an out-of-band
 * single-use email token, and the append-only public event log.
 *
 * Threat model, in brief:
 * - A stolen admin SESSION must not be sufficient to sign a canary event.
 *   Staging requires the dedicated canary passphrase (bcrypt cost 12, stored
 *   separately from the login password hash); committing requires a
 *   single-use token delivered to the admin notification email. An attacker
 *   holding only the session can neither stage nor commit.
 * - A tampered DATABASE must not be able to rewrite history silently. Every
 *   committed event carries an Ed25519 detached signature over a canonical
 *   payload; the public key is published on /transparency so anyone can
 *   verify offline. Stated precisely, the signature detects: (a) row edits
 *   by a party who cannot read the private key (the key is AES-256-GCM
 *   encrypted at rest with a key derived from AUTH_SECRET, which lives in
 *   the environment, never in the database — so a leaked backup or a stolen
 *   .db file alone cannot re-sign forged history), and (b) a key swap by a
 *   full read+write adversary, detectable against the public-key
 *   fingerprint the operator records out-of-band. It cannot protect against
 *   an adversary holding BOTH the database and the environment (a coerced
 *   operator controls both by definition) — no server-side scheme can; the
 *   out-of-band fingerprint record is the residual check for that case.
 * - The public history must survive account deletion: CanaryEvent has NO
 *   foreign key to User — the signing admin is snapshotted as public handles
 *   (alias + username) at commit time.
 * - A disclosure is terminal: once a DISCLOSE event exists, the canary can
 *   never be re-affirmed. The guard runs at staging AND again inside the
 *   commit transaction, so an AFFIRM staged before a disclosure cannot slip
 *   through afterwards.
 *
 * Zero-PII: the canary speaks about the service, never about members. Raw
 * confirmation tokens exist only in the email body and the caller's return
 * value — the database stores only their SHA-256 hash. Nothing in this
 * module logs tokens, passphrases, or note content.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
// Client-safe contract (constants, public shapes, pure functions) lives in
// canaryShared.ts — see that module's header for why the split exists. The
// re-export keeps every server consumer importing from "@/lib/canary".
export {
  CANARY_VALID_DAYS,
  CANARY_CONFIRM_TTL_MINUTES,
  CANARY_MIN_PASSPHRASE_LENGTH,
  CANARY_STATEMENTS,
  deriveCanaryStatus,
  buildCanonicalPayload,
} from "./canaryShared";
export type {
  CanaryAction,
  CanaryStatus,
  CanaryEventPublic,
  CanaryPendingPublic,
  CanaryState,
} from "./canaryShared";
import {
  CANARY_CONFIRM_TTL_MINUTES,
  CANARY_VALID_DAYS,
  buildCanonicalPayload,
  deriveCanaryStatus,
  type CanaryAction,
  type CanaryEventPublic,
  type CanaryPendingPublic,
  type CanaryState,
} from "./canaryShared";

/** bcrypt cost for the canary passphrase hash — matches the login password. */
const BCRYPT_COST = 12;

/** Plain Date arithmetic constants (no date library dependency). */
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const REASON_NO_PENDING =
  "No pending canary update, or the confirmation link expired — stage the update again.";
const REASON_INVALID_TOKEN = "Invalid confirmation token.";
const REASON_TERMINAL_DISCLOSURE =
  "The canary has been dropped — a disclosure is terminal and the canary cannot be re-affirmed";
const REASON_COMMIT_FAILED = "Could not commit the canary update — try again.";

/** Shape of a CanaryEvent row as read from the database (no FK to User). */
interface CanaryEventRow {
  id: string;
  seq: number;
  action: string;
  note: string | null;
  committedAt: Date;
  expiresAt: Date | null;
  signature: string;
  publicKey: string;
  adminAlias: string;
  adminUsername: string;
}

/** Map a database row to the public event shape, normalizing the action. */
function toPublicEvent(row: CanaryEventRow): CanaryEventPublic {
  return {
    id: row.id,
    seq: row.seq,
    action: row.action === "DISCLOSE" ? "DISCLOSE" : "AFFIRM",
    note: row.note,
    committedAt: row.committedAt,
    expiresAt: row.expiresAt,
    signature: row.signature,
    publicKey: row.publicKey,
    adminAlias: row.adminAlias,
    adminUsername: row.adminUsername,
  };
}

/** SHA-256 hex digest of a UTF-8 string (token hashing, key fingerprint). */
function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

// ── Private-key encryption at rest (PHASE_30) ────────────────────────────
// The Ed25519 private key is stored in the same SQLite file as the canary
// history it protects, so plaintext storage would hand a database-reading
// adversary (leaked backup, stolen .db file) the power to re-sign forged
// history with the ORIGINAL key — undetectable against the operator's
// out-of-band fingerprint record. The key is therefore sealed with
// AES-256-GCM under a key derived (HKDF-SHA256, domain-separated) from
// AUTH_SECRET, which lives in the environment and never in the database.
// Consequences, stated honestly: a database leak alone no longer yields the
// signing key; an environment leak alone never touches the database; an
// adversary holding both holds the key (no server-side scheme avoids that).
// Rotating AUTH_SECRET invalidates the seal — the operator deletes the
// CanaryKey row and a fresh keypair is generated on the next commit; every
// historical event keeps its own embedded public key, so old signatures
// remain verifiable against the previously recorded fingerprint.

const KEY_SEAL_VERSION = "v1";
const KEY_SEAL_SALT = "toolslibrary-canary-key";
const KEY_SEAL_INFO = "ed25519-private-key-encryption";

/** AES-256 key-encryption-key derived from AUTH_SECRET (HKDF-SHA256). */
function getKeyEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length === 0) {
    // Fail loud: silently falling back to a fixed key would be worse than
    // refusing to sign. AUTH_SECRET is required for NextAuth anyway.
    throw new Error("AUTH_SECRET is not configured");
  }
  return Buffer.from(
    crypto.hkdfSync("sha256", secret, KEY_SEAL_SALT, KEY_SEAL_INFO, 32)
  );
}

/** Seal a PKCS8 PEM private key: `v1:<iv>:<ciphertext>:<authTag>` (base64). */
function sealPrivateKey(privateKeyPem: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKeyEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKeyPem, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    KEY_SEAL_VERSION,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

/** Open a sealed private key. Throws on tampering (GCM auth tag mismatch). */
function openPrivateKey(sealed: string): string {
  const [version, ivB64, ciphertextB64, tagB64] = sealed.split(":");
  if (version !== KEY_SEAL_VERSION || !ivB64 || !ciphertextB64 || !tagB64) {
    throw new Error("malformed sealed key");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKeyEncryptionKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Verify an Ed25519 detached signature (hex) over a canonical payload against
 * a base64 SPKI DER public key. Returns false on ANY error — malformed key,
 * malformed signature, wrong lengths — because for a third-party auditor a
 * verification error and a verification failure are the same outcome: do not
 * trust the event. Never throws.
 */
export function verifyCanarySignature(
  publicKeyB64: string,
  canonical: string,
  signatureHex: string
): boolean {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    return crypto.verify(
      // Ed25519 is a pure one-shot algorithm — no digest parameter.
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      Buffer.from(signatureHex, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Assemble the full canary state for the transparency page and the admin
 * console: derived status, latest event, published public key, the caller's
 * non-expired pending update (when userId is given), and whether the caller
 * has a canary passphrase on record. Safe on an empty database — every query
 * tolerates zero rows.
 */
export async function getCanaryState(userId?: string): Promise<CanaryState> {
  const [latestRows, keyRow] = await Promise.all([
    prisma.canaryEvent.findMany({
      orderBy: [{ committedAt: "desc" }, { seq: "desc" }],
      take: 1,
    }),
    prisma.canaryKey.findFirst(),
  ]);
  const latestRow = latestRows[0] ?? null;

  let hasPassphrase = false;
  let pending: CanaryPendingPublic | null = null;
  if (userId) {
    const [user, pendingRow] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { canaryPassphraseHash: true },
      }),
      prisma.canaryPending.findUnique({ where: { userId } }),
    ]);
    hasPassphrase = user?.canaryPassphraseHash != null;
    if (pendingRow && pendingRow.expiresAt.getTime() > Date.now()) {
      pending = {
        action: pendingRow.action === "DISCLOSE" ? "DISCLOSE" : "AFFIRM",
        note: pendingRow.note,
        expiresAt: pendingRow.expiresAt,
      };
    }
  }

  return {
    status: deriveCanaryStatus(
      latestRow ? { action: latestRow.action, expiresAt: latestRow.expiresAt } : null
    ),
    latest: latestRow ? toPublicEvent(latestRow) : null,
    publicKey: keyRow?.publicKey ?? null,
    pending,
    hasPassphrase,
  };
}

/**
 * Public canary history, newest first, for the transparency page audit log.
 */
export async function getCanaryHistory(limit = 6): Promise<CanaryEventPublic[]> {
  const rows = await prisma.canaryEvent.findMany({
    orderBy: [{ committedAt: "desc" }, { seq: "desc" }],
    take: limit,
  });
  return rows.map(toPublicEvent);
}

/**
 * Set (or replace) the dedicated canary passphrase. Cost 12 matches the
 * login password: the canary passphrase gates a signing authority, so it
 * deserves the same offline-cracking resistance. Callers enforce the
 * current-passphrase check — this is the write primitive only.
 */
export async function setCanaryPassphrase(userId: string, passphrase: string): Promise<void> {
  const hash = await bcrypt.hash(passphrase, BCRYPT_COST);
  await prisma.user.update({
    where: { id: userId },
    data: { canaryPassphraseHash: hash },
  });
}

/**
 * Verify a canary passphrase against the stored hash. False when no hash is
 * on record (nothing to verify) — callers treat that as a setup error, not a
 * credential failure.
 */
export async function verifyCanaryPassphrase(
  userId: string,
  passphrase: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { canaryPassphraseHash: true },
  });
  if (!user?.canaryPassphraseHash) return false;
  return bcrypt.compare(passphrase, user.canaryPassphraseHash);
}

/**
 * Stage a canary update for out-of-band email approval (PHASE_30). Guards in
 * order:
 * (a) the user exists and has a canary passphrase on record;
 * (b) an AFFIRM cannot be staged once any DISCLOSE event exists — a
 *     disclosure is terminal (the world must be able to trust that a dropped
 *     canary stays dropped);
 * (c) staging replaces any prior pending row for the user (one per admin).
 * The raw single-use token is returned to the caller for email delivery and
 * NEVER stored — only its SHA-256 hash lands in the database, so a leaked
 * backup or a read-only DB compromise cannot confirm a staged update.
 */
export async function stageCanaryUpdate(
  userId: string,
  action: CanaryAction,
  note: string | null
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, canaryPassphraseHash: true },
  });
  if (!user?.canaryPassphraseHash) {
    return { ok: false, reason: "no canary passphrase on record" };
  }

  if (action === "AFFIRM") {
    const disclosure = await prisma.canaryEvent.findFirst({
      where: { action: "DISCLOSE" },
      select: { id: true },
    });
    if (disclosure) {
      return { ok: false, reason: REASON_TERMINAL_DISCLOSURE };
    }
  }

  // 256 bits of entropy: the token is the only thing standing between an
  // email inbox and a signed canary event, and it is single-use with a
  // 15-minute TTL on top.
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + CANARY_CONFIRM_TTL_MINUTES * MINUTE_MS);

  // One transaction: replace-any-prior-pending must be atomic, or two
  // concurrent stagings by the same admin could race the delete+create
  // against the userId unique constraint.
  await prisma.$transaction(async (tx) => {
    await tx.canaryPending.deleteMany({ where: { userId } });
    await tx.canaryPending.create({
      data: { userId, action, note, tokenHash, expiresAt },
    });
  });

  return { ok: true, token };
}

/**
 * Check a confirmation token against the caller's staged update WITHOUT
 * consuming it (the commit path re-validates and consumes). Comparison is
 * timing-safe over the SHA-256 hex digests; both digests are 64 hex chars,
 * but the length guard keeps a malformed token from throwing inside
 * timingSafeEqual. Rejects expired stagings. Never throws.
 */
export async function inspectCanaryToken(
  userId: string,
  token: string
): Promise<{ ok: true; pending: CanaryPendingPublic } | { ok: false }> {
  try {
    const pendingRow = await prisma.canaryPending.findUnique({ where: { userId } });
    if (!pendingRow) return { ok: false };

    const candidate = sha256Hex(token);
    const expected = pendingRow.tokenHash;
    if (candidate.length !== expected.length) return { ok: false };
    if (
      !crypto.timingSafeEqual(
        Buffer.from(candidate, "utf8"),
        Buffer.from(expected, "utf8")
      )
    ) {
      return { ok: false };
    }
    if (pendingRow.expiresAt.getTime() <= Date.now()) return { ok: false };

    return {
      ok: true,
      pending: {
        action: pendingRow.action === "DISCLOSE" ? "DISCLOSE" : "AFFIRM",
        note: pendingRow.note,
        expiresAt: pendingRow.expiresAt,
      },
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Internal control-flow signal for the commit transaction: thrown to roll the
 * transaction back, then mapped to its caller-facing reason outside the
 * transaction callback (Prisma treats a thrown error as a rollback). Carries
 * only a reason string — no secrets, no content.
 */
class CanaryCommitError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "CanaryCommitError";
  }
}

/**
 * Consume a staged canary update and commit it as a signed, append-only
 * CanaryEvent (PHASE_30). Sequence of operations:
 * 1. Re-validate the staged update exactly like inspectCanaryToken
 *    (existence, timing-safe token hash, TTL) before opening the transaction.
 * 2. Inside one transaction: allocate the monotonic seq (max + 1), get or
 *    create the singleton Ed25519 keypair, build the canonical payload, sign
 *    it, re-check the terminal-disclosure guard for AFFIRM (a disclosure
 *    committed between staging and confirmation must win), snapshot the
 *    admin's current public handles, insert the event, and delete the
 *    pending row (single-use consumption).
 * The transaction is the atomicity boundary: a crash or a lost race leaves
 * either the prior state or the fully committed event, never a half-signed
 * row or a consumed token without its event.
 */
export async function commitStagedCanaryUpdate(
  userId: string,
  token: string
): Promise<{ ok: true; event: CanaryEventPublic } | { ok: false; reason: string }> {
  const pendingRow = await prisma.canaryPending.findUnique({ where: { userId } });
  if (!pendingRow) {
    return { ok: false, reason: REASON_NO_PENDING };
  }

  const candidate = sha256Hex(token);
  const expected = pendingRow.tokenHash;
  if (candidate.length !== expected.length) {
    return { ok: false, reason: REASON_INVALID_TOKEN };
  }
  if (
    !crypto.timingSafeEqual(Buffer.from(candidate, "utf8"), Buffer.from(expected, "utf8"))
  ) {
    return { ok: false, reason: REASON_INVALID_TOKEN };
  }
  if (pendingRow.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: REASON_NO_PENDING };
  }

  const action: CanaryAction = pendingRow.action === "DISCLOSE" ? "DISCLOSE" : "AFFIRM";

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (action === "AFFIRM") {
        const disclosure = await tx.canaryEvent.findFirst({
          where: { action: "DISCLOSE" },
          select: { id: true },
        });
        if (disclosure) {
          throw new CanaryCommitError(REASON_TERMINAL_DISCLOSURE);
        }
      }

      // Monotonic 1-based sequence number, allocated inside the transaction
      // so concurrent commits cannot collide on the @unique column.
      const aggregate = await tx.canaryEvent.aggregate({ _max: { seq: true } });
      const seq = (aggregate._max.seq ?? 0) + 1;

      const key = await getOrCreateCanaryKey(tx);

      const committedAt = new Date();
      const expiresAt =
        action === "AFFIRM"
          ? new Date(committedAt.getTime() + CANARY_VALID_DAYS * DAY_MS)
          : null;
      const canonical = buildCanonicalPayload({
        action,
        seq,
        committedAt,
        expiresAt,
        note: pendingRow.note,
      });
      const signature = crypto
        .sign(
          null,
          Buffer.from(canonical, "utf8"),
          crypto.createPrivateKey(key.privateKey)
        )
        .toString("hex");

      // Snapshot the signing admin's PUBLIC handles: the event log has no FK
      // to User and must survive account deletion, so the handles are copied
      // at commit time rather than joined at read time.
      const admin = await tx.user.findUnique({
        where: { id: userId },
        select: { alias: true, username: true },
      });
      if (!admin) {
        // The pending row is FK-bound to the user; if the user vanished
        // mid-flight the staging is gone with it — roll back and report the
        // staging as vanished.
        throw new CanaryCommitError(REASON_NO_PENDING);
      }

      const event = await tx.canaryEvent.create({
        data: {
          seq,
          action,
          note: pendingRow.note,
          committedAt,
          expiresAt,
          signature,
          publicKey: key.publicKey,
          adminAlias: admin.alias,
          adminUsername: admin.username,
        },
      });

      // Single-use consumption: the token dies with the commit.
      await tx.canaryPending.delete({ where: { id: pendingRow.id } });

      return event;
    });
    return { ok: true, event: toPublicEvent(created) };
  } catch (error) {
    if (error instanceof CanaryCommitError) {
      return { ok: false, reason: error.reason };
    }
    // Unexpected failure (DB busy, connection loss): one coarse line, no
    // payload content, no tokens — same posture as the email module.
    console.error("[canary] commit failed: internal error");
    return { ok: false, reason: REASON_COMMIT_FAILED };
  }
}

/**
 * Get or create the singleton Ed25519 keypair for canary events. Accepts an
 * optional transaction client so the commit path can run it inside its
 * transaction — key creation and the first signed event then commit
 * atomically, and a crash can never publish a public key with no signed
 * event or vice versa. The private key is sealed with AES-256-GCM (see the
 * encryption-at-rest notes above) and is decrypted only in memory, only to
 * sign; no exported function ever returns it.
 */
async function getOrCreateCanaryKey(
  tx?: Prisma.TransactionClient
): Promise<{ publicKey: string; privateKey: string }> {
  const client = tx ?? prisma;
  const existing = await client.canaryKey.findFirst();
  if (existing) {
    return { publicKey: existing.publicKey, privateKey: openPrivateKey(existing.privateKey) };
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const created = await client.canaryKey.create({
    data: { publicKey: publicKeyB64, privateKey: sealPrivateKey(privateKeyPem) },
  });
  return { publicKey: created.publicKey, privateKey: privateKeyPem };
}

/**
 * Drop any staged (pending) canary update for the user. Idempotent —
 * deleteMany on zero rows is a no-op.
 */
export async function cancelCanaryStaging(userId: string): Promise<void> {
  await prisma.canaryPending.deleteMany({ where: { userId } });
}

/**
 * SHA-256 hex fingerprint of the singleton signing key's SPKI DER bytes —
 * the value operators record out-of-band so a DB-tampered key swap (replace
 * the keypair, re-sign forged history) is detectable against the recorded
 * fingerprint. Null when no key exists yet (nothing has ever been committed).
 */
export async function getCanaryKeyFingerprint(): Promise<string | null> {
  const keyRow = await prisma.canaryKey.findFirst();
  if (!keyRow) return null;
  return crypto
    .createHash("sha256")
    .update(Buffer.from(keyRow.publicKey, "base64"))
    .digest("hex");
}
