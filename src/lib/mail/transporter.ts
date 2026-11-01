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
 * E2EE outbound mail dispatcher (operator-directed work, extends the
 * PHASE_29 Postfix relay in src/lib/email.ts).
 *
 * Pipeline: plaintext body → PGP-encrypted in-process by
 * src/lib/crypto/encryptEmail.ts (operator's ProtonMail public key) →
 * nodemailer SMTP handoff to the local Postfix container → Resend
 * smart-host → internet. Resend is a third party and the residential ISP
 * blocks direct port-25 delivery, so the body must already be ciphertext
 * before it touches the SMTP wire: Resend relays a message it cannot read.
 *
 * Only routing metadata stays plaintext: the envelope/header From, the
 * recipient To, and the Subject header. The body is the armored PGP message
 * (text/plain), which ProtonMail auto-detects and decrypts on arrival.
 *
 * Relay addressing: `SMTP_HOST` (default `host.containers.internal` — the
 * rootless-Podman DNS name through which a containerized website reaches
 * the host's Postfix loopback listener), `SMTP_PORT` (default `25`). For
 * host-network deployments set SMTP_HOST=127.0.0.1 (the deployed .env does).
 * This is the single outbound transport: admin alerts (src/lib/email.ts)
 * and the operator test email both dispatch through here. Unauthenticated
 * by design: the relay is private infrastructure with no credentials to
 * store or leak. `rejectUnauthorized: false` accepts the self-signed
 * certificate typical of a private relay; this connection never leaves the
 * machine/container network.
 *
 * Failure posture: mirrors src/lib/email.ts — never throws, safe to call
 * fire-and-forget, collapses every failure into `{ sent: false, reason }`
 * with a coarse reason only. The plaintext body is never logged, never
 * persisted, and never appears in any error or returned value; nodemailer's
 * debug/logger output is explicitly disabled so even the ciphertext-bearing
 * SMTP conversation can never be dumped to the console.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { encryptEmailBody } from "@/lib/crypto/encryptEmail";

/** Hard ceiling on every SMTP socket phase (connect, greeting, idle read). */
const SMTP_TIMEOUT_MS = 10_000;

/** Valid TCP port range; guards a garbage SMTP_PORT env value. */
const MIN_PORT = 1;
const MAX_PORT = 65_535;

/** Default relay host: rootless-Podman DNS name for the host's Postfix. */
const DEFAULT_SMTP_HOST = "host.containers.internal";
const DEFAULT_SMTP_PORT = 25;

/**
 * Build the SMTP transport for one send. Stateless by design: no pooled
 * sockets, so a dead relay can never leave a stale connection inside the
 * server process. Defaults match the containerized Postfix relay:
 * host.containers.internal port 25, plaintext, unauthenticated.
 */
function buildTransporter(): Transporter {
  const host = process.env.SMTP_HOST?.trim() || DEFAULT_SMTP_HOST;
  const parsedPort = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "", 10);
  const port =
    Number.isFinite(parsedPort) && parsedPort >= MIN_PORT && parsedPort <= MAX_PORT
      ? parsedPort
      : DEFAULT_SMTP_PORT;
  return nodemailer.createTransport({
    host,
    port,
    // Local relay on port 25: plaintext SMTP, no implicit TLS. If the relay
    // advertises STARTTLS, nodemailer upgrades opportunistically; the
    // self-signed certificates typical of a private relay are accepted
    // because this connection never leaves the machine/container network.
    secure: false,
    tls: { rejectUnauthorized: false },
    // Unauthenticated local relay — no credentials are ever configured,
    // stored, or logged.
    // debug/logger hard-off: nodemailer's debug mode dumps the full SMTP
    // conversation to the console. The body is ciphertext by the time
    // sendMail sees it, but the conversation must never be dumped anywhere.
    debug: false,
    logger: false,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

export interface EncryptedMailInput {
  /** Recipient address (routing metadata — stays plaintext). */
  readonly to: string;
  /** Subject header (routing metadata — stays plaintext). */
  readonly subject: string;
  /**
   * Plaintext body. Encrypted in-process before the SMTP handoff; never
   * logged, persisted, or exposed in any error or returned value.
   */
  readonly body: string;
}

/** Coarse failure reasons — deliberately the only diagnostic detail returned. */
export type EncryptedMailFailureReason =
  | "SMTP_FROM not configured"
  | "no recipient address"
  | "encryption failed"
  | "network error"
  | `smtp error ${number}`;

export interface EncryptedMailResult {
  readonly sent: boolean;
  readonly reason?: EncryptedMailFailureReason;
}

/**
 * Strip CR/LF from header-bound values: To and Subject become SMTP headers,
 * and a newline would allow header injection (e.g. a smuggled Bcc).
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Send one End-to-End Encrypted email through the local Postfix relay.
 * The body is PGP-encrypted to the operator's ProtonMail key BEFORE the
 * SMTP handoff, so the relay chain (Postfix → Resend) only ever observes
 * ciphertext bodies plus routing metadata. Never throws — every failure
 * mode (missing env, no recipient, encryption failure, SMTP rejection,
 * network/timeout) collapses into `{ sent: false, reason }` so callers can
 * fire-and-forget safely. Error reasons carry the 3-digit SMTP response
 * code only: SMTP responses may echo recipient addresses, and message
 * content must never appear in any log.
 */
export async function sendEncryptedEmail(
  input: EncryptedMailInput
): Promise<EncryptedMailResult> {
  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    return { sent: false, reason: "SMTP_FROM not configured" };
  }

  const to = sanitizeHeaderValue(input.to);
  const subject = sanitizeHeaderValue(input.subject);
  if (!to) {
    return { sent: false, reason: "no recipient address" };
  }

  // Encrypt FIRST — the plaintext body never reaches this module's SMTP
  // code path. EmailEncryptionError carries a coarse code only; nothing
  // about the failure can leak the payload.
  let ciphertext: string;
  try {
    ciphertext = await encryptEmailBody(input.body);
  } catch {
    return { sent: false, reason: "encryption failed" };
  }

  try {
    const transporter = buildTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      // The armored PGP message IS the body (text/plain). ProtonMail
      // auto-detects and decrypts inline PGP on arrival.
      text: ciphertext,
    });
    return { sent: true };
  } catch (error) {
    // SMTP rejections carry a numeric response code (e.g. 550); timeouts
    // and connection failures do not. Coarse reason either way — never the
    // raw error text (SMTP responses can echo recipient addresses). The
    // object guard keeps the never-throws contract airtight even if a
    // rejection value were ever not an Error.
    const responseCode =
      typeof error === "object" && error !== null
        ? (error as { responseCode?: unknown }).responseCode
        : undefined;
    return {
      sent: false,
      reason:
        typeof responseCode === "number" ? `smtp error ${responseCode}` : "network error",
    };
  }
}
