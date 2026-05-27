#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="homeadmin"
REMOTE_HOST="100.80.53.62"
REMOTE_DIR="/home/homeadmin/backups/tierlistplus"
DB_DIR="${REMOTE_DIR}/db"
UPLOADS_DIR="${REMOTE_DIR}/uploads"
SSH_KEY="/home/tieradmin/.ssh/id_ed25519_mini_backup"
KEEP_DAYS="${KEEP_DAYS:-21}"
SSH_RETRY_ATTEMPTS="${SSH_RETRY_ATTEMPTS:-4}"
SSH_RETRY_DELAY_SEC="${SSH_RETRY_DELAY_SEC:-3}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DB_BASE="tierlistplus_${TS}.dump"
UP_BASE="tierlistplus_uploads_${TS}.tar.gz"
DB_TMP="${DB_DIR}/.${DB_BASE}.partial"
UP_TMP="${UPLOADS_DIR}/.${UP_BASE}.partial"
DB_REMOTE="${DB_DIR}/${DB_BASE}"
UP_REMOTE="${UPLOADS_DIR}/${UP_BASE}"

SSH_OPTS=(
  -i "${SSH_KEY}"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
  -o ConnectionAttempts=2
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o IPQoS=none
)

remote_run() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

retry() {
  local description="$1"
  shift

  local attempt=1
  while true; do
    if "$@"; then
      return 0
    fi

    if (( attempt >= SSH_RETRY_ATTEMPTS )); then
      return 1
    fi

    echo "${description} failed (attempt ${attempt}/${SSH_RETRY_ATTEMPTS}), retrying in ${SSH_RETRY_DELAY_SEC}s..." >&2
    sleep "${SSH_RETRY_DELAY_SEC}"
    attempt=$((attempt + 1))
  done
}

fail() {
  echo "$1" >&2
  exit 1
}

db_stream_once() {
  sudo -n bash -lc 'cd /opt/tierlistplus && docker compose --profile with-domain --env-file .env.production -f docker-compose.prod.yml exec -T db sh -lc "pg_dump -Fc -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\""' |
    ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "cat > '${DB_TMP}'"
}

uploads_stream_once() {
  sudo -n tar -czf - -C "${VOL_PATH}" . | ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "cat > '${UP_TMP}'"
}

cleanup_partials() {
  ssh \
    -i "${SSH_KEY}" \
    -o BatchMode=yes \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=3 \
    -o ConnectionAttempts=1 \
    "${REMOTE_USER}@${REMOTE_HOST}" \
    "rm -f '${DB_TMP}' '${UP_TMP}'" >/dev/null 2>&1 || true
}
trap cleanup_partials EXIT

retry "Backup target setup" remote_run "mkdir -p '${DB_DIR}' '${UPLOADS_DIR}'" || fail "Backup target setup failed"

# 1) Stream PostgreSQL logical backup directly to UM890.
if ! retry "DB stream backup" db_stream_once; then
  fail "DB stream backup failed"
fi
retry "DB backup verification" remote_run "[ -s '${DB_TMP}' ]" || fail "DB backup verification failed"
retry "DB backup publish" remote_run "mv '${DB_TMP}' '${DB_REMOTE}'" || fail "DB backup publish failed"
retry "DB backup checksum" remote_run "cd '${DB_DIR}' && sha256sum '${DB_BASE}' > '${DB_BASE}.sha256' && sha256sum -c '${DB_BASE}.sha256'" || fail "DB backup checksum failed"

# 2) Stream uploads archive directly to UM890.
VOL_PATH="$(sudo -n docker volume inspect tierlistplus_uploads_data -f '{{ .Mountpoint }}')" || fail "Uploads volume lookup failed"
if ! retry "Uploads stream backup" uploads_stream_once; then
  fail "Uploads stream backup failed"
fi
retry "Uploads backup verification" remote_run "[ -s '${UP_TMP}' ]" || fail "Uploads backup verification failed"
retry "Uploads backup publish" remote_run "mv '${UP_TMP}' '${UP_REMOTE}'" || fail "Uploads backup publish failed"
retry "Uploads backup checksum" remote_run "cd '${UPLOADS_DIR}' && sha256sum '${UP_BASE}' > '${UP_BASE}.sha256' && sha256sum -c '${UP_BASE}.sha256'" || fail "Uploads backup checksum failed"

# 3) Prune old backups on UM890.
retry "DB backup prune" remote_run "find '${DB_DIR}' -type f \\( -name 'tierlistplus_*.dump' -o -name 'tierlistplus_*.dump.sha256' \\) -mtime +${KEEP_DAYS} -delete" || fail "DB backup prune failed"
retry "Uploads backup prune" remote_run "find '${UPLOADS_DIR}' -type f \\( -name 'tierlistplus_uploads_*.tar.gz' -o -name 'tierlistplus_uploads_*.tar.gz.sha256' \\) -mtime +${KEEP_DAYS} -delete" || fail "Uploads backup prune failed"

echo "DB backup uploaded: ${REMOTE_HOST}:${DB_REMOTE}"
echo "Uploads backup uploaded: ${REMOTE_HOST}:${UP_REMOTE}"
