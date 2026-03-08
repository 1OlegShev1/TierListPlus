#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-tieradmin@100.120.76.1}"
REMOTE_DIR="${2:-/opt/tierlistplus}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    echo "Install it in the shell you use for deploy (recommended: WSL Debian)." >&2
    exit 1
  fi
}

require_command ssh
require_command rsync

if ! ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "${REMOTE_HOST}" "exit 0" >/dev/null 2>&1; then
  echo "Cannot reach ${REMOTE_HOST} over SSH." >&2
  echo "Check: Tailscale running, host reachable on tailnet, and SSH auth configured." >&2
  exit 1
fi

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
  --exclude 'CLAUDE.md' \
  --exclude 'docker-compose.yml' \
  --exclude '*.tsbuildinfo' \
  --exclude 'public/uploads/*' \
  "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh "${REMOTE_HOST}" "
  sudo bash -lc '
    set -euo pipefail
    cd \"${REMOTE_DIR}\"
    test -f .env.production || {
      echo \".env.production not found on server. Create it first.\" >&2
      exit 1
    }
    rm -rf .claude docs output
    rm -f .env .env.production.example CLAUDE.md docker-compose.yml
    find . -maxdepth 1 -name \"*.tsbuildinfo\" -delete
    mkdir -p public/uploads
    touch public/uploads/.gitkeep
    find public/uploads -maxdepth 1 -type f ! -name \".gitkeep\" -delete
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
