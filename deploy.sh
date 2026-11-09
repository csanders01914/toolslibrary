#!/usr/bin/env bash
# ToolsLibrary - A self-hostable community tool and skill-sharing platform.
# Copyright (C) 2026 Chris Sanders
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Fedora CoreOS rootless Podman deployment with a migration preflight,
# cold rollback copy, environment validation, and HTTP readiness check.
#
# Usage:
#   ./deploy-safe.sh --check    # Read-only checks; does NOT rebuild or restart
#   ./deploy-safe.sh            # Build and deploy a fresh candidate
#
# WARNING: Actual deployment briefly stops the website. Ensure current
# encrypted off-server backups are healthy before using the deploy mode.

set -Eeuo pipefail
umask 077

APP_NAME="${APP_NAME:-tool-library}"
DATA_DIR="${DATA_DIR:-/var/home/core/srv/tool-library/data}"
APP_PORT="${APP_PORT:-3000}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONTAINERFILE="$SCRIPT_DIR/Containerfile"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
MODE="${1:---deploy}"

if [[ "$MODE" != "--check" && "$MODE" != "--deploy" ]]; then
  printf 'Usage: %s [--check|--deploy]\n' "$0" >&2
  exit 2
fi

for tool in podman openssl curl cp cmp awk stat; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'ERROR: required command not found: %s\n' "$tool" >&2
    exit 1
  }
done

[[ -f "$CONTAINERFILE" ]] || { echo 'ERROR: Containerfile missing.' >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo 'ERROR: production .env file missing.' >&2; exit 1; }
[[ -f "$SCRIPT_DIR/.dockerignore" ]] || { echo 'ERROR: .dockerignore missing.' >&2; exit 1; }

grep -qxF '.env' "$SCRIPT_DIR/.dockerignore" || {
  echo 'ERROR: .dockerignore must explicitly exclude .env.' >&2
  exit 1
}

