#!/usr/bin/env bash
# Start Control Desk, always loading the current dashboard/server.js.
#
# Why: static files (HTML/JS) reload from disk on every request, but Node keeps
# old route handlers in memory. If an old process stays on port 3939, Setup
# buttons return 404 even after git pull — this script frees the port first.
#
# Usage (via npm):
#   npm run dashboard
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${DASHBOARD_PORT:-3939}"
HOST="${DASHBOARD_HOST:-127.0.0.1}"

cd "$ROOT"

free_port() {
  local pids
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "  Stopping previous dashboard on port ${PORT} (PID ${pids//$'\n'/, })…"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
    sleep 0.4
  fi
}

free_port
echo "  Starting Control Desk on http://${HOST}:${PORT} (browser opens http://${DASHBOARD_DOMAIN-testsuite.appdesign.ie}:${PORT} when /etc/hosts maps it)"
exec node dashboard/server.js
