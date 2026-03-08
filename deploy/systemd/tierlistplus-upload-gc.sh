#!/usr/bin/env bash
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/opt/tierlistplus}"

compose_cmd() {
  docker compose \
    --profile with-domain \
    --env-file "${REMOTE_DIR}/.env.production" \
    -f "${REMOTE_DIR}/docker-compose.prod.yml" \
    "$@"
}

main() {
  [[ -f "${REMOTE_DIR}/.env.production" ]]
  [[ -f "${REMOTE_DIR}/docker-compose.prod.yml" ]]
  compose_cmd exec -T app node scripts/cleanup-orphan-uploads.mjs
}

main "$@"
