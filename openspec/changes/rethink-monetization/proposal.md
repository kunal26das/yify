# Proposal

## Why

Supporter currently sells ad removal and journal insights through a modal, while `/upgrade` immediately opens that modal and sends people away when it closes. Automatic offers after ads interrupt requested content, and the paid experience lacks a lasting place to use benefits and recover billing access; this change makes the existing membership understandable and useful without inventing benefits or changing prices.

## What Changes

- Make `/upgrade` a persistent membership destination sharing its offer and account-state content with voluntary contextual dialogs. Show two concrete benefits, the permanent free boundary, and useful member actions.
- Support actual recurring monthly and yearly offers with SDK-localized pricing and billing terms; show yearly checkout only after a real yearly product is available. Preserve legacy entitlements, explicit sign-in and checkout, account-safe restoration and cancellation access through the paid period.
- Remove fictional example statistics from checkout. Pending or not-yet-granted payment outcomes offer access recovery instead of an immediate repeat purchase.
- Remove automatic post-ad supporter dialogs. Pace Android interstitials: first two movie opens are free, at most one ad per three opens, and at least 120 seconds between actual ad openings; no-fill or failed presentation consumes no display allowance.
- Suppress native ad preloading and retries for cached paid grants even before verification completes. Keep consent and unknown-entitlement display protections.
- Align public support and growth documentation; evaluate released behavior for 14 days and renewals over a full monthly cycle, without forecasting revenue.

## Capabilities

### New Capabilities

- `supporter-membership`: Persistent membership discovery, truthful recurring purchase terms, existing-member use and recovery while preserving free features and entitlement boundaries.
- `advertising-pacing`: Bounded Android movie-open advertising, prompt content continuation, and suppression for cached supporters.

### Modified Capabilities

None. Existing `account-action-feedback` and `accessible-product-controls` requirements remain applicable and unchanged.

## Impact

The affected surfaces are purchase presentation, `/upgrade`, journal entrypoints, discovery/settings copy, player ad breaks, native ad gating, tests, and public/growth documentation. Native and web purchase identity contracts and the current products/prices remain unchanged by this code release. The lead's October 17 read-only catalog audit found only the monthly package and no yearly product; yearly commercial setup is separate. A yearly price of ten monthly payments for twelve months is a proposal, not configured pricing. Server-only Anime/raw access and disabled availability alerts retain their separate eligibility; no new paid access is inferred from a local entitlement.

Delivery targets are both production web exports and Android Production OTA for the already-shipped 1.8.25 runtime/code 107, after required tests, independent review and normal PR/CI. No native code, dependencies, runtime, consent settings, infrastructure spending or customer messages change. Source inspection and the private contract audit establish the current behavior; live conversion baseline, current service configuration and commercial effectiveness remain unknown for this release.
