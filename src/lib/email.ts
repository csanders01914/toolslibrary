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
 * Admin alert notifications (PHASE_29_ADMIN_EMAIL_NOTIFICATIONS), migrated
 * to the E2EE outbound pipeline (operator-directed PHASE_38/40 work).
 *
 * Zero-PII exception, documented deliberately: the platform never collects
 * member email addresses — accounts are username + alias + password only.
 * The ONE exception is `User.notificationEmail`, a single optional address
 * stored on ADMIN (operator) accounts exclusively, used as the destination
 * for operational alert emails (help escalations, new registrations, and
 * notification-email changes). It is never collected from members, never
 * displayed publicly, and member-facing features never read it.
 *
 * Transport: every alert body is PGP-encrypted in process to the operator's
 * ProtonMail public key (src/lib/crypto/encryptEmail.ts) BEFORE the SMTP
 * handoff (src/lib/mail/transporter.ts → local Postfix relay → Resend
 * smart host). The relay chain only ever observes ciphertext bodies plus
 * routing metadata (envelope From, recipient To, Subject header) — never
 * the body. Bodies are plain text (the armored PGP message is the text
 * body), which ProtonMail auto-decrypts on arrival; the former HTML chrome
 * is gone because HTML would have to travel as readable markup or as
 * PGP/MIME structure the simple text pipeline does not produce. Alert
 * content is operator-facing only, so plain text loses nothing material.
 *
 * Routing: one encrypted message per destination. All destinations must be
 * inboxes the operator's key can decrypt (the operator's own ProtonMail
 * addresses/aliases) — mail encrypted to the operator's public key is
 * unreadable by anyone else, fail closed.
 *
 * Failure posture: every entry point here is safe to call fire-and-forget
 * (`void notifyAdmins(...)`). Nothing throws; failures log exactly one line
 * with the notification type and a coarse reason — never recipient
 * addresses, never message content, and no credentials exist to leak (the
 * local relay is unauthenticated by design).
 */

import { prisma } from "@/lib/db";
import { sendEncryptedEmail } from "@/lib/mail/transporter";

/**
 * All configured admin alert destinations: ADMIN accounts with a non-empty
 * `notificationEmail` on record. Returns [] when no admin has opted in yet
 * (e.g. before the forced first-time setup flow completes).
 */
export async function getAdminNotificationEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", notificationEmail: { not: null } },
    select: { notificationEmail: true },
  });
  return admins
    .map((admin) => admin.notificationEmail?.trim() ?? "")
    .filter((email) => email.length > 0);
}

/**
 * Operational alert payloads. A discriminated union so `notifyAdmins` can
 * render the right minimal copy and route to the right recipients:
 * - help_escalation: a public help ticket was triaged into the admin queue.
 * - registration: a new account was created (the operator promotes the
 *   owner's account to ADMIN out-of-band via scripts/bootstrap-admin.mjs —
 *   registration itself never grants ADMIN, Stage 4 of the KILO
 *   auth/security plan).
 * - email_changed: the admin notification email itself was replaced — `to`
 *   is the OLD address, which must be alerted so a hijacked session cannot
 *   silently redirect operational alerts to an attacker-controlled inbox.
 */
export type AdminNotification =
  | {
      type: "help_escalation";
      ticketId: string;
      alias: string;
      category: string;
      excerpt: string;
    }
  | { type: "registration"; username: string; alias: string }
  | {
      type: "email_changed";
      to: string;
      oldEmail: string;
      newEmail: string;
      changedBy: string;
    }
  // PHASE_30_CANARY_SIGNING: warrant-canary lifecycle alerts. canary_staged
  // is the out-of-band approval half of the two-factor gate — it routes to
  // the staging admin's OWN notification address (like email_changed) and
  // carries the single-use confirmation link. canary_committed and
  // canary_failed_attempt use default routing (all configured admins): a
  // committed canary event is public information, and a failed passphrase
  // attempt against a hijacked session is exactly the signal every admin
  // must not miss.
  | {
      type: "canary_staged";
      to: string;
      action: "AFFIRM" | "DISCLOSE";
      confirmUrl: string;
      expiresInMinutes: number;
    }
  | {
      type: "canary_committed";
      action: "AFFIRM" | "DISCLOSE";
      alias: string;
      validUntil: string | null;
      note: string | null;
    }
  | { type: "canary_failed_attempt"; alias: string }
  | { type: "canary_passphrase_enrolled"; alias: string };

/**
 * Render one alert as its plain-text subject and body. Pure function — no
 * I/O, no DB, no transport. The body travels only as PGP ciphertext on the
 * wire, so user-supplied content (aliases, excerpts) passes through
 * verbatim: there is no HTML rendering to inject into, and the plaintext
 * body never leaves the process unencrypted. Subjects stay plaintext
 * (routing metadata) and are CR/LF-sanitized by the transport's header
 * guard before they touch SMTP.
 */
export function renderAdminNotification(notification: AdminNotification): {
  subject: string;
  body: string;
} {
  let subject: string;
  let body: string;

  switch (notification.type) {
    case "help_escalation": {
      subject = `Help escalation: ${notification.category} (ticket ${notification.ticketId})`;
      body = [
        "Help request escalated",
        "",
        `Ticket: ${notification.ticketId}`,
        `Alias: ${notification.alias}`,
        `Category: ${notification.category}`,
        "Urgency: HIGH",
        `Excerpt: ${notification.excerpt}`,
        "",
        "Resolve in the admin console help queue.",
      ].join("\n");
      break;
    }
    case "registration": {
      subject = "New registration";
      body = [
        "New member registered",
        "",
        `Alias: ${notification.alias}`,
        `Username: ${notification.username}`,
        "",
        "No action needed — informational alert.",
      ].join("\n");
      break;
    }
    case "email_changed": {
      subject = "Admin notification email changed";
      body = [
        "Notification email changed",
        "",
        `Old address: ${notification.oldEmail}`,
        `New address: ${notification.newEmail}`,
        `Changed by: ${notification.changedBy}`,
        "",
        "If this wasn't you, sign in and change it back immediately — operational alerts are now going to the new address.",
      ].join("\n");
      break;
    }
    case "canary_staged": {
      subject = "Approve canary update — ToolsLibrary";
      const actionLabel =
        notification.action === "AFFIRM"
          ? "Affirm canary for another month"
          : "Disclose a canary event";
      body = [
        "Canary approval required",
        "",
        `Action: ${actionLabel}`,
        `Expires in: ${notification.expiresInMinutes} minutes`,
        "",
        "Confirmation link (single-use):",
        notification.confirmUrl,
        "",
        "This link is single-use and requires you to be signed in as an administrator. If you did not stage this update, treat the admin session as compromised.",
      ].join("\n");
      break;
    }
    case "canary_committed": {
      subject = "Canary update committed";
      const committedLabel =
        notification.action === "AFFIRM"
          ? "Affirm canary for another month"
          : "Disclose a canary event";
      body = [
        "Canary update committed",
        "",
        `Action: ${committedLabel}`,
        `Signed by: ${notification.alias}`,
        `Valid until: ${notification.validUntil ? notification.validUntil.slice(0, 10) : "—"}`,
        `Note: ${notification.note ?? "—"}`,
        "",
        "The transparency page now reflects this event.",
      ].join("\n");
      break;
    }
    case "canary_failed_attempt": {
      subject = "FAILED canary passphrase attempt";
      body = [
        "Failed canary passphrase attempt",
        "",
        `Attempted by: ${notification.alias}`,
        "",
        "Someone using this admin session entered a wrong canary passphrase. If this wasn't you, rotate credentials immediately.",
      ].join("\n");
      break;
    }
    case "canary_passphrase_enrolled": {
      subject = "Canary passphrase enrolled";
      body = [
        "Canary passphrase enrolled",
        "",
        `Enrolled by: ${notification.alias}`,
        "",
        "A canary passphrase was set for this admin account — first enrollment needs no current passphrase by definition. If this wasn't you, a hijacked session may be enrolling its own canary credentials: rotate credentials immediately.",
      ].join("\n");
      break;
    }
  }

  return { subject, body };
}

/**
 * Pure routing: which destinations receive this alert.
 * - email_changed → the OLD address only: the party being alerted about the
 *   change is whoever still controls the previous inbox. Under E2EE the
 *   body is encrypted to the operator's key, so a hijacker's new address
 *   never receives readable content and the legitimate owner still can.
 * - canary_staged → the staged destination only: the out-of-band factor
 *   must reach the inbox that the passphrase holder expects.
 * - everything else → all configured admin destinations.
 */
export function routeAdminNotification(
  notification: AdminNotification,
  configured: string[]
): string[] {
  switch (notification.type) {
    case "email_changed":
    case "canary_staged":
      return [notification.to];
    default:
      return configured;
  }
}

export interface AdminDeliveryOutcome {
  readonly sent: number;
  readonly failed: number;
  /** Coarse reason of the first failed send, if any. Never an address. */
  readonly firstReason?: string;
}

/**
 * Deliver one rendered alert to each destination as its own encrypted
 * message (the E2EE transport takes a single recipient per message). Never
 * throws — every per-recipient failure collapses into the outcome counters
 * with a coarse reason, so the fire-and-forget contract holds even if the
 * transport wiring regresses.
 */
export async function deliverAdminNotification(
  to: string[],
  subject: string,
  body: string
): Promise<AdminDeliveryOutcome> {
  let sent = 0;
  let failed = 0;
  let firstReason: string | undefined;

  for (const recipient of to) {
    const result = await sendEncryptedEmail({
      to: recipient,
      subject,
      body,
    });
    if (result.sent) {
      sent += 1;
    } else {
      failed += 1;
      firstReason ??= result.reason;
    }
  }

  return { sent, failed, firstReason };
}

/**
 * Fire-and-forget admin alert dispatcher. Resolves the configured
 * destinations from the database, routes, renders the plain-text alert,
 * and dispatches one PGP-encrypted message per destination. Swallows every
 * failure with a single coarse log line. Callers use
 * `void notifyAdmins(...)` — this must never block or fail the surrounding
 * server action.
 */
export async function notifyAdmins(notification: AdminNotification): Promise<void> {
  try {
    const configured = await getAdminNotificationEmails();
    const to = routeAdminNotification(notification, configured);
    if (to.length === 0) {
      console.error(
        "[email] admin notification failed:",
        notification.type,
        "no admin notification email on record"
      );
      return;
    }

    const { subject, body } = renderAdminNotification(notification);
    const outcome = await deliverAdminNotification(to, subject, body);
    if (outcome.failed > 0) {
      // One coarse line: type + failure count + first coarse reason. Never
      // addresses, never content, never credentials.
      console.error(
        "[email] admin notification failed:",
        notification.type,
        `${outcome.failed}/${to.length} failed:`,
        outcome.firstReason
      );
    }
    // On success log nothing (zero-log discipline).
  } catch (error) {
    // Absolute last resort — the render/route/deliver chain never throws by
    // contract, but this guard guarantees the fire-and-forget contract even
    // if the module's own wiring regresses.
    console.error(
      "[email] admin notification failed:",
      notification.type,
      error instanceof Error ? "internal error" : "unknown error"
    );
  }
}
