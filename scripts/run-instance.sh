#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 [start|stop|status]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTANCE="${INSTANCE:-dev}"
APP_BIN="${APP_BIN:-$ROOT_DIR/build/mydeck-console}"
APP_LISTEN="${APP_LISTEN:-127.0.0.1:8889}"
APP_UPSTREAM="${APP_UPSTREAM:-http://127.0.0.1:8888}"
APP_BRAVE_KEY="${APP_BRAVE_KEY:-${BRAVE_API_KEY:-}}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/run}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
PID_FILE="$RUN_DIR/mydeck-console-${INSTANCE}.pid"
LOG_FILE="$LOG_DIR/mydeck-console-${INSTANCE}.log"

mkdir -p "$RUN_DIR" "$LOG_DIR"

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  kill -0 "$pid" >/dev/null 2>&1
}

start() {
  if [[ ! -x "$APP_BIN" ]]; then
    echo "Binary not found or not executable: $APP_BIN"
    exit 1
  fi

  if is_running; then
    echo "mydeck-console ($INSTANCE) already running (pid $(cat "$PID_FILE"))"
    exit 0
  fi

  rm -f "$PID_FILE"

  local -a cmd=("$APP_BIN" "--listen" "$APP_LISTEN" "--readeck-upstream" "$APP_UPSTREAM")
  if [[ -n "$APP_BRAVE_KEY" ]]; then
    cmd+=("--brave-key" "$APP_BRAVE_KEY")
  fi

  nohup "${cmd[@]}" >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  sleep 0.5
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "Started mydeck-console ($INSTANCE): pid=$pid listen=$APP_LISTEN"
    echo "Log: $LOG_FILE"
  else
    echo "Failed to start mydeck-console ($INSTANCE). See log: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
}

stop() {
  if ! is_running; then
    echo "mydeck-console ($INSTANCE) is not running."
    rm -f "$PID_FILE"
    exit 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$PID_FILE"
      echo "Stopped mydeck-console ($INSTANCE)."
      exit 0
    fi
    sleep 0.2
  done

  echo "Process did not stop gracefully, sending SIGKILL (pid $pid)"
  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$PID_FILE"
  echo "Stopped mydeck-console ($INSTANCE)."
}

status() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "mydeck-console ($INSTANCE) is running (pid $pid) on $APP_LISTEN"
    echo "Log: $LOG_FILE"
  else
    echo "mydeck-console ($INSTANCE) is not running."
  fi
}

case "$ACTION" in
  start)  start ;;
  stop)   stop ;;
  status) status ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: $0 [start|stop|status]"
    exit 1
    ;;
esac
