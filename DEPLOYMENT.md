# DEPLOYMENT.md — Fedora CoreOS Rootless Podman Deployment

This guide deploys the ToolsLibrary as a rootless Podman container on a local
Fedora CoreOS (FCOS) server. The stack is fully self-hosted: SQLite in WAL mode
on a single persistent volume, zero external CDNs, zero analytics, zero IP
logging.

## Prerequisites

- Fedora CoreOS server with `podman` installed (rootless mode enabled).
- The repository source code on the server (e.g. `git clone` into
  `/var/home/core/srv/tool-library`).
- OpenSSL available for generating the `AUTH_SECRET`.

## 1. Prepare the persistent data volume

The SQLite database (`tool_library.db`) and user media uploads live in a single
host directory that is bind-mounted into the container:

```bash
mkdir -p /var/home/core/srv/tool-library/data/uploads
```

## 2. Build the image

The `Containerfile` builds a Next.js `output: 'standalone'` image on
`node:20-alpine`, generates the Prisma client, and produces a production
server:

```bash
podman build -t localhost/tool-library:latest -f Containerfile .
```

## 3. Run the container (rootless, keep-id)

Generate the session secret ONCE and persist it in the data volume; every
deploy must reuse it. Regenerating per deploy invalidates all existing logins
(the browser keeps sending a session cookie the new container cannot decrypt —
Auth.js logs `JWTSessionError: no matching decryption secret` and every
authenticated route answers 401) and breaks the admin canary seal, which is
keyed from `AUTH_SECRET`:

```bash
printf '%s\n' "$(openssl rand -hex 32)" > /var/home/core/srv/tool-library/data/.auth_secret
chmod 600 /var/home/core/srv/tool-library/data/.auth_secret
```

```bash
podman run -d \
  --name tool-library \
  --restart always \
  --userns=keep-id \
  --network host \
  -e DATABASE_URL="file:/app/data/tool_library.db" \
  -e AUTH_SECRET="$(cat /var/home/core/srv/tool-library/data/.auth_secret)" \
  -e AUTH_TRUST_HOST="true" \
  -e MATRIX_HOMESERVER_URL="https://matrix.tools-library.com" \
  -e MATRIX_BOT_USER_ID="@helpbot:matrix.tools-library.com" \
  -e MATRIX_BOT_ACCESS_TOKEN="syt_your_bot_token_here" \
  -e MATRIX_ADMIN_ROOM_ID="!yourAdminRoomId:matrix.tools-library.com" \
  -v /var/home/core/srv/tool-library/data:/app/data:Z \
  localhost/tool-library:latest
```

Notes:

- `--userns=keep-id` maps your host UID into the container so the bind-mounted
  `data/` volume stays owned by the same user (rootless requirement).
- `:Z` applies the SELinux private volume label required on FCOS.
- `--network host` binds the app directly to port `3000` on the host.
- On first start the entrypoint runs `prisma migrate deploy` to apply the
  version-controlled SQL migrations in `prisma/migrations/`, then launches
  `node server.js`. A fresh volume is created by the `0_init` baseline
  migration; a volume created by the old `db push` boot needs a one-time
  baseline first (see section 7).
- `MATRIX_HOMESERVER_URL`, `MATRIX_BOT_USER_ID`, `MATRIX_BOT_ACCESS_TOKEN`,
  and `MATRIX_ADMIN_ROOM_ID` configure the deterministic support and triage
  system's connection to your self-hosted Matrix (Synapse) server. The bot
  account answers help questions in community rooms and notifies the admin
  room when a request needs someone from the admin team. All replies are
  pre-written strings selected by pure regular expressions: no external
  services are contacted and no message content is sent anywhere except your
  own homeserver. If these variables are omitted, the listener stays dormant
  and the website help form still works (escalations then surface only in the
  Admin Console help queue).
