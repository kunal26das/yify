# Proposal

## Why

Yify needs useful product measurement without treating uncertain geography or perceived enforcement strength as permission to track. The present analytics choice combines usage, purchase/ad measurement and optional performance telemetry, so a regional default requires a purpose-specific assessment and a migration that preserves earlier refusals.

## What Changes

- Prepare a sourced regional assessment and a concrete contract for any later default-on rollout. This change is a proposal; it does not change collection or deploy the app.
- Scope potential default-on collection to defined product-use/performance measurements after assessing each provider and platform. Advertising, attribution, cross-service identifiers and media permission remain separate.
- Require a recorded, current approval for the exact jurisdiction, purpose, provider configuration and platform before enabling a regional default. No jurisdiction is approved by this assessment.
- Preserve explicit refusal across notice updates, travel, login and policy changes. Unknown or conflicting jurisdiction evidence keeps optional collection off pending an affirmative choice.
- Specify receipt migration, user-facing explanations, revocation, tests, rollout and rollback before implementation.

## Capabilities

### New Capabilities

- `regional-analytics-policy`: Purpose-specific regional eligibility, user-choice precedence, transparent defaults and safe recovery for optional analytics.

### Modified Capabilities

None. Existing canonical specifications do not define analytics policy. Existing consent behavior remains the baseline until the proposed implementation is verified and released.

## Impact

Planning artifacts only. A later implementation would affect privacy entities/storage, the welcome and Preferences controls, native/web Firebase analytics, optional Sentry telemetry and RevenueCat measurement. It must preserve requested account/billing operations and assess operational error reporting separately. No dependencies, prices, entitlements, credentials, native projects or production settings change here.

Success for this preparation is a reviewed regional assessment, a documented decision that no current bundle is approved for default-on collection, and testable requirements for a later implementation. Country-wide legal certification and a claim of coverage for every supported country are outside this assessment.
