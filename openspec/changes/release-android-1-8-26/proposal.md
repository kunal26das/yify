# Proposal

## Why

The owner requested an Android store release of reviewed source `f1f615755c6abf8f8cfd3cbe33c242efa4cc02a0` as version/runtime 1.8.26, code 108. A new production binary needs exact signed-artifact and installed-device evidence before the Play upload, followed by separate confirmation that users can obtain it.

## What Changes

- Deliver the existing Android 1.8.26 source through one verified production AAB and one production submission, without changing application behavior.
- Bind artifact, device, submission, store-availability and ledger evidence to the same version and bundle.
- Keep unexecuted journeys and post-release health separate from release acceptance.

## Capabilities

### New Capabilities

- `android-production-delivery`: Gates production submission on an exact verified candidate and distinguishes upload, availability and ledger outcomes.

### Modified Capabilities

None.

## Impact

The existing EAS production build and `play-production` submission profiles, signed AAB verifier, Google Play production track, and release ledger are involved. No new credentials, permissions, app features, iOS publication, or OTA to older native runtimes are in scope. The wider account, billing, provider and crash-health checks remain tracked in `finish-android-crash-release`.
