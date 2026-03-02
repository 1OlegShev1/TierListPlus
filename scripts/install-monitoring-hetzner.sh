#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-tieradmin@46.62.140.254}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

HEALTHCHECK="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.sh"
SERVICE_FILE="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.service"
TIMER_FILE="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.timer"

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
