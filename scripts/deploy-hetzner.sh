#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-root@46.62.140.254}"
REMOTE_DIR="${2:-/opt/tierlistplus}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Deploying ${REPO_ROOT} -> ${REMOTE_HOST}:${REMOTE_DIR}"

ssh "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"

rsync -az --delete \
  --exclude '.git' \
  --exclude '.env.production' \
  --exclude 'node_modules' \
  --exclude '.next' \
  "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh "${REMOTE_HOST}" "
  set -euo pipefail
  cd '${REMOTE_DIR}'
  test -f .env.production || {
    echo '.env.production not found on server. Create it first.' >&2
    exit 1
  }
  docker compose --profile with-domain --env-file .env.production -f docker-compose.prod.yml up -d --build
  docker compose --profile with-domain --env-file .env.production -f docker-compose.prod.yml ps
"

echo "Deploy complete."
