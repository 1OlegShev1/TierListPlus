#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-tieradmin@46.62.140.254}"
REMOTE_DIR="${2:-/opt/tierlistplus}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Deploying ${REPO_ROOT} -> ${REMOTE_HOST}:${REMOTE_DIR}"

ssh "${REMOTE_HOST}" "sudo mkdir -p '${REMOTE_DIR}'"

rsync -rlptDz --delete \
  --rsync-path="sudo rsync" \
  --exclude '.git' \
  --exclude '.claude' \
  --exclude '.env' \
  --exclude '.env.production.example' \
  --exclude '.env.production' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'output' \
  --exclude 'docs' \
  --exclude 'scripts' \
  --exclude 'CLAUDE.md' \
  --exclude 'docker-compose.yml' \
  --exclude '*.tsbuildinfo' \
  "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh "${REMOTE_HOST}" "
  sudo bash -lc '
    set -euo pipefail
    cd \"${REMOTE_DIR}\"
    test -f .env.production || {
      echo \".env.production not found on server. Create it first.\" >&2
      exit 1
    }
    rm -rf .claude docs output scripts
    rm -f .env .env.production.example CLAUDE.md docker-compose.yml
    find . -maxdepth 1 -name \"*.tsbuildinfo\" -delete
    chown -R root:root .
    chmod 750 .
    chmod 600 .env.production
    COMPOSE=\"docker compose --profile with-domain --env-file .env.production -f docker-compose.prod.yml\"
    \$COMPOSE build app migrate
    \$COMPOSE up -d db
    \$COMPOSE --profile ops run --rm migrate
    \$COMPOSE up -d app caddy
    docker image prune -f >/dev/null
    docker builder prune -af --filter \"until=168h\" >/dev/null
    \$COMPOSE ps
  '
"

echo "Deploy complete."
