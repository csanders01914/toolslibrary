# CONTRIBUTING.md — Tool Library v2

Thank you for contributing to the Tool Library — a zero-PII, self-hosted community
platform for neighbor-to-neighbor tool lending and skills exchange. This document
explains how to set up a development environment, the non-negotiable rules of this
codebase, and the quality gates every change must pass before it is merged.

- **License:** AGPL-3.0-only (see `LICENSE.md`). By contributing, you agree that your
  contributions are licensed under the same terms.
- **Code of Conduct:** [`/code-of-conduct`](src/app/code-of-conduct/page.tsx) — mutual-aid
  respect, harassment-free participation. Applies to all project spaces.
- **Stack:** Next.js 15 (App Router, `output: 'standalone'`), React 19, TypeScript 5.7
  (strict), Tailwind CSS v4, Prisma 5.22 + SQLite (WAL mode), NextAuth v5 (JWT), Zod,
  bcryptjs, Lucide icons.

---

## 1. Ways to Contribute

| Type | Where |
|------|-------|
| Code (features, fixes, hardening) | Pull requests against this repository |
| Documentation | This repo (`README.md`, `DEPLOYMENT.md`, doc comments) and the wiki at <https://wiki.tools-library.com> |
| Bug reports | GitHub issues, or the in-app `/help` triage intake |
| Security vulnerabilities | **Private disclosure only** — see Section 9. Never open a public issue. |
| Community / governance | Matrix: <https://matrix.to/#/#tools-library:matrix.org> |

---

## 2. Development Environment Setup

### Prerequisites

- **Node.js 20+** and npm (the production image is `node:20-alpine`).
- Podman is only required if you want to test the container build locally
  (see `DEPLOYMENT.md`).

### Steps

```bash
# 1. Clone and enter the repository
git clone <repository-url> toolslibrary-v2
cd toolslibrary-v2

# 2. Create .env in the repository root (there is no .env.example; do not commit it)
```

Create `.env` with exactly these variables:

```env
DATABASE_URL="file:./data/tool_library.db"
AUTH_SECRET="<run: openssl rand -hex 32>"
AUTH_TRUST_HOST="true"
```

```bash
# 3. Install dependencies
npm install

# 4. Create/sync the SQLite database and generate the Prisma client
npx prisma db push

# 5. Start the development server
npm run dev
# → http://localhost:3000
```

Notes:

- The `data/` directory (SQLite database, WAL sidecars, `uploads/`) is runtime state.
  It is gitignored and excluded from the container image by `.dockerignore`.
- **The first account registered on an empty database automatically receives the
  `ADMIN` role.** Register immediately on a fresh database to claim it.
- Optional: `npx prisma studio` opens a visual browser for the local database.

---

## 3. Repository Orientation

```
toolslibrary-v2/
├── prisma/schema.prisma        # Single source of truth: 9 models (User, RecoveryKey,
│                               #   Tool, Loan, Skill, Message, LlmConfig, HelpRequest,
│                               #   AgentAction)
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/                # auth/[...nextauth], agent/{chat,confirm}, llm/config,
│   │   │                       #   messages (+read), tools/{create,loan}, skills/*,
│   │   │                       #   uploads/[filename], user/accessibility
│   │   ├── tools/ skills/      # Catalog, detail, and create routes (+ *Client.tsx)
│   │   ├── help/               # Public triage intake
│   │   ├── messages/ dashboard/ admin/
│   │   ├── login/ register/ recover/ change-password/
│   │   └── privacy/ terms/ transparency/ code-of-conduct/ contribute/ donate/
│   │                           #   about/ accessibility/  (legal & community hub)
│   ├── components/
│   │   ├── a11y/               # AccessibilityMenu, ReadingGuide
│   │   ├── layout/             # Navbar, Footer
│   │   ├── messenger/          # MessengerWidget (floating DMs)
│   │   └── ui/                 # Shared primitives (Modal with focus trap)
│   ├── context/
│   │   └── AccessibilityContext.tsx   # a11y prefs: cookie sync + optional account sync
│   ├── lib/
│   │   ├── actions/            # Server Actions: auth, tools, skills, messages, help, admin
│   │   ├── agent/              # tools.ts (operation registry + safety), run.ts (turn loop)
│   │   ├── services/           # triage.ts (decision engine), llm.ts, admin-ai.ts
│   │   ├── crypto.ts           # AES-256-GCM secret storage, recovery-code hashing
│   │   ├── db.ts               # Prisma singleton (WAL + busy_timeout + FK pragmas)
│   │   └── constants.ts        # CATEGORIES, SKILL_CATEGORIES
│   ├── auth.config.ts          # Edge-safe NextAuth config + authorized callback
│   ├── auth.ts                 # Credentials provider (bcrypt compare)
│   ├── middleware.ts           # Forced password change, route protection
│   └── types/                  # next-auth module augmentation
├── scripts/
│   ├── verify-handoff.mjs      # Checksum integrity gate (see Section 6)
│   └── record-handoff.mjs      # Handoff state recorder
├── Containerfile               # Multi-stage rootless Podman image
├── deploy.sh                   # Idempotent FCOS deployment wrapper
├── DEPLOYMENT.md               # Production deployment guide
├── IMPLEMENTATION_PLAN.md      # Build plan + MANDATORY design system contract
└── AGENTS.md                   # Operating contract for automated agent sessions
```

