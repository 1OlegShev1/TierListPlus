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
TIME_NOW="$(date -Is)"
ACTIVE_STATE="$(systemctl show -p ActiveState --value "${UNIT_NAME}" 2>/dev/null || echo unknown)"
RESULT_STATE="$(systemctl show -p Result --value "${UNIT_NAME}" 2>/dev/null || echo unknown)"

is_success_result() {
  case "$1" in
    success | done | none) return 0 ;;
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

if [[ "${MODE}" == "success" ]]; then
  if is_success_result "${RESULT_STATE}"; then
    send_message "OK: ${HOSTNAME_NOW} ${UNIT_NAME} ${TIME_NOW}"
  fi
  exit 0
fi

if is_success_result "${RESULT_STATE}"; then
  exit 0
fi

JOURNAL_LOGS="$(journalctl -u "${UNIT_NAME}" -n 80 --no-pager -o cat 2>/dev/null || true)"

HEALTHCHECK_REASON="$(printf '%s\n' "${JOURNAL_LOGS}" | sed -n 's/^TierListPlus healthcheck failed: //p' | tail -n 1)"
HEALTHCHECK_STATUS="$(printf '%s\n' "${JOURNAL_LOGS}" | sed -n 's/^status: //p' | tail -n 1)"
GENERIC_LOGS="$(printf '%s\n' "${JOURNAL_LOGS}" | tail -n 3)"

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
else
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
