# Proposal

## Why

The owner requested a new Google Play submission. The reviewed October 21 native dependency cohort is prepared as 1.8.27/code 109 but cannot reach installed users through an older-runtime OTA.

## What Changes

- Build the exact reviewed source using the existing Expo production signing key, initially without automatic submission.
- Verify the signed bundle, derived APKs and isolated device startup before submitting its specific build ID.
- Record submission and review status accurately; add a shipped-runtime ledger entry only after authenticated Play availability is confirmed.

## Capabilities

### New Capabilities

None. This change records delivery of existing reviewed behavior.

### Modified Capabilities

None. No additional product or specification behavior changes; `skip_specs` is enabled for release operations.

## Impact

Android Production delivery and release evidence. Source is `68e73e5c0213957ce83f50f585ec93949f85b129`, version/runtime 1.8.27/code 109. No new signing credentials, permissions, iOS release or incompatible OTA is required. The manual rating row remains available and automatic review requests remain disabled.
