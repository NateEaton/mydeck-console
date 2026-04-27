#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

export INSTANCE=dev
export APP_BIN="${APP_BIN:-$ROOT_DIR/build/mydeck-console}"  # always use ./build/ for dev
export APP_LISTEN="${APP_LISTEN:-127.0.0.1:8889}"

exec "$SCRIPT_DIR/run-instance.sh" start
