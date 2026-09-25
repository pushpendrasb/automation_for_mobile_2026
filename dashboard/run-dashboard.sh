#!/usr/bin/env bash
# Start Control Desk and keep it running in the background.
#
# Closing Terminal will NOT kill the server (uses nohup).
# Force restart: DASHBOARD_FORCE_RESTART=1 npm run dashboard
# Foreground logs: DASHBOARD_FOREGROUND=1 npm run dashboard
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${DASHBOARD_PORT:-3939}"
HOST="${DASHBOARD_HOST:-127.0.0.1}"
URL="http://127.0.0.1:${PORT}"
DOMAIN="${DASHBOARD_DOMAIN:-testsuite.appdesign.ie}"
LOG="/tmp/automation-control-desk.log"
PID_FILE="/tmp/automation-control-desk.pid"

cd "$ROOT"

is_healthy() {
  /usr/bin/curl -sf -o /dev/null --max-time 2 "$URL/api/setup" 2>/dev/null
}

free_port() {
  local pids
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "  Stopping previous dashboard on port ${PORT}…"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
    sleep 0.4
  fi
}

open_browser() {
  local open_url="$URL"
  if [[ -n "$DOMAIN" ]] && /usr/bin/curl -sf -o /dev/null --max-time 1 "http://${DOMAIN}:${PORT}/api/setup" 2>/dev/null; then
    open_url="http://${DOMAIN}:${PORT}"
  fi
  if [[ -z "${DASHBOARD_NO_OPEN:-}" ]]; then
    /usr/bin/open "$open_url" 2>/dev/null || true
  fi
  echo "  Open: $open_url"
}

if [[ "${DASHBOARD_FORCE_RESTART:-}" == "1" ]]; then
  free_port
elif is_healthy; then
  echo "  Control Desk already running."
  open_browser
  exit 0
else
  free_port
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [[ "${DASHBOARD_FOREGROUND:-}" == "1" ]]; then
  echo "  Starting Control Desk (foreground) on http://${HOST}:${PORT}"
  exec env DASHBOARD_NO_OPEN=1 node dashboard/server.js
fi

echo "  Starting Control Desk in background…"
: >"$LOG"
nohup env DASHBOARD_NO_OPEN=1 node dashboard/server.js >>"$LOG" 2>&1 &
echo $! >"$PID_FILE"

for _ in $(seq 1 40); do
  if is_healthy; then
    echo "  Running (PID $(cat "$PID_FILE")) · log: $LOG"
    open_browser
    exit 0
  fi
  # Died during boot?
  if ! kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
    echo "  Failed to start. Last log lines:"
    tail -20 "$LOG" || true
    exit 1
  fi
  sleep 0.25
done

echo "  Timed out waiting for Setup API. Log: $LOG"
tail -20 "$LOG" || true
exit 1
