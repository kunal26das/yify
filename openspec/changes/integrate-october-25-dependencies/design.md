# Design

## Context

Main d13f9a26a98df948ce85ea43159bb1dac043cf94 is clean. All three PR heads and the baseline have a verified private recovery bundle. Review of upstream package sources and CI identifies guarded Expo installation, an unsupported Firebase major migration, and native runtime coordination as separate causes.

## Decisions

- Integrate Expo 58.0.16, AdMob 17.3.1 and Purchases 10.15.0 in one exact graph. Advance only the coordinated Expo transitive pins needed by that SDK; review changed guarded sources before changing hashes. Preserve lifecycle patches, classic ads backend, consent gates and manual revenue tracking.
- Retain Firebase 26.4 and current iOS static/disableSPM configuration. Firebase 27 needs SPM/dynamic frameworks, Kotlin 2.4+, and GoogleSignIn 10.1 support. The published React Native Google Sign-In 16.1.5 wrapper pins GoogleSignIn ~>9.0. Do not override unsupported wrapper pins or suppress compiler metadata checks to merge a major update.
- Use new version/runtime 1.8.28/code 110 for native updates. Regenerate native projects from config; never publish this native graph to existing runtimes via OTA.
- Preserve conservative automatic merge boundaries: the refreshed native PR is intentionally manual, with successful lockfile regeneration and follow-up CI. No evidence supports weakening eligibility.

## Validation and delivery

Run fresh root resolution, frozen install, source guards, pins, typecheck, application/workspace tests, Expo doctor, strict specs, both web exports/render checks and release-console checks. Regenerate Android/iOS and verify Production metadata. Obtain independent exact-tree review, credential-free all-ABI Android compile/packaging evidence and unsigned iOS Simulator compile evidence where the installed toolchain supports it. Record coverage limits rather than treating compile checks as native-device or live billing proof.

Merge through required checks. Existing main CI automatically publishes Hosting and Pages; verify those source-bound workflows and live HTML/startup bytes. Close only PRs whose full proposed pins are present on main. Preserve Firebase 27 PR with exact blockers and recovery criteria. No manual store release, OTA, new credentials or spending is included.

## Risks and rollback

Fresh lockfile resolution can move unrelated transitives; inspect semantic changes and strong integrity. New Expo native code can compile but regress at runtime; existing mocked journeys and future store startup gates remain necessary. Revert via a tested source change or prior Hosting artifact if web delivery regresses, preserving the native runtime boundary. Preserve unrelated migration work and all credentials.
