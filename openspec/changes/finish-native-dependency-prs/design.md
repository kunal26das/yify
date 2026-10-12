# Design

## Context

At main `009ab6c`, #982 fails the React Native rc.3 source-version guard, #983 fails the reviewed Sentry version check and Android prebuild consistency, and #984 fails the React Native Web reviewed-version check. These are native upgrades outside the existing automatic merge policy.

## Goals / Non-Goals

Validate and merge the requested upstream versions while preserving the app's existing behavior and release boundaries. Do not grant native upgrades automatic merge eligibility or publish incompatible OTA updates to installed binaries.

## Decisions

Use isolated worktrees for three bounded dependency reviews, then integrate serially into the existing PRs. Reconcile overlapping compatibility policies and generated files after each merge. Retain upstream integrity evidence and review the exact integrated heads.

Allocate runtime/build pairs 1.8.19/101 to Sentry, 1.8.20/102 to RevenueCat/RN Web, and 1.8.21/103 to Expo/RN. The native source changes require distinct runtimes even though this task does not release those binaries. Regenerate Android and iOS through Expo and config plugins, rather than editing native source by hand.

Keep source guards version-specific and compare each patch with the updated upstream implementation. Accept an updated doctor exception only with source and test evidence; remove obsolete exceptions where the installed version matches Expo's recommendation. Commit the fresh lockfile and verify frozen installation reproduces it.

## Risks / Trade-offs

- Native SDK or lifecycle changes can compile but regress runtime behavior: exercise focused crash, billing, native lifecycle and privacy tests; compile the final integrated Android graph and verify an isolated emulator launch.
- Web asset registry changes can silently break images: validate both exports and rendered synthetic catalog journeys with outbound telemetry blocked.
- Native build work is resource-intensive: coordinate local builds, retain logs and identify exactly which platforms/ABIs were tested.
- Merging triggers web deployment: serialize integration and check final publication receipts. A store or OTA release remains a separate operation.

## Migration Plan

Merge each repaired PR after required checks and independent review. Verify final main CI and both web delivery workflows. Before a future native release, use the repository's signing, all-ABI packaging and actual-device verification gates. Reverting a dependency repair must restore its matching generated projects and runtime metadata; do not publish a rollback bundle under an incompatible runtime.
