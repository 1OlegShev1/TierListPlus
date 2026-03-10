#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://tierlistplus.com}"
REMOTE_DIR="${REMOTE_DIR:-/opt/tierlistplus}"
DISK_MAX_USAGE="${DISK_MAX_USAGE:-85}"
CPU_MAX_USAGE="${CPU_MAX_USAGE:-90}"
CPU_CHECK_ENABLED="${CPU_CHECK_ENABLED:-true}"
CPU_SAMPLE_COUNT="${CPU_SAMPLE_COUNT:-3}"
CPU_SAMPLE_INTERVAL_SEC="${CPU_SAMPLE_INTERVAL_SEC:-1}"
CPU_REQUIRED_BREACHES="${CPU_REQUIRED_BREACHES:-3}"

compose_cmd() {
  docker compose \
    --profile with-domain \
    --env-file "${REMOTE_DIR}/.env.production" \
    -f "${REMOTE_DIR}/docker-compose.prod.yml" \
    "$@"
}

check_http() {
  curl -fsSIL --max-time 10 "${APP_URL}" >/dev/null
}

check_container() {
  local service="$1"
  local expected="$2"
  local container_id actual

  if ! container_id="$(compose_cmd ps -q "${service}" 2>/dev/null | head -n 1)"; then
    return 1
  fi

  [[ -n "${container_id}" ]] || return 1

  actual="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
  [[ "${actual}" == "${expected}" ]]
}

check_disk() {
  local usage

  usage="$(df -P / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')"
  (( usage < DISK_MAX_USAGE ))
}

read_cpu_usage() {
  local total1 idle1 total2 idle2 total_delta idle_delta busy_delta usage
  local -a cpu1 cpu2

  read -r _ cpu1[0] cpu1[1] cpu1[2] cpu1[3] cpu1[4] cpu1[5] cpu1[6] cpu1[7] _ < /proc/stat
  sleep "${CPU_SAMPLE_INTERVAL_SEC}"
  read -r _ cpu2[0] cpu2[1] cpu2[2] cpu2[3] cpu2[4] cpu2[5] cpu2[6] cpu2[7] _ < /proc/stat

  total1=$((cpu1[0] + cpu1[1] + cpu1[2] + cpu1[3] + cpu1[4] + cpu1[5] + cpu1[6] + cpu1[7]))
  total2=$((cpu2[0] + cpu2[1] + cpu2[2] + cpu2[3] + cpu2[4] + cpu2[5] + cpu2[6] + cpu2[7]))
  idle1=$((cpu1[3] + cpu1[4]))
  idle2=$((cpu2[3] + cpu2[4]))

  total_delta=$((total2 - total1))
  idle_delta=$((idle2 - idle1))
  (( total_delta > 0 )) || return 1

  busy_delta=$((total_delta - idle_delta))
  usage=$((busy_delta * 100 / total_delta))
  echo "${usage}"
}

check_cpu() {
  local usage samples=0 breaches=0 i

  for ((i = 0; i < CPU_SAMPLE_COUNT; i++)); do
    usage="$(read_cpu_usage)" || continue
    ((samples++))
    if (( usage >= CPU_MAX_USAGE )); then
      ((breaches++))
    fi
  done

  (( samples > 0 )) || return 1
  (( breaches < CPU_REQUIRED_BREACHES ))
}

report_compose_status() {
  compose_cmd ps || true
}

main() {
  local failures=()

  check_http || failures+=("public-url")
  check_container "app" "healthy" || failures+=("app")
  check_container "db" "healthy" || failures+=("db")
  check_container "caddy" "running" || failures+=("caddy")
  check_disk || failures+=("disk")
  if [[ "${CPU_CHECK_ENABLED}" == "true" ]]; then
    check_cpu || failures+=("cpu")
  fi

  if ((${#failures[@]} > 0)); then
    printf 'TierListPlus healthcheck failed: %s\n' "${failures[*]}" >&2
    report_compose_status >&2
    exit 1
  fi
}

main "$@"
