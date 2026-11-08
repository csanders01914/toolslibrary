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
│ Ubuntu VPS gateway (stateless, tmpfs-only)                 │
│                                                            │
│  UFW: SSH, WireGuard 51820/udp, 80/443 only                │
│  DNAT 80/443 → 10.8.0.2 · MASQUERADE return path           │
│  No TLS state, no certificates, no logs, nothing on disk   │
└──────────────────────────┬─────────────────────────────────┘
                           │ WireGuard wg0 (10.8.0.1 ↔ 10.8.0.2)
┌──────────────────────────┴─────────────────────────────────┐
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
│              Caddy: TLS termination for all public domains  │
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
- **Stateless edge:** the Ubuntu VPS forwards packets only. TLS terminates on
  the FCOS host, and the VPS keeps no logs and no disk state.

## 2. Fedora CoreOS preparation

```bash
# Podman is preinstalled on FCOS; verify rootless mode works:
podman info --format '{{.Host.Security.Rootless}}'   # true

# The backup script uses the sqlite3 CLI (FCOS ships minimal).
# Requires a reboot to apply the layered package:
sudo rpm-ostree install sqlite

# Keep user-level systemd timers (backups) running while logged out:
sudo loginctl enable-linger $USER

# Only for direct exposure without the VPS edge: open the port:
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

**If the build aborts with a Go panic** (`SIGSEGV` inside
`imagebuildah.(*StageExecutor).Copy`): that is a known buildah race
(podman-container-tools/buildah #6894, fixed by PR #7141 in buildah 1.47) —
a failed stage's error is swallowed and a concurrently running stage copies
from an already-torn-down container, so podman core-dumps instead of printing
the real failing step. `deploy.sh` passes `--jobs 1` to sidestep it (this
image's stages are a linear chain, so nothing is lost). If you hit the panic
anyway: re-run the build (the race is a flake; the retry surfaces the real
error or succeeds outright), clean the aborted build's stale state
(`podman builder prune -f`, remove leftover intermediate containers from
`podman ps -a`), and upgrade the host (`rpm-ostree upgrade` + reboot) once
Fedora ships a podman vendoring buildah ≥ 1.47.

## 5. Environment reference

| Variable | Set on | Purpose |
|---|---|---|
| `DATABASE_URL` | website | `file:/app/data/tool_library.db` (set by deploy.sh/Containerfile) |
| `AUTH_SECRET` | website | Session signing + canary-seal key; persisted in `data/.auth_secret` and reused across deploys (export `AUTH_SECRET` to pin/rotate) |
| `AUTH_TRUST_HOST` | website | `true`; required behind the reverse proxy |
| `APP_PORT` | host (deploy.sh) | Host port for the website (default 3000) |
| `MATRIX_HOMESERVER_URL` / `MATRIX_BOT_USER_ID` / `MATRIX_BOT_ACCESS_TOKEN` / `MATRIX_ADMIN_ROOM_ID` | website | Deterministic support & triage via your own Matrix homeserver (dormant until set) |
| `BOT_WEBHOOK_URL` | website | helpbot webhook URL: **Podman container DNS, e.g. `http://helpbot:3005`, never localhost** (required for the help form) |
| `HELPDESK_WEBHOOK_SECRET` | website | Shared secret; must equal the bot's `WEBHOOK_SECRET` |
| `PORT` | helpbot | Webhook listen port (default **3005**, no collision with Next.js :3000) |
| `WEBHOOK_SECRET` | helpbot | Shared secret; must equal `HELPDESK_WEBHOOK_SECRET` |
| `LIBERAPAY_URL` | build (deploy.sh) | Your Liberapay page URL, surfaced in the site footer when set |
| `SMTP_HOST` | website | Local Postfix relay host (default `host.containers.internal` — rootless-Podman DNS for the host relay; set `localhost` with `--network host`) |
| `SMTP_PORT` | website | Local Postfix relay port (default `25`) |
| `SMTP_FROM` | website | Sender identity for admin alert emails, e.g. "ToolsLibrary \<alerts@tools-library.com\>"; alerts are skipped when unset |

Admin alert and test-email bodies are PGP-encrypted to the operator's public
key before the SMTP handoff (`src/lib/crypto/encryptEmail.ts`), so the
Postfix → Resend relay chain only ever observes ciphertext bodies plus
routing metadata. Postfix must be configured with Resend as its outbound
smart host.

## 6. Public edge: VPS gateway, WireGuard tunnel, and Caddy

Public traffic does not reach the FCOS host directly. A small Ubuntu VPS acts
as a stateless ingress gateway and NAT router: it accepts ports 80 and 443,
forwards the raw packets through a WireGuard tunnel to the FCOS host, and
masquerades the return path. TLS terminates on the FCOS host, where Caddy
manages certificates for all public domains. The VPS never decrypts HTTPS
payloads and stores no private keys.

### 6.1 VPS hardening (stateless, RAM-only)

The VPS is disposable by design. Swap is disabled, and every write-heavy path
lives in volatile memory, so nothing about transit traffic or session activity
is written to block storage and a reboot wipes whatever accumulated in RAM.

```bash
# Disable swap permanently
sudo swapoff -a
sudo sed -i '/swap/d' /etc/fstab

# Keep shell history off disk
ln -sf /dev/null ~/.bash_history
echo 'unset HISTFILE' >> ~/.bashrc
```

