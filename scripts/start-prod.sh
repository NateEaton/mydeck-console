#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

export INSTANCE=prod
export APP_LISTEN="${APP_LISTEN:-127.0.0.1:8890}"
# APP_BIN defaults to BIN_INSTALL_DIR/mydeck-console (when set in .env) or ./build/
# APP_UPSTREAM defaults to READECK_UPSTREAM from .env
# APP_BRAVE_KEY defaults to BRAVE_API_KEY from .env

exec "$SCRIPT_DIR/run-instance.sh" start