---

## 4. Non-Negotiable Invariants

These are hard rules. A pull request that violates any of them will be rejected
regardless of other merits.

1. **Zero PII.** No email addresses, phone numbers, IP logging, location data, or
   third-party analytics — ever. Identity is only a `username` (login handle) and a
   public `alias`. Never add a schema field, log line, or request that collects PII.
   No external CDNs; all assets are local.
2. **Zero-stub tolerance.** No `TODO`, `FIXME`, `// implement later`, mock data arrays,
   or `throw new Error("Not implemented")` may be committed. Wire real logic or do not
   open the PR.
3. **Zod validation on every input.** API routes, Server Actions, operation arguments,
   and LLM/service output are all validated with Zod schemas before use.
4. **Human-in-the-loop for destructive automation.** Any destructive operation performed
   by the automated agent is created as an `AgentAction` with `status: "PENDING"` and is
   never executed until an admin explicitly approves it
   (`src/lib/agent/tools.ts`, `/api/agent/confirm`). Never add an autonomous
   destructive code path.
5. **Secrets handling.** Provider API keys are stored AES-256-GCM encrypted
   (`LlmConfig.apiKeyEnc`, key material derived from `AUTH_SECRET` or
   `LLM_ENCRYPTION_KEY`) and are never returned to the client — only a masked hint.
   Passwords use bcrypt cost 12. Never log or echo secrets.
6. **No new runtime dependencies without justification.** Everything must bundle into
   the standalone build. The only permitted outbound network call is the
   admin-configured LLM chat-completions endpoint. Propose any new npm dependency in
   the PR description and explain why an existing one cannot do the job.
7. **Accessibility is a feature contract.** The WCAG 2.2 Level AAA suite (with WCAG 3.0
   draft adoptions) must not regress. See Section 7.
8. **Respect the design system.** The "Sleek Cypherpunk Glassmorphic" visual contract in
   `IMPLEMENTATION_PLAN.md` (glass cards, semantic neon palette, layout wrappers) is
   mandatory on all pages. Flat, unstyled boxes are not accepted.

---

## 5. Coding Standards

- **TypeScript strict mode.** No `any`, no implicit returns. `npm run typecheck`
  (`tsc --noEmit`) must pass with zero errors.
- **Next.js 15 async params.** In dynamic pages and route handlers, `params` and
  `searchParams` are Promises — always `await` them:
  ```typescript
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```
- **Server Actions** live in `src/lib/actions/*.ts`. Pages stay thin; database access
  goes through the Prisma singleton from `@/lib/db` (which sets the WAL, busy-timeout,
  and foreign-key pragmas). Do not instantiate `PrismaClient` elsewhere.
- **Client components** are named `*Client.tsx` and colocated next to their route
  (e.g. `src/app/tools/ToolsClient.tsx`).
- **Database-backed pages** export `export const dynamic = 'force-dynamic';`.
- **Path alias:** `@/*` maps to `./src/*`.
- **Schema changes:** edit `prisma/schema.prisma`, then run
  `npx prisma db push && npx prisma generate`. The schema is the single source of
  truth; Zod schemas mirror it for runtime validation.
- **Commits:** short, imperative subject lines matching the existing history style
  (e.g. "Added ability to delete users", "Upgraded a11y standards to WCAG 2.2 AAA").
  One logical concern per commit.