```fstab
# /etc/fstab: volatile mounts
tmpfs   /tmp        tmpfs   defaults,noatime,nosuid,nodev,noexec,mode=1777,size=512M   0 0
tmpfs   /var/tmp    tmpfs   defaults,noatime,nosuid,nodev,noexec,mode=1777,size=256M   0 0
tmpfs   /var/log    tmpfs   defaults,noatime,nosuid,nodev,noexec,mode=0755,size=256M   0 0
```

```ini
# /etc/systemd/journald.conf: keep journals in RAM only
[Journal]
Storage=volatile
RuntimeMaxUse=64M
ForwardToSyslog=no
```

```bash
sudo systemctl restart systemd-journald
```

### 6.2 WireGuard tunnel

Enable IPv4 forwarding, then define the tunnel. The VPS is the listening peer
(`10.8.0.1`); the FCOS host connects as `10.8.0.2`.

```ini
# /etc/sysctl.d/99-wireguard-forward.conf
net.ipv4.ip_forward=1
```

```bash
sudo sysctl --system
```

```ini
# /etc/wireguard/wg0.conf (VPS)
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <VPS_PRIVATE_KEY>
SaveConfig = false

[Peer]
# Fedora CoreOS host
PublicKey = <FCOS_PUBLIC_KEY>
AllowedIPs = 10.8.0.2/32
```

```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
```

On the FCOS side, the peer entry uses `AllowedIPs = 10.8.0.0/24` with
`PersistentKeepalive = 25`, so masqueraded traffic from `10.8.0.1` is accepted
and answered over `wg0`. WireGuard runs natively through NetworkManager on
FCOS, not in a container.

### 6.3 Firewall and NAT (UFW)

Set the default forward policy, then add the NAT rules at the top of
`/etc/ufw/before.rules`, before the `*filter` section:

```ini
# /etc/default/ufw
DEFAULT_FORWARD_POLICY="ACCEPT"
```

```text
# /etc/ufw/before.rules: *nat table
*nat
:PREROUTING ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]

# Forward HTTP/HTTPS from the public interface to the FCOS host
-A PREROUTING -i eth0 -p tcp --dport 80 -j DNAT --to-destination 10.8.0.2:80
-A PREROUTING -i eth0 -p tcp --dport 443 -j DNAT --to-destination 10.8.0.2:443
-A PREROUTING -i eth0 -p udp --dport 443 -j DNAT --to-destination 10.8.0.2:443

# Masquerade traffic entering wg0 so FCOS routes responses back to 10.8.0.1
-A POSTROUTING -o wg0 -p tcp --dport 80 -d 10.8.0.2 -j MASQUERADE
-A POSTROUTING -o wg0 -p tcp --dport 443 -d 10.8.0.2 -j MASQUERADE
-A POSTROUTING -o wg0 -p udp --dport 443 -d 10.8.0.2 -j MASQUERADE

# Masquerade outbound traffic from the WireGuard subnet
-A POSTROUTING -s 10.8.0.0/24 -o eth0 -j MASQUERADE

COMMIT
```

Match `eth0` to the interface reported by `ip route show default` (`eth0`,
`enp1s0`, and so on). Then open exactly the needed ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 51820/udp comment 'WireGuard VPN'
sudo ufw allow 80/tcp comment 'HTTP NAT Forward'
sudo ufw allow 443/tcp comment 'HTTPS NAT Forward'
sudo ufw allow 443/udp comment 'HTTP/3 QUIC NAT Forward'
sudo ufw reload
```

### 6.4 DNS records (DNS-only)

The `A` records for `tools-library.com`, `wiki`, `chat`, and `matrix` point at
the VPS public IP with the CDN proxy disabled (DNS-only, gray cloud). DNS-only
is required for this topology: the VPS forwards raw TCP ports to Caddy, so
Let's Encrypt HTTP-01 and TLS-ALPN-01 challenges must reach Caddy untouched.
Cloudflare's proxy intercepts `.well-known/acme-challenge` requests and breaks
the handshake unless the zone is switched to origin certificates.

### 6.5 Caddy on the FCOS host

Caddy terminates TLS for all four domains and proxies each to its local
backend: the website on `127.0.0.1:3000`, the wiki on `127.0.0.1:6875`,
Element Web on `127.0.0.1:8080`, and Synapse on `127.0.0.1:8008`. Certificates
persist in the Caddy data directory on the FCOS host, so renewals survive
reboots and VPS rebuilds.

### 6.6 Verification

```bash
# On the VPS: RAM-only mounts and zero swap
df -hT | grep tmpfs
free -h

# Tunnel health
sudo wg show
ping -c 3 10.8.0.2

# NAT counters incrementing on the DNAT and MASQUERADE rules
sudo iptables -t nat -L -n -v
```

Notes that matter for this application:

- **Trusted client IP:** Caddy sets `x-forwarded-for`, and the rate limiter
  (`src/lib/rateLimit.ts`) reads its first hop, so per-IP throttling of
  login/recovery/help routes works correctly.
- **HTTPS origin:** Caddy terminates TLS, and `x-forwarded-proto: https` flows
  through, so the printable QR handoff labels encode the public `https://` URL
  automatically.
- **`AUTH_TRUST_HOST=true`** (already set by `deploy.sh`) allows NextAuth to
  trust the proxied host header.
- Zero-PII invariant holds: the VPS forwards packets without decrypting them
  and keeps no logs; the application itself never logs IPs and stores none.

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
  `PRAGMA integrity_check`, and prune after 14 days. Since PHASE_55 each run
  also archives `data/uploads/` (photos + secret-link images) and
  `data/.auth_secret` (the canary key-seal root) into a `chmod 600` tarball
  with its own sha256 manifest, on the same retention window. Setup steps and
  the restore procedure: `DEPLOYMENT.md` section 6.
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
