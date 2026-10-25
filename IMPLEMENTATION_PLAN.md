# IMPLEMENTATION_PLAN.md — 9-Phase Greenfield Rebuild (From Empty Directory)

## Architecture Summary
- **Stack:** Next.js (App Router, `output: 'standalone'`), React 19, TypeScript, Tailwind CSS v4, Prisma 5.22 (SQLite), NextAuth v5 (Auth.js JWT), Zod, bcryptjs, Lucide Icons.
- **Database & Storage:** Single persistent volume directory (`./data` locally, `/app/data` in Podman). SQLite database at `data/tool_library.db` with WAL mode enabled; uploaded images stored in `data/uploads/`.
- **Identity:** Zero-PII handle (`username`), public display name (`alias`), password hash, and 8 single-use SHA-256 recovery tokens (`XXXX-XXXX`). Optional anonymous JSON column (`a11yPrefs`) for syncing accessibility settings.
- **Compliance:** GNU AGPLv3 compliant with full source link, legal hub, self-hosted BookStack wiki integration (`[https://wiki.tools-library.com](https://wiki.tools-library.com)`), and WCAG 2.1 Level AAA accessibility suite.

---

## MANDATORY DESIGN SYSTEM & VISUAL CONTRACT (ENFORCE ON ALL PAGES)

Every page and component created in Phases 1 through 9 MUST implement this exact **Sleek Cypherpunk Glassmorphic Design System**. Flat, unstyled boxes are strictly forbidden.

