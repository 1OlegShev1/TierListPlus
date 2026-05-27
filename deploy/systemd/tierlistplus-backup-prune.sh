#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/homeadmin/backups/tierlistplus}"
KEEP_DAYS="${KEEP_DAYS:-21}"
PARTIAL_KEEP_DAYS="${PARTIAL_KEEP_DAYS:-2}"

DB_DIR="${BACKUP_DIR}/db"
UPLOADS_DIR="${BACKUP_DIR}/uploads"

mkdir -p "${DB_DIR}" "${UPLOADS_DIR}"

find "${DB_DIR}" -type f \
  \( -name 'tierlistplus_*.dump' -o -name 'tierlistplus_*.dump.sha256' \) \
  -mtime +"${KEEP_DAYS}" -delete

find "${UPLOADS_DIR}" -type f \
  \( -name 'tierlistplus_uploads_*.tar.gz' -o -name 'tierlistplus_uploads_*.tar.gz.sha256' \) \
  -mtime +"${KEEP_DAYS}" -delete

find "${DB_DIR}" "${UPLOADS_DIR}" -type f -name '.*.partial' \
  -mtime +"${PARTIAL_KEEP_DAYS}" -delete

printf 'TierListPlus backup prune completed: keep_days=%s partial_keep_days=%s\n' "${KEEP_DAYS}" "${PARTIAL_KEEP_DAYS}"
