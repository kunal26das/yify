# Proposal

## Why

Dependabot PRs #982, #983 and #984 remain blocked by native compatibility checks after the JavaScript automation repair. The owner wants these updates repaired and merged, with their lockfile changes committed.

## What Changes

- Review and integrate Sentry 8.30, RevenueCat 10.12.2, React Native Web 0.21.4 and the proposed Expo/React Native dependency set.
- Rebase version-specific compatibility guards against the actual upstream code, regenerate native projects, and assign new native runtimes.
- Validate clean installs, application behavior and native builds before merging the existing PRs.

## Capabilities

No product or automation eligibility requirements change. This dependency-maintenance change uses `skip_specs: true`; the existing privacy, entitlement, crash-reporting and native-runtime requirements remain in force.

## Impact

Dependency manifests and lockfile, reviewed Expo compatibility policies and source patches, generated Android/iOS projects, native validation fixtures, and acceptance evidence. Merging invokes the existing web delivery workflows. This work does not publish a store build or an OTA for an unshipped runtime.
