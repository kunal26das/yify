# Proposal

## Why

Firebase27 PR1033 cannot install or build with the existing Apple distribution and Kotlin configuration. Upgrade the native graph coherently, preserve existing customer/consent/crash behavior, merge the validated migration and submit one verified Android store build through Expo.

## What Changes

- Align all five React Native Firebase packages at27.0.0 and retain the existing modular JavaScript APIs and Firebase13 web SDK.
- **BREAKING build migration:** Kotlin2.4.21 with the existing supported Gradle/AGP pair, Firebase Apple13 through SPM and dynamic frameworks, and a narrowly guarded Google Sign-In10.1 compatibility bridge whose distribution is selected by actual dependency resolution.
- Enforce aligned installed packages and reviewed privacy/crash defaults; retain exact pins, source hashes and compiler checks.
- Regenerate tracked native projects from Expo source config at runtime1.8.29/code111, validate all platforms and submit the exact signed Android artifact only after artifact/device checks.

## Capabilities

### New Capabilities

None. This is dependency/build/release work preserving existing product contracts; skip_specs is explicit.

### Modified Capabilities

None. No UI, entitlement, authentication journey or data-collection requirement changes are intended.

## Impact

Package/lock metadata, reviewed native compatibility patches, Expo build configuration and generated Android/iOS projects, guard tests and release records. Existing main CI automatically publishes both web targets after merges. iOS remains prepare-only; no new credentials, permissions, billing, campaigns or OTA publication is authorized by this plan. Production Android submission is authorized by the current request and must use the existing play-production profile after duplicate checks.
