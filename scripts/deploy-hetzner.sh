#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-tieradmin@100.120.76.1}"
REMOTE_DIR="${2:-/opt/tierlistplus}"
# Keep BuildKit cache bounded on small VPS disks.
BUILDKIT_MAX_USED_SPACE="${BUILDKIT_MAX_USED_SPACE:-6gb}"
BUILDKIT_MIN_FREE_SPACE="${BUILDKIT_MIN_FREE_SPACE:-10gb}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

find_command() {
  local cmd
  for cmd in "$@"; do
    if command -v "${cmd}" >/dev/null 2>&1; then
      echo "${cmd}"
      return 0
    fi
  done
  return 1
}

require_command() {
  local cmd="${1:-}"
  if [[ -z "${cmd}" ]] || ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd:-<unspecified>}" >&2
    exit 1
  fi
}

SSH_BIN="${SSH_BIN:-$(find_command ssh ssh.exe || true)}"
if [[ -z "${SSH_BIN}" ]]; then
  echo "Missing required command: ssh (or ssh.exe)" >&2
  echo "Install OpenSSH in the shell you use for deploy (recommended: WSL Debian)." >&2
  exit 1
fi

if ! "${SSH_BIN}" -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "${REMOTE_HOST}" "exit 0" >/dev/null 2>&1; then
  echo "Cannot reach ${REMOTE_HOST} over SSH." >&2
  echo "Check: Tailscale running, host reachable on tailnet, and SSH auth configured." >&2
  exit 1
fi

echo "Deploying ${REPO_ROOT} -> ${REMOTE_HOST}:${REMOTE_DIR}"

 "${SSH_BIN}" "${REMOTE_HOST}" "sudo mkdir -p '${REMOTE_DIR}'"

if command -v rsync >/dev/null 2>&1; then
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
else
  require_command tar
  STAGE_DIR="/tmp/tierlistplus-sync-$(date +%s)-$$"
  echo "rsync not found; falling back to tar-over-ssh sync."

  "${SSH_BIN}" "${REMOTE_HOST}" "sudo rm -rf '${STAGE_DIR}' && sudo mkdir -p '${STAGE_DIR}'"

  tar -C "${REPO_ROOT}" -cf - \
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
    . | "${SSH_BIN}" "${REMOTE_HOST}" "sudo tar -xf - -C '${STAGE_DIR}'"

  "${SSH_BIN}" "${REMOTE_HOST}" "
    sudo bash -lc '
      set -euo pipefail
      stage=\"${STAGE_DIR}\"
      dest=\"${REMOTE_DIR}\"
      mkdir -p \"\$dest\"
      if [ -f \"\$dest/.env.production\" ]; then
        cp \"\$dest/.env.production\" \"\$stage/.env.production\"
      fi
      find \"\$dest\" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
      cp -a \"\$stage\"/. \"\$dest\"/
      rm -rf \"\$stage\"
    '
  "
fi

"${SSH_BIN}" "${REMOTE_HOST}" "
  sudo bash -lc '
    set -euo pipefail
    cd \"${REMOTE_DIR}\"
    HEALTHCHECK_TIMER=\"tierlistplus-healthcheck.timer\"
    HEALTHCHECK_SERVICE=\"tierlistplus-healthcheck.service\"
    HEALTHCHECK_TIMER_PRESENT=0
    HEALTHCHECK_TIMER_WAS_ACTIVE=0

    restore_healthcheck_timer() {
      if [[ \"\${HEALTHCHECK_TIMER_PRESENT}\" != \"1\" ]]; then
        return 0
      fi

      if [[ \"\${HEALTHCHECK_TIMER_WAS_ACTIVE}\" == \"1\" ]]; then
        systemctl start \"\${HEALTHCHECK_TIMER}\" >/dev/null 2>&1 || true
      fi
    }

    if systemctl list-unit-files --type=timer --no-legend \"\${HEALTHCHECK_TIMER}\" 2>/dev/null | grep -q \"\${HEALTHCHECK_TIMER}\"; then
      HEALTHCHECK_TIMER_PRESENT=1
      if systemctl is-active --quiet \"\${HEALTHCHECK_TIMER}\"; then
        HEALTHCHECK_TIMER_WAS_ACTIVE=1
        echo \"Pausing \${HEALTHCHECK_TIMER} during deploy.\"
        systemctl stop \"\${HEALTHCHECK_TIMER}\"
      fi
      systemctl reset-failed \"\${HEALTHCHECK_SERVICE}\" >/dev/null 2>&1 || true
      trap restore_healthcheck_timer EXIT
    fi

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
    if docker buildx version >/dev/null 2>&1; then
      docker buildx prune --force \
        --max-used-space \"${BUILDKIT_MAX_USED_SPACE}\" \
        --min-free-space \"${BUILDKIT_MIN_FREE_SPACE}\" >/dev/null || true
    else
      docker builder prune -af --filter \"until=168h\" >/dev/null || true
    fi
    \$COMPOSE ps

    if [[ \"\${HEALTHCHECK_TIMER_PRESENT}\" == \"1\" ]]; then
      echo \"Running post-deploy healthcheck.\"
      systemctl start \"\${HEALTHCHECK_SERVICE}\"
      systemctl --no-pager --full status \"\${HEALTHCHECK_SERVICE}\" || true
    fi
  '
"

echo "Deploy complete."
