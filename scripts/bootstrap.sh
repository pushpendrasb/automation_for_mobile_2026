#!/usr/bin/env bash
# Bootstrap a fresh Mac for Appium automation (no Node required to start).
# Installs Homebrew + Node if missing, then runs the interactive setup wizard.
#
# Usage:
#   bash scripts/bootstrap.sh
#   bash scripts/bootstrap.sh --project vetpal
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "========================================"
echo " Mobile automation — fresh Mac bootstrap"
echo "========================================"
echo "Repo: $ROOT"
echo

# --- Homebrew ---
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found. Installing…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon default path
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
else
  echo "✓ Homebrew present"
fi

# Ensure brew is on PATH in this shell
if command -v brew >/dev/null 2>&1; then
  eval "$(brew shellenv)" 2>/dev/null || true
fi

# --- Node.js (>=18) ---
need_node=0
if ! command -v node >/dev/null 2>&1; then
  need_node=1
else
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [[ "${major}" -lt 18 ]]; then
    echo "Node $(node -v) is too old (need >= 18). Upgrading via Homebrew…"
    need_node=1
  else
    echo "✓ Node $(node -v)"
  fi
fi

if [[ "$need_node" -eq 1 ]]; then
  echo "Installing Node.js via Homebrew…"
  brew install node
fi

echo "✓ npm $(npm -v)"

# --- Xcode CLT hint (do not auto-install full Xcode) ---
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo
  echo "⚠ xcodebuild not found. For iOS tests:"
  echo "  1. Install Xcode from the App Store"
  echo "  2. Run: xcode-select --install"
  echo "  3. Open Xcode once and accept the license"
  echo
fi

# --- Hand off to Node wizard ---
echo
echo "Starting setup wizard…"
exec node "$ROOT/scripts/setup-mac.js" "$@"
