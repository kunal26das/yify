# Tasks

## 1. Dependency and configuration migration

- [x] 1.1 Verify current PR/main, official SDK/API/toolchain requirements, existing credential assignments and prior build/submission state; preserve a verified recovery bundle and dated source/preflight evidence.
- [x] 1.2 Align Firebase 27 pins/lock, source Kotlin/SPM/framework configuration and runtime 1.8.29/code 111; frozen installation and exact/source guards must pass without unrelated native drift.
- [x] 1.3 Implement a hash/version-guarded Google Sign-In 10.1 distribution bridge and demonstrate coherent Apple package resolution without incompatible or duplicate AppCheck products; document exact native versions and scope.
- [x] 1.4 Add package/config regression guards and fixtures for partial/mismatched installs, source drift and preserved optional collection/crash/ad defaults; tests must fail on each rejected case.
- [x] 1.5 Regenerate tracked native projects/Pods from source and verify required versions, Production runtime/channel, existing app behavior configuration and reproducible diffs.

## 2. Integration validation and merge

- [x] 2.1 Pass typecheck, app/workspace tests and focused auth/consent/crash/revenue regressions against installed27, reviewed doctor, both rendered web exports, strict specs and release-console checks.
- [ ] 2.2 Pass source-bound Android four-ABI release compile/packaging/JNI and Apple Debug/Release compile/link plus bounded initialization/embedding checks; record actual test scope and any unexercised provider journeys.
- [x] 2.3 Obtain independent exact-commit source/security/artifact review and required PR CI, merge normally, verify Firebase pins on main and reconcile original PR #1033.
- [x] 2.4 Verify final-main CI and automatic Hosting/Pages publication with exact-source artifact/public readback; record immutable receipts.

## 3. Android store release

- [x] 3.1 Recheck duplicate jobs/current Play state and dispatch one exact-source production EAS Android build without auto-submit; record source/runtime/code and build ID.
- [x] 3.2 Verify the exact finished signed AAB/upload certificate, runtime/channel, all four ABI native payloads and actual optimized JNI; install its generated APKs on isolated API 36/4KB and API 37/16KB devices and verify startup/consent persistence/About with explicit journey limits.
- [x] 3.3 Independently review signed-artifact/device evidence, submit the exact build once via play-production and record authenticated Expo/Play receipt, review and availability boundaries without duplicate submission.
- [ ] 3.4 Reconcile release/state/ledger only from observed outcomes, validate/merge records and automatic web effects, and clean completed task branches/worktrees/helpers/test resources with recovery evidence retained.

## Remaining scope

Task 2.2 is partially verified: Android four-ABI compile, signed optimized JNI and both offline startup checks pass, as do Apple Debug/Release compile/link/embedding. iOS initialization remains unexercised because app-process egress isolation was not proven; keep this gate before future iOS publication. Task 3.4 awaits this records change's CI/merge/web readback and branch cleanup. Android submission is complete, with Google review/public availability unverified.

## Workflow follow-up

- Archive only after all tracked migration/submission/records tasks are verified. Keep unobserved approval, public availability, provider journeys and version-specific health separate from completed submission work.
