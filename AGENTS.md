# AGENTS.md — Autonomous Agent Operating Contract

## 1. Core Operating Mandate
You are an autonomous engineering agent executing tasks in a sandboxed environment. Every session is completely stateless outside of the Git repository and the `.handoff/` state directory.

### Invariant Operating Rules
1. **Silent Tool Execution & Pure JSON Final Output:** 
   - During your work turn, invoke your native file-editing and bash execution tools silently without conversational narration between tool calls.
   - Once all code edits, cleanups, handoff recordings, and build verifications are complete, your **FINAL response terminating the session** must consist EXCLUSIVELY of a single structured, pretty-printed JSON object matching the schema in Section 4. Never emit conversational prose, greetings, or explanations outside the JSON object.
2. **Aggressive Cleanup (Zero Scratch Artifacts):**
   - Any temporary test scripts (`scripts/temp-*`, `test-*.mjs`, `verify-*.js`), seed scratchpads, diagnostic API routes (`/api/debug-*`), or mock fixtures created to test your work MUST be deleted (`rm`) before running the final build and handoff script. Only permanent production application code may survive.
3. **Zero Stub Tolerance:**
   - Never commit stubs, placeholder comments (`// TODO`, `// FIXME`, `// implement later`), mock memory arrays, or functions throwing `throw new Error("Not implemented")`. If you stub a function to test a pipeline, wire the real SQLite database logic and remove the stub within the same session.
4. **Strict Single-Phase Execution:**
   - Execute **EXACTLY ONE PHASE** per session. Once the active phase passes verification and records its handoff state, terminate immediately.
5. **Collaborative Error Transparency:**
   - Do not fear compiler or build errors, and never enter a repetitive guessing loop. If `tsc` or `npm run build` fails more than twice on the same issue, stop editing, leave the diagnostic logs in `verification_output`, set `"status": "BLOCKED"`, and output the JSON report so we can debug together.

---

## 2. Target Production Environment & Technical Invariants
- **Host OS:** Local Fedora CoreOS (FCOS) Server running rootless Podman (`--userns=keep-id`).
- **Container Runtime:** `node:20-alpine` with Next.js `output: 'standalone'`.
- **Next.js 15/16 Async Params Rule:** In all dynamic pages (`page.tsx`) and route handlers (`route.ts`), `params` and `searchParams` are Promises (e.g., `export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }`). Always `await params` and `await searchParams` so TypeScript compilation succeeds.
- **Database & Storage:** SQLite via Prisma ORM (`file:./data/tool_library.db` locally, `file:/app/data/tool_library.db` in Podman) in WAL mode (`PRAGMA journal_mode = WAL;`). User media uploads are stored in `data/uploads` and served dynamically via `/api/uploads/[filename]`.
- **Privacy & Cypherpunk Invariants:** Zero PII required. Accounts use only `username` (login handle), `alias` (public display name), and `password` (bcrypt cost 12). Account recovery uses 8 single-use SHA-256 hashed recovery codes (`XXXX-XXXX`). Zero email collection, zero phone collection, zero external CDNs, zero analytics, zero IP logging.

---

## 3. Mandatory Session Lifecycle (Step-by-Step)

### Step A: Pre-Flight Verification (Run First)
Check if `scripts/verify-handoff.mjs` exists:
- **If `scripts/verify-handoff.mjs` does NOT exist yet:** You are in a brand-new directory. Proceed directly to executing `PHASE_01_FOUNDATION` in `IMPLEMENTATION_PLAN.md`.
- **If `scripts/verify-handoff.mjs` exists:** Run it before reading or modifying any code:
  ```bash
  node scripts/verify-handoff.mjs
  ```
  - If the script exits with code `1` (`DRIFT_DETECTED`), halt immediately and output your JSON report with `"status": "BLOCKED"`.
  - If the script outputs `"status": "VERIFIED"`, read `last_completed_phase` and execute the **next sequential phase** in `IMPLEMENTATION_PLAN.md`.

### Step B: Implementation & Scratch Cleanup
1. Create or modify only the files listed in your active phase.
2. If you modified `prisma/schema.prisma`, run:
   ```bash
   npx prisma db push && npx prisma generate
   ```
3. Delete any temporary test files, scratch scripts, or stubs created during development.

### Step C: Deterministic Build Gate
Run the strict TypeScript and Next.js production build verification:
```bash
npx tsc --noEmit && npm run build
```

### Step D: Record Handoff Checksums (Run Last)
Never calculate SHA-256 hashes manually. Run the deterministic handoff recorder script:
```bash
node scripts/record-handoff.mjs <CURRENT_PHASE_ID> "<CONCISE_INSTRUCTIONS_FOR_NEXT_PHASE>"
```

---

## 4. Mandatory Final Output JSON Schema

Your final output message for the session must conform strictly to this JSON structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "phase",
    "status",
    "commands_executed",
    "files_created",
    "files_modified",
    "scratch_files_purged",
    "stubs_purged",
    "verification_output",
    "handoff_file_written",
    "blocking_issue",
    "next_session_instructions"
  ],
  "properties": {
    "phase": {
      "type": "string",
      "enum": [
        "PHASE_01_FOUNDATION",
        "PHASE_02_AUTH_BACKEND",
        "PHASE_03_AUTH_UI",
        "PHASE_04_TOOLS_ENGINE",
        "PHASE_05_SKILLS_ENGINE",
        "PHASE_06_MESSAGING_TRUST",
        "PHASE_07_LEGAL_FOOTER",
        "PHASE_08_A11Y_SUITE",
        "PHASE_09_ADMIN_AI_PODMAN"
      ]
    },
    "status": {
      "type": "string",
      "enum": ["COMPLETED", "IN_PROGRESS", "BLOCKED"]
    },
    "commands_executed": {
      "type": "array",
      "items": { "type": "string" }
    },
    "files_created": {
      "type": "array",
      "items": { "type": "string" }
    },
    "files_modified": {
      "type": "array",
      "items": { "type": "string" }
    },
    "scratch_files_purged": {
      "type": "array",
      "items": { "type": "string" }
    },
    "stubs_purged": {
      "type": "array",
      "items": { "type": "string" }
    },
    "verification_output": {
      "type": "object",
      "required": ["command", "exit_code", "logs"],
      "properties": {
        "command": { "type": "string" },
        "exit_code": { "type": "integer" },
        "logs": { "type": "string" }
      }
    },
    "handoff_file_written": { "type": "string" },
    "blocking_issue": {
      "type": ["string", "null"]
    },
    "next_session_instructions": { "type": "string" }
  }
}
```