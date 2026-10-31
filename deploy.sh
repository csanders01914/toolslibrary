#!/usr/bin/env bash

# ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
# Copyright (C) 2026  Chris Sanders
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

#
# deploy.sh — Fedora CoreOS rootless-Podman deployment for the ToolsLibrary.
#
# Builds localhost/tool-library from ./Containerfile and (re)launches the
# container with:
#   - rootless --userns=keep-id  (host UID maps into the container, so the
#     bind-mounted data volume keeps host ownership)
#   - SELinux-labeled bind mount (:Z) for the persistent SQLite DB + uploads
#   - --network host, so the app serves directly on APP_PORT (default 3000).
#     With host networking no `-p` flag is needed; open the port in firewalld
#     if the server must be reachable from other machines.
#
# Usage (on the FCOS host, inside the repository checkout):
#   chmod +x deploy.sh
#   ./deploy.sh
#   APP_PORT=3000 DATA_DIR=/var/home/core/srv/tool-library/data ./deploy.sh
#
# Optional environment overrides:
#   APP_NAME   (default: tool-library)
#   IMAGE      (default: localhost/tool-library:latest)
#   DATA_DIR   (default: /var/home/core/srv/tool-library/data)
#   APP_PORT   (default: 3000)
#   MATRIX_HOMESERVER_URL / MATRIX_BOT_USER_ID / MATRIX_BOT_ACCESS_TOKEN /
#   MATRIX_ADMIN_ROOM_ID
#              (self-hosted Matrix server used by the deterministic support
#              and triage system; the listener stays dormant until these are
#              set)
#   BOT_WEBHOOK_URL / HELPDESK_WEBHOOK_SECRET
#              (helpbot webhook integration: the bot's container DNS URL on a
#              shared Podman network, e.g. http://helpbot:3005 — never a
#              hardcoded localhost; the secret must match the bot's
#              WEBHOOK_SECRET. The help form requires BOT_WEBHOOK_URL.)
#   LIBERAPAY_URL
#              (optional funding surface: the operator's Liberapay page URL,
#              passed as a build arg and surfaced in the site footer)
#   SMTP_HOST / SMTP_PORT / SMTP_FROM
#              (admin alert emails via the local Postfix relay; host defaults
#              to localhost and port to 25 — with --network host that is the
#              FCOS host's Postfix loopback listener. Alerts are skipped when
#              SMTP_FROM is unset)
#
# Notes:
#   - AUTH_SECRET is persisted in $DATA_DIR/.auth_secret and reused across
#     deploys, so login sessions and the admin canary seal survive redeploys.
#     Export AUTH_SECRET to pin or rotate it explicitly (rotating signs every
#     member out once and invalidates the canary seal until re-sealed).
#   - Nothing here modifies the local source tree: the build context is
#     filtered by .dockerignore and all persistent state lives in DATA_DIR.

set -euo pipefail

APP_NAME="${APP_NAME:-tool-library}"
IMAGE="${IMAGE:-localhost/tool-library:latest}"
DATA_DIR="${DATA_DIR:-/var/home/core/srv/tool-library/data}"
APP_PORT="${APP_PORT:-3000}"

