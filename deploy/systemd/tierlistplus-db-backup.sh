#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="homeadmin"
REMOTE_HOST="100.80.53.62"
REMOTE_DIR="/home/homeadmin/backups/tierlistplus"
DB_DIR="${REMOTE_DIR}/db"
UPLOADS_DIR="${REMOTE_DIR}/uploads"
SSH_KEY="/home/tieradmin/.ssh/id_ed25519_mini_backup"
KEEP_DAYS="${KEEP_DAYS:-21}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DB_BASE="tierlistplus_${TS}.dump"
UP_BASE="tierlistplus_uploads_${TS}.tar.gz"
DB_TMP="${DB_DIR}/.${DB_BASE}.partial"
UP_TMP="${UPLOADS_DIR}/.${UP_BASE}.partial"
DB_REMOTE="${DB_DIR}/${DB_BASE}"
UP_REMOTE="${UPLOADS_DIR}/${UP_BASE}"

SSH_OPTS=(
  -i "${SSH_KEY}"
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
)

remote_run() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

cleanup_partials() {
  remote_run "rm -f '${DB_TMP}' '${UP_TMP}'"
}
trap cleanup_partials EXIT

remote_run "mkdir -p '${DB_DIR}' '${UPLOADS_DIR}'"

# 1) Stream PostgreSQL logical backup directly to UM890.
if ! sudo -n bash -lc 'cd /opt/tierlistplus && docker compose --profile with-domain --env-file .env.production -f docker-compose.prod.yml exec -T db sh -lc "pg_dump -Fc -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\""' | remote_run "cat > '${DB_TMP}'"; then
  echo "DB stream backup failed" >&2
  exit 1
fi
remote_run "[ -s '${DB_TMP}' ]"
remote_run "mv '${DB_TMP}' '${DB_REMOTE}'"
remote_run "cd '${DB_DIR}' && sha256sum '${DB_BASE}' > '${DB_BASE}.sha256' && sha256sum -c '${DB_BASE}.sha256'"

# 2) Stream uploads archive directly to UM890.
VOL_PATH="$(sudo -n docker volume inspect tierlistplus_uploads_data -f '{{ .Mountpoint }}')"
if ! sudo -n tar -czf - -C "${VOL_PATH}" . | remote_run "cat > '${UP_TMP}'"; then
  echo "Uploads stream backup failed" >&2
  exit 1
fi
remote_run "[ -s '${UP_TMP}' ]"
remote_run "mv '${UP_TMP}' '${UP_REMOTE}'"
remote_run "cd '${UPLOADS_DIR}' && sha256sum '${UP_BASE}' > '${UP_BASE}.sha256' && sha256sum -c '${UP_BASE}.sha256'"

# 3) Prune old backups on UM890.
remote_run "find '${DB_DIR}' -type f \\( -name 'tierlistplus_*.dump' -o -name 'tierlistplus_*.dump.sha256' \\) -mtime +${KEEP_DAYS} -delete"
remote_run "find '${UPLOADS_DIR}' -type f \\( -name 'tierlistplus_uploads_*.tar.gz' -o -name 'tierlistplus_uploads_*.tar.gz.sha256' \\) -mtime +${KEEP_DAYS} -delete"

echo "DB backup uploaded: ${REMOTE_HOST}:${DB_REMOTE}"
echo "Uploads backup uploaded: ${REMOTE_HOST}:${UP_REMOTE}"
