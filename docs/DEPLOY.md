# DEPLOY.md — Self-Hosting the ToolsLibrary on Fedora CoreOS

The ToolsLibrary is an AGPL-3.0, zero-PII community tool & skills library. This
guide is for self-hosters replicating the production architecture on their own
Fedora CoreOS (FCOS) server. It is the high-level map; `DEPLOYMENT.md` (repo
root) is the deep-dive companion covering backups, migrations, rate limiting,
and the helpbot webhook integration in full detail.

The stack is fully self-contained: SQLite in WAL mode on a single bind-mounted
volume, zero external CDNs, zero analytics, zero IP logging, zero member email
collection. (The operator's ADMIN account may store one notification email as
the destination for operational alert emails — PHASE_29; member accounts never
store email.)

## 1. Architecture overview

```
┌────────────────────────────────────────────────────────────┐
│ Fedora CoreOS host (rootless Podman, --userns=keep-id)     │
│                                                            │
│  ┌──────────────────────────────┐  ┌────────────────────┐  │
│  │ tool-library (Next.js 15     │  │ helpbot (optional) │  │
│  │ standalone + Prisma 5.22)    │  │ Express webhook    │  │
│  │ port 3000 · SQLite WAL ·     │  │ :3005 · Matrix bot │  │
│  │ uploads on /app/data volume  │  │                    │  │
│  └──────────────┬───────────────┘  └─────────┬──────────┘  │
│                 │  data/ bind mount (:Z)      │             │
│                 └──────────┬──────────────────┘             │
│                            │                                │
│              systemd user timer: nightly sqlite3 .backup    │
│              cloudflared: public exposure without open ports│
└────────────────────────────────────────────────────────────┘
```

- **One container, one volume:** the SQLite database (`tool_library.db`) and
  all user media (`uploads/`) live in a single host directory bind-mounted at
  `/app/data` with the SELinux private label (`:Z`).
- **Rootless everywhere:** the container runs with `--userns=keep-id`, so your
  host user's UID maps into the container and the volume keeps host ownership.
  No root, no daemon as root, no privileged containers.
- **Migrations on boot:** the entrypoint runs `prisma migrate deploy` against
  the version-controlled SQL migrations; never `db push` (a prototyping
  command that can silently truncate or drop columns on drift).

## 2. Fedora CoreOS preparation

```bash
# Podman is preinstalled on FCOS; verify rootless mode works:
podman info --format '{{.Host.Security.Rootless}}'   # true

# The backup script uses the sqlite3 CLI (FCOS ships minimal).
# Requires a reboot to apply the layered package:
sudo rpm-ostree install sqlite

# Keep user-level systemd timers (backups) running while logged out:
sudo loginctl enable-linger $USER

# If the site must be reachable directly (without a tunnel), open the port:
sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload
```

## 3. Source, volume, and permissions

```bash
mkdir -p /var/home/core/srv/tool-library/data/uploads
cd /var/home/core/srv/tool-library
git clone https://github.com/csanders01914/toolslibrary.git repo
# (or your fork; the deployment scripts live in the repo root)
```

Permission model: everything under `data/` is owned by YOUR host user. The
`--userns=keep-id` flag makes the container process run as that same UID, so
SQLite (which requires write access to the directory for its WAL sidecars) and
the uploads folder work without any chown dance. The `:Z` volume suffix applies
the SELinux private label that FCOS's enforcing mode requires:

```bash
ls -Z /var/home/core/srv/tool-library/data
# → container_file_t with the private label after the first container start
```

## 4. Build and run

```bash
cd repo
./deploy.sh
```

`deploy.sh` builds `localhost/tool-library` from the `Containerfile` and
launches it rootless with `--userns=keep-id`, the `:Z` volume mount, and
`--network host` (the app serves directly on `APP_PORT`, default 3000). Every
environment variable you export before calling it is forwarded into the
container; see the reference table below.

First boot applies the SQL migrations (`prisma migrate deploy`), then boots
`node server.js`. **Register immediately**: the first account on an empty
database becomes the `ADMIN`.

## 5. Environment reference