- **Branches:** `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, `a11y/<topic>`.

---

## 6. Handoff & Checksum System (Specific to This Repo)

This repository maintains a deterministic integrity state used by both human and
automated sessions:

- `.handoff/CURRENT_STATE.json` records the last completed phase, session handoff
  instructions, and SHA-256 checksums of tracked files. It is gitignored — never edit
  it by hand and never commit it.
- `node scripts/verify-handoff.mjs` verifies the working tree against the recorded
  checksums. It prints `{"status": "VERIFIED", ...}` or exits `1` with
  `DRIFT_DETECTED`.
- After completing a verified unit of work, refresh the state once from the repo root:
  ```bash
  node scripts/record-handoff.mjs <PHASE_ID> "<instructions for the next session>"
  ```

Rules for contributors:

- **If `verify-handoff.mjs` reports `DRIFT_DETECTED` before you start:** the tree
  contains unrecorded work (usually an in-progress phase). Do not build on top of it
  and do not re-record over someone else's work-in-progress — coordinate with the
  session/author that owns the drift first.
- **If your own change is complete and verified:** re-record the handoff state so the
  next session starts from `VERIFIED`.
- Never delete or "clean up" `data/`, `.handoff/`, or `.env` as part of a PR.

---

## 7. Accessibility & Mobile Contract

The accessibility suite (`src/context/AccessibilityContext.tsx`,
`src/components/a11y/*`, `src/app/globals.css` data-attribute rules) is a core feature.
When touching any UI:

- Preserve the preference system: `data-*` attributes on `<html>`, the `a11y_prefs`
  cookie, the FOUC-prevention inline script, and the optional account sync via
  `PATCH /api/user/accessibility`.
- Preserve keyboard paths: skip link, `Alt+A` (accessibility menu), `Alt+M` (focus main
  content), `Escape` (close menu/modals), and focus trapping/restoration in modals
  (`src/components/ui/Modal.tsx`).
- Announce state changes through the `aria-live` region; keep `role="switch"` /
  `role="radiogroup"` semantics on the menu controls.
- **Touch targets ≥ 44px** (`.tap-target` utility) and **form controls at 16px**
  (`text-base`) — iOS Safari zooms on focus below 16px, and `maximum-scale=1` is
  forbidden (WCAG 1.4.4).
- **Mobile floor is 320px.** Use `dvh` (not `vh`) for viewport-height UI, avoid
  horizontal scroll, and keep both fixed widgets (messenger + accessibility trigger)
  non-overlapping.
- Do not remove or restyle a11y toggles (high contrast, inverted, monochrome, font
  size, dyslexia-friendly font, text spacing, focus indicators, reduced motion,
  underline links, big cursor, reading guide).

---

## 8. Quality Gates (All Required Before Opening a PR)

```bash
# 1. Type safety (strict)
npm run typecheck

# 2. Production build (runs prisma generate + next build)
npm run build

# 3. Repository integrity
node scripts/verify-handoff.mjs
```

There is currently no automated test suite; correctness is verified by the gates above
plus manual verification. For UI changes, walk the verification matrix in
`IMPLEMENTATION_PLAN.md` (routes × viewport widths 320/375/768/1280 × font sizes
100/125/150% × a11y toggles) and confirm the Lighthouse accessibility score does not
decrease. Include what you ran and observed in the PR description — "it works" without
evidence will not be accepted.

If the build fails on the same error more than twice, stop editing, attach the
diagnostic output to the PR/issue, and ask rather than entering a guessing loop.

---

## 9. Reporting Bugs & Security Issues

- **Bugs and regressions:** open a GitHub issue with reproduction steps, expected vs.
  actual behavior, and the route(s) affected — or file through the in-app `/help`
  triage system, which routes to the maintainers.
- **Security vulnerabilities (auth bypass, PII leak, injection, approval-gate
  bypass, secret exposure):** disclose **privately** — do not open a public issue.
  Contact the maintainers via Matrix
  (<https://matrix.to/#/#tools-library:matrix.org>). Please allow a reasonable window
  for a patch before any public disclosure.

---

## 10. Deployment

Contributors do not need to deploy, but changes that affect runtime behavior
(schema, auth, container packaging) should be validated against the deployment path:
`Containerfile` → `deploy.sh` → rootless Podman on Fedora CoreOS. The full procedure,
including the `--userns=keep-id` / SELinux `:Z` volume requirements and backup
procedure, is documented in `DEPLOYMENT.md`.

---

## 11. License

By contributing to this repository you agree that your contributions fall under the
**GNU AGPLv3**. This is a network-copyleft license: if you modify and deploy this
software as a network service, you must offer the corresponding source code to the
users of that service. This protects every community member's right to self-host and
audit the platform they depend on.
