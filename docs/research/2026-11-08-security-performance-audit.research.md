# ToolsLibrary v2 — Security & Performance Audit

*Research brief · 2026-11-08 · read-only session (no source, config, or test files modified)*

**Scope:** full-repository audit of `toolslibrary-v2` (Next.js 15 App Router + Prisma/SQLite web app, rootless-Podman/FCOS deployment, standalone Matrix-bot helpdesk project) for security vulnerabilities, performance hazards, code-quality problems, and optimization opportunities.

**Method:** targeted reads of every API route handler, all server actions, auth/crypto/rate-limit/PoW/upload libraries, the Prisma schema and migrations, container/deploy/backup scripts, and the `tools-library-bot` webhook surface — cross-checked against live dependency advisories (Next.js/next-auth GHSA records, Snyk/npm registries, Prisma docs). Every internal claim is anchored to a `file:line` reference. Claims that could not be fully confirmed in this session are labeled **[Hypothesis]** with a validation step.

---

## 1. Verdict / Executive Summary

The codebase is a disciplined, security-aware Next.js 15 + Prisma/SQLite application: authorization is re-checked in every API route, brute-force/PoW gates are layered correctly, tokens and recovery codes are properly hashed, and the PGP-email and canary-signing pipelines are unusually well-engineered for a self-hosted project.

That said, the audit found:

- **One broken privacy contract** — secret-link images are bypassable via the unauthenticated `/api/uploads/` route (S1).
- **One deployment-contract contradiction with data-loss risk** — the container boots with `prisma db push`, which `AGENTS.md` §2 (PHASE_22) explicitly forbids and which the Containerfile's own comment contradicts (S2).
- **Two known-vulnerable dependency versions** — `next-auth@5.0.0-beta.25` (4 unfixed advisories, 2 Critical, fixed in beta.32) and `next@15.5.28` (one patch behind the Nov 3 2026 security release `15.5.29`) (S3, §5).
- **A cluster of correctness races** — recovery-code double-spend, first-user ADMIN race, unclamped trust-score mutations (S4–S6).
- **Several event-loop-blocking I/O and unbounded-query performance hazards** (P1–P7).

Recommended remediation order: **B → A → F → C → E → D → G** (§4).

---

## 2. Architecture & Execution Flow

- **Requests** enter via `src/middleware.ts:21-40` (edge NextAuth wrapper; redirects `/mustChangePassword` → `/change-password` and admin-email gate → `/admin-email`). The matcher (`src/middleware.ts:42-45`) **excludes `/api`**, so every route handler self-authorizes via `await auth()` — verified present in all 17 REST routes read during the audit.
- **Pages** are all `export const dynamic = "force-dynamic"` (e.g. `src/app/tools/page.tsx:24`); they query Prisma server-side, apply guest redaction via `src/lib/redact.ts:29-31`, then hydrate client components. `ToolsClient.tsx` performs all search/filter client-side.
- **Writes**: Server Actions in `src/lib/actions/*` (zod-validated, auth-checked) plus four REST multipart handlers (`/api/tools/create`, `/api/tools/[id]/image`, `/api/images/create`, `/api/tools/loan`) that exist to bypass the Cloudflare-Tunnel 403 on binary Server Actions (`next.config.ts:26-40`).
- **Persistence**: SQLite WAL via `src/lib/db.ts:36-38`. The three `$queryRawUnsafe` calls use constant strings only — **no SQL-injection surface found**; no `$executeRawUnsafe` with interpolated input exists anywhere.
- **Anti-abuse stack**: in-memory token-bucket rate limiter with per-process salted client hashes (`src/lib/rateLimit.ts:101-147`), stateless HMAC-signed proof-of-work challenges bound to surface + client + jti (`src/lib/pow.ts:141-310`), variable difficulty driven by suspicion scoring (`pow.ts:400-425`).
- **Background**: `src/instrumentation.ts:26-31` boots a singleton Matrix long-polling listener (`src/lib/matrixListener.ts:138-233`); dormant without env config.
- **Email**: PGP-encrypt-before-SMTP pipeline — `src/lib/crypto/encryptEmail.ts` (operator public key, coarse-code errors, no logging) → `src/lib/mail/transporter.ts` (header CRLF sanitization `:131-133`, TLS `rejectUnauthorized: false` documented `:88`) → local Postfix → Resend smart host.
- **Warrant canary**: Ed25519-signed append-only history; private key seal is AES-256-GCM under an HKDF key derived from `AUTH_SECRET` (`src/lib/canary.ts:161-211`); staging requires a dedicated bcrypt-12 passphrase **plus** a single-use 256-bit email token hashed (SHA-256) at rest (`canary.ts:345-386`); commit re-checks the terminal-disclosure guard inside the transaction (`canary.ts:483-553`). Sound design.
- **Bot project** (`tools-library-bot/`): separate Express webhook (`src/server/webhook.ts:57-141`) with timing-safe shared-secret check and per-IP budget (`src/server/guards.ts:37-77`); no dynamic triage, no LLM — regex intent router only.