1. **Layout & Container Width:**
   - All page wrappers must use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`.
   - Sticky top navbar with frosted glass: `sticky top-0 z-50 bg-slate-950/75 backdrop-blur-xl border-b border-white/10`.
2. **Root Canvas & Ambient Glows (`src/app/layout.tsx` & `globals.css`):**
   - Base canvas: `bg-[#05070e] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200`.
   - Render fixed, non-interactive ambient neon glow gradients behind the main layout:
     - Top-left cyan orb: `fixed -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[128px] pointer-events-none`
     - Top-right purple orb: `fixed top-20 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-[128px] pointer-events-none`
     - Bottom emerald orb: `fixed -bottom-40 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none`
3. **Semantic Neon Color Palette:**
   - **Blue / Electric Cyan (`cyan-400` / `blue-500`):** Tools Catalog, Primary CTAs, Trust Score badges, active focus borders (`border-cyan-500/40`, `shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)]`).
   - **Purple / Neon Fuchsia (`purple-400` / `fuchsia-500`):** Skills Exchange, Skill Cards, Community Governance accents (`border-purple-500/40`, `shadow-[0_0_25px_-5px_rgba(168,85,247,0.3)]`).
   - **Neon Emerald (`emerald-400`):** `AVAILABLE` status pills (with pulsing dot `animate-ping`), verified positive trust actions (`bg-emerald-500/10 text-emerald-300 border-emerald-500/30`).
   - **Laser Crimson / Red (`rose-500` / `red-500`):** `BORROWED` or `MAINTENANCE` lockouts, security alerts, Recovery Key Vault warnings, and destructive actions (`bg-rose-500/10 text-rose-300 border-rose-500/30`).
4. **Component Primitives:**
   - **Glass Cards:** `bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.2)]` (use `hover:border-purple-500/40` on Skill cards).
   - **Hero & Section Headings:** `text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent`.
   - **Primary Neon Buttons:** `px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer`.
   - **Purple Skill Buttons:** `px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-200 cursor-pointer`.
   - **Inputs & Selects:** `w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all`.

---

## PHASE_01_FOUNDATION: Git Init, Package Bootstrap, Handoff Scripts & SQLite Core
**Goal:** Initialize the empty directory into a building Next.js + Prisma SQLite repository with handoff tracking and the Cypherpunk root shell.

### 1. Initialize Git & Ignore Rules
Run `git init` and create `.gitignore`:
```gitignore
node_modules/
.next/
out/
dist/
data/*.db
data/*.db-journal
data/*.db-wal
data/*.db-shm
data/uploads/*
!data/uploads/.gitkeep
.handoff/
.env
.env.local
*.tsbuildinfo
next-env.d.ts
```

Create `.env`:
```env
DATABASE_URL="file:./data/tool_library.db"
AUTH_SECRET="dev-secret-change-in-podman-production-64-chars-minimum-0000"
AUTH_TRUST_HOST="true"
```

### 2. Create `package.json`, `tsconfig.json`, `postcss.config.mjs`, and `next.config.ts`
Create `package.json`:
```json
{
  "name": "tool-library",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "5.22.0",
    "bcryptjs": "^2.4.3",
    "lucide-react": "^0.475.0",
    "next": "^15.2.0",
    "next-auth": "5.0.0-beta.25",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "postcss": "^8.5.0",
    "prisma": "5.22.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```
Run `npm install` to install all packages.

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `postcss.config.mjs`:
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

Create `next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
```

### 3. Create Handoff Verification & Recording Scripts
Create `scripts/verify-handoff.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const handoffDir = path.resolve(process.cwd(), '.handoff');
const currentStateFile = path.join(handoffDir, 'CURRENT_STATE.json');

if (!fs.existsSync(currentStateFile)) {
  console.log(JSON.stringify({ status: "INIT", last_completed_phase: null, message: "Ready for PHASE_01_FOUNDATION" }, null, 2));
  process.exit(0);
}

const state = JSON.parse(fs.readFileSync(currentStateFile, 'utf8'));
const driftReport = [];

for (const [filePath, expectedHash] of Object.entries(state.checksums || {})) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    driftReport.push({ file: filePath, error: "File missing" });
    continue;
  }
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
  if (actualHash !== expectedHash) {
    driftReport.push({ file: filePath, error: "Checksum mismatch", expected: expectedHash, actual: actualHash });
  }
}

if (driftReport.length > 0) {
  console.error(JSON.stringify({ status: "DRIFT_DETECTED", report: driftReport }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "VERIFIED", last_completed_phase: state.last_completed_phase, next: state.next_session_instructions }, null, 2));
```

Create `scripts/record-handoff.mjs`:
```javascript
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const [,, phaseName, nextInstructions = "Proceed to next sequential phase"] = process.argv;
if (!phaseName) {
  console.error("Usage: node scripts/record-handoff.mjs <PHASE_ID> <NEXT_INSTRUCTIONS>");
  process.exit(1);
}

const handoffDir = path.resolve(process.cwd(), '.handoff');
fs.mkdirSync(handoffDir, { recursive: true });

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .map(f => f.trim())
  .filter(f => f && !f.startsWith('.handoff/') && !f.startsWith('data/') && fs.existsSync(f) && fs.statSync(f).isFile());

const checksums = {};
for (const file of files) {
  checksums[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const payload = {
  last_completed_phase: phaseName,
  timestamp: new Date().toISOString(),
  next_session_instructions: nextInstructions,
  checksums
};

const phaseFile = path.join(handoffDir, `${phaseName.toLowerCase()}.json`);
fs.writeFileSync(phaseFile, JSON.stringify(payload, null, 2));
fs.writeFileSync(path.join(handoffDir, 'CURRENT_STATE.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ recorded: phaseFile, tracked_file_count: files.length }, null, 2));
```

### 4. Prisma SQLite Schema (`prisma/schema.prisma`) & WAL Client (`src/lib/db.ts`)
Create `prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  username     String        @unique
  alias        String
  passwordHash String
  role         String        @default("USER") // "USER" | "ADMIN"
  bio          String?
  trustScore   Int           @default(100)
  a11yPrefs    String?       // Anonymous JSON string for synced accessibility prefs
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  recoveryKeys RecoveryKey[]
  tools        Tool[]        @relation("OwnerTools")
  loans        Loan[]        @relation("BorrowerLoans")
  skills       Skill[]       @relation("OwnerSkills")
  sentMsgs     Message[]     @relation("SentMessages")
  receivedMsgs Message[]     @relation("ReceivedMessages")

  @@index([username])
}

model RecoveryKey {
  id        String    @id @default(cuid())
  keyHash   String    @unique
  usedAt    DateTime?
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime  @default(now())

  @@index([userId])
}

model Tool {
  id          String   @id @default(cuid())
  name        String
  description String
  category    String
  status      String   @default("AVAILABLE") // "AVAILABLE" | "BORROWED" | "MAINTENANCE"
  imageUrl    String?
  ownerId     String
  owner       User     @relation("OwnerTools", fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  loans       Loan[]

  @@index([status, category])
  @@index([ownerId])
}

model Loan {
  id              String    @id @default(cuid())
  toolId          String
  tool            Tool      @relation(fields: [toolId], references: [id], onDelete: Cascade)
  borrowerId      String
  borrower        User      @relation("BorrowerLoans", fields: [borrowerId], references: [id], onDelete: Cascade)
  status          String    @default("REQUESTED") // "REQUESTED" | "APPROVED" | "ACTIVE" | "RETURNED" | "REJECTED"
  startDate       DateTime
  endDate         DateTime
  returnedAt      DateTime?
  returnCondition String?   // "GOOD" | "DAMAGED"
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([toolId])
  @@index([borrowerId])
}

model Skill {
  id          String   @id @default(cuid())
  name        String
  description String
  category    String
  available   Boolean  @default(true)
  ownerId     String
  owner       User     @relation("OwnerSkills", fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category, available])
  @@index([ownerId])
}

model Message {
  id        String   @id @default(cuid())
  content   String
  fromId    String
  toId      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  sender    User     @relation("SentMessages", fields: [fromId], references: [id], onDelete: Cascade)
  receiver  User     @relation("ReceivedMessages", fields: [toId], references: [id], onDelete: Cascade)

  @@index([fromId, toId])
  @@index([toId, read])
}
```

Create `src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
  });

prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;').catch(() => {});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 5. Create Cypherpunk App Router Shell (`src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`)
- `src/app/globals.css`: Import Tailwind (`@import "tailwindcss";`) and define a subtle background tactical grid pattern `.bg-cypher-grid { background-size: 32px 32px; background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px); }`.
- `src/app/layout.tsx`: Root HTML shell in deep obsidian (`bg-[#05070e] text-slate-100 min-h-screen antialiased bg-cypher-grid relative overflow-x-hidden`) with the 3 fixed ambient neon blur orbs (cyan top-left, purple top-right, emerald bottom) and a `max-w-7xl mx-auto` main wrapper.
- `src/app/page.tsx`: Initial sleek landing view with gradient title (`bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent`), glassmorphic status cards querying `prisma.tool.count()` and `prisma.skill.count()`, and `export const dynamic = 'force-dynamic';`.

### Phase 1 Gate
1. Run `npx prisma db push && npx prisma generate`
2. Run `npx tsc --noEmit && npm run build`
3. Run `node scripts/record-handoff.mjs PHASE_01_FOUNDATION "Execute PHASE_02_AUTH_BACKEND"`

---

## PHASE_02_AUTH_BACKEND: Zero-PII Crypto, NextAuth v5 & Server Actions
**Files Created/Modified:** `src/lib/crypto.ts`, `src/types/next-auth.d.ts`, `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`, `src/lib/actions/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`.

### 1. Cryptographic Helper (`src/lib/crypto.ts`)
- `generateRecoveryCodes(count = 8): string[]`: Uses `crypto.randomBytes(4).toString('hex').toUpperCase()` formatted as `XXXX-XXXX`.
- `hashRecoveryCode(code: string): string`: Normalizes (`code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')`) and returns SHA-256 hex digest.

### 2. NextAuth Configuration (`src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`)
- `src/auth.config.ts`: Edge-safe callbacks (no Prisma imports). Protects `/dashboard`, `/tools/new`, `/skills/new`, `/messages`, and `/admin` (requires `role === 'ADMIN'`). Leaves `/`, `/tools`, `/skills`, and legal pages public for unauthenticated browsing.
- `src/auth.ts`: Credentials provider validating `username` and `password` via `bcryptjs.compare`. Populates JWT and Session with `{ id, username, alias, role }`.
- `src/app/api/auth/[...nextauth]/route.ts`: Exports `{ GET, POST } = handlers`.

### 3. Auth Server Actions (`src/lib/actions/auth.ts`)
- `registerUser(prevState, formData)`:
  - Validates `username` (`/^[a-zA-Z0-9_-]{3,24}$/`), `alias` (2–32 chars), and `password` ($\ge 10$ chars).
  - First registered user in an empty database is automatically granted `role: 'ADMIN'`; all subsequent users get `role: 'USER'`.
  - Hashes password with `bcrypt.hash(password, 12)`.
  - Generates 8 single-use recovery codes, stores SHA-256 hashes in `RecoveryKey`, and returns `{ success: true, recoveryCodes }`.
- `recoverAccount(prevState, formData)`:
  - Validates `username`, `recoveryCode`, and `newPassword`.
  - Finds user and unused `RecoveryKey` matching `hashRecoveryCode(recoveryCode)`.
  - Uses `prisma.$transaction` to mark `RecoveryKey.usedAt = new Date()` and update `User.passwordHash`.
- `authenticate(prevState, formData)` & `logoutAction()`.

### Phase 2 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_02_AUTH_BACKEND "Execute PHASE_03_AUTH_UI"`

---

## PHASE_03_AUTH_UI: Cypherpunk Auth Views & Glassmorphic Navigation Shell
**Files Created/Modified:** `src/components/layout/Navbar.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/recover/page.tsx`, `src/app/layout.tsx`.

### 1. Frosted Glass Navbar (`src/components/layout/Navbar.tsx`)
- Full-width `sticky top-0 z-50 bg-slate-950/75 backdrop-blur-xl border-b border-white/10` with inner `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between`.
- Brand logo with glowing cyan/purple icon and gradient text (`from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent font-extrabold text-xl`).
- Navigation pills with colorful hover states: `Browse Tools (/tools)` (cyan glow), `Skills Exchange (/skills)` (purple glow), `+ Lend Tool (/tools/new)`, `+ Offer Skill (/skills/new)`.
- Right section: If logged in, displays user `alias` inside a glowing cyan pill badge, links to `/messages`, `/dashboard`, `/admin` (if `ADMIN`, styled with rose/red badge), and Logout button. If guest, shows sleek `Login` and neon gradient `Join Collective` button.

### 2. Registration View with Neon Key Vault (`src/app/register/page.tsx`)
- Centered glassmorphic card (`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-[0_0_50px_-12px_rgba(6,182,212,0.25)]`).
- Form requests ONLY `username`, `alias`, and `password` with zero-PII privacy badge at top (`emerald-400`).
- When `state?.success && state.recoveryCodes` returns:
  - Renders a high-contrast crimson/amber warning banner (`border-rose-500/40 bg-rose-950/30`) and displays the 8 single-use `XXXX-XXXX` codes in a glowing 2-column monospace grid (`bg-slate-950/90 border border-cyan-500/30 text-cyan-300 font-mono`).
  - Provides **"Copy Keys"** and **"Download Keys (.txt)"** buttons with Lucide icons.
  - Requires checking *"I have saved these recovery keys offline. I understand there is no email password reset."* before enabling the glowing **"Proceed to Login"** CTA.

### 3. Login & Recovery Views (`src/app/login/page.tsx`, `src/app/recover/page.tsx`)
- `/login`: Glassmorphic card with cyan focus rings, `username` + `password` inputs, and link to `/recover`.
- `/recover`: Emergency password reset card with purple/rose accents accepting `username`, single-use `recoveryCode` (`XXXX-XXXX`), and `newPassword`.

### Phase 3 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_03_AUTH_UI "Execute PHASE_04_TOOLS_ENGINE"`

---

## PHASE_04_TOOLS_ENGINE: Tools Inventory, Loan State Machine & Bento Hero
**Files Created/Modified:** `src/app/api/uploads/[filename]/route.ts`, `src/lib/actions/tools.ts`, `src/app/tools/page.tsx`, `src/app/tools/new/page.tsx`, `src/app/tools/[id]/page.tsx`, `src/app/page.tsx`.

### 1. Standalone-Safe Media Upload & Serving (`src/app/api/uploads/[filename]/route.ts`)
- Awaits `params` (`const { filename } = await params;`).
- Serves uploaded tool photos directly from `path.resolve(process.cwd(), 'data/uploads', path.basename(filename))` with proper `Content-Type` headers.

### 2. Tool & Loan Server Actions (`src/lib/actions/tools.ts`)
- `createTool(formData)`: Saves optional image file to `data/uploads/` (max 5MB), creates `Tool` record linked to `session.user.id`.
- `requestLoan(formData)`: Creates `Loan` record (`status: 'REQUESTED'`) for specified `startDate` and `endDate`.
- `manageLoan(loanId, decision)`: Owner approves (`status: 'ACTIVE'`, sets tool to `'BORROWED'`), rejects (`status: 'REJECTED'`), or marks returned (`status: 'RETURNED'`, sets tool back to `'AVAILABLE'`, adjusts borrower `trustScore`: `+5` if on-time/good condition, `-15` if damaged/overdue).

### 3. Sleek Bento Homepage & Tools Catalog (`src/app/page.tsx`, `src/app/tools/page.tsx`, `src/app/tools/[id]/page.tsx`, `src/app/tools/new/page.tsx`)
- Add `export const dynamic = 'force-dynamic';` to database-backed pages.
- **Homepage (`src/app/page.tsx`):**
  - Hero section with dual-tone gradient headline, glowing search dock (`bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-2 shadow-[0_0_40px_-10px_rgba(6,182,212,0.3)]`), and interactive category filter pills.
  - 3-card Bento feature grid highlighting **Zero-PII Cypherpunk Identity** (Cyan), **Cryptographic Trust Scores** (Emerald), and **Community Skills & Tool Sharing** (Purple).
  - Live inventory showcase grid below the hero.
- **Tool Cards (`/tools` & `/`):**
  - Glassmorphic cards (`hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.25)]`).
  - Status pill in top-right: pulsing emerald dot (`bg-emerald-500/15 text-emerald-300 border border-emerald-500/30`) for `AVAILABLE`, rose/red pill for `BORROWED`.
  - Owner `alias` + `trustScore` shield in blue/cyan (redacted to `"Community Member"` for unauthenticated guests).

### Phase 4 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_04_TOOLS_ENGINE "Execute PHASE_05_SKILLS_ENGINE"`

---

## PHASE_05_SKILLS_ENGINE: Neon Purple Community Skills Exchange
**Files Created/Modified:** `src/lib/actions/skills.ts`, `src/app/skills/page.tsx`, `src/app/skills/new/page.tsx`, `src/app/skills/[id]/page.tsx`.

### 1. Skills Server Actions (`src/lib/actions/skills.ts`)
- `createSkill(formData)`: Validates `name`, `description`, and `category` (*Repair & Maintenance*, *Carpentry*, *Gardening & Homestead*, *Electronics & Soldering*, *Software & Linux*, *Fabrication*), inserts into `Skill`.
- `toggleSkillAvailability(skillId)`: Owner toggles `available` boolean.
- `deleteSkill(skillId)`: Owner or Admin deletes skill listing.

### 2. Skills Directory & Detail Pages (`src/app/skills/page.tsx`, `src/app/skills/new/page.tsx`, `src/app/skills/[id]/page.tsx`)
- Styled with the **Neon Purple & Fuchsia** semantic theme (`from-purple-400 via-fuchsia-400 to-cyan-400` headers, `hover:border-purple-500/50 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.25)]` cards).
- Unauthenticated browsing with category filter pills and keyword search (redacting provider `alias` to `"Community Member"` for guests).
- `/skills/[id]` displays skill summary, provider `alias`, `trustScore` badge, and a glowing purple **"Message Neighbor to Coordinate"** button linking to `/messages?to=<ownerId>`.

### Phase 5 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_05_SKILLS_ENGINE "Execute PHASE_06_MESSAGING_TRUST"`

---

## PHASE_06_MESSAGING_TRUST: Zero-PII P2P Messenger & Command Dashboard
**Files Created/Modified:** `src/lib/actions/messages.ts`, `src/app/messages/page.tsx`, `src/app/dashboard/page.tsx`.

### 1. Messaging Server Actions (`src/lib/actions/messages.ts`)
- `sendMessage(formData)`: Validates `toId` and `content` (1–1000 chars), stores in `Message`.
- `markThreadRead(partnerId)`: Marks incoming messages from `partnerId` to `session.user.id` as `read: true`.
- `updateProfile(formData)`: Allows authenticated user to update their public `alias` and optional `bio`.

### 2. Glassmorphic Split-Pane Messenger (`src/app/messages/page.tsx`)
- Sleek two-pane glassmorphic terminal (`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden min-h-[600px]`):
  - Left pane: Conversation threads by `alias` with glowing cyan unread counters.
  - Right pane: Chat bubbles (outgoing in `bg-gradient-to-r from-cyan-600/40 to-blue-600/40 border border-cyan-400/30`, incoming in `bg-slate-800/70 border border-white/10`) and instant message bar.

### 3. Self-Sovereign Command Dashboard (`src/app/dashboard/page.tsx`)
- Top Bento stat row: Glowing Trust Score gauge (Emerald/Cyan), Active Tools Lent, Active Borrows, and Skills Offered.
- Interactive loan management queues with emerald `Approve` / `Mark Returned` and rose `Reject` action buttons, plus inline alias/bio editor.

### Phase 6 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_06_MESSAGING_TRUST "Execute PHASE_07_LEGAL_FOOTER"`

---

## PHASE_07_LEGAL_FOOTER: AGPLv3 Compliance Footer & Zero-PII Legal Hub
**Files Created/Modified:** `src/components/footer/Footer.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/transparency/page.tsx`, `src/app/code-of-conduct/page.tsx`, `src/app/contribute/page.tsx`, `src/app/donate/page.tsx`, `src/app/about/page.tsx`.

### 1. AGPLv3 & Community Governance Footer (`src/components/footer/Footer.tsx`)
Mount `<Footer/>` in `src/app/layout.tsx` (`bg-slate-950/90 backdrop-blur-xl border-t border-white/10 mt-20`) with a top neon gradient divider line (`h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent`) and 4 columns:
1. **Source & License (AGPLv3 Compliance):**
   - `Source Code (GitHub)` $\to$ `[https://github.com/csanders01914/tool-library](https://github.com/csanders01914/tool-library)` (fulfills AGPLv3 Section 13 Corresponding Source mandate).
   - `GNU AGPLv3 License` $\to$ `[https://www.gnu.org/licenses/agpl-3.0.html](https://www.gnu.org/licenses/agpl-3.0.html)`.
2. **Privacy & Legal (Zero-PII):**
   - `Privacy Policy` $\to$ `/privacy` (Explicit zero-PII, zero-IP logging, zero-analytics declaration).
   - `Terms of Service` $\to$ `/terms` (Good-faith peer lending, tool safety responsibility, anti-abuse rules).
   - `Transparency Report` $\to$ `/transparency` (Warrant canary status in emerald green, $0 third-party data sharing, local FCOS server metrics).
3. **Community & Governance:**
   - `Code of Conduct` $\to$ `/code-of-conduct` (Mutual aid respect, harassment-free workshops, moderation accountability).
   - `Contribute / Get Involved` $\to$ `/contribute` (Code contributions, tool donations, documentation).
   - `Donate / Support Us` $\to$ `/donate` (Open Collective, Liberapay, and community hardware fund info).
   - `Matrix Chat` $\to$ `[https://matrix.to/#/#tools-library:matrix.org](https://matrix.to/#/#tools-library:matrix.org)`.
   - `Discord` $\to$ Rendered with a glowing purple pill badge: `Discord (Coming Soon)`.
4. **Navigation & Knowledge:**
   - `About / Manifesto` $\to$ `/about` (Right-to-repair, anti-surveillance capitalism, local resilience, decentralization).
   - `Project Wiki` $\to$ `[https://wiki.tools-library.com](https://wiki.tools-library.com)` (Direct link to self-hosted standalone BookStack instance).

### 2. Build All 7 Legal & Community Routes
Style all 7 pages inside glassmorphic Bento containers with glowing semantic badges, crisp typography, and complete editorial content. Zero placeholder text.

### Phase 7 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_07_LEGAL_FOOTER "Execute PHASE_08_A11Y_SUITE"`

---

## PHASE_08_A11Y_SUITE: WCAG 2.1 Level AAA Accessibility Suite
**Files Created/Modified:** `src/app/globals.css`, `src/context/AccessibilityContext.tsx`, `src/components/a11y/AccessibilityMenu.tsx`, `src/components/a11y/ReadingGuide.tsx`, `src/app/api/user/accessibility/route.ts`.

### 1. CSS Custom Properties & Attribute Selectors (`src/app/globals.css`)
Define root `html[data-*]` rules with zero external network calls:
- `html[data-contrast="high"]`: Pure `#000000` background, `#FFFFFF` body text, `#FFE600` borders and interactive highlights ($\ge 7:1$ AAA contrast).
- `html[data-contrast="inverted"]`: `filter: invert(100%) hue-rotate(180deg);`
- `html[data-contrast="monochrome"]`: `filter: grayscale(100%);`
- `html[data-font-size="100"]` (16px), `html[data-font-size="125"]` (20px), `html[data-font-size="150"]` (24px).
- `html[data-dyslexic="true"] *`: Uses local dyslexia-friendly accessible font stack (`'OpenDyslexic', 'Comic Sans MS', 'Verdana', sans-serif !important`).
- `html[data-text-spacing="true"] *`: `line-height: 2.0 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;`.
- `html[data-focus-indicators="true"] :focus-visible`: `outline: 4px solid #FFE600 !important; outline-offset: 3px !important; box-shadow: 0 0 0 6px #000000 !important;`.
- `html[data-reduced-motion="true"] *`: `animation-duration: 0.001ms !important; transition-duration: 0.001ms !important;`.
- `html[data-big-cursor="true"], html[data-big-cursor="true"] *`: High-contrast enlarged SVG data-URI cursor.

### 2. FOUC Prevention, Context & Screen-Reader Live Region (`src/context/AccessibilityContext.tsx`)
- Inject synchronous inline `<script>` in `src/app/layout.tsx` `<head>` reading `a11y_prefs` cookie before paint and applying `data-*` attributes to `document.documentElement`.
- Include global `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>` as the first child of `<body>` and wrap page children in `<main id="main-content" tabIndex={-1}>`.
- Provide `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>` that announces every toggle state change for screen readers.
- Sync changes to `a11y_prefs` cookie and optionally `PATCH /api/user/accessibility` (stores anonymous JSON in `User.a11yPrefs` when logged in).

### 3. Keyboard Shortcuts, Reading Guide & Modal Menu (`src/components/a11y/AccessibilityMenu.tsx`, `src/components/a11y/ReadingGuide.tsx`)
- Global keyboard listener: `Alt + A` toggles the Accessibility Menu dialog; `Alt + M` focuses `#main-content`; `Escape` closes the menu and restores focus.
- `<ReadingGuide/>`: Horizontal cursor-tracking bar (`pointer-events-none`, `aria-hidden="true"`) with `#FFE600` highlight line.
- `<AccessibilityMenu/>`: Floating bottom-right glowing cyan trigger button and glassmorphic `role="dialog"` panel with `role="switch"` toggles (`min-h-[44px] min-w-[44px]`), `role="radiogroup"` for font sizing (100%, 125%, 150%), and **"Reset All"** button.

### Phase 8 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_08_A11Y_SUITE "Execute PHASE_09_ADMIN_AI_PODMAN"`

---

## PHASE_09_ADMIN_AI_PODMAN: Admin Console, Qwen 2.5 7B Helper & FCOS Containerfile
**Files Created/Modified:** `src/lib/services/admin-ai.ts`, `src/app/admin/page.tsx`, `Containerfile`, `DEPLOYMENT.md`.

### 1. Qwen 2.5 7B Admin Helper Service (`src/lib/services/admin-ai.ts`)
- Strictly gated to `session?.user?.role === 'ADMIN'`.
- Connects to `process.env.AI_INFERENCE_URL || '[https://openrouter.ai/api/v1/chat/completions](https://openrouter.ai/api/v1/chat/completions)'` using model `process.env.AI_MODEL_NAME || 'qwen/qwen-2.5-7b-instruct'`.
- Evaluates tool/skill listings or admin prompts and validates output with Zod:
  ```typescript
  const AdminAuditSchema = z.object({
    decision: z.enum(['APPROVE', 'FLAG', 'NEEDS_REVIEW', 'NO_ACTION']),
    confidenceScore: z.number().min(0).max(1),
    suggestedCategory: z.string().optional(),
    auditSummary: z.string(),
  });
  ```

### 2. Sleek Cypherpunk Admin Console (`src/app/admin/page.tsx`)
- High-contrast telemetry Bento grid (Total Members, Active Tool Inventory, Active Loans, Skills Exchange Count) with cyan, purple, emerald, and rose neon accents.
- AI Audit Queue: Lists tools and skills with a glowing **"Run Qwen AI Audit"** button (invoking `admin-ai.ts` with explicit human confirmation before applying status changes) and moderation controls.
- User role & trust score management table.

### 3. Rootless Podman `Containerfile` & `DEPLOYMENT.md`
Create `Containerfile` at the repository root:
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/app/data/tool_library.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/tool_library.db"

RUN npm install --no-save prisma@5.22.0 && mkdir -p /app/data/uploads && chown -R node:node /app

USER node
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node server.js"]
```

Document the exact Fedora CoreOS rootless Podman launch command in `DEPLOYMENT.md`:
```bash
mkdir -p /var/home/core/srv/tool-library/data/uploads

podman build -t localhost/tool-library:latest -f Containerfile .

podman run -d \
  --name tool-library \
  --restart always \
  --userns=keep-id \
  --network host \
  -e DATABASE_URL="file:/app/data/tool_library.db" \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e AUTH_TRUST_HOST="true" \
  -e AI_INFERENCE_URL="https://openrouter.ai/api/v1/chat/completions" \
  -e AI_INFERENCE_KEY="your-api-key" \
  -e AI_MODEL_NAME="qwen/qwen-2.5-7b-instruct" \
  -v /var/home/core/srv/tool-library/data:/app/data:Z \
  localhost/tool-library:latest
```

### Phase 9 Gate
1. Run `npx tsc --noEmit && npm run build`
2. Run `node scripts/record-handoff.mjs PHASE_09_ADMIN_AI_PODMAN "ALL_PHASES_COMPLETED"`