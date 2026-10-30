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
 * Local Postfix SMTP relay integration (PHASE_29_ADMIN_EMAIL_NOTIFICATIONS,
 * reworked from the deprecated Resend API client to the operator's
 * self-hosted mail infrastructure).
 *
 * Zero-PII exception, documented deliberately: the platform never collects
 * member email addresses — accounts are username + alias + password only.
 * The ONE exception is `User.notificationEmail`, a single optional address
 * stored on ADMIN (operator) accounts exclusively, used as the destination
 * for operational alert emails (help escalations, new registrations, and
 * notification-email changes). It is never collected from members, never
 * displayed publicly, and member-facing features never read it.
 *
 * Transport: nodemailer SMTP client pointed at the local Postfix relay —
 * `SMTP_HOST` (default `localhost`), `SMTP_PORT` (default `25`), plaintext
 * (`secure: false`), unauthenticated. In production the website container
 * runs with `--network host`, so `localhost:25` is the FCOS host's Postfix
 * loopback listener; alerts never traverse an external network or a
 * third-party API. nodemailer is the single deliberate email dependency
 * (operator-approved): correct SMTP is a protocol, not a fetch call —
 * multi-line replies, STARTTLS negotiation, and MIME encoding are not worth
 * hand-rolling. Every socket phase is capped at 10 seconds so a stalled
 * relay can never hang a server action or a fire-and-forget promise chain.
 *
 * Failure posture: every entry point here is safe to call fire-and-forget
 * (`void notifyAdmins(...)`). Nothing throws; failures log exactly one line
 * with the notification type and a coarse reason — never recipient
 * addresses, never message content, and no credentials exist to leak (the
 * local relay is unauthenticated by design).
 */

import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";

/** Hard ceiling on every SMTP socket phase (connect, greeting, idle read). */
const SMTP_TIMEOUT_MS = 10_000;

/** Valid TCP port range; guards a garbage SMTP_PORT env value. */
const MIN_PORT = 1;
const MAX_PORT = 65_535;

/**
 * Build the loopback SMTP transport for one send. Stateless by design: no
 * pooled sockets, so a dead relay can never leave a stale connection inside
 * the server process. Defaults match the containerized Postfix relay:
 * localhost port 25, plaintext, unauthenticated.
 */