- `BOT_WEBHOOK_URL` (required for the help form) points the website at the
  standalone helpdesk assistant in `tools-library-bot/`. In the multi-container
  Podman deployment this is the bot container's DNS name on a shared
  user-defined network (`http://helpbot:3005`), never a hardcoded localhost
  (localhost inside the website container is the website itself, not the bot).
  Missing configuration fails loudly: the support channel throws
  "BOT_WEBHOOK_URL is not configured." See the integration snippet below.
  Support submissions are then triaged by the assistant, which delivers
  escalations to the admin team room on the community Matrix server. When the
  assistant is unreachable, the website's built-in engine takes over
  automatically. Leave empty to always use the built-in engine.

### helpbot webhook integration (multi-container Podman)

The website's support form forwards submissions to the standalone helpdesk
assistant (`tools-library-bot/`: Express webhook `POST /api/web-support`,
listening on port `3005` by default). Next.js resolves the bot STRICTLY from
the environment; no hardcoded URL exists anywhere in the integration.

Podman's internal DNS resolves container names only on user-defined networks,
so both containers must join one (e.g. `toollibrary-net`); a website container
on `--network host` cannot resolve DNS names and must join the shared network
instead, publishing its port explicitly:

```bash
podman network create toollibrary-net

# helpbot container (built from tools-library-bot/):
podman run -d --name helpbot --network toollibrary-net \
  --restart always localhost/helpbot:latest

# website container: same flags as section 3 but with the shared network
# replacing --network host, e.g.:
#   podman run -d --name tool-library --network toollibrary-net \
#     -p 3000:3000 --userns=keep-id ... (remaining flags as in section 3)
# Or simply export BOT_WEBHOOK_URL / HELPDESK_WEBHOOK_SECRET before
# ./deploy.sh: the script forwards both into the container when set.
```

Exact `.env` configuration (commented):

```bash
# ── Website container (.env; forwarded by deploy.sh) ─────────────────────
# Next.js → helpbot routing uses Podman's internal DNS via the bot's
# CONTAINER NAME, never localhost:
BOT_WEBHOOK_URL=http://helpbot:3005
# Shared secret; must equal WEBHOOK_SECRET in the helpbot container's .env.
HELPDESK_WEBHOOK_SECRET=change-me-to-a-long-random-value

# Admin alert emails (PHASE_29) via the local Postfix SMTP relay — no
# third-party email API, no API keys. Requires Postfix installed on the FCOS
# host and listening on the loopback interface (inet_interfaces = localhost):
#   sudo dnf install -y postfix && sudo systemctl enable --now postfix
# SMTP_HOST/SMTP_PORT default to localhost:25 (correct for --network host);
# when SMTP_FROM is empty the app stores the admin notification email but
# skips sending.
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_FROM=ToolsLibrary <alerts@tools-library.com>

# ── helpbot container (tools-library-bot/.env) ───────────────────────────
# Webhook listen port; defaults to 3005 (no collision with Next.js :3000).
PORT=3005
# Must equal HELPDESK_WEBHOOK_SECRET in the website container's .env.
WEBHOOK_SECRET=change-me-to-a-long-random-value
```

Behavior: a missing `BOT_WEBHOOK_URL` throws "BOT_WEBHOOK_URL is not
configured." (strict guardrail: misconfiguration is loud); a configured but
unreachable bot falls back to the website's built-in deterministic engine so
the help form keeps working during bot restarts.

## 4. Verify

```bash
podman ps                          # container should be Up
podman logs -f tool-library        # watch prisma migrate deploy + server boot
curl -s http://localhost:3000      # landing page HTML
```

The first account registered on an empty database automatically receives the
`ADMIN` role. Register immediately after the first boot to claim it.

### Post-deploy verification checklist (run on the live FCOS server)

This project ships no seeded, mocked, or fake test data by design: every
verification is performed against the live deployment with real member
accounts. After each deploy, walk this checklist:

