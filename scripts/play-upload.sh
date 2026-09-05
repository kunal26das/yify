#!/usr/bin/env bash
set -euo pipefail

PKG="io.github.kunal26das.yify"
KEY="${YIFY_RELEASE_PLAY_SERVICE_ACCOUNT:-$HOME/.config/play-publisher/yify-service-account.json}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
API="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$PKG"
TRACK="${1:-internal}"

[ -f "$AAB" ] || { echo "No AAB at $AAB - run: cd android && ./gradlew bundleRelease"; exit 1; }

VERSION=$(python3 -c "import json;print(json.load(open('$ROOT/package.json'))['version'])")
CODE=$(python3 -c "import json;print(json.load(open('$ROOT/package.json'))['versionCode'])")

RUNTIME=$(unzip -p "$AAB" base/resources.pb 2>/dev/null | strings | grep -A1 '^expo_runtime_version$' | sed -n '2p' | tr -d '[:space:]')
if [ "$RUNTIME" != "$VERSION" ]; then
  echo "Refusing to upload: the AAB declares expo_runtime_version '${RUNTIME:-<absent>}' but package.json says '$VERSION'."
  echo "No EAS update published for $VERSION could ever reach this binary, and updates published"
  echo "for '${RUNTIME:-?}' would land on it instead. strings.xml is prebuild output that no Gradle"
  echo "task regenerates, so a version bump alone does not change it."
  echo "Fix: yarn prebuild && bash scripts/setup-android-signing.sh && (cd android && ./gradlew bundleRelease)"
  exit 1
fi
CHANNEL=$(unzip -p "$AAB" base/manifest/AndroidManifest.xml 2>/dev/null | strings | grep -o 'expo-channel-name[^A-Za-z]*[A-Za-z]*' | grep -o '[A-Za-z]*$' | head -1)
if [ "$TRACK" = "production" ] && [ "$CHANNEL" != "Production" ]; then
  echo "Refusing to upload: the AAB is baked with EAS Update channel '${CHANNEL:-<absent>}' but the target track is production."
  echo "Shipped users would receive updates published to the '${CHANNEL:-?}' channel."
  echo "EXPO_UPDATE_CHANNEL is baked in at prebuild time, so rebuild with:"
  echo "  EXPO_UPDATE_CHANNEL=Production yarn prebuild && bash scripts/setup-android-signing.sh && (cd android && ./gradlew bundleRelease)"
  exit 1
fi
echo "Artifact verified: runtime $RUNTIME, channel ${CHANNEL:-<absent>}, track $TRACK"

TOKEN=$(python3 - "$KEY" <<'PY'
import base64, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
sa = json.load(open(sys.argv[1]))
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=')
now = int(time.time())
si = b64u(json.dumps({'alg':'RS256','typ':'JWT'},separators=(',',':')).encode()) + b'.' + \
     b64u(json.dumps({'iss':sa['client_email'],'scope':'https://www.googleapis.com/auth/androidpublisher',
                      'aud':'https://oauth2.googleapis.com/token','iat':now,'exp':now+3600},
                     separators=(',',':')).encode())
with tempfile.NamedTemporaryFile('w', suffix='.pem', delete=False) as f:
    f.write(sa['private_key']); kp = f.name
try:
    sig = subprocess.run(['openssl','dgst','-sha256','-sign',kp], input=si, capture_output=True, check=True).stdout
finally:
    os.unlink(kp)
data = urllib.parse.urlencode({'grant_type':'urn:ietf:params:oauth:grant-type:jwt-bearer',
                               'assertion':(si+b'.'+b64u(sig)).decode()}).encode()
with urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=data)) as r:
    print(json.load(r)['access_token'])
PY
)

auth=(-H "Authorization: Bearer $TOKEN")

echo "Creating edit..."
EDIT=$(curl -sf -X POST "$API/edits" "${auth[@]}" -H "Content-Length: 0" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")

cleanup() { curl -s -X DELETE "$API/edits/$EDIT" "${auth[@]}" >/dev/null 2>&1 || true; }
trap cleanup ERR

echo "Uploading $(du -h "$AAB" | cut -f1) as $VERSION ($CODE)..."
curl -sf -X POST \
  "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/$PKG/edits/$EDIT/bundles?uploadType=media" \
  "${auth[@]}" -H "Content-Type: application/octet-stream" --data-binary "@$AAB" --max-time 900 \
  | python3 -c "import json,sys;print('  uploaded versionCode', json.load(sys.stdin)['versionCode'])"

echo "Assigning to $TRACK..."
python3 - "$CODE" "$VERSION" > /tmp/yify-track.json <<'PY'
import json, sys
code, version = sys.argv[1], sys.argv[2]
print(json.dumps({"track": "PLACEHOLDER", "releases": [{
    "name": f"{version} ({code})", "versionCodes": [code], "status": "completed"}]}))
PY
python3 -c "
import json
d=json.load(open('/tmp/yify-track.json')); d['track']='$TRACK'
json.dump(d, open('/tmp/yify-track.json','w'))
"
curl -sf -X PATCH "$API/edits/$EDIT/tracks/$TRACK" "${auth[@]}" \
  -H "Content-Type: application/json" -d @/tmp/yify-track.json > /dev/null

echo "Validating..."
VAL=$(curl -s -o /tmp/yify-validate.json -w '%{http_code}' -X POST "$API/edits/$EDIT"':validate' "${auth[@]}" -H "Content-Length: 0")
if [ "$VAL" != "200" ]; then
  echo "VALIDATION FAILED ($VAL):"
  python3 -c "import json;print(json.load(open('/tmp/yify-validate.json'))['error']['message'])" 2>/dev/null || cat /tmp/yify-validate.json
  cleanup
  exit 1
fi

echo "Committing..."
curl -sf -X POST "$API/edits/$EDIT"':commit' "${auth[@]}" -H "Content-Length: 0" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('  committed edit', d.get('id'))"

trap - ERR
echo "Done: $VERSION ($CODE) is live on the $TRACK track."
