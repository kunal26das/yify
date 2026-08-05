#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EAS_BIN="$PROJECT_ROOT/release/node_modules/.bin/eas"

if [ ! -x "$EAS_BIN" ]; then
  EAS_BIN="$(command -v eas || true)"
fi

if [ -z "$EAS_BIN" ] || [ ! -x "$EAS_BIN" ]; then
  echo "eas-cli is not installed. Run: cd release && yarn install"
  echo "Or install it globally: npm install -g eas-cli"
  exit 1
fi

if [ -z "${EXPO_TOKEN:-}" ]; then
  SESSION_FILE="$HOME/.yify-release.json"
  if [ -f "$SESSION_FILE" ]; then
    EXPO_TOKEN="$(node -e "const fs=require('node:fs');try{process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).token||''))}catch{process.stdout.write('')}" "$SESSION_FILE")"
    export EXPO_TOKEN
  fi
fi

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "EXPO_TOKEN is not set and $HOME/.yify-release.json has no token."
  echo "Sign in from the release console (yarn release) or export EXPO_TOKEN."
  exit 1
fi

cd "$PROJECT_ROOT"
exec "$EAS_BIN" "$@"
