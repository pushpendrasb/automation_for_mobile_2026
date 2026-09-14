#!/bin/bash
# Start Control Desk if needed (or replace a stale process), then open the browser.
#
# Stale process check: an old Node may still listen on 3939 after git pull.
# HTML updates from disk, but /api/setup is missing until that process is replaced.
set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${DASHBOARD_PORT:-3939}"
URL="http://127.0.0.1:${PORT}"
LOG="/tmp/automation-control-desk.log"
PID_FILE="/tmp/automation-control-desk.pid"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  LATEST="$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
  [[ -n "$LATEST" ]] && export PATH="$HOME/.nvm/versions/node/$LATEST/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  NODE_BIN="$(/bin/zsh -lc 'command -v node' 2>/dev/null)"
  [[ -n "$NODE_BIN" ]] && export PATH="$(dirname "$NODE_BIN"):$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display dialog "Node.js was not found.\nInstall Node 18+ then try again.\n\nOr run in Terminal:\nnpm run dashboard" buttons {"OK"} default button 1 with title "Control Desk"'
  exit 1
fi

is_up() { /usr/bin/curl -sf -o /dev/null --max-time 1 "$URL/" 2>/dev/null; }

# True when Setup APIs exist (current server.js). Old processes fail this check.
has_setup_api() {
  /usr/bin/curl -sf -o /dev/null --max-time 2 "$URL/api/setup" 2>/dev/null
}

free_port() {
  local pids
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Replacing stale dashboard on port ${PORT}…" >>"$LOG"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
    sleep 0.5
  fi
  if [[ -f "$PID_FILE" ]]; then
    old="$(cat "$PID_FILE" 2>/dev/null)"
    kill -9 "$old" 2>/dev/null
    rm -f "$PID_FILE"
  fi
}

start_server() {
  cd "$ROOT" || exit 1
  # Avoid auto-open from server.js when we open explicitly below
  nohup env DASHBOARD_NO_OPEN=1 node dashboard/server.js >>"$LOG" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in $(seq 1 50); do
    is_up && break
    sleep 0.2
  done
}

NEED_START=0
if ! is_up; then
  NEED_START=1
elif ! has_setup_api; then
  # Page is up but Setup routes missing → old Node still holding the port
  echo "Stale dashboard detected (no /api/setup) — restarting…" >>"$LOG"
  free_port
  NEED_START=1
fi

if [[ "$NEED_START" -eq 1 ]]; then
  free_port
  start_server
fi

if ! is_up; then
  /usr/bin/osascript -e "display dialog \"Could not start the dashboard.\n\nTry Terminal:\ncd automation_for_mobile_2026\nnpm run dashboard\n\nLog: $LOG\" buttons {\"OK\"} default button 1 with title \"Control Desk\""
  exit 1
fi

if ! has_setup_api; then
  /usr/bin/osascript -e "display dialog \"Dashboard is running but Setup API is still missing.\n\nIn Terminal run:\nlsof -ti:3939 | xargs kill -9\ncd automation_for_mobile_2026 && git pull && npm run dashboard\n\nLog: $LOG\" buttons {\"OK\"} default button 1 with title \"Control Desk\""
  exit 1
fi

/usr/bin/open "$URL"
exit 0
