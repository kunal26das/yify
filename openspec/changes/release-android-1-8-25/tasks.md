# Tasks

## 1. Preflight and build

- [x] 1.1 Verify current source CI/web receipts, existing signing/submission assignments, latest EAS builds and Play version-code state; record exact identities without secret values.
- [x] 1.2 Build version/runtime 1.8.25 code 107 once from the verified source through Expo production with automatic submission disabled; verify the completed build identity.

## 2. Candidate validation

- [x] 2.1 Verify the signed AAB source, hash, certificate, runtime/channel, all four ABIs and optimized JNI/packaging checks; retain candidate-specific receipts.
- [x] 2.2 Install bundletool-generated candidate APKs and verify actual installed identity, startup, analytics-off consent/restart and bounded browsing on disposable devices; label unexecuted account/billing/provider checks explicitly.
- [x] 2.3 Obtain independent review of the exact artifact and device evidence before submission; resolve any blocking findings.

## 3. Delivery

- [x] 3.1 Recheck live state, submit the verified candidate once through the existing release route and record Expo/Play receipts and tested AAB identity.
- [x] 3.2 Check authenticated Play availability and reconcile only confirmed shipped runtimes in the ledger; keep this task open if review is pending.
- [ ] 3.3 Update the sanitized handoff and release evidence through reviewed CI, verify any automatic web publication, and clean task-owned helpers/branches/worktrees while preserving unfinished migration work.

## Workflow follow-up

- Archive only after all tracked delivery outcomes are verified. Retain pending availability as active.
- Continue separately tracked provider/billing and version-specific crash-health work without claiming this release proves recovery.
