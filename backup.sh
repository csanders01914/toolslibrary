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
# backup.sh — WAL-safe online backup for the Tool Library SQLite database.
#
# Uses the native sqlite3 CLI `.backup` command (the SQLite Online Backup
# API), which produces a consistent, transactionally sound snapshot of the
# database WHILE the Next.js container keeps running. A plain file copy of a
# WAL-mode database can capture a torn state of the -wal/-shm sidecar files
# and yield a corrupted restore; `.backup` never has that problem and never
# blocks the running server.
#
# Runs on the Fedora CoreOS host as the same user that owns the bind-mounted
# data volume (i.e. scheduled by the user-level systemd timer in
# deploy/systemd/tool-library-backup.timer — see DEPLOYMENT.md). If the host
# has no sqlite3 CLI (FCOS ships minimal), it falls back to a throwaway
# alpine container sharing the data volume.
#
# Usage (on the FCOS host, inside the repository checkout):
#   chmod +x backup.sh
#   ./backup.sh
#   DATA_DIR=/var/home/core/srv/tool-library/data \
#     BACKUP_DIR=/var/home/core/srv/tool-library/backups ./backup.sh
#
# Optional environment overrides:
#   DATA_DIR        (default: /var/home/core/srv/tool-library/data)
#   BACKUP_DIR      (default: /var/home/core/srv/tool-library/backups)
#   DB_NAME         (default: tool_library.db)
#   RETENTION_DAYS  (default: 14)  snapshots older than this are deleted
#   SQLITE3_BIN     (default: sqlite3)  host CLI path when not on PATH
#   FALLBACK_IMAGE  (default: docker.io/alpine:3.20)  podman fallback image
#
# Restore procedure (full details in DEPLOYMENT.md):
#   podman stop tool-library
#   cp "$BACKUP_DIR"/tool_library-<stamp>.db "$DATA_DIR"/tool_library.db
#   rm -f "$DATA_DIR"/tool_library.db-wal "$DATA_DIR"/tool_library.db-shm
#   ./deploy.sh
#

set -euo pipefail

DATA_DIR="${DATA_DIR:-/var/home/core/srv/tool-library/data}"
BACKUP_DIR="${BACKUP_DIR:-/var/home/core/srv/tool-library/backups}"
DB_NAME="${DB_NAME:-tool_library.db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
SQLITE3_BIN="${SQLITE3_BIN:-sqlite3}"
FALLBACK_IMAGE="${FALLBACK_IMAGE:-docker.io/alpine:3.20}"

case "$RETENTION_DAYS" in
  ''|*[!0-9]*) echo "ERROR: RETENTION_DAYS must be a non-negative integer (got: $RETENTION_DAYS)" >&2; exit 1 ;;
esac

DB_PATH="$DATA_DIR/$DB_NAME"
PREFIX="${DB_NAME%.db}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/$PREFIX-$STAMP.db"
TMP_BASE="$PREFIX-$STAMP.db.tmp"

[ -f "$DB_PATH" ] || { echo "ERROR: database not found at $DB_PATH" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

# Pick the sqlite3 execution mode: host CLI first, podman fallback second.
if command -v "$SQLITE3_BIN" >/dev/null 2>&1; then
  MODE="host"
  # Snapshot into BACKUP_DIR so the final rename is atomic on one filesystem.
  TMP="$BACKUP_DIR/$TMP_BASE"
  "$SQLITE3_BIN" "$DB_PATH" ".backup '$TMP'"
  INTEGRITY="$("$SQLITE3_BIN" "$TMP" 'PRAGMA integrity_check;')"
elif command -v podman >/dev/null 2>&1; then
  MODE="podman"
  # FCOS ships without the sqlite3 CLI: run it in a throwaway container that
  # shares the data volume (the SELinux :Z label is already applied by
  # deploy.sh). One container performs BOTH the snapshot and the integrity
  # check; the temp file must live inside DATA_DIR because that is the only
  # mounted path.
  TMP="$DATA_DIR/$TMP_BASE"
  INTEGRITY="$(podman run --rm -v "$DATA_DIR:/data:Z" "$FALLBACK_IMAGE" \
    sh -c "apk add --no-cache sqlite >/dev/null 2>&1 && sqlite3 \"/data/$DB_NAME\" \".backup '/data/$TMP_BASE'\" && sqlite3 \"/data/$TMP_BASE\" 'PRAGMA integrity_check;'")"
else
  echo "ERROR: neither the sqlite3 CLI nor podman is available; cannot back up." >&2
  exit 1
fi
trap 'rm -f "$TMP"' EXIT

# A snapshot that fails integrity_check is a restore hazard, not a backup:
# discard it and fail loudly (systemd journal captures the message). The live
# database is never touched by this script.
if [ "${INTEGRITY:-}" != "ok" ]; then
  echo "ERROR: PRAGMA integrity_check failed on the snapshot ('$INTEGRITY'); snapshot discarded, live database untouched." >&2
  exit 1
fi

mv -f "$TMP" "$TARGET"
(cd "$BACKUP_DIR" && sha256sum "$PREFIX-$STAMP.db" > "$PREFIX-$STAMP.db.sha256")

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "OK: $TARGET ($SIZE, integrity_check: ok, sha256 manifest written)"

# Retention: prune snapshots, manifests, and stale temp files past the window.
find "$BACKUP_DIR" -type f \
  \( -name "$PREFIX-*.db" -o -name "$PREFIX-*.db.sha256" -o -name "$PREFIX-*.db.tmp" \) \
  -mtime "+$RETENTION_DAYS" -delete
echo "Retention: snapshots older than $RETENTION_DAYS day(s) removed from $BACKUP_DIR"
