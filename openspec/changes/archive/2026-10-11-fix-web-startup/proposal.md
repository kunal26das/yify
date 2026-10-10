# Proposal

## Why

The owner reports false offline warnings and several successive loading screens before the homepage becomes usable. Source inspection confirms that web rendering waits for every font, home swaps a separate skeleton page for its real list, and shelf requests start only after that swap; browser connectivity is treated as authoritative without checking reachability.

## What Changes

- Keep one homepage list mounted while its hero and shelves fill in, allowing visible shelves to load alongside the hero.
- Render web content without waiting for all custom fonts, preserving native font startup and existing typography.
- Corroborate browser offline reports using a bounded same-origin check; preserve recovery after a genuine disconnection and avoid classifying provider failures as device outages.
- Verify first visits, saved privacy choices, slow connections, failures and recovery on phone and desktop layouts. Preserve adult-only onboarding and optional analytics defaults.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-recovery`: stable initial home rendering and reliable web connectivity feedback.

## Impact

Web network monitoring, root font readiness, homepage loading composition, focused regression tests and release verification. No new product features, dependencies, subscription changes or native release. Catalog/bootstrap work must remain behind the existing adult confirmation gate. Success means no false offline banner when the site is reachable, no font-blocked blank web page, and visible shelf loading that does not wait for the hero or replace the whole list.
