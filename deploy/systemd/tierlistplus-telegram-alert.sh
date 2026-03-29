#!/usr/bin/env bash
set -euo pipefail

MODE="failure"
UNIT_NAME_RAW=""

if [[ $# -eq 1 ]]; then
  UNIT_NAME_RAW="$1"
elif [[ $# -ge 2 ]]; then
  MODE="$1"
  UNIT_NAME_RAW="$2"
else
  UNIT_NAME_RAW="unknown"
fi

UNIT_NAME="${UNIT_NAME_RAW}"
if [[ "${UNIT_NAME}" != *.* ]]; then
  UNIT_NAME="${UNIT_NAME}.service"
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  exit 0
fi

HOSTNAME_NOW="$(hostname)"
TIME_NOW="$(date '+%Y-%m-%d %H:%M %Z')"
ACTIVE_STATE="$(systemctl show -p ActiveState --value "${UNIT_NAME}" 2>/dev/null || echo unknown)"
RESULT_STATE="$(systemctl show -p Result --value "${UNIT_NAME}" 2>/dev/null || echo unknown)"
JOURNAL_LOGS="$(journalctl -u "${UNIT_NAME}" -n 80 --no-pager -o cat 2>/dev/null || true)"

is_success_result() {
  case "$1" in
    success | done | none) return 0 ;;
    *) return 1 ;;
  esac
}

is_backup_unit() {
  case "$1" in
    tierlistplus-db-backup.service) return 0 ;;
    *) return 1 ;;
  esac
}

send_message() {
  local message="$1"
  curl -fsS -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${message}" >/dev/null
}

backup_success_db_line() {
  printf '%s\n' "${JOURNAL_LOGS}" | sed -n 's/^DB backup uploaded: /db: uploaded to /p' | tail -n 1
}

backup_success_uploads_line() {
  printf '%s\n' "${JOURNAL_LOGS}" | sed -n 's/^Uploads backup uploaded: /uploads: uploaded to /p' | tail -n 1
}

meaningful_journal_lines() {
  printf '%s\n' "${JOURNAL_LOGS}" | sed -E \
    -e '/^$/d' \
    -e '/^Starting .*$/d' \
    -e '/^Started .*$/d' \
    -e '/^Stopping .*$/d' \
    -e '/^Stopped .*$/d' \
    -e "/: Failed with result '.*'\.$/d" \
    -e '/^Failed to start .* - .*$/d' \
    -e '/^.*: Triggering OnFailure= dependencies\.$/d' \
    -e '/^.*: Triggering OnSuccess= dependencies\.$/d' \
    -e '/^.*: Deactivated successfully\.$/d' \
    -e '/^.*: Consumed [0-9.]+s CPU time\.$/d'
}

backup_failure_lines() {
  meaningful_journal_lines | awk '!seen[$0]++'
}

backup_failure_hint() {
  case "$1" in
    *"Connection timed out"* | *"No route to host"* | *"Connection refused"* | *"Could not resolve host"* | *"ssh:"*)
      printf '%s\n' "hint: the backup target may have been unreachable over Tailscale"
      ;;
  esac
}

if [[ "${MODE}" == "success" ]]; then
  if is_success_result "${RESULT_STATE}"; then
    if is_backup_unit "${UNIT_NAME}"; then
      DB_LINE="$(backup_success_db_line)"
      UPLOADS_LINE="$(backup_success_uploads_line)"

      if [[ -n "${DB_LINE}" || -n "${UPLOADS_LINE}" ]]; then
        MESSAGE=$(cat <<MSG
OK: TierListPlus backup completed
host: ${HOSTNAME_NOW}
unit: ${UNIT_NAME}
finished: ${TIME_NOW}
${DB_LINE}
${UPLOADS_LINE}
MSG
)
        send_message "${MESSAGE}"
      else
        send_message "OK: ${HOSTNAME_NOW} ${UNIT_NAME} ${TIME_NOW}"
      fi
    else
      send_message "OK: ${HOSTNAME_NOW} ${UNIT_NAME} ${TIME_NOW}"
    fi
  fi
  exit 0
fi

if is_success_result "${RESULT_STATE}"; then
  exit 0
fi

HEALTHCHECK_REASON="$(printf '%s\n' "${JOURNAL_LOGS}" | sed -n 's/^TierListPlus healthcheck failed: //p' | tail -n 1)"
HEALTHCHECK_STATUS="$(printf '%s\n' "${JOURNAL_LOGS}" | sed -n 's/^status: //p' | tail -n 1)"

if [[ "${UNIT_NAME}" == "tierlistplus-healthcheck.service" && -n "${HEALTHCHECK_REASON}" ]]; then
  MESSAGE=$(cat <<MSG
ALERT: TierListPlus healthcheck failed
host: ${HOSTNAME_NOW}
unit: ${UNIT_NAME}
state/result: ${ACTIVE_STATE}/${RESULT_STATE}
time: ${TIME_NOW}
reason: ${HEALTHCHECK_REASON}
status: ${HEALTHCHECK_STATUS:-unknown}
hint: journalctl -u ${UNIT_NAME} -n 80 --no-pager
MSG
)
elif is_backup_unit "${UNIT_NAME}"; then
  FAILURE_LINES="$(backup_failure_lines)"
  FAILURE_REASON="$(printf '%s\n' "${FAILURE_LINES}" | sed -n '1p')"
  FAILURE_DETAILS="$(printf '%s\n' "${FAILURE_LINES}" | sed -n '2,4p')"
  BACKUP_HINT="$(backup_failure_hint "${FAILURE_REASON}")"

  if [[ -n "${FAILURE_REASON}" ]]; then
    if [[ -n "${FAILURE_DETAILS}" ]]; then
      MESSAGE=$(cat <<MSG
ALERT: TierListPlus backup failed
host: ${HOSTNAME_NOW}
unit: ${UNIT_NAME}
state/result: ${ACTIVE_STATE}/${RESULT_STATE}
time: ${TIME_NOW}
reason: ${FAILURE_REASON}
details:
${FAILURE_DETAILS}
${BACKUP_HINT}
MSG
)
    else
      MESSAGE=$(cat <<MSG
ALERT: TierListPlus backup failed
host: ${HOSTNAME_NOW}
unit: ${UNIT_NAME}
state/result: ${ACTIVE_STATE}/${RESULT_STATE}
time: ${TIME_NOW}
reason: ${FAILURE_REASON}
${BACKUP_HINT}
MSG
)
    fi
  else
    MESSAGE=$(cat <<MSG
ALERT: TierListPlus backup failed
host: ${HOSTNAME_NOW}
unit: ${UNIT_NAME}
state/result: ${ACTIVE_STATE}/${RESULT_STATE}
time: ${TIME_NOW}
hint: no useful backup log lines were captured
MSG
)
  fi
else
  GENERIC_LOGS="$(meaningful_journal_lines | awk '!seen[$0]++' | tail -n 3)"

  MESSAGE=$(cat <<MSG
ALERT: TierListPlus failure
host: ${HOSTNAME_NOW}
unit: ${UNIT_NAME}
state/result: ${ACTIVE_STATE}/${RESULT_STATE}
time: ${TIME_NOW}
logs:
${GENERIC_LOGS}
MSG
)
fi

send_message "${MESSAGE}"
