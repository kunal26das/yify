#!/usr/bin/env bash
set -euo pipefail

SIGNING_ENV="${YIFY_SIGNING_ENV:-$HOME/.config/yify/signing.env}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$PROJECT_ROOT/credentials.json"

if [ ! -f "$SIGNING_ENV" ]; then
  echo "Release signing not configured: $SIGNING_ENV is missing."
  echo "It must define YIFY_UPLOAD_KEYSTORE, YIFY_UPLOAD_STORE_PASSWORD,"
  echo "YIFY_UPLOAD_KEY_ALIAS, YIFY_UPLOAD_KEY_PASSWORD and YIFY_UPLOAD_EXPECTED_SHA1."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$SIGNING_ENV"
set +a

for var in YIFY_UPLOAD_KEYSTORE YIFY_UPLOAD_STORE_PASSWORD YIFY_UPLOAD_KEY_ALIAS YIFY_UPLOAD_KEY_PASSWORD YIFY_UPLOAD_EXPECTED_SHA1; do
  if [ -z "${!var:-}" ]; then
    echo "Release signing not configured: $var is unset in $SIGNING_ENV."
    exit 1
  fi
done

if [ ! -f "$YIFY_UPLOAD_KEYSTORE" ]; then
  echo "Upload keystore not found at $YIFY_UPLOAD_KEYSTORE."
  exit 1
fi

if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/keytool" ]; then
  KEYTOOL="$JAVA_HOME/bin/keytool"
elif command -v keytool &>/dev/null; then
  KEYTOOL="keytool"
else
  KEYTOOL="$(/usr/libexec/java_home 2>/dev/null)/bin/keytool"
fi

ACTUAL_SHA1="$("$KEYTOOL" -list -v \
  -keystore "$YIFY_UPLOAD_KEYSTORE" \
  -storepass "$YIFY_UPLOAD_STORE_PASSWORD" \
  -alias "$YIFY_UPLOAD_KEY_ALIAS" 2>/dev/null \
  | grep "SHA1:" | head -1 | sed 's/.*SHA1: //' | tr -d ' ')"

if [ "$ACTUAL_SHA1" != "$YIFY_UPLOAD_EXPECTED_SHA1" ]; then
  echo "Upload keystore fingerprint mismatch."
  echo "  expected: $YIFY_UPLOAD_EXPECTED_SHA1"
  echo "  actual:   ${ACTUAL_SHA1:-<unreadable>}"
  echo "EAS Build would sign with a key Play rejects. Aborting."
  exit 1
fi

umask 077
KEYSTORE_PATH="$YIFY_UPLOAD_KEYSTORE" \
KEYSTORE_PASSWORD="$YIFY_UPLOAD_STORE_PASSWORD" \
KEY_ALIAS="$YIFY_UPLOAD_KEY_ALIAS" \
KEY_PASSWORD="$YIFY_UPLOAD_KEY_PASSWORD" \
node -e "
const fs = require('node:fs');
const credentials = {
  android: {
    keystore: {
      keystorePath: process.env.KEYSTORE_PATH,
      keystorePassword: process.env.KEYSTORE_PASSWORD,
      keyAlias: process.env.KEY_ALIAS,
      keyPassword: process.env.KEY_PASSWORD,
    },
  },
};
fs.writeFileSync(process.argv[1], JSON.stringify(credentials, null, 2) + '\n', {mode: 0o600});
" "$TARGET"
chmod 600 "$TARGET"

echo "EAS Build credentials configured (SHA1 $ACTUAL_SHA1)."