# Never source .env: sourcing executes shell statements; Podman parses KEY=value.
awk '
  /^[[:space:]]*(#|$)/ { next }
  !/^[A-Za-z_][A-Za-z0-9_]*=/ {
    printf "ERROR: Unsupported .env entry at line %d\n", NR > "/dev/stderr"
    bad=1
  }
  END { exit bad }
' "$ENV_FILE"

# In check mode, do not change file permissions either.
env_mode=$(stat -c '%a' "$ENV_FILE")
if [[ "$env_mode" != 600 ]]; then
  if [[ "$MODE" == "--check" ]]; then
    echo "ERROR: .env permissions are $env_mode; run: chmod 600 .env" >&2
    exit 1
  fi
  chmod 600 "$ENV_FILE"
fi

[[ "$APP_PORT" =~ ^[0-9]+$ ]] || { echo 'ERROR: APP_PORT must be a number.' >&2; exit 1; }
[[ "$DATA_DIR" = /* ]] || { echo 'ERROR: DATA_DIR must be an absolute path.' >&2; exit 1; }

# Read only setting names. Values must never be printed.
for key in SMTP_HOST SMTP_PORT SMTP_FROM; do
  if ! awk -v key="$key" '
    index($0, key "=") == 1 && length($0) > length(key)+1 { found=1 }
    END { exit !found }
  ' "$ENV_FILE"; then
    echo "ERROR: required production .env setting is missing or empty: $key" >&2
    exit 1
  fi
done

current_exists=false
if podman container exists "$APP_NAME"; then
  current_exists=true
  [[ "$(podman inspect -f '{{.State.Status}}' "$APP_NAME")" == running ]] || {
    echo "ERROR: $APP_NAME exists but is not running. Resolve this before deployment." >&2
    exit 1
  }
  [[ "$(podman inspect -f '{{.HostConfig.NetworkMode}}' "$APP_NAME")" == host ]] || {
    echo "ERROR: running $APP_NAME does not use host networking." >&2
    exit 1
  }
  # Reject unexpected data mount. The complete source path is not a secret.
  podman inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Source}}{{end}}{{end}}' \
    "$APP_NAME" | grep -qxF "$DATA_DIR" || {
    echo 'ERROR: running container uses a different /app/data directory.' >&2
    exit 1
  }
fi

if [[ "$MODE" == "--check" ]]; then
  echo 'PASS: .env exists, is private, and contains the required SMTP settings.'
  echo 'PASS: Containerfile and secret-excluding .dockerignore exist.'
  if [[ "$current_exists" == true ]]; then
    echo 'PASS: current container is running with host networking and expected data mount.'
  else
    echo 'INFO: no currently running production container (first deploy).'
  fi
  echo 'CHECK COMPLETE: no changes were made.'
  exit 0
fi

# There is intentionally no automatic AUTH_SECRET rotation in this script.
# A rotation must be a separate explicitly authorized maintenance operation.
mkdir -p "$DATA_DIR/uploads"
SECRET_FILE="$DATA_DIR/.auth_secret"
RUNTIME_ENV=''
ROLLBACK_DIR=''
OLD_STOPPED=false
OLD_RENAMED=false
NEW_PROMOTED=false
NEW_STARTED=false
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
IMAGE="${IMAGE:-localhost/tool-library:release-$stamp}"
CANDIDATE="$APP_NAME-candidate-$stamp"
OLD_NAME="$APP_NAME-previous-$stamp"
FAILED_NAME="$APP_NAME-failed-$stamp"
BACKUP_BASE="${BACKUP_BASE:-$HOME/toolslibrary-deploy-backups}"

[[ "$IMAGE" != 'localhost/tool-library:latest' ]] || {
  echo 'ERROR: building directly to latest would overwrite the rollback image.' >&2
  exit 1
}
if podman image exists "$IMAGE"; then
  echo "ERROR: candidate image tag already exists: $IMAGE" >&2
  exit 1
fi
for name in "$CANDIDATE" "$OLD_NAME" "$FAILED_NAME"; do
  if podman container exists "$name"; then
    echo "ERROR: container name already exists: $name" >&2
    exit 1
  fi
done

rollback_if_needed() {
  local code="$1"
  trap - EXIT
  if [[ -n "$RUNTIME_ENV" ]]; then rm -f -- "$RUNTIME_ENV"; fi
  if (( code == 0 )); then exit 0; fi

  echo "ERROR: deployment failed (exit $code)." >&2
  if [[ "$NEW_PROMOTED" == false ]] && podman container exists "$CANDIDATE"; then
    podman rm "$CANDIDATE" >/dev/null 2>&1 || true
  fi
  if [[ "$OLD_STOPPED" == true ]]; then
    echo 'Attempting to restore the previous application...' >&2

    if [[ "$NEW_PROMOTED" == true ]]; then
      podman stop --time 15 "$APP_NAME" >/dev/null 2>&1 || true
      if podman container exists "$APP_NAME"; then
        podman rename "$APP_NAME" "$FAILED_NAME" || true
        podman update --restart=no "$FAILED_NAME" || true
      fi
      # The new image may have migrated the live DB. Restore its cold copy.
      if [[ -n "$ROLLBACK_DIR" && -d "$ROLLBACK_DIR/data" ]]; then
        mkdir -m 700 -p "$ROLLBACK_DIR/failed-live-data"
        cp -a "$DATA_DIR/." "$ROLLBACK_DIR/failed-live-data/" || true
        # Leave $DATA_DIR itself in place so existing bind mounts remain valid.
        find "$DATA_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
        cp -a "$ROLLBACK_DIR/data/." "$DATA_DIR/"
      fi
    fi

    if [[ "$OLD_RENAMED" == true ]]; then
      podman rename "$OLD_NAME" "$APP_NAME" || true
      podman update --restart=unless-stopped "$APP_NAME" || true
    fi
    if podman container exists "$APP_NAME"; then
      podman start "$APP_NAME" || true
    fi
    echo 'Rollback attempted. Verify the local website immediately.' >&2
  fi
  exit "$code"
}
trap 'rollback_if_needed $?' EXIT

# The running container's env is a fallback for settings that may not have
# been moved into .env. The checked .env overrides those fallback values.
if [[ "$current_exists" == true ]]; then
  runtime_dir="${XDG_RUNTIME_DIR:-/tmp}"
  RUNTIME_ENV="$(mktemp "$runtime_dir/toolslibrary-env.XXXXXX")"
  podman inspect --type container "$APP_NAME" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' > "$RUNTIME_ENV"
fi

# AUTH_SECRET is always taken from the stable file (or active runtime for a
# one-time recovery of a missing file), not silently rotated by .env.
if [[ -s "$SECRET_FILE" ]]; then
  AUTH_SECRET="$(cat "$SECRET_FILE")"
  if [[ "$current_exists" == true ]]; then
    active_secret=$(awk 'index($0,"AUTH_SECRET=")==1 {print substr($0,13); exit}' "$RUNTIME_ENV")
    if [[ -n "$active_secret" && "$active_secret" != "$AUTH_SECRET" ]]; then
      echo 'ERROR: .auth_secret differs from the running application secret.' >&2
      exit 1
    fi
  fi
elif [[ "$current_exists" == true ]]; then
  AUTH_SECRET=$(awk 'index($0,"AUTH_SECRET=")==1 {print substr($0,13); exit}' "$RUNTIME_ENV")
  [[ -n "$AUTH_SECRET" ]] || {
    echo 'ERROR: active container lacks AUTH_SECRET and .auth_secret is missing.' >&2
    exit 1
  }
  printf '%s\n' "$AUTH_SECRET" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
else
  AUTH_SECRET="$(openssl rand -hex 32)"
  printf '%s\n' "$AUTH_SECRET" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
fi

# LIBERAPAY_URL is public (a build-time footer URL). Extract only that key;
# do not source/execute the .env file.
liberapay_url=$(awk 'index($0,"LIBERAPAY_URL=")==1 {print substr($0,15)}' "$ENV_FILE" | tail -n 1)
liberapay_url="${LIBERAPAY_URL:-$liberapay_url}"
if [[ "$liberapay_url" == \"*\" && "$liberapay_url" == *\" ]]; then
  liberapay_url="${liberapay_url:1:${#liberapay_url}-2}"
fi
if [[ "$liberapay_url" == \'*\' && "$liberapay_url" == *\' ]]; then
  liberapay_url="${liberapay_url:1:${#liberapay_url}-2}"
fi

echo "==> Building candidate image $IMAGE (production stays online)"
podman build --jobs 1 --format docker \
  --build-arg "LIBERAPAY_URL=$liberapay_url" \
  -t "$IMAGE" -f "$CONTAINERFILE" "$SCRIPT_DIR"

# Create only; never start a second SQLite writer while production is live.
create_args=(
  --name "$CANDIDATE"
  --restart=unless-stopped
  --userns=keep-id
  --network=host
)
if [[ -n "$RUNTIME_ENV" ]]; then
  # Existing runtime settings are fallbacks for settings not yet in .env.
  create_args+=(--env-file "$RUNTIME_ENV")
fi
create_args+=(
  --env-file "$ENV_FILE"
  -e "PORT=$APP_PORT"
  -e 'DATABASE_URL=file:/app/data/tool_library.db'
  -e 'AUTH_TRUST_HOST=true'
  -e "AUTH_SECRET=$AUTH_SECRET"
  --health-cmd "wget -q -O /dev/null http://127.0.0.1:$APP_PORT/ || exit 1"
  --health-interval=30s
  --health-timeout=5s
  --health-start-period=30s
  --health-retries=3
  -v "$DATA_DIR:/app/data:Z"
)

# Sanity-check the candidate's host networking and settings without exposing
# any secret values.
echo "==> Preparing candidate container $CANDIDATE (not starting it)"
podman create "${create_args[@]}" "$IMAGE" >/dev/null
[[ "$(podman inspect -f '{{.State.Status}}' "$CANDIDATE")" == created ]]
[[ "$(podman inspect -f '{{.HostConfig.NetworkMode}}' "$CANDIDATE")" == host ]]
for key in SMTP_HOST SMTP_PORT SMTP_FROM AUTH_SECRET; do
  podman inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CANDIDATE" | \
    awk -v key="$key" 'index($0,key "=")==1 && length($0)>length(key)+1 {found=1} END {exit !found}' || {
      echo "ERROR: candidate missing required environment variable: $key" >&2
      exit 1
    }
done

echo '==> Candidate configuration validated. Starting downtime for SQLite safety.'
if [[ "$current_exists" == true ]]; then
  podman stop --time 30 "$APP_NAME"
  OLD_STOPPED=true
fi

# A cold backup is made only after the previous SQLite writer has stopped.
mkdir -m 700 -p "$BACKUP_BASE"
ROLLBACK_DIR="$BACKUP_BASE/$stamp"
mkdir -m 700 "$ROLLBACK_DIR"
mkdir -m 700 "$ROLLBACK_DIR/data"
cp -a "$DATA_DIR/." "$ROLLBACK_DIR/data/"
[[ -s "$ROLLBACK_DIR/data/tool_library.db" ]] || {
  echo 'ERROR: cold backup is missing the SQLite DB.' >&2
  exit 1
}
cmp -s "$DATA_DIR/tool_library.db" "$ROLLBACK_DIR/data/tool_library.db" || {
  echo 'ERROR: cold SQLite backup differs from production.' >&2
  exit 1
}

# Database-only duplicate: apply the candidate migration to this copy first.
mkdir -m 700 "$ROLLBACK_DIR/migration-test"
for suffix in '' '-wal' '-shm'; do
  source_file="$ROLLBACK_DIR/data/tool_library.db$suffix"
  if [[ -f "$source_file" ]]; then
    cp -a "$source_file" "$ROLLBACK_DIR/migration-test/"
  fi
done

echo '==> Testing migrations against an offline database copy'
podman run --rm --network none --userns=keep-id \
  -e 'DATABASE_URL=file:/app/data/tool_library.db' \
  -v "$ROLLBACK_DIR/migration-test:/app/data:Z" \
  --entrypoint sh "$IMAGE" -c \
  'set -e; node prisma/boot-migrate.mjs; ./node_modules/.bin/prisma migrate deploy'

# After preflight passes, move containers without deleting the old one.
if [[ "$current_exists" == true ]]; then
  echo "==> Preserving old container as $OLD_NAME"
  podman rename "$APP_NAME" "$OLD_NAME"
  OLD_RENAMED=true
  podman update --restart=no "$OLD_NAME" >/dev/null
fi

echo '==> Promoting candidate'
podman rename "$CANDIDATE" "$APP_NAME"
NEW_PROMOTED=true
podman start "$APP_NAME" >/dev/null
NEW_STARTED=true

healthy=false
for attempt in {1..20}; do
  if [[ "$(podman inspect -f '{{.State.Status}}' "$APP_NAME")" == running ]] && \
     curl -fsS --max-time 3 -o /dev/null "http://127.0.0.1:$APP_PORT/" 2>/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" == true ]] || {
  echo 'ERROR: new application failed HTTP readiness check.' >&2
  podman logs --tail 35 "$APP_NAME" >&2 || true
  exit 1
}

# Container healthcheck is configured at runtime even if the image metadata
# were ignored by an older OCI build.
podman healthcheck run "$APP_NAME" >/dev/null || {
  echo 'ERROR: new application failed Podman healthcheck.' >&2
  exit 1
}

podman tag "$IMAGE" "localhost/${APP_NAME}:latest"
rm -rf -- "$ROLLBACK_DIR/migration-test"
echo
printf 'SUCCESS: %s is online at http://127.0.0.1:%s/\n' "$APP_NAME" "$APP_PORT"
printf 'Live image: %s\n' "$IMAGE"
if [[ "$current_exists" == true ]]; then
  printf 'Previous container (stopped, no auto-restart): %s\n' "$OLD_NAME"
fi
printf 'Cold rollback copy (private): %s/data\n' "$ROLLBACK_DIR"
echo 'Next: verify public HTTPS, logins, SMTP, and Matrix as applicable.'
