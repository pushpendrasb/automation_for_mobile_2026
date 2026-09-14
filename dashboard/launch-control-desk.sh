#!/bin/bash
# Start Control Desk if needed, then open the browser.
set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="http://127.0.0.1:3939"
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

if ! is_up; then
  if [[ -f "$PID_FILE" ]]; then
    old="$(cat "$PID_FILE" 2>/dev/null)"
    kill "$old" 2>/dev/null
    rm -f "$PID_FILE"
  fi
  cd "$ROOT" || exit 1
  # Avoid auto-open from server.js when we open explicitly below
  nohup env DASHBOARD_NO_OPEN=1 node dashboard/server.js >>"$LOG" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in $(seq 1 50); do
    is_up && break
    sleep 0.2
  done
fi

if ! is_up; then
  /usr/bin/osascript -e "display dialog \"Could not start the dashboard.\n\nTry Terminal:\ncd automation_for_mobile_2026\nnpm run dashboard\n\nLog: $LOG\" buttons {\"OK\"} default button 1 with title \"Control Desk\""
  exit 1
fi

/usr/bin/open "$URL"
exit 0
