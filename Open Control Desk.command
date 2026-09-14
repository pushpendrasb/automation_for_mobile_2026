#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "Starting Control Desk…"
./dashboard/launch-control-desk.sh
STATUS=$?
if [[ $STATUS -ne 0 ]]; then
  echo ""
  echo "Failed (exit $STATUS). You can still run:"
  echo "  npm run dashboard"
  read -r -p "Press Enter to close…"
fi
# Keep window briefly so user sees it worked
sleep 1
