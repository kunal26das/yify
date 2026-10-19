# Tasks

## 1. Production candidate

- [x] 1.1 Verify clean source `f1f615755c6abf8f8cfd3cbe33c242efa4cc02a0`, package/native 1.8.26/code 108/Production metadata, Expo credential assignment and prior release state; record the read-only results in `evidence.md` without secrets.
- [x] 1.2 Queue one EAS production Android build with automatic submission disabled; verify its accepted ID, source, profile, version, code, runtime, channel and absence of a scheduled submission in the EAS receipt.
- [x] 1.3 Confirm the single queued build finished, match its EAS source/profile/version/code/runtime/channel and downloaded AAB hash to the private candidate, and record the terminal receipt in `evidence.md` without scheduling a submission.

## 2. Signed artifact and installed devices

- [x] 2.1 Pin the finished candidate's AAB SHA-256 and Play-registered upload certificate in a private code-108 manifest; run the local verifier on signed entries, manifest/runtime/channel, four-ABI native packaging and optimized JNI, and record sanitized passing results for the exact AAB.
- [x] 2.2 Derive and install candidate APKs on 4 KB and 16 KB Android targets, compare APK payloads and installed bytes, and record startup, optional-analytics-off consent/restart, version display, rendered evidence and logs; label the offline watchlist fixture as read/render/restart only and any unexecuted connected catalog/detail/save, provider, account or billing paths explicitly.
- [x] 2.3 Obtain independent exact-candidate review of source, signed artifact, local verifier output, device evidence and rollback readiness, with blocking findings resolved before Play submission; link the exact-source CI receipt without representing the historical code-105 GitHub workflow as a code-108 run.

## 3. Play delivery

- [x] 3.1 Recheck EAS and Play for an existing code-108 build/upload, then have the release owner submit the verified build once using `play-production`; verify the submission ID, production track, completed status setting and exact build identity.
- [x] 3.2 Verify the terminal submission and Play production AAB hash/version code against the tested candidate; report review as pending until authenticated Console availability is observed, and inspect remote state before any failed or uncertain retry.
- [ ] 3.3 Confirm authenticated Play availability for version 1.8.26/code 108 and record its observed time in the shipped-runtime ledger.
- [ ] 3.4 Reconcile sanitized release evidence and team handoff through reviewed CI; verify any automatic web workflow effects without triggering duplicate publication, then clean up release work.

## 4. Post-release observation

- [ ] 4.1 Review version-specific Crashlytics/Sentry crash and ANR signals after availability with observation window and exposure, record a recovery, regression or inconclusive result, and leave independently tracked account/billing/provider gaps explicit.

## Workflow follow-up

- Archive only after all tracked outcomes are verified; keep pending Play review or inconclusive health active.
