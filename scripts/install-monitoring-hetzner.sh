#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-tieradmin@100.120.76.1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

HEALTHCHECK="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.sh"
SERVICE_FILE="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.service"
TIMER_FILE="${REPO_ROOT}/deploy/systemd/tierlistplus-healthcheck.timer"
UPLOAD_GC="${REPO_ROOT}/deploy/systemd/tierlistplus-upload-gc.sh"
UPLOAD_GC_SERVICE="${REPO_ROOT}/deploy/systemd/tierlistplus-upload-gc.service"
UPLOAD_GC_TIMER="${REPO_ROOT}/deploy/systemd/tierlistplus-upload-gc.timer"

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

SSH_BIN="${SSH_BIN:-$(find_command ssh ssh.exe || true)}"
SCP_BIN="${SCP_BIN:-$(find_command scp scp.exe || true)}"
if [[ -z "${SSH_BIN}" ]]; then
  echo "Missing required command: ssh (or ssh.exe)" >&2
  echo "Install OpenSSH in the shell you use for deploy (recommended: WSL Debian)." >&2
  exit 1
fi
if [[ -z "${SCP_BIN}" ]]; then
  echo "Missing required command: scp (or scp.exe)" >&2
  echo "Install OpenSSH in the shell you use for deploy (recommended: WSL Debian)." >&2
  exit 1
fi

copy_file() {
  local local_file="$1"
  local remote_target="$2"
  local scp_local="${local_file}"

  # Windows OpenSSH binaries invoked from WSL require Windows-style local paths.
  if [[ "${SCP_BIN##*/}" == "scp.exe" ]] && command -v wslpath >/dev/null 2>&1; then
    scp_local="$(wslpath -w "${local_file}")"
  fi

  "${SCP_BIN}" "${scp_local}" "${remote_target}"
}

if ! "${SSH_BIN}" -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "${REMOTE_HOST}" "exit 0" >/dev/null 2>&1; then
  echo "Cannot reach ${REMOTE_HOST} over SSH." >&2
  echo "Check: Tailscale running, host reachable on tailnet, and SSH auth configured." >&2
  exit 1
fi

echo "Installing monitoring on ${REMOTE_HOST}"

copy_file "${HEALTHCHECK}" "${REMOTE_HOST}:/tmp/tierlistplus-healthcheck"
copy_file "${SERVICE_FILE}" "${REMOTE_HOST}:/tmp/tierlistplus-healthcheck.service"
copy_file "${TIMER_FILE}" "${REMOTE_HOST}:/tmp/tierlistplus-healthcheck.timer"
copy_file "${UPLOAD_GC}" "${REMOTE_HOST}:/tmp/tierlistplus-upload-gc"
copy_file "${UPLOAD_GC_SERVICE}" "${REMOTE_HOST}:/tmp/tierlistplus-upload-gc.service"
copy_file "${UPLOAD_GC_TIMER}" "${REMOTE_HOST}:/tmp/tierlistplus-upload-gc.timer"

"${SSH_BIN}" "${REMOTE_HOST}" "
  sudo install -m 755 /tmp/tierlistplus-healthcheck /usr/local/bin/tierlistplus-healthcheck
  sudo install -m 644 /tmp/tierlistplus-healthcheck.service /etc/systemd/system/tierlistplus-healthcheck.service
  sudo install -m 644 /tmp/tierlistplus-healthcheck.timer /etc/systemd/system/tierlistplus-healthcheck.timer
  sudo install -m 755 /tmp/tierlistplus-upload-gc /usr/local/bin/tierlistplus-upload-gc
  sudo install -m 644 /tmp/tierlistplus-upload-gc.service /etc/systemd/system/tierlistplus-upload-gc.service
  sudo install -m 644 /tmp/tierlistplus-upload-gc.timer /etc/systemd/system/tierlistplus-upload-gc.timer
  rm -f /tmp/tierlistplus-healthcheck /tmp/tierlistplus-healthcheck.service /tmp/tierlistplus-healthcheck.timer
  rm -f /tmp/tierlistplus-upload-gc /tmp/tierlistplus-upload-gc.service /tmp/tierlistplus-upload-gc.timer
  if sudo systemctl list-unit-files | grep -q '^tierlistplus-telegram-alert@.service'; then
    sudo mkdir -p /etc/systemd/system/tierlistplus-healthcheck.service.d
    printf '[Unit]\nOnFailure=tierlistplus-telegram-alert@%%n\n' | sudo tee /etc/systemd/system/tierlistplus-healthcheck.service.d/alert.conf >/dev/null
    if sudo systemctl list-unit-files | grep -q '^tierlistplus-db-backup.service'; then
      sudo mkdir -p /etc/systemd/system/tierlistplus-db-backup.service.d
      printf '[Unit]\nOnFailure=tierlistplus-telegram-alert@%%n\n' | sudo tee /etc/systemd/system/tierlistplus-db-backup.service.d/alert.conf >/dev/null
      if sudo systemctl list-unit-files | grep -q '^tierlistplus-telegram-success@.service'; then
        printf '[Unit]\nOnSuccess=tierlistplus-telegram-success@%%n\n' | sudo tee /etc/systemd/system/tierlistplus-db-backup.service.d/success.conf >/dev/null
      fi
    fi
  fi
  sudo systemctl daemon-reload
  sudo systemctl enable --now tierlistplus-healthcheck.timer
  sudo systemctl enable --now tierlistplus-upload-gc.timer
  sudo systemctl start tierlistplus-healthcheck.service
  sudo systemctl start tierlistplus-upload-gc.service
  sudo systemctl --no-pager --full status tierlistplus-healthcheck.timer
  sudo systemctl --no-pager --full status tierlistplus-healthcheck.service || true
  sudo systemctl --no-pager --full status tierlistplus-upload-gc.timer
  sudo systemctl --no-pager --full status tierlistplus-upload-gc.service || true
"

echo "Monitoring install complete."
