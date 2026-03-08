#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-tieradmin@100.120.76.1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

HEALTHCHECK="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.sh"
SERVICE_FILE="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.service"
TIMER_FILE="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.timer"

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    echo "Install it in the shell you use for deploy (recommended: WSL Debian)." >&2
    exit 1
  fi
}

require_command ssh
require_command scp

if ! ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "${REMOTE_HOST}" "exit 0" >/dev/null 2>&1; then
  echo "Cannot reach ${REMOTE_HOST} over SSH." >&2
  echo "Check: Tailscale running, host reachable on tailnet, and SSH auth configured." >&2
  exit 1
fi

echo "Installing monitoring on ${REMOTE_HOST}"

scp "${HEALTHCHECK}" "${REMOTE_HOST}:/tmp/tierlistplus-healthcheck"
scp "${SERVICE_FILE}" "${REMOTE_HOST}:/tmp/tierlistplus-healthcheck.service"
scp "${TIMER_FILE}" "${REMOTE_HOST}:/tmp/tierlistplus-healthcheck.timer"

ssh "${REMOTE_HOST}" "
  sudo install -m 755 /tmp/tierlistplus-healthcheck /usr/local/bin/tierlistplus-healthcheck
  sudo install -m 644 /tmp/tierlistplus-healthcheck.service /etc/systemd/system/tierlistplus-healthcheck.service
  sudo install -m 644 /tmp/tierlistplus-healthcheck.timer /etc/systemd/system/tierlistplus-healthcheck.timer
  rm -f /tmp/tierlistplus-healthcheck /tmp/tierlistplus-healthcheck.service /tmp/tierlistplus-healthcheck.timer
  sudo systemctl daemon-reload
  sudo systemctl enable --now tierlistplus-healthcheck.timer
  sudo systemctl start tierlistplus-healthcheck.service
  sudo systemctl --no-pager --full status tierlistplus-healthcheck.timer
  sudo systemctl --no-pager --full status tierlistplus-healthcheck.service || true
"

echo "Monitoring install complete."
