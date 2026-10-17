#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' \
  'Retired: this script previously migrated the catalog to lifetime sales.' \
  'No credentials are read and no catalog requests or mutations are performed.' \
  'Existing monthly sales and legacy lifetime entitlements must remain intact.' \
  'For the verified catalog and separate yearly setup prerequisites, read docs/revenuecat-operations.md.' >&2
exit 64
