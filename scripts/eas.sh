#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [ -z "${EXPO_TOKEN:-}" ] && [ -f "$HOME/.yify-release.json" ]; then
  EXPO_TOKEN="$(node -e "const fs=require('node:fs');try{process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).token||''))}catch{process.stdout.write('')}" "$HOME/.yify-release.json")"
  export EXPO_TOKEN
fi
node --input-type=module -e "
import {checkLivePrivacy, requiresLivePrivacyCheck} from './scripts/check-live-privacy.mjs';
if (requiresLivePrivacyCheck(process.argv.slice(1))) {
  await checkLivePrivacy();
  console.log('Live privacy policy links passed.');
}
" -- "$@"
if [ "${1:-}" = "update" ]; then
  case " $* " in
    *" --help "* | *" -h "*) ;;
    *) node scripts/check-ota-compat.mjs ;;
  esac
fi
exec npx --yes eas-cli@27.11.0 "$@"