function buildTransporter(): Transporter {
  const host = process.env.SMTP_HOST?.trim() || "localhost";
  const parsedPort = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "", 10);
  const port =
    Number.isFinite(parsedPort) && parsedPort >= MIN_PORT && parsedPort <= MAX_PORT
      ? parsedPort
      : 25;
  return nodemailer.createTransport({
    host,
    port,
    // Local relay on port 25: plaintext SMTP, no implicit TLS. If the relay
    // advertises STARTTLS, nodemailer upgrades opportunistically; the
    // self-signed certificates typical of a private loopback relay are
    // accepted because this connection never leaves the machine.
    secure: false,
    tls: { rejectUnauthorized: false },
    // Unauthenticated local relay — no credentials are ever configured,
    // stored, or logged.
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

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
 * Send one email through the local Postfix SMTP relay. Never throws — every
 * failure mode (missing env, no recipients, SMTP rejection, network/timeout)
 * collapses into `{ sent: false, reason }` so callers can fire-and-forget
 * safely. Error reasons carry the 3-digit SMTP response code only: SMTP
 * responses may echo recipient addresses, and message content must never
 * appear in any log.
 */
export async function sendAdminEmail(input: {
  subject: string;
  html: string;
  to?: string[];
}): Promise<{ sent: boolean; reason?: string }> {
  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    return { sent: false, reason: "SMTP_FROM not configured" };
  }

  const to = input.to ?? (await getAdminNotificationEmails());
  if (to.length === 0) {
    return { sent: false, reason: "no admin notification email on record" };
  }

  try {
    const transporter = buildTransporter();
    await transporter.sendMail({
      from,
      to,
      subject: input.subject,
      html: input.html,
    });
    return { sent: true };
  } catch (error) {
    // SMTP rejections carry a numeric response code (e.g. 550); timeouts and
    // connection failures do not. Coarse reason either way — never the raw
    // error text (SMTP responses can echo recipient addresses).
    const responseCode = (error as { responseCode?: unknown }).responseCode;
    return {
      sent: false,
      reason:
        typeof responseCode === "number" ? `smtp error ${responseCode}` : "network error",
    };
  }
}

/**
 * Operational alert payloads. A discriminated union so `notifyAdmins` can
 * render the right minimal copy and route to the right recipients:
 * - help_escalation: a public help ticket was triaged into the admin queue.
 * - registration: a new account was created (first account becomes ADMIN).
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

// Shared email chrome: plain, minimal, inline-styled dark background. No
// external assets, no tracking pixels, no HTML entities beyond what the
// content itself needs — the email body is operator-facing only.
const EMAIL_STYLES = {
  body: "margin:0;padding:24px;background:#111318;color:#e6e8ee;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.6;",
  card: "max-width:560px;margin:0 auto;background:#1a1d24;border:1px solid #2a2e37;border-radius:8px;padding:20px;",
  heading:
    "margin:0 0 12px;font-size:15px;letter-spacing:0.08em;text-transform:uppercase;color:#8ab4f8;",
  label: "color:#9aa0ab;",
  value: "color:#e6e8ee;",
  footer: "margin-top:16px;padding-top:12px;border-top:1px solid #2a2e37;color:#6b7280;font-size:12px;",
} as const;

function row(label: string, value: string): string {
  return `<p style="margin:4px 0"><span style="${EMAIL_STYLES.label}">${label}:</span> <span style="${EMAIL_STYLES.value}">${value}</span></p>`;
}

// PHASE_29_ADMIN_EMAIL_NOTIFICATIONS: user-supplied content (self-declared
// aliases, raw help-request excerpts, usernames) must never reach the
// operator's inbox as markup — unescaped interpolation would let a malicious
// help request or registration render HTML/phishing content in the email
// client. Every dynamic value is escaped before interpolation; static
// template strings stay as-is.
/** Escape a value for safe interpolation into the HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Fire-and-forget admin alert dispatcher. Builds the minimal HTML email for
 * the notification type, routes it (email_changed → the OLD address only and
 * canary_staged → the staged destination only; everything else → all
 * configured admin destinations), and swallows every failure with a single
 * coarse log line. Callers use `void notifyAdmins(...)` — this must never
 * block or fail the surrounding server action.
 */
export async function notifyAdmins(notification: AdminNotification): Promise<void> {
  try {
    let subject: string;
    let html: string;
    let to: string[] | undefined;

    switch (notification.type) {
      case "help_escalation": {
        subject = `Help escalation: ${escapeHtml(notification.category)} (ticket ${escapeHtml(notification.ticketId)})`;
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">Help request escalated</h2>
${row("Ticket", escapeHtml(notification.ticketId))}
${row("Alias", escapeHtml(notification.alias))}
${row("Category", escapeHtml(notification.category))}
${row("Urgency", "HIGH")}
${row("Excerpt", escapeHtml(notification.excerpt))}
<p style="${EMAIL_STYLES.footer}">Resolve in the admin console help queue.</p>
</div></div>`;
        break;
      }
      case "registration": {
        subject = "New registration";
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">New member registered</h2>
${row("Alias", escapeHtml(notification.alias))}
${row("Username", escapeHtml(notification.username))}
<p style="${EMAIL_STYLES.footer}">No action needed — informational alert.</p>
</div></div>`;
        break;
      }
      case "email_changed": {
        subject = "Admin notification email changed";
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">Notification email changed</h2>
${row("Old address", escapeHtml(notification.oldEmail))}
${row("New address", escapeHtml(notification.newEmail))}
${row("Changed by", escapeHtml(notification.changedBy))}
<p style="${EMAIL_STYLES.footer}">If this wasn't you, sign in and change it back immediately — operational alerts are now going to the new address.</p>
</div></div>`;
        // Route to the OLD address: the party being alerted about the change
        // is whoever still controls the previous inbox.
        to = [notification.to];
        break;
      }
      case "canary_staged": {
        subject = "Approve canary update — ToolsLibrary";
        const actionLabel =
          notification.action === "AFFIRM"
            ? "Affirm canary for another month"
            : "Disclose a canary event";
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">Canary approval required</h2>
${row("Action", escapeHtml(actionLabel))}
${row("Expires in", `${notification.expiresInMinutes} minutes`)}
<p style="margin:12px 0 4px"><span style="${EMAIL_STYLES.label}">Confirmation link (single-use):</span><br /><a style="color:#8ab4f8;word-break:break-all" href="${escapeHtml(notification.confirmUrl)}">${escapeHtml(notification.confirmUrl)}</a></p>
<p style="${EMAIL_STYLES.footer}">This link is single-use and requires you to be signed in as an administrator. If you did not stage this update, treat the admin session as compromised.</p>
</div></div>`;
        // Route to the staging admin's OWN address: the out-of-band factor
        // must reach the inbox that the passphrase holder expects.
        to = [notification.to];
        break;
      }
      case "canary_committed": {
        subject = "Canary update committed";
        const committedLabel =
          notification.action === "AFFIRM"
            ? "Affirm canary for another month"
            : "Disclose a canary event";
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">Canary update committed</h2>
${row("Action", escapeHtml(committedLabel))}
${row("Signed by", escapeHtml(notification.alias))}
${row("Valid until", notification.validUntil ? escapeHtml(notification.validUntil.slice(0, 10)) : "—")}
${row("Note", notification.note ? escapeHtml(notification.note) : "—")}
<p style="${EMAIL_STYLES.footer}">The transparency page now reflects this event.</p>
</div></div>`;
        break;
      }
      case "canary_failed_attempt": {
        subject = "FAILED canary passphrase attempt";
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">Failed canary passphrase attempt</h2>
${row("Attempted by", escapeHtml(notification.alias))}
<p style="${EMAIL_STYLES.footer}">Someone using this admin session entered a wrong canary passphrase. If this wasn't you, rotate credentials immediately.</p>
</div></div>`;
        break;
      }
      case "canary_passphrase_enrolled": {
        subject = "Canary passphrase enrolled";
        html = `<div style="${EMAIL_STYLES.body}"><div style="${EMAIL_STYLES.card}">
<h2 style="${EMAIL_STYLES.heading}">Canary passphrase enrolled</h2>
${row("Enrolled by", escapeHtml(notification.alias))}
<p style="${EMAIL_STYLES.footer}">A canary passphrase was set for this admin account — first enrollment needs no current passphrase by definition. If this wasn't you, a hijacked session may be enrolling its own canary credentials: rotate credentials immediately.</p>
</div></div>`;
        break;
      }
    }

    const result = await sendAdminEmail({ subject, html, to });
    if (!result.sent) {
      // One coarse line: type + reason. Never addresses, never content,
      // never credentials.
      console.error(
        "[email] admin notification failed:",
        notification.type,
        result.reason
      );
    }
    // On success log nothing (zero-log discipline).
  } catch (error) {
    // Absolute last resort — sendAdminEmail already never throws, but this
    // guard guarantees the fire-and-forget contract even if the email
    // module's own wiring regresses.
    console.error(
      "[email] admin notification failed:",
      notification.type,
      error instanceof Error ? "internal error" : "unknown error"
    );
  }
}