command -v podman  >/dev/null 2>&1 || { echo "ERROR: podman not found in PATH" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl not found (needed to generate AUTH_SECRET)" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINERFILE="$SCRIPT_DIR/Containerfile"
[ -f "$CONTAINERFILE" ] || { echo "ERROR: Containerfile not found at $CONTAINERFILE" >&2; exit 1; }

echo "==> Preparing persistent data volume at $DATA_DIR"
mkdir -p "$DATA_DIR/uploads"

# --- AUTH_SECRET persistence -------------------------------------------------
# The session cookie is an Auth.js JWE encrypted with AUTH_SECRET, and the
# admin canary seal is AES-encrypted with a key derived from it. Generating a
# fresh secret on every deploy invalidates every existing login (the browser
# keeps sending a cookie the new container cannot decrypt — Auth.js logs
# JWTSessionError "no matching decryption secret" and every authenticated
# route answers 401) and breaks canary seal verification. Persist the secret
# in the data volume and reuse it; it changes only on a fresh DATA_DIR or
# when the operator pins/rotates it explicitly via the AUTH_SECRET
# environment variable. The file lives inside the mounted volume — the same
# trust domain as the container environment that already carries the secret.
SECRET_FILE="$DATA_DIR/.auth_secret"
if [ -n "${AUTH_SECRET:-}" ]; then
  # Operator-pinned or rotated secret: honor it and persist for future deploys.
  printf '%s\n' "$AUTH_SECRET" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "==> AUTH_SECRET: using operator-provided value (persisted to $SECRET_FILE)"
elif [ -s "$SECRET_FILE" ]; then
  AUTH_SECRET="$(cat "$SECRET_FILE")"
  echo "==> AUTH_SECRET: reusing persisted secret from $SECRET_FILE"
else
  AUTH_SECRET="$(openssl rand -hex 32)"
  printf '%s\n' "$AUTH_SECRET" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "==> AUTH_SECRET: generated and persisted to $SECRET_FILE"
fi

echo "==> Building $IMAGE"
podman build --build-arg "LIBERAPAY_URL=${LIBERAPAY_URL:-}" -t "$IMAGE" -f "$CONTAINERFILE" "$SCRIPT_DIR"

echo "==> Removing previous container (if any)"
podman rm -f "$APP_NAME" 2>/dev/null || true

echo "==> Launching $APP_NAME (rootless, keep-id, host network, port $APP_PORT)"
RUN_ARGS=(
  -d
  --name "$APP_NAME"
  --restart always
  --userns=keep-id
  --network host
  -e "PORT=$APP_PORT"
  -e "DATABASE_URL=file:/app/data/tool_library.db"
  -e "AUTH_TRUST_HOST=true"
  -v "$DATA_DIR:/app/data:Z"
)
RUN_ARGS+=(-e "AUTH_SECRET=$AUTH_SECRET")
if [ -n "${MATRIX_HOMESERVER_URL:-}" ]; then RUN_ARGS+=(-e "MATRIX_HOMESERVER_URL=$MATRIX_HOMESERVER_URL"); fi
if [ -n "${MATRIX_BOT_USER_ID:-}" ];    then RUN_ARGS+=(-e "MATRIX_BOT_USER_ID=$MATRIX_BOT_USER_ID");         fi
if [ -n "${MATRIX_BOT_ACCESS_TOKEN:-}" ]; then RUN_ARGS+=(-e "MATRIX_BOT_ACCESS_TOKEN=$MATRIX_BOT_ACCESS_TOKEN"); fi
if [ -n "${MATRIX_ADMIN_ROOM_ID:-}" ];  then RUN_ARGS+=(-e "MATRIX_ADMIN_ROOM_ID=$MATRIX_ADMIN_ROOM_ID");     fi
if [ -n "${BOT_WEBHOOK_URL:-}" ];       then RUN_ARGS+=(-e "BOT_WEBHOOK_URL=$BOT_WEBHOOK_URL");               fi
if [ -n "${HELPDESK_WEBHOOK_SECRET:-}" ]; then RUN_ARGS+=(-e "HELPDESK_WEBHOOK_SECRET=$HELPDESK_WEBHOOK_SECRET"); fi
if [ -n "${SMTP_HOST:-}" ]; then RUN_ARGS+=(-e "SMTP_HOST=$SMTP_HOST"); fi
if [ -n "${SMTP_PORT:-}" ]; then RUN_ARGS+=(-e "SMTP_PORT=$SMTP_PORT"); fi
if [ -n "${SMTP_FROM:-}" ]; then RUN_ARGS+=(-e "SMTP_FROM=$SMTP_FROM"); fi

podman run "${RUN_ARGS[@]}" "$IMAGE"

echo "==> Deployed. Verify with:"
echo "    podman ps"
echo "    podman logs -f $APP_NAME"
echo "    curl -s http://localhost:$APP_PORT"
echo "    podman healthcheck run $APP_NAME"
