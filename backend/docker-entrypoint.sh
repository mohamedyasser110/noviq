#!/bin/sh
# ============================================================
# NOVIQ BACKEND — container entrypoint
# ------------------------------------------------------------
# A persistent volume (Railway, Docker, or any bind mount) is created
# root-owned, while the server itself must run as the unprivileged
# `node` user — better-sqlite3 refuses to open a database file it
# cannot write. Fix ownership once at boot, then drop privileges for
# the real process.
# ============================================================
set -e

STORAGE_DIR="${STORAGE_DIR:-/app/storage}"
DB_PATH="${DB_PATH:-$STORAGE_DIR/noviq.db}"
UPLOADS_DIR="${UPLOADS_DIR:-$STORAGE_DIR/uploads}"

# The volume may mount over an existing directory, so always (re)create.
mkdir -p "$STORAGE_DIR" "$UPLOADS_DIR" "$(dirname "$DB_PATH")"

if [ "$(id -u)" = "0" ]; then
  # Best-effort: a read-only or already-correct mount should not block boot.
  chown -R node:node "$STORAGE_DIR" 2>/dev/null || true
  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec node "$@"
  fi
  echo "[entrypoint] su-exec unavailable — running as root" >&2
fi

exec "$@"
