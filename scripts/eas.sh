#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [ -z "${EXPO_TOKEN:-}" ] && [ -f "$HOME/.yify-release.json" ]; then
  EXPO_TOKEN="$(node -e "const fs=require('node:fs');try{process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).token||''))}catch{process.stdout.write('')}" "$HOME/.yify-release.json")"
  export EXPO_TOKEN
fi
exec npx --yes eas-cli@27.11.0 "$@"