---

## 3. Findings

### 3.1 Security — HIGH

#### S1 — Secret-link image model is bypassable via the public uploads route

- **Contract:** `prisma/schema.prisma:233-238` and `src/lib/images.ts:19-27` promise each published image is reachable *only* at `/i/<256-bit token>`.
- **Reality:** `src/app/api/images/create/route.ts:105` stores the file with the same `saveUploadedImage()` into the same `data/uploads` directory as public tool photos, and `src/app/api/uploads/[filename]/route.ts:23-54` serves **any** file in that directory, unauthenticated, with `Cache-Control: public, max-age=31536000, immutable`. The `/i/[token]` route's `Cache-Control: private` (`src/app/i/[token]/route.ts:94`) is meaningless if the identical bytes are publicly cacheable at `/api/uploads/<filename>`.
- **Aggravator:** filenames are low-entropy — `src/lib/uploads.ts:85`: `${Date.now()}-${Math.random().toString(36).slice(2)}` — and public tool-photo filenames are visible in every listing page's HTML, disclosing the naming scheme. `Math.random()` is not CSPRNG.
- **Exploitability:** LOW in practice (no listing/index, filename must be guessed) but the documented invariant is false, and associated private-cache/CDN properties (S8) do not hold.
- **Fix:** store secret-link images in a separate directory (e.g. `data/uploads/secret/`) served only by `/i/[token]`, or filter `/api/uploads/` to filenames matching an existing `Tool.imageUrl`. Migrate existing `PublishedImage` rows.

#### S2 — Container boots with `prisma db push`, contradicting its own comment and AGENTS.md

- `Containerfile:96-104` documents "`migrate deploy` … never destroys data; schema drift fails loudly (unlike `db push`, … can silently truncate or drop columns)".
- `Containerfile:105` actually runs: `CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node server.js"]`.
- `AGENTS.md` §2: "`prisma db push` is forbidden against any real database (PHASE_22)".
- **Impact:** every container start force-syncs the live SQLite volume; a schema drift (e.g. renamed column) is resolved silently — **potentially destructive data loss** on deploy.
- **Fix:** `CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]`. Versioned migrations already exist under `prisma/migrations/`.

#### S3 — next-auth 5.0.0-beta.25 carries four unfixed advisories (fixed in 5.0.0-beta.32)

Locked at `package.json:17` and `package-lock.json:1879`:

| Advisory | Severity | Relevance here |
|---|---|---|
| CVE-2026-73421 / GHSA-8fpg-xm3f-6cx3 — configuration errors make existence-based auth checks fail open (auth object populated with an error) | Critical | Directly adjacent to this codebase's existence checks (`src/auth.config.ts:89-109`, `src/middleware.ts:24-37`). Current code compares `.user` fields, so it fails *closed* today — but the pattern is one refactor away from fail-open. |
| CVE-2026-73418 / GHSA-xmf8-cvqr-rfgj — `getToken()` throws uncaught on malformed Bearer headers | High | **Not called anywhere in this repo** (grep-verified) → latent only. |
| CVE-2026-73420 / GHSA-7rqj-j65f-68wh — email normalizer homoglyph `@` bypass | Critical | No email provider configured → not reachable. |
| CVE-2026-73419 / GHSA-x445-f3h2-j279 — OAuth state/nonce/PKCE cookies not provider-bound | Medium | No OAuth provider → not reachable. |
| GHSA-5jpx-9hw9-2fx4 — nodemailer `<7.0.7` address-parse email misdelivery (fixed beta.30) | Medium | No email provider; app's own nodemailer recipients are operator-typed (`admin.ts:365-376`). |

**Fix:** upgrade to `next-auth@5.0.0-beta.32` or later and re-run the build gate; the code is compatible (credentials provider, callbacks API unchanged between beta.25 and beta.32).

### 3.2 Security — MEDIUM

