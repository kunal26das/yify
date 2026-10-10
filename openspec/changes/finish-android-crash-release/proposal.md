# Proposal

## Why

The Android startup fixes are built in candidate 98, but installation, connected journeys, store delivery and recovery are not established. Stale handoffs also describe completed compile work as unfinished, inviting duplicate builds while the actual release gap remains.

## What Changes

- Extend the existing production AAB verifier to identify and install the intended candidate, rejecting mismatched artifacts and evidence from older versions.
- Complete framework and app journey verification, preserving the distinction between an infrastructure failure, an application failure and a passing test.
- Reuse verified build and compile receipts; rebuild only when source changes or a defect requires it.
- Record submission, user availability and version-specific crash health separately. Success means the verified fix reaches users and its recovery evidence is reviewed.

## Capabilities

### New Capabilities

- `android-release-verification`: Candidate identity, device evidence and distinct delivery and recovery outcomes for Android crash releases.

### Modified Capabilities

None.

## Impact

Expected implementation touches `scripts/verify-production-aab.mjs`, its tests/workflow, Android QA evidence and the release record. It uses the existing Expo/Play release route and Sentry/Crashlytics access. The current OpenSpec adoption creates this plan only; its unchecked release tasks remain future work. No native rewrite, new credentials, iOS publication, acquisition spending or incompatible OTA is proposed. See `design.md` for the dated evidence and unverified boundaries.
