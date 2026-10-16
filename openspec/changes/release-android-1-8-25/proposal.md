# Proposal

## Why

The owner requested web and Android deployment after the October 16 dependency integration. Web is already verified at source `69c60b1e69c3535743b7fa3a82c878132e988061`; Android version/runtime 1.8.25, code 107 requires a new binary because native dependencies changed.

## What Changes

- Build and verify the exact current Android source through the existing Expo signing route, then submit the verified artifact once to Google Play production.
- Reconcile current web delivery and previous Android availability without duplicate publications.
- Record artifact/device checks, submission, store availability and remaining unverified journeys separately.

## Capabilities

No application requirements change. This is release execution and evidence for already reviewed code; no new spec delta is needed.

## Impact

Existing Expo, Play, web workflows and release evidence. No new credentials, permissions, product changes, iOS publication or OTA to older runtimes. Provider/billing and long-window crash-health work in `finish-android-crash-release` remain separately tracked.
