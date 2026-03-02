#!/usr/bin/env bash
set -euo pipefail

# The uploads volume is mounted at runtime, so fix its ownership before
# dropping privileges to the unprivileged app user.
mkdir -p /app/public/uploads /tmp
chown appuser:appuser /app/public/uploads /tmp

exec gosu appuser "$@"
