# Tasks

## 1. Exact-source production candidate

- [x] 1.1 Verify clean source, exact-source CI, package/native version and runtime, existing Expo credential assignments, and absence of a code-109 build/submission; record sanitized preflight evidence.
- [x] 1.2 Queue one Expo production build without automatic submission and verify accepted source, version/runtime, code, channel and no scheduled submission.
- [x] 1.3 Confirm the accepted build finishes and its final identity matches the intended candidate; preserve build logs and crash-symbol upload evidence.

## 2. Exact artifact and device gate

- [x] 2.1 Pin the actual signed AAB hash and expected upload certificate, then pass candidate manifest/runtime/signature checks and bundletool-derived four-ABI packaging checks.
- [x] 2.2 Verify installed candidate-derived APK identity, offline startup, analytics-off consent/restart and About version on isolated 4 KB and 16 KB targets; retain rendered/log evidence and label unexecuted journeys.
- [x] 2.3 Obtain independent approval of the exact signed artifact and bounded device evidence before submission; resolve blocking findings and record the verdict.

## 3. Submission and handoff

- [x] 3.1 Recheck remote code-109 build/submission and Play state, then submit the verified build once using the `play-production` submission profile; verify its accepted submission ID and build/track/status identity.
- [x] 3.2 Verify terminal submission and observed Play status without equating upload/review to availability; update the shipped ledger only if actual availability is authenticated.
- [x] 3.3 Prepare sanitized release and pending-availability records, validate OpenSpec and obtain independent evidence review; preserve the candidate, receipts and stated coverage limits.

## Workflow follow-up

- Archive after the requested submission and handoff outcomes are verified. Record any pending store review and post-release health as separate observations, not completed recovery.
- Deliver the reviewed records through normal CI and merge, verify automatic web workflow effects, then remove task-owned devices/caches/branches while preserving credentials, release evidence and the unfinished migration worktree. Retain the final delivery/cleanup receipt privately.
