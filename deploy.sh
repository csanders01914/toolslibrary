#!/usr/bin/env bash
#
# deploy.sh — Fedora CoreOS rootless-Podman deployment for the Tool Library.
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
#   AI_INFERENCE_URL / AI_MODEL_NAME / AI_INFERENCE_KEY
#              (legacy LLM fallback; primary LLM config lives in the Admin
#              Console, encrypted at rest with AES-256-GCM)
#   LLM_ENCRYPTION_KEY (optional dedicated master secret for API-key encryption)
#
# Notes:
#   - AUTH_SECRET is regenerated on every deploy; existing login sessions are
#     invalidated. Pin it by exporting AUTH_SECRET before calling this script
#     if session persistence across redeploys is required.
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

echo "==> Building $IMAGE"
podman build -t "$IMAGE" -f "$CONTAINERFILE" "$SCRIPT_DIR"

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
if [ -n "${AUTH_SECRET:-}" ]; then
  RUN_ARGS+=(-e "AUTH_SECRET=$AUTH_SECRET")
else
  RUN_ARGS+=(-e "AUTH_SECRET=$(openssl rand -hex 32)")
fi
if [ -n "${AI_INFERENCE_URL:-}" ];  then RUN_ARGS+=(-e "AI_INFERENCE_URL=$AI_INFERENCE_URL");    fi
if [ -n "${AI_MODEL_NAME:-}" ];     then RUN_ARGS+=(-e "AI_MODEL_NAME=$AI_MODEL_NAME");          fi
if [ -n "${AI_INFERENCE_KEY:-}" ];  then RUN_ARGS+=(-e "AI_INFERENCE_KEY=$AI_INFERENCE_KEY");    fi
if [ -n "${LLM_ENCRYPTION_KEY:-}" ]; then RUN_ARGS+=(-e "LLM_ENCRYPTION_KEY=$LLM_ENCRYPTION_KEY"); fi

podman run "${RUN_ARGS[@]}" "$IMAGE"

echo "==> Deployed. Verify with:"
echo "    podman ps"
echo "    podman logs -f $APP_NAME"
echo "    curl -s http://localhost:$APP_PORT"
echo "    podman healthcheck run $APP_NAME"
