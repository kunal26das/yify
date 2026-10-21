# Tasks

## 1. Review and integration

- [x] 1.1 Inspect the four exact PR heads and failures, verify automation boundaries, and retain a private baseline and PR recovery bundle.
- [x] 1.2 Review upstream native/build-tool changes, align exact pins/source guards/policy, and commit a successful fresh lockfile resolution.
- [x] 1.3 Regenerate native projects and Pods under runtime 1.8.27/code 109 and verify generated diffs and Production channel.

## 2. Validation

- [x] 2.1 Pass pins, source guards, typecheck, app/workspace tests, Expo doctor, strict OpenSpec validation, both rendered web exports and release-console checks.
- [x] 2.2 Obtain independent review of the final integration tree, exact-source all-ABI Android compile/packaging evidence and bounded desktop runtime evidence; record iOS validation scope.

## 3. Delivery and cleanup

- [x] 3.1 Merge through required checks and verify main CI and automatic Hosting/Pages delivery.
- [x] 3.2 Confirm all four proposed direct changes reached main, close superseded PRs with evidence, and remove completed branches while preserving unrelated migration work.

## Workflow follow-up

Archive after implementation and delivery evidence reconcile these tasks. Store release and native OTA remain outside this batch.
