# Tasks

## 1. Establish blockers

- [x] 1.1 Inspect all three PR heads, required checks and maintenance decisions; record why each merge stopped.

## 2. Screens baseline

- [x] 2.1 Review screens 4.29.0, narrow its lockfile and regenerate runtime 1.8.22/code 104; verify install, app tests, doctor and native build evidence.
- [x] 2.2 Obtain independent final-diff review, pass required checks and merge PR #995 normally; record the exact merge and validation evidence.

## 3. Release console

- [x] 3.1 Verify the release-console update with its typecheck and tests, refresh it against the repaired main baseline, and observe passing final-head checks and merge of PR #996.

## 4. Coordinated Expo update

- [x] 4.1 Inspect updated upstream sources, align exact pins and guards, regenerate runtime 1.8.23/code 105, and verify install, tests, doctor, exports and affected native builds.
- [x] 4.2 Obtain independent final-diff review, pass required checks and merge PR #994 normally; record the exact merge and validation evidence.

## 5. Integration

- [x] 5.1 Verify final main CI, automatic web deployment receipts and rendered homepage; confirm no targeted PR remains open and record any native delivery limits.

## 6. Authorized Android delivery

- [x] 6.1 Refresh Expo/Play state and remote credential presence, validate live privacy URLs, and start one production build from the verified main commit without automatic submission.
- [x] 6.2 Verify the finished signed AAB identity, certificate, runtime, four-ABI payload and generated APKs; install those APKs on an isolated emulator and record actual startup, consent/restart and bounded catalog journey evidence.
- [x] 6.3 Obtain independent candidate/evidence review, refresh duplicate-submission state, submit that exact build to production without duplicate uploads, and verify the completed upload plus matching Play bundle/track receipt. Record failed Expo attempts, confirm their outcome before retrying, and independently review any existing-credential direct-publisher fallback.
- [x] 6.4 Verify Google Play availability and record the actual shipped runtime in the ledger; keep pending review distinct from availability and update the sanitized handoff.
