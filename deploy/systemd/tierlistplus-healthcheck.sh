#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://tierlistplus.com}"
REMOTE_DIR="${REMOTE_DIR:-/opt/tierlistplus}"

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
  (( usage < 85 ))
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

  if ((${#failures[@]} > 0)); then
    printf 'TierListPlus healthcheck failed: %s\n' "${failures[*]}" >&2
    report_compose_status >&2
    exit 1
  fi
}

main "$@"
