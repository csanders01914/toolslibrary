# Transparency Report — Tool Library

What we can't collect can't be seized, subpoenaed, or sold. This report is our
standing declaration of what has — and has not — happened on this server. It mirrors
the in-app report at `/transparency` and accompanies the
[Privacy Policy](privacy-policy.md), [Terms of Service](terms-of-service.md), and
[Code of Conduct](code-of-conduct.md).

- **Scope:** this running instance of the Tool Library, operated on self-hosted
  hardware by its administrator(s).
- **Method:** verified by absence. The platform is architected so that no personal
  data exists to surrender, share, or lose.

---

## 1. Warrant Canary

**STATUS: INTACT**

As of the last affirmation date below:

- This service has received **zero** government or law-enforcement requests for user
  data.
- No gag orders, national security letters, or secret subpoenas have been served on
  the operators.
- No warrants, court orders, or informal requests have been received from any local,
  state, or federal agency.
- No backdoors, lawful-intercept hooks, or deliberate weaknesses have been introduced
  into this software.

**Canary last affirmed: 2026-10-25**

> If this canary is ever removed, altered, or goes stale without explanation, treat
> that as a signal to assume compromise and verify independently.

## 2. Handling of Data Requests

Because the platform collects no personal information — no emails, no phone numbers,
no real names, no IP logs — there is nothing to hand over in response to any request.
Any such request would be answered with that fact, and the warrant canary above would
be updated to reflect it. This is the strongest privacy guarantee that can exist:
**absence**.

## 3. Third-Party Data Sharing

| Category | Status |
|----------|--------|
| Advertising networks | $0 — none exist |
| Analytics providers | $0 — none exist |
| Cloud hosting providers | $0 — self-hosted on local hardware |
| Payment processors | $0 — no payments are processed |
| Email delivery services | $0 — no emails are collected or sent |
| CDNs & font providers | $0 — all assets served locally |
| Automation LLM provider | Only the content described in the Privacy Policy (Section 4), and only when the automation service is used; $0 if a local Ollama endpoint is configured |

## 4. Local Server Facts

| Fact | Detail |
|------|--------|
| **Hosting** | Fedora CoreOS, self-hosted — a single physical machine under the Operator's physical control. |
| **Data store** | SQLite (WAL mode) — one database file on a local volume. No managed cloud database. |
| **Application logs** | Zero IP logging — the Next.js application performs no request-IP retention and logs errors only. |
| **Source code** | AGPLv3, fully public — every line running here is auditable in the public repository (linked in the site footer, per AGPLv3 Section 13). |

## 5. Security Posture

For auditors verifying the claims above, the relevant mechanisms are:

- Passwords hashed with **bcrypt cost 12**; recovery codes stored only as SHA-256
  hashes, single-use.
- Automation provider API keys encrypted **at rest with AES-256-GCM** and never
  returned to the browser.
- **Human-in-the-loop approval gates:** destructive automated operations are created
  as `PENDING` and never execute without explicit administrator confirmation.
- **Rootless Podman** deployment with `--userns=keep-id`, SELinux-labeled volume
  (`:Z`), and a non-root container user.
- **Zod validation** on all inputs: API routes, Server Actions, operation arguments,
  and service output.

## 6. Auditability

- The complete source code is publicly available under the GNU AGPLv3; the version
  running on this instance is built from it via the public `Containerfile`.
- All persistent data lives in a single SQLite file and a local uploads directory on
  the host volume — inspectable by the Operator and, on request, exportable to the
  member it concerns.
- The repository maintains a deterministic integrity system
  (`scripts/verify-handoff.mjs`) that checksums tracked files, making undocumented
  modifications to the codebase detectable between sessions.

## 7. Maintaining This Report (Self-Hosters)

If you operate your own instance, this file and `/transparency` are yours to maintain:

1. Re-affirm the warrant canary honestly and update the **last affirmed** date each
   time — a stale canary is treated as a compromise signal by design.
2. Update the sharing table and server facts to match your actual deployment
   (including your automation provider configuration).
3. Publish changes to this file in the repository history so the affirmation trail is
   itself auditable.

## 8. Changes & Contact

Material changes to this report are published in the repository history; the version
displayed in the running Service is the authoritative one. Questions about this report?
Read the [Privacy Policy](privacy-policy.md) or reach the collective via Matrix
(<https://matrix.to/#/#tools-library:matrix.org>).