**Smoke checks (read-only, no accounts needed):**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/tools   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/donate  # 200
curl -s http://localhost:3000/api/auth/session                         # {}
podman exec tool-library ./node_modules/.bin/prisma migrate status
# → "Database schema is up to date!"
```

**Loan lifecycle walkthrough (two real member accounts):**

1. Register member A (on a fresh volume this account becomes ADMIN) and list
   a real tool from `/tools/new`.
2. As A, open the tool page and open `QR HANDOFF LABEL` from Quick Actions;
   the printable label must render a QR encoding the public handoff URL.
3. Register member B (second device, or after signing out) and request the
    tool from its listing page.
4. As B, open the handoff URL (scan the printed label with a phone, or visit
   `/tools/<id>/handoff`); it must show the REQUESTED state with no confirm
    button.
5. As A, approve the request from the dashboard; the lent queue shows
    `Awaiting Pickup` and offers no return buttons yet.
6. As B, scan the label again and confirm pickup; the loan becomes ACTIVE
    and the tool page shows BORROWED.
7. As A, scan the label and mark the tool returned (Good); the loan becomes
    RETURNED, the tool shows AVAILABLE again, and B's trust score rises by 5.
8. Check the dashboard's `TRUST // VOUCH YOUR COUNTERPARTS` section as A and
    as B; each side vouches once (+2 to the counterparty's trust score), the
   queues empty afterwards, and a second vouch on the same loan is refused.
   Also decline one queue entry with the `Decline` button; the row leaves
   the queue, the counterparty's trust score is unchanged, and the decision
   is final (vouching afterwards is refused).
9. As B, exercise `/recover` with one of the recovery codes from step 1 and
   confirm the code is single-use (a second attempt fails).

**helpbot integration (when deployed):**

```bash
podman exec helpbot wget -qO- http://127.0.0.1:3005/health   # {"ok":true,...}
```

Submit a real support message from `/help`: an escalated submission reaches
the admin Matrix room via the assistant; with the bot stopped, the website's
built-in engine answers instead and the submission still lands in the Admin
Console help queue.

## 5. Maintenance

- **Backups:** automated, WAL-safe, and safe while the server runs; see
  section 6 (`backup.sh` + systemd timer). Never copy the live
  `tool_library.db` / `-wal` / `-shm` files directly.
- **Schema changes:** update `prisma/schema.prisma`, generate a migration
  with `prisma migrate dev`, commit it, rebuild the image, and restart;
  the entrypoint applies pending migrations with `prisma migrate deploy`
  (see section 7).
- **Logs:** `podman logs tool-library` (the app logs errors only; no IP or
  request logging).
- **Update:** `git pull`, `podman build -t localhost/tool-library:latest -f Containerfile .`,
  then `podman stop tool-library && podman rm tool-library` and re-run the
  `podman run` command above.

## 6. Automated backups (systemd timer)

The SQLite database runs in WAL mode and is bind-mounted into the running
container, so copying `tool_library.db` directly can capture a torn state of
the `-wal`/`-shm` sidecar files and produce a corrupted restore. `backup.sh`
uses the native `sqlite3` CLI `.backup` command (the SQLite Online Backup
API) instead: it takes a consistent snapshot while the server keeps running,
verifies it with `PRAGMA integrity_check`, writes a `.sha256` manifest, and
prunes snapshots older than the retention window (default 14 days).

### One-time host setup

```bash
# FCOS ships minimal: install the sqlite3 CLI (requires a reboot), or skip
# this step; backup.sh then falls back to a throwaway alpine container.
sudo rpm-ostree install sqlite

mkdir -p /var/home/core/srv/tool-library/backups
mkdir -p ~/.config/systemd/user
cp deploy/systemd/tool-library-backup.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now tool-library-backup.timer
loginctl enable-linger        # keep user timers running while logged out
```

The units are user-level (no root): the timer runs `backup.sh` as your host
user, which owns the data volume thanks to `--userns=keep-id`.

### Operations

```bash
systemctl --user list-timers tool-library-backup.timer   # next run
journalctl --user -u tool-library-backup.service         # run logs
systemctl --user start tool-library-backup.service       # run one now
```

Each run writes `tool_library-YYYYMMDD-HHMMSS.db` plus a `.sha256` manifest
into `BACKUP_DIR`. A snapshot that fails `PRAGMA integrity_check` is deleted
and the service exits non-zero, so `systemctl --user --failed` surfaces the
failure. Tune directories, schedule, or retention via the `DATA_DIR`,
`BACKUP_DIR`, and `RETENTION_DAYS` environment overrides in `backup.sh` and
the `OnCalendar` entry in the timer unit.

`data/uploads/` (user media) is not part of the database snapshot; include it
in a file-level backup of the host if uploaded photos matter to you.

### Restoring from a backup

```bash
podman stop tool-library
cd /var/home/core/srv/tool-library/backups
sha256sum -c tool_library-<stamp>.db.sha256        # verify the snapshot first
cp tool_library-<stamp>.db ../data/tool_library.db
rm -f ../data/tool_library.db-wal ../data/tool_library.db-shm
cd -
./deploy.sh
```

The `-wal`/`-shm` sidecars of the old database must be removed so SQLite does
not replay stale WAL frames over the restored file. `./deploy.sh` restarts
the container, which re-runs `prisma migrate deploy` (a no-op when the
snapshot already matches the committed migrations).

## 7. Database migrations (prisma migrate deploy)

The container entrypoint applies version-controlled migrations with
`prisma migrate deploy`, which applies pending `.sql` files sequentially and
never destroys data. The old `prisma db push` boot was removed: `db push` is
a prototyping command that force-syncs the schema and can silently truncate
or drop columns when it detects drift.

### Existing deployments (database created by `db push`) — one-time baseline

Before restarting with a new image build, mark the baseline migration as
already applied so `migrate deploy` does not try to re-create existing
tables:

```bash
podman exec tool-library ./node_modules/.bin/prisma migrate resolve --applied 0_init
```

Then rebuild and redeploy as usual. Fresh deployments need no baseline: the
first boot applies `0_init` to the empty volume.

### Future schema changes

```bash
# 1. Edit prisma/schema.prisma, then generate and apply a migration locally:
npx prisma migrate dev --name <change_description>
# 2. Commit prisma/migrations/<timestamp>_<name>/ together with the code change.
# 3. Rebuild the image and redeploy; the entrypoint runs `migrate deploy`,
#    which applies the new migration on boot.
```

Never edit an applied migration file; always add a new one. If `migrate
deploy` fails on boot, the container exits loudly instead of guessing;
inspect `podman logs tool-library` and reconcile the drift before
redeploying.

## 8. Abuse controls (rate limiting)

Unauthenticated write surfaces are throttled by a zero-dependency, in-memory
token bucket (`src/lib/rateLimit.ts`). Buckets are keyed by a SHA-256 hash of
the client IP with a random per-process salt; the raw IP is never stored,
logged, or persisted, and buckets vanish on restart (zero-PII invariant).

| Surface | Bucket | Burst | Sustained |
|---|---|---|---|
| Login credential check (NextAuth `authorize`) | `login` | 10 | 5/min |
| Registration (`registerUser`) | `register` | 5 | 2/min |
| Account recovery (`recoverAccount`) | `recover` | 5 | 2/min |
| Change password (`changePassword`) | `changePassword` | 10 | 5/min |
| Delete own account (`deleteOwnAccount`) | `deleteAccount` | 10 | 5/min |
| Help form + website webhook actions | `help` | 5 | 2/min |

Throttled requests receive a "Too many requests" error (or a generic login
failure, deliberately indistinguishable from bad credentials, so throttling
never becomes an account-existence oracle). Buckets are in-memory only:
restarting the container resets all budgets, and a multi-replica deployment
would enforce budgets per replica (this app is a single container by design).

Client identification: behind a Cloudflare Tunnel the trusted
`cf-connecting-ip` header is used; otherwise the first `x-forwarded-for`
hop. With direct exposure and neither header present, all clients share one
bucket per surface; throttling fails safe (still applies) rather than
fail-open.
