#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export INSTANCE=dev
export APP_LISTEN="${APP_LISTEN:-127.0.0.1:8889}"

exec "$SCRIPT_DIR/run-instance.sh" stop
