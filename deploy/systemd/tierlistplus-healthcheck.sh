#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://tierlistplus.com}"
REMOTE_DIR="${REMOTE_DIR:-/opt/tierlistplus}"

check_http() {
  curl -fsSIL --max-time 10 "${APP_URL}" >/dev/null
}

check_container() {
  local name="$1"
  local expected="$2"
  local actual

  actual="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${name}")"
  [[ "${actual}" == "${expected}" ]]
}

check_disk() {
  local usage

  usage="$(df -P / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')"
  (( usage < 85 ))
}

report_compose_status() {
  docker compose \
    --profile with-domain \
    --env-file "${REMOTE_DIR}/.env.production" \
    -f "${REMOTE_DIR}/docker-compose.prod.yml" \
    ps || true
}

main() {
  local failures=()

  check_http || failures+=("public-url")
  check_container "tierlistplus-app-1" "healthy" || failures+=("app")
  check_container "tierlistplus-db-1" "healthy" || failures+=("db")
  check_container "tierlistplus-caddy-1" "running" || failures+=("caddy")
  check_disk || failures+=("disk")

  if ((${#failures[@]} > 0)); then
    printf 'TierListPlus healthcheck failed: %s\n' "${failures[*]}" >&2
    report_compose_status >&2
    exit 1
  fi
}

main "$@"
