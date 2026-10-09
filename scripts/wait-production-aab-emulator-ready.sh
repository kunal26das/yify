#!/usr/bin/env bash
set -euo pipefail

ATTEMPTS=${YIFY_EMULATOR_READY_ATTEMPTS:-90}
[[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ ]] && (( ATTEMPTS <= 90 ))

timeout 10s adb root >/dev/null
services_ready() {
    for SERVICE in connectivity phone package activity; do
        timeout 10s adb shell service check "$SERVICE" 2>/dev/null | tr -d '\r' | grep -qx "Service $SERVICE: found" || return 1
    done
}
STABLE=0
DEADLINE=$((SECONDS + 180))
for ((ATTEMPT=1; ATTEMPT<=ATTEMPTS && SECONDS<DEADLINE; ATTEMPT++)); do
    if timeout 10s adb wait-for-device >/dev/null 2>&1 &&
        test "$(timeout 10s adb shell id -u 2>/dev/null | tr -d '\r')" = 0 &&
        test "$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 &&
        services_ready; then
        STABLE=$((STABLE + 1))
        if (( STABLE == 3 )); then exit 0; fi
    else
        STABLE=0
    fi
    sleep 2
done

echo 'Emulator did not reach stable root and Android service readiness' >&2
exit 1
