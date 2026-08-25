#!/usr/bin/env bash
set -euo pipefail

# Reads the RevenueCat v2 secret key from ~/.config/revenuecat/yify.key
# Usage: bash scripts/revenuecat-setup.sh [--apply]     (default is a dry run)

KEYFILE="${YIFY_REVENUECAT_KEY_FILE:-$HOME/.config/revenuecat/yify.key}"
[ -f "$KEYFILE" ] || { echo "No key at $KEYFILE"; exit 1; }
export RC_KEY="$(tr -d '[:space:]' < "$KEYFILE")"
export RC_APPLY="${1:-}"

python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error

KEY = os.environ['RC_KEY']
APPLY = os.environ.get('RC_APPLY') == '--apply'
PROJECT = '8b6ff243'
BASE = 'https://api.revenuecat.com/v2'

PLAY_PRODUCT = 'remove_ads_lifetime'
WEB_PRODUCT = 'remove_ads_lifetime_web'
PACKAGE = '$rc_lifetime'
ENTITLEMENT = 'remove_ads'
OFFERING = 'default'
USD, INR = 2.99, 199.0

def call(method, path, body=None, ok=(200, 201)):
    req = urllib.request.Request(
        BASE + path, method=method,
        headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
                 'Accept': 'application/json'},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:400]
        raise SystemExit(f'{method} {path} -> {e.code}\n{detail}')

def do(label, method, path, body=None):
    if not APPLY:
        print(f'  WOULD {label}: {method} {path}')
        if body: print(f'         {json.dumps(body)[:180]}')
        return None
    out = call(method, path, body)
    print(f'  DID {label}')
    return out

print(f'project {PROJECT} | mode: {"APPLY" if APPLY else "DRY RUN"}\n')

apps = call('GET', f'/projects/{PROJECT}/apps?limit=50').get('items', [])
print('apps:')
by_type = {}
for a in apps:
    print(f"  {str(a.get('id')):24} type={str(a.get('type')):16} name={a.get('name')}")
    by_type.setdefault(a.get('type'), []).append(a)

play = (by_type.get('play_store') or [None])[0]
web = (by_type.get('rc_billing') or by_type.get('web_billing') or [None])[0]
print(f"\nplay app: {play and play['id']}\nweb  app: {web and web['id']}\n")

products = call('GET', f'/projects/{PROJECT}/products?limit=100').get('items', [])
print('existing products:')
for p in products:
    print(f"  {str(p.get('id')):24} store={str(p.get('store')):14} type={str(p.get('type')):14} sid={p.get('store_identifier')}")
have = {p.get('store_identifier'): p for p in products}

if play and PLAY_PRODUCT not in have:
    do('create play product', 'POST', f'/projects/{PROJECT}/products',
       {'store_identifier': PLAY_PRODUCT, 'app_id': play['id'], 'type': 'one_time'})
else:
    print(f'  play product {PLAY_PRODUCT}: already present')

if web and WEB_PRODUCT not in have:
    do('create web product', 'POST', f'/projects/{PROJECT}/products',
       {'store_identifier': WEB_PRODUCT, 'app_id': web['id'], 'type': 'one_time',
        'display_name': 'Yify — Remove Ads'})
else:
    print(f'  web product {WEB_PRODUCT}: already present or no web app')

offerings = call('GET', f'/projects/{PROJECT}/offerings?limit=50').get('items', [])
print('\nofferings:')
for o in offerings:
    print(f"  {str(o.get('id')):24} lookup={str(o.get('lookup_key')):14} current={o.get('is_current')}")
target = next((o for o in offerings if o.get('lookup_key') == OFFERING), None)
if not target:
    raise SystemExit(f'offering "{OFFERING}" not found')

pkgs = call('GET', f'/projects/{PROJECT}/offerings/{target["id"]}/packages?limit=50').get('items', [])
print('packages in offering:')
for p in pkgs:
    print(f"  {str(p.get('id')):24} lookup={p.get('lookup_key')}")
lifetime = next((p for p in pkgs if p.get('lookup_key') == PACKAGE), None)
if not lifetime:
    created = do('create $rc_lifetime package', 'POST',
                 f'/projects/{PROJECT}/offerings/{target["id"]}/packages',
                 {'lookup_key': PACKAGE, 'display_name': 'Remove ads'})
    lifetime = created or {'id': '<new>'}
else:
    print('  $rc_lifetime: already present')

ents = call('GET', f'/projects/{PROJECT}/entitlements?limit=50').get('items', [])
ent = next((e for e in ents if e.get('lookup_key') == ENTITLEMENT), None)
print(f'\nentitlement {ENTITLEMENT}: {ent and ent["id"]}')

print('\nremaining actions:')
print(f'  attach {PLAY_PRODUCT} + {WEB_PRODUCT} to package {PACKAGE}')
print(f'  attach both to entitlement {ENTITLEMENT}')
print(f'  detach $rc_monthly from the offering')
print(f'  ensure offering "{OFFERING}" is current')
print('\nWeb Billing prices (USD %.2f / INR %.0f) may need setting in the dashboard —' % (USD, INR))
print('the v2 API surface for Web Billing pricing is limited.')
if not APPLY:
    print('\nDry run only. Re-run with --apply once the output above looks right.')
PY