| Variable | Set on | Purpose |
|---|---|---|
| `DATABASE_URL` | website | `file:/app/data/tool_library.db` (set by deploy.sh/Containerfile) |
| `AUTH_SECRET` | website | Session signing secret (regenerated per deploy unless pinned) |
| `AUTH_TRUST_HOST` | website | `true`; required behind proxies/tunnels |
| `APP_PORT` | host (deploy.sh) | Host port for the website (default 3000) |
| `MATRIX_HOMESERVER_URL` / `MATRIX_BOT_USER_ID` / `MATRIX_BOT_ACCESS_TOKEN` / `MATRIX_ADMIN_ROOM_ID` | website | Deterministic support & triage via your own Matrix homeserver (dormant until set) |
| `BOT_WEBHOOK_URL` | website | helpbot webhook URL: **Podman container DNS, e.g. `http://helpbot:3005`, never localhost** (required for the help form) |
| `HELPDESK_WEBHOOK_SECRET` | website | Shared secret; must equal the bot's `WEBHOOK_SECRET` |
| `PORT` | helpbot | Webhook listen port (default **3005**, no collision with Next.js :3000) |
| `WEBHOOK_SECRET` | helpbot | Shared secret; must equal `HELPDESK_WEBHOOK_SECRET` |
| `LIBERAPAY_URL` | build (deploy.sh) | Your Liberapay page URL, surfaced in the site footer when set |
| `SMTP_HOST` | website | Local Postfix relay host (default `localhost`; with `--network host` this is the FCOS host's loopback listener) |
| `SMTP_PORT` | website | Local Postfix relay port (default `25`) |
| `SMTP_FROM` | website | Sender identity for admin alert emails, e.g. "ToolsLibrary \<alerts@tools-library.com\>"; alerts are skipped when unset |

## 6. Cloudflare Tunnel integration

A Cloudflare Tunnel exposes the site publicly without opening firewall ports or
exposing your home IP; the tunnel makes an outbound-only connection from the
host to Cloudflare's edge.

```bash
# 1. Install cloudflared (FCOS: layer it or run it as a container):
sudo rpm-ostree install cloudflared && sudo systemctl reboot

# 2. Authenticate and create the tunnel:
cloudflared tunnel login
cloudflared tunnel create tools-library
cloudflared tunnel route dns tools-library tools-library.com

# 3. Point the tunnel at the local website (host networking → localhost):
cloudflared tunnel run --url http://localhost:3000 tools-library

# 4. Make it persistent (systemd service):
sudo cloudflared service install
```

Notes that matter for this application:

- **Trusted client IP:** the rate limiter (`src/lib/rateLimit.ts`) prefers the
  `cf-connecting-ip` header that Cloudflare sets; behind the tunnel, per-IP
  throttling of login/recovery/help routes works correctly.
- **HTTPS origin:** the tunnel terminates TLS, and `x-forwarded-proto: https`
  flows through, so the printable QR handoff labels encode the public
  `https://` URL automatically.
- **`AUTH_TRUST_HOST=true`** (already set by `deploy.sh`) allows NextAuth to
  trust the proxied host header.
- Zero-PII invariant holds: Cloudflare sees transport metadata only; the
  application itself never logs IPs and stores none.

## 7. helpbot (optional second container)

The standalone helpdesk assistant (`tools-library-bot/`) triages support
messages with deterministic rules and escalates to your admin Matrix room.
Wire it over a shared user-defined Podman network so the website reaches it by
container name:

```bash
podman network create toollibrary-net
podman run -d --name helpbot --network toollibrary-net --restart always localhost/helpbot:latest
# website: join the same network and set BOT_WEBHOOK_URL=http://helpbot:3005
```

Full details, including the exact commented `.env` for both containers and
the strict "BOT_WEBHOOK_URL is not configured." guardrail behavior, are in
`DEPLOYMENT.md`, section "helpbot webhook integration (multi-container
Podman)".

## 8. Backups, migrations, and updates

- **Backups:** `backup.sh` + the `tool-library-backup.timer` user unit take a
  WAL-safe online snapshot every night (`sqlite3 .backup`), verify it with
  `PRAGMA integrity_check`, and prune after 14 days. Setup steps and the
  restore procedure: `DEPLOYMENT.md` section 6.
- **Schema changes:** `prisma migrate dev` locally, commit the migration,
  redeploy; `migrate deploy` applies it on boot. Existing `db push`-era
  databases need the one-time baseline: `DEPLOYMENT.md` section 7.
- **Updating:** `git pull && ./deploy.sh`: the build is deterministic
  (lockfile-driven `npm ci`), migrations apply on boot, and the verification
  checklist in `DEPLOYMENT.md` section 4 confirms the deployment is healthy.

## 9. License and source availability

The ToolsLibrary is free software under GNU AGPLv3. Section 13 of the license
requires that the full corresponding source of this network service remains
available to every user: if you run a modified version publicly, publish your
source. The footer links to it on every page.
