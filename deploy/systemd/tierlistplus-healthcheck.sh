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
CPU_LAST_DETAIL="disabled"

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

container_state() {
  local service="$1"
  local container_id actual
  if ! container_id="$(compose_cmd ps -q "${service}" 2>/dev/null | head -n 1)"; then
    echo "unknown"
    return 0
  fi

  if [[ -z "${container_id}" ]]; then
    echo "missing"
    return 0
  fi

  actual="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
  echo "${actual}"
}

check_container() {
  local actual="$1"
  local expected="$2"
  [[ "${actual}" == "${expected}" ]]
}

check_disk() {
  local usage="$1"
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
  local -a sample_values=()

  for ((i = 0; i < CPU_SAMPLE_COUNT; i++)); do
    usage="$(read_cpu_usage)" || continue
    sample_values+=("${usage}")
    ((samples++))
    if (( usage >= CPU_MAX_USAGE )); then
      ((breaches++))
    fi
  done

  if (( samples == 0 )); then
    CPU_LAST_DETAIL="unavailable"
    return 1
  fi

  CPU_LAST_DETAIL="samples=$(IFS=,; echo "${sample_values[*]}") threshold=${CPU_MAX_USAGE}% breaches=${breaches}/${samples} required=${CPU_REQUIRED_BREACHES}"
  (( breaches < CPU_REQUIRED_BREACHES ))
}

report_compose_status() {
  local app_state="$1"
  local db_state="$2"
  local caddy_state="$3"
  local disk_usage="$4"
  printf 'status: app=%s db=%s caddy=%s disk=%s%% cpu=%s\n' \
    "${app_state}" \
    "${db_state}" \
    "${caddy_state}" \
    "${disk_usage}" \
    "${CPU_LAST_DETAIL}"
}

main() {
  local failures=()
  local app_state db_state caddy_state disk_usage

  app_state="$(container_state "app")"
  db_state="$(container_state "db")"
  caddy_state="$(container_state "caddy")"
  disk_usage="$(df -P / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')"

  check_http || failures+=("public-url")
  check_container "${app_state}" "healthy" || failures+=("app:${app_state}")
  check_container "${db_state}" "healthy" || failures+=("db:${db_state}")
  check_container "${caddy_state}" "running" || failures+=("caddy:${caddy_state}")
  check_disk "${disk_usage}" || failures+=("disk:${disk_usage}%")
  if [[ "${CPU_CHECK_ENABLED}" == "true" ]]; then
    check_cpu || failures+=("cpu")
  else
    CPU_LAST_DETAIL="disabled"
  fi

  if ((${#failures[@]} > 0)); then
    printf 'TierListPlus healthcheck failed: %s\n' "${failures[*]}" >&2
    report_compose_status "${app_state}" "${db_state}" "${caddy_state}" "${disk_usage}" >&2
    exit 1
  fi
}

main "$@"
