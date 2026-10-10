# Proposal

## Why

Existing Yify journeys contain recoverable failures that look like success, discard usable content or leave no clear next action. A product audit at `fa7d0ae82b46b4e72b801c8237d7b442b19fec7b` identified these gaps across discovery, account actions and shared controls.

## What Changes

- Keep refresh results current, preserve useful catalog content, and expose retry for failed home sections and movie refreshes.
- Make mobile search reset consistent with desktop, improve existing control targets and heading semantics, and correct stale labels.
- Report account, access-refresh, deletion, privacy-form and external-link outcomes accurately, retaining session/access state when verification fails.
- Document audited journeys and evidence, including platform and live-service checks that were not performed.

## Capabilities

### New Capabilities

These are specifications of existing product behavior, not new product features.

- `catalog-recovery`: Refresh isolation, partial success and retry for existing discovery views.
- `account-action-feedback`: Truthful outcomes and recovery for existing account and supporter actions.
- `accessible-product-controls`: Consistent search reset, descriptive labels, semantic headings and adaptable existing controls.

### Modified Capabilities

None; the only current canonical spec concerns OpenSpec validation.

## Impact

Existing presentation components, view models, account/purchase/ad interfaces and their platform implementations, plus focused regression tests. Preserve the visual design, adult/consent gates, account boundaries, paid entitlements, prices and features. No dependencies, native SDK changes, new screens, campaigns, tracking, production account actions or store publication. Android binary delivery remains its separate active change.