**S4 — Recovery codes are double-spendable (TOCTOU).** `src/lib/actions/auth.ts:174` checks `!k.usedAt` **outside** the transaction, then `:183-186` updates by `id` with no `usedAt: null` predicate. Two concurrent submissions of the same code both pass, both commit → two password resets from one single-use code. **Fix:** `recoveryKey.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } })` inside the transaction and abort when `count === 0`.

**S5 — First-user ADMIN race + unhandled unique violation on registration.** `src/lib/actions/auth.ts:94-103`: `findUnique`-then-`create` is not atomic (concurrent same-username registration → unhandled P2002 → 500), and two concurrent *first* registrations can both read `userCount === 0` → **both become ADMIN**. **Fix:** wrap election + create in one transaction, catch P2002 into the friendly form error.

**S6 — Trust-score mutations bypass clamping.** The admin path clamps 0–100 (`actions/admin.ts:114`), but `MARK_RETURNED` increments ±5/−15 unclamped (`actions/tools.ts:248,265-272` — a borrower's score can be dragged below 0), and vouching increments +2 unclamped (`actions/vouch.ts:141-145` — drift above 100). `formatVouch` (`ToolsClient.tsx:53-56`) then renders semantically meaningless numbers. **Fix:** clamp in all three write paths.

**S7 — MIME trust, no EXIF stripping, `.svg` serving hole.**
- `src/lib/uploads.ts:59-67` validates only the client-supplied multipart `Content-Type` — no magic-byte sniffing, no re-encoding.
- Files are served byte-for-byte as uploaded (`uploads/[filename]/route.ts:35`), so phone photos retain **EXIF GPS data**, leaking precise owner locations on a platform whose stated privacy posture is a *coarse, self-declared* location label only (`schema.prisma:36`).
- `uploads/[filename]/route.ts:38-47` maps `.svg → image/svg+xml`, an extension the upload pipeline can never produce (`uploads.ts:48-53`); any foreign `.svg` dropped into `data/uploads` becomes a stored-XSS surface.
- **Fix:** re-encode/strip metadata with `sharp` (already in `node_modules` as a Next 15.5.28 optional dependency); drop the `.svg` mapping; add `X-Content-Type-Options: nosniff` and a restrictive `Content-Security-Policy` to both file-serving routes.

**S8 — Upload route hardening gaps.** `uploads/[filename]/route.ts:35` uses `fs.readFileSync` per request (event-loop blocking, up to 5 MB per hit), no `X-Content-Type-Options`, no `Content-Length`/ETag. `next.config.ts:50-57` sets **only** `Referrer-Policy` — the app ships no CSP, no `X-Frame-Options`, no HSTS. (Framing risk is low — clickjacking targets are auth-gated — but headers are cheap.)

**S9 — Account deletion orphans photos on disk.** `deleteOwnAccount` (`actions/auth.ts:349-362`) and admin `deleteUser` (`actions/admin.ts:207-222`) rely on DB cascade, which removes `Tool`/`PublishedImage` **rows** but never calls `deleteUploadedImage()`. Tool photos and secret-link images therefore remain publicly retrievable at `/api/uploads/<filename>` **forever after account deletion**, contradicting the zero-PII "purge path" contract. (`deleteTool` does clean up correctly: `actions/tools.ts:87-88`.) **Fix:** collect `imageUrl` / `PublishedImage.filename` sets inside the transaction and delete the files after commit (also relevant if S1's directory split lands).

**S10 — Helpdesk webhook integration is dead in the shipped configuration.** Code reads `process.env.BOT_WEBHOOK_URL` (`src/lib/supportChannel.ts:65`), but `.env:12` and `.env.example:28` define **`HELPDESK_WEBHOOK_URL`** — a variable nothing reads (grep-verified). Every help submission logs "BOT_WEBHOOK_URL is not configured" (`supportChannel.ts:66-69`) and falls back to the built-in engine; the standalone assistant is never consulted. `.env:12` additionally points at the site itself (`http://localhost:3000`) rather than a bot container DNS name. **Fix:** rename to `BOT_WEBHOOK_URL` in `.env`/`.env.example`/docs, and set the real podman-DNS URL in production.

**S11 — Username-existence oracles.** `recoverAccount` returns distinct "User not found" vs "Invalid or already used recovery code" (`actions/auth.ts:170-178`); registration exposes "Username already taken" deliberately. Both are IP-rate-limited (5 burst / 2 per minute, `rateLimit.ts:74`), so residual risk is acceptable — but the recovery path should return one uniform message.

### 3.3 Security — LOW / hardening

**S12 — Local `.env` contains live values** (dev `AUTH_SECRET`, the real webhook shared secret, Matrix room IDs — values deliberately not reproduced in this report). Gitignored (`.gitignore:12`) and excluded from the handoff checksums, but run `git log --all -- .env` once to confirm no historical leak, and rotate the webhook secret on the next redeploy cycle.

**S13 — Stubs/dead code.** `authenticate` and `logoutAction` are documented no-op placeholders (`actions/auth.ts:197-220`); `src/lib/actions/websiteHelp.ts:78-91` contains a commented-out integration block referencing a non-existent `HELP_DESK_ACCOUNT_ID`. `websiteHelp.ts` is an exported Server Action that no client component uses. Violates the project's zero-stub rule; delete or implement.

**S14 — Authenticated write surfaces are unthrottled.** Only `imagePublish` is budgeted; `/api/tools/create`, `/api/tools/[id]/image`, skills create/update, and DMs (`/api/messages` POST, `actions/messages.ts:39`) can be flooded by any member (disk-flood via 5 MB photos, message spam). Consider reusing the token-bucket pattern with member-facing buckets.

**S15 — `chat/token` origin check is stricter than Next's.** Compares `new URL(origin).host === Host` (`api/chat/token/route.ts:46-58`) rather than using an allowlist; any proxy that rewrites `Host` 403s the flow silently. **[Hypothesis — verify behind the Cloudflare Tunnel; the Next `allowedOrigins` config at `next.config.ts:39` does not apply to route handlers.]**

**S16 — Dead exports with SQLite-invalid Prisma filters.** `getTools` (`actions/tools.ts:414-443`) and `getSkills` (`actions/skills.ts:191`) use `mode: "insensitive"` (`tools.ts:427-428`, `skills.ts:204-205`), which the SQLite connector does **not** support ([prisma/prisma#24014](https://github.com/prisma/prisma/issues/24014); [Prisma case-sensitivity docs](https://www.prisma.io/docs/orm/v6/prisma-client/queries/case-sensitivity) — SQLite only offers `COLLATE NOCASE`). Both call sites are currently unreachable dead code (catalog pages filter client-side), so nothing breaks today. **[Hypothesis: TS accepts the arg but a wired call would throw PrismaClientValidationError — validate with `npx tsc --noEmit` and a REPL invocation.]** Fix when wiring search, or delete.

### 3.4 Quality notes (verified-good, for the record)

- Timing-safe comparisons in every credential path (`canary.ts:407-411,471-474`, `pow.ts:265-289`, `guards.ts:42-49`).
- Open-redirect guard in the NextAuth redirect callback (`auth.config.ts:70-88`), allowlist-based.
- Session JWT is 1-hour inactivity-expiring (`auth.config.ts:111-117`); `session.update()` payload re-derived from DB truth (`auth.ts:87-101`).
- Multipart binaries validated by size+MIME before write; stored extension derived from validated MIME, never the user filename (`uploads.ts:29-36,74-92`); deletion refuses non-system filenames (`uploads.ts:95-101`).
- Canary single-use email token: 256-bit CSPRNG, SHA-256-hashed at rest, 15-min TTL, append-only signed history with severity of "DB-only adversary cannot re-sign" (`canary.ts:1-61`, `:345-386`).
- WAL-safe backup script with integrity check and retention (`backup.sh:56-118`).
- `.intentRouter` regexes are linear-complexity (lookahead composition; no ReDoS pattern present).

### 3.5 Backup gap (from §3.4 review)

`backup.sh` copies only the `.db` file. `data/uploads` (all listing photos and secret-link images) and `data/.auth_secret` (the canary key-seal root) are **not covered by any documented backup** — a host loss destroys pictures and bricks canary re-signing until `AUTH_SECRET` is recovered from the dead volume. Extend `backup.sh` (or the systemd timer) to archive `uploads/` and the secret file.

---

## 4. Performance Findings

| ID | Issue | Evidence | Impact |
|---|---|---|---|
| P1 | `fs.readFileSync` / `existsSync` / `writeFileSync` on hot paths | `uploads/[filename]/route.ts:31-35`; `i/[token]/route.ts:76-87`; `uploads.ts:80-89` | Event-loop serialization under the single node process; burst of 5 MB photo hits stalls every concurrent request |
| P2 | Pure-JS bcryptjs cost-12 blocks the event loop | `actions/auth.ts:106,180,271,334`; `admin.ts:289`; `canary.ts:309` | ~100 ms CPU each; concurrent logins/canary operations serialize the entire process |
| P3 | Unbounded queries + full-payload delivery | All-tools+owner to every guest (`tools/page.tsx:33-40`); all-thread-messages per user (`actions/messages.ts:146-155`); `/api/messages` thread GET with no `take` (`route.ts:89-101`); `getUserTools`/`getUserLoans` (`actions/tools.ts:463-521`) | O(rows) memory/bytes per visit, unpaginated; conversation views degrade linearly with message volume |
| P4 | Over-fetching in loan/dashboard queries (`include: { tool: true }` etc.) | `dashboard/page.tsx:44-58`; `actions/tools.ts:493-521`; `getUserStats` `actions/messages.ts:221-239` | Wider rows than needed; fine at community scale |
| P5 | Prisma client singleton established only in dev | `db.ts:40` skips `globalForPrisma` in production, while rate-limit/PoW modules persist unconditionally (`rateLimit.ts:105-109`, `pow.ts:87-92`) | **[Hypothesis]** per-chunk PrismaClient duplication → extra SQLite pool connections and contention vs WAL single-writer; align `db.ts` with the unconditional pattern |
| P6 | Polling amplification | MessengerWidget polls thread index every 5 s when open (`components/messenger/MessengerWidget.tsx:58,189`); NotificationBell polls 5 COUNT queries every 30 s per open tab (`NotificationBell.tsx:53,157`) | Every tab multiplies background DB queries against `force-dynamic` routes |
| P7 | `request.formData()` buffering bounded only by spoofable `Content-Length` | `tools/[id]/image/route.ts:85-88` (chunked bypass explicitly admitted in comment); `tools/create/route.ts:41` (no guard at all) | Authenticated DoS: chunked multi-hundred-MB multipart is RAM-buffered before the 5 MB per-file validation runs |

SQLite specifics: WAL + `busy_timeout=5000` + single-node deployment mitigate most write-contention concerns; the memory-only rate limiter/PoW store means horizontal scaling (multi-container replicas) would silently break those gates — acceptable for the stated single-node posture, worth a documented constraint.

---

## 5. Dependency Posture (verified against live advisories, 2026-11-08)

| Package | Locked version | State | Recommended action |
|---|---|---|---|
| next | 15.5.28 (`package-lock.json:1828`) | One patch behind the [Nov 3 2026 security release](https://nextjs.org/blog/november-2026-security-release) (`15.5.29`); Oct 14 2026 criticals (image-optimizer RCE GHSA-2464-fhr4-w9xw; Server-Actions DoS GHSA-p3m5-59mp-jv5r) **already fixed** in `.28`; this app uses no `use cache`/Cache Components and no `images.remotePatterns`, so the Nov advisories' preconditions are absent — still patch. | `next@15.5.29` |
| next-auth | 5.0.0-beta.25 | 4 unfixed advisories, 2 Critical (S3) | `5.0.0-beta.32+` |
| nodemailer | ^6.10.1 | Address-parser misdelivery fixed in 7.0.7 ([GHSA-5jpx-9hw9-2fx4](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-5jpx-9hw9-2fx4)) | `nodemailer@>=7.0.7` |
| bcryptjs | 2.4.3 (published 2017) | No CVEs; project restructured/ESM in 3.x, low activity (Snyk "Inactive"); pure-JS = P2 | `@node-rs/bcrypt` (native) or `bcryptjs@3.0.3` |
| prisma | 5.22.0 | Two majors behind current line | **[Hypothesis: outside support window]** — verify release/support policy, then plan an upgrade to Prisma 6/7; separately, the Next image-optimizer RCE fix requires `sharp >= 0.35.5`, which `next@15.5.29` resolves as its optional dependency |
| openpgp 6.3.2, qrcode 1.5.4, zod 3.24.x, react/react-dom 19, tailwindcss 4 | — | No applicable advisories found | — |
| tools-library-bot (matrix-bot-sdk, express) | see `tools-library-bot/package-lock.json` | Not CVE-swept in this session | run `npm audit` in that subproject |

---

## 6. Options & Tradeoff Matrix (highest-leverage optimizations)

| Option | Summary | Security gain | Perf gain | Effort / Risk |
|---|---|---|---|---|
| **B** | `Containerfile:105` CMD → `prisma migrate deploy` | High (prevents silent schema-drift data loss; restores PHASE_22 compliance) | — | Trivial; verify `migrate resolve` baselines for pre-migration DBs |
| **A** | Separate secret-image storage + filter `/api/uploads` by `Tool.imageUrl` (S1) | High (restores the core secret-link invariant; enables true private caching) | — | Low-Medium; migrate existing `PublishedImage` rows and their paths |
| **F** | Dependency patch train (next, next-auth, nodemailer, bcryptjs) | High (closes two Critical-tracked advisories; P2 partial) | Medium | Low; lockfile-driven `npm ci`; bcryptjs→@node-rs/bcrypt changes no call sites' signatures |
| **C** | sharp re-encode + EXIF strip + header hardening (S7/S8) | High privacy (location leak), Medium XSS hardening | Small (bad files rejected early) | Medium; `sharp` already present in the dep tree |
| **E** | Atomic transactions for recovery/vouch/registration (S4-S6) | Medium (kills the kernel races that undermine single-use + one-time-role invariants) | — | Low |
| **D** | Async fs + streaming responses on image routes (P1) | — | High under load | Low |
| **G** | Pagination / bounded `take` on catalog + message threads (P3, P6) | — | Medium-Long-term (linear degradation avoided) | Medium; touches UI filter logic (client-side filtering must move server-side or be hybrid) |

---

## 7. Implementation Handoff

Surgical targets for the implementing session, in the order above:

1. `Containerfile:105` — swap to `prisma migrate deploy` (B).
2. `src/lib/uploads.ts:74-92`, `src/app/api/uploads/[filename]/route.ts`, `src/app/api/images/create/route.ts`, `src/app/i/[token]/route.ts` — directory split + Tool.imageUrl filtering (A).
3. `package.json` — `next@15.5.29`, `next-auth@5.0.0-beta.32+`, `nodemailer@>=7.0.7`, bcrypt swap; regenerate lockfile with `npm i` (F).
4. `src/lib/uploads.ts` + both serving routes — sharp re-encode, EXIF strip, `X-Content-Type-Options`, restrictive CSP (C).
5. `src/lib/actions/auth.ts:174-192` (single-use consumption) and `:94-129` (transactional ADMIN election); `actions/tools.ts:248-273` and `actions/vouch.ts:132-149` clamps (E).
6. `actions/auth.ts:349-362` + `actions/admin.ts:207-222` — cascade file cleanup (S9).
7. `.env`/`.env.example` + `supportChannel.ts` — unify `BOT_WEBHOOK_URL`; delete `websiteHelp.ts` stub block (S10/S13).
8. P-threaded follow-ups: async fs streaming (D), pagination/`take` (G), extend `backup.sh` for `uploads/` + `.auth_secret` (§3.5).

**Verification steps (per `AGENTS.md` Step C and beyond):**
- `npx tsc --noEmit && npm run build`
- Manual matrix: (a) concurrent double-submit recovery → exactly one password reset succeeds, the concurrent attempt errors; (b) concurrent first registrations → exactly one ADMIN; (c) `/api/uploads/<tool-photo>.jpg` still serves 200; (d) `/api/uploads/<PublishedImage filename>` → 404; (e) `/i/<token>` still serves 200 with `nosniff` + CSP headers; (f) an EXIF-laced JPEG uploads and downloads metadata-stripped (verify with `exiftool`); (g) existing login sessions survive the `next-auth` upgrade (JWT/session shape unchanged).

---

## 8. Evidence Index (primary file anchors)

- `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts` — auth/session/policy
- `src/lib/rateLimit.ts`, `src/lib/pow.ts`, `src/lib/powClient.ts` — anti-abuse
- `src/lib/uploads.ts`, `src/lib/images.ts`, `src/app/api/uploads/[filename]/route.ts`, `src/app/i/[token]/route.ts` — file surface
- `src/lib/crypto.ts`, `src/lib/crypto/encryptEmail.ts`, `src/lib/mail/transporter.ts`, `src/lib/email.ts` — crypto/mail
- `src/lib/canary.ts`, `src/lib/canaryShared.ts` — canary signing
- `src/lib/db.ts`, `prisma/schema.prisma`, `prisma/migrations/*` — persistence
- `src/app/api/*`, `src/lib/actions/*` — write surfaces
- `tools-library-bot/src/server/{webhook,guards}.ts`, `tools-library-bot/src/config.ts` — bot surface
- `Containerfile`, `deploy.sh`, `backup.sh` — deployment
