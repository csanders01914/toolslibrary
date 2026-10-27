# Privacy Policy — Tool Library

This service is engineered so that it is structurally incapable of surveilling you.
There is no data broker relationship to disclose, because there is no data to broker.
This policy mirrors the in-app legal hub at `/privacy` and is enforced alongside the
[Terms of Service](terms-of-service.md) and the [Code of Conduct](code-of-conduct.md).

- **Zero-PII by architecture, not by promise.** The platform has no field, endpoint,
  or log sink for personal information. What cannot be collected cannot be leaked,
  sold, seized, or subpoenaed.
- **Operator:** the administrator(s) of this self-hosted instance (see Section 8).

---

## 1. What We Never Collect

- **Email addresses** — we do not ask for them and there is no field to enter one.
- **Phone numbers** — never requested, never stored.
- **Real names** — your public identity is a self-chosen alias, nothing more.
- **IP addresses** — the server performs zero IP logging at the application layer.
- **Analytics & telemetry** — there is no analytics script, no beacon, no pixel, no
  CDN. Next.js telemetry is disabled (`NEXT_TELEMETRY_DISABLED=1`).
- **Third-party cookies or trackers** — the only cookies are your session and your
  anonymous accessibility preferences (Section 3).

## 2. The Complete Inventory of Stored Data

Everything the platform can ever know about you:

| Data | Details |
|------|---------|
| **Login handle (`username`)** | A 3–24 character handle of letters, numbers, hyphens, and underscores used to log in. It is your account key, not your identity. |
| **Public alias** | A display name shown to neighbors. Choose anything — a first name, a nickname, or a pseudonym. Change it anytime from your dashboard. |
| **Password hash** | Your password is hashed with bcrypt at cost factor 12. The plaintext password is never written to disk, logged, or transmitted anywhere except the login request itself. |
| **Recovery key hashes** | Eight single-use recovery codes are generated at registration. Only their SHA-256 hashes are stored; the plaintext codes are shown exactly once and exist nowhere else. |
| **Listing & loan data** | Tools, skills, loan requests, and messages you create. These are the operational minimum for a functioning lending collective. |
| **Optional bio** | Free text you choose to write on your profile. Leave it empty if you prefer. |
| **Anonymous accessibility preferences** | Optional JSON (contrast, font size, dyslexia font, spacing, and similar display settings) synced to your account so your accessibility settings follow you between devices. It contains no identifying data. |
| **Trust score** | A community-reputation number (base 100) adjusted by loan outcomes (+5 on-time good return, −15 damaged/overdue). Visible to other members. |

No other data exists. There is no hidden table, no shadow profile, and no export to
any external system.

## 3. Cookies

Exactly two cookies are used, both first-party:

1. **Session cookie** — an HTTP-only JWT session cookie issued by the authentication
   layer. It contains your account id, username, alias, and role, and expires after a
   short sliding window. It is required to stay logged in.
2. **`a11y_prefs` cookie** — an anonymous cookie storing your accessibility display
   preferences so they apply before first paint. It contains no identifier.

There are no advertising, analytics, social-media, or cross-site tracking cookies.

## 4. Automation & AI Disclosure

This instance can run an optional automation service (help-ticket triage, listing
moderation audits, and an operations assistant). When it does:

- The **content you submitted for that purpose** (for example, the text of a help
  request or the details of a listing being audited) may be sent to the chat-completion
  provider configured by the Operator — a hosted provider (OpenRouter, OpenAI,
  DeepSeek, Z.ai) or a **local Ollama endpoint** on the Operator's own hardware.
- **Never transmitted:** your password or its hash, your recovery codes or their
  hashes, your session token, or any contact information — none of which exist to send.
- Provider API keys are stored **AES-256-GCM encrypted at rest** and are never
  returned to the browser — only a masked hint is ever displayed.
- If the Operator configures a local Ollama endpoint, no automation data leaves the
  server at all.

## 5. Infrastructure & Hosting

- The application runs on a self-hosted Fedora CoreOS server inside a rootless Podman
  container. There is no cloud provider account, no managed database service, and no
  third-party log aggregation.
- All data lives in a **single SQLite database file** (WAL mode) on the host volume.
- Uploaded images are stored locally in the data volume and served directly by the
  application — never by an object-storage provider or CDN.
- All assets (fonts, icons, images, scripts) are served locally. The application makes
  no outbound calls except to the Operator-configured automation endpoint (Section 4).

## 6. Logs & Retention

- The application logs **errors only**. It performs no request-IP retention, no access
  logging, and no behavioral tracking.
- Data is retained only while your account exists. **Deleting your account removes
  your user record, recovery keys, tools, skills, and messages via cascading deletes.**
- The database and uploads live in one directory that the Operator backs up by copying;
  backups inherit the same zero-PII property.

## 7. Your Rights & Controls

- **Pseudonymity:** use any alias you like; change it anytime from your dashboard.
- **Correction:** edit your alias and bio at any time.
- **Accessibility data:** reset all accessibility preferences from the accessibility
  menu (Alt+A), which clears the cookie and the optional account sync.
- **Deletion:** request account deletion via the in-app messenger or Matrix; the
  Operator deletes the account, which cascades to all associated data (Section 6).
- **Inspection:** the entire database is a single file on the Operator's volume; the
  full source code that reads and writes it is public under AGPLv3, so every access
  path is auditable.

Because we collect no contact information, we cannot and will not sell, share, or
respond to data requests about you: there is nothing to hand over. This is the
strongest privacy guarantee that can exist — **absence**.

## 8. Operator & Jurisdiction

This instance is operated on a single physical machine under the Operator's physical
control, in the Operator's jurisdiction. The running service, not this repository,
defines the actual deployment; the Operator is responsible for the host, the volume,
and the configured automation endpoint.

## 9. Law-Enforcement Requests

The platform holds no personal data that could be surrendered. The standing status of
government and law-enforcement requests, gag orders, and backdoors is published in the
[Transparency Report](src/app/transparency/page.tsx), including a warrant canary.

## 10. Third-Party Sharing

| Party | Amount shared |
|-------|---------------|
| Advertising networks | $0 — none exist |
| Analytics providers | $0 — none exist |
| Cloud hosting providers | $0 — self-hosted on local hardware |
| Payment processors | $0 — no payments are processed |
| Email delivery services | $0 — no emails are collected or sent |
| CDNs & font providers | $0 — all assets served locally |
| Automation LLM provider | Only the content described in Section 4, and only when the automation service is used; $0 if a local endpoint is configured |

## 11. Changes to This Policy

This policy may be updated to reflect changes in the Service. Material changes will be
published on this page, and the version displayed in the running Service is the
authoritative one. Because the platform collects no personal data, policy changes
cannot retroactively affect data that does not exist.

## 12. Contact

Questions about this policy? Read the
[Transparency Report](src/app/transparency/page.tsx) or reach the collective via
Matrix (<https://matrix.to/#/#tools-library:matrix.org>).
