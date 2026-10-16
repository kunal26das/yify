# Evidence

## Initial state, 14 October 2026

- Main: `8e459663e089e46e8d76090128dbebe3c0b33be5`, runtime 1.8.21/code 103.
- PR #994, `964eda76511db2e3f3e4e2c1f5bacf27848effb0`: CI [38555423385](https://github.com/kunal26das/yify/actions/runs/38555423385) fails installation because Expo 58.0.7 does not match the source-reviewed 58.0.6 guard. Android dependency verification fails at the same guard.
- PR #995, `04492751b19121ea73853d3c5788b41ea4b7489c`: required CI passes. Maintenance [38556148353](https://github.com/kunal26das/yify/actions/runs/38556148353) intentionally stops after lockfile publication because a native screens minor update is outside the automatic root upgrade policy.
- PR #996, `8fe62ba758769317e6e416c784e6e54513779c48`: CI [38557558288](https://github.com/kunal26das/yify/actions/runs/38557558288) fails only the app's screens recommendation check; its release-console and web checks pass. The remote Expo recommendation changed from 4.28 to 4.29 after the previously passing main CI. This is not evidence of a Node types defect.
- Independent automation review found no controller defect requiring a policy bypass.

## Local release-console verification

- Frozen installation and typecheck pass for #996.
- Initial full suite: 149/150 pass. The TUI recovery test observed `confirm` before a queued render committed `result`; its single `setImmediate()` wait did not reliably synchronize with React.
- The test repair uses React `act()` for the asynchronous release transition and Ink's render-flush API. Targeted tests pass 3/3; the full release-console suite passes 150/150; typecheck and build pass. The repair is included with the screens baseline, keeping #996's dependency-only provenance intact. No production release was attempted by these mocked tests.

## Screens validation

- Implementation `d27b80b5924999531c387bce2d341773aaa1ac21` pins screens 4.29.0, narrows the Yarn diff to that dependency, regenerates runtime 1.8.22/code 104, and resolves RNScreens 4.29.0 through CocoaPods.
- Frozen install, typecheck, dependency pins, reviewed Expo Doctor, clean prebuild and pod install pass. App suite: 2,289 pass, one skip, zero failures; crash-reporting workspace: 51 pass, zero failures.
- Independent review found no actionable issues at final head `02535fa60cdf01c9a1ba61b9e0d635d07aecb8a8`. Android debug assembly succeeded with JDK 17; APK SHA-256 `49b32873a74b68288633fbdccbdcc4c8e91e2508d7ba5ee5c2beed138b2c80c4`. iOS compilation and device validation remain unverified.
- All required checks in CI [38563794322](https://github.com/kunal26das/yify/actions/runs/38563794322) and Android dependency verification [38563794435](https://github.com/kunal26das/yify/actions/runs/38563794435) passed. PR #995 merged as `5d3ee0cc889fd8d5b5892b5d4ac5addaeb1262cb` on 14 October. Main CI [38564617710](https://github.com/kunal26das/yify/actions/runs/38564617710) passed.

## Expo validation

- Fix `1dadf000a68a68bbf5770f098c7b44ed7dbcfb9c` and integration merge `1d3a1ab2209809bd1e5c9e6b58809b8143744196` preserve both signed Dependabot commits and the screens baseline. The integration merge changes no app/native/dependency files relative to the validated fix.
- A preliminary independent review found four retained resolutions below their upgraded parents' requirements. All four are aligned, including expo-modules-jsi 58.0.10, whose upstream fixes include iOS CPU busy-spinning and Swift 6.4 build compatibility. A parent-requirement regression test now guards those pairs.
- Frozen install/postinstall, exact pins, all 71 source guards, typecheck, and reviewed Expo Doctor pass. App tests: 2,290 pass, one skip, zero failures; crash-reporting workspace: 51 pass. Pages and Hosting exports and their output checks pass. Post-pod native/proguard tests: 22 pass.
- CocoaPods generation succeeds with 189 pods. JDK 17 Android offline debug assembly succeeds (1,318 tasks). Generated native metadata declares runtime 1.8.23/code 105. iOS compilation and device QA remain unverified. Independent review found no actionable issues at `faefa6ff6f8cf64d0ddb9dde9ef6295f7b185871`; required CI [38565891919](https://github.com/kunal26das/yify/actions/runs/38565891919) and Android dependency verification [38565897612](https://github.com/kunal26das/yify/actions/runs/38565897612) passed. Final integration with the release-console merge requires fresh checks before merge.

## Release-console automatic merge

- PR #996 was refreshed by the existing recovery workflow after the screens baseline passed. Its signed final head `e4ec4869e7578f71dbe86a5739f45a562c7cf061` passed CI [38566089876](https://github.com/kunal26das/yify/actions/runs/38566089876); its two release dependency files are identical to the locally verified original update.
- Maintenance [38566031983](https://github.com/kunal26das/yify/actions/runs/38566031983) automatically merged #996 as `afd00133df1e57241d649a0fb32eb042ebee486b` and dispatched main CI with the existing GitHub App. Main CI [38566837457](https://github.com/kunal26das/yify/actions/runs/38566837457) passed; its actor and triggering actor are `yify-dependabot-ci[bot]`.
- Both downstream `workflow_run` deployments were created automatically on that exact merge: Hosting [38567360620](https://github.com/kunal26das/yify/actions/runs/38567360620) and Pages [38567360537](https://github.com/kunal26das/yify/actions/runs/38567360537). Both workflows completed successfully. Hosting promoted deployment `6ua48xczqw` to `https://yify.expo.app` at 12:57 UTC; Pages delivered `https://kunal26das.github.io/yify/`. This verifies the full bot-merge delivery chain, without a human-push substitute or manual dispatch.
- Integration commit `064a1fc1e698502082625bc18fa7d99503662520` merges that main into #994. Only `release/package.json` and `release/yarn.lock` change relative to the independently reviewed Expo head; the validated app/native tree is unchanged.

## Delivery boundaries

The existing runtime 1.8.21/code 103 Android build was previously submitted to Google Play. This dependency integration is separate: native runtime bumps require their own store build before publishing matching OTA updates. No new store availability or live billing/provider validation is claimed by these PR checks.

## Final merge and web receipts

PR #994 merged normally as `68c9459f87ec7b05376e3a1e5450fb2ada5dc343` after independent review of `a0767596b0ac4655a05cf1622445bcbf2bb97feb`, required CI [38568047973](https://github.com/kunal26das/yify/actions/runs/38568047973), and Android dependency verification [38568048285](https://github.com/kunal26das/yify/actions/runs/38568048285) passed. Main CI [38568992413](https://github.com/kunal26das/yify/actions/runs/38568992413) passed. Hosting [38569570932](https://github.com/kunal26das/yify/actions/runs/38569570932) promoted deployment `hpjuwp9dro` and Pages [38569571170](https://github.com/kunal26das/yify/actions/runs/38569571170) succeeded on that exact commit. Edge showed the rendered Hosting catalog hero/trailer/images/navigation/shelf and the Pages consent dialog over its blurred homepage. No account or consent settings were changed. GitHub showed zero open PRs.

## Android 105 preflight

The existing Expo default upload keystore and Play submission service account are assigned for the expected project/package; the check read identifiers only. Both public privacy-policy URLs passed. The 13:21 UTC Play snapshot lists production 1.8.21/code 103 and no code 105 bundle; the latest Expo build is the previously submitted code 103. Code 103's review/availability still requires a direct store check. A frozen local install aligned Expo 58.0.7 and all 71 compatibility guards without tracked changes before the new build upload.

Expo accepted production build [99bbce6d-1267-45a2-a50d-062ed9a63eb5](https://expo.dev/accounts/kunal26das/projects/yify/builds/99bbce6d-1267-45a2-a50d-062ed9a63eb5) at 13:22:10 UTC from clean source `68c9459f87ec7b05376e3a1e5450fb2ada5dc343`. The receipt identifies version/runtime 1.8.23, code 105, production profile and Production update channel. Remote credentials were reused with credential updates frozen. Automatic submission was not enabled; the finished artifact requires its own verification before submission.

A fresh authenticated Play UI check confirms prior code 103 is **Available on Google Play**, released October 12 at 18:15 IST with 100% rollout across all 171 configured regions and no unpublished changes. Its shipped-runtime ledger entry is reconciled separately from the in-progress code 105 build. No code 105 availability is inferred from this prior release.

## Existing navigation crash baseline

A read-only Sentry query on October 14 found one Android fatal event in the preceding 48 hours for `io.github.kunal26das.yify@1.8.21+103`: [YIFY-2R](https://kudos-labs.sentry.io/issues/YIFY-2R), an unavailable imperative router during a top-navigation press. Independent comparison found the relevant Expo Router global binding and queue implementations unchanged between 58.0.16 and 58.0.17, and the app navigation path unchanged between code 103 and 105. This dependency release does not claim to fix that existing issue. Focused device navigation checks can identify a reproduced failure but cannot prove the race absent; a reviewed context-backed navigation fix and post-release health verification remain separate work.

## Finished Android artifact

Build `99bbce6d-1267-45a2-a50d-062ed9a63eb5` finished successfully on October 14 at 13:58:32 UTC from `68c9459f87ec7b05376e3a1e5450fb2ada5dc343`. The downloaded 100,197,692-byte AAB has SHA-256 `7be3d6edf2437451525289e29addc7af6ad4539a0afbd8a5864ae644e4d692f6`. The production verifier passed the expected package, version/code, runtime resource, Production channel, every signed archive entry and upload certificate. APK derivation and actual device journeys remain separate gates.

The raw EAS doctor reported the two known config/native-directory warnings and dependency recommendations, including newer remote patch recommendations. A fresh `node scripts/check-expo-doctor.mjs` passed with the existing reviewed policy and no exclusions or policy edits. Gradle completed in 24m41s. Sentry explicitly confirmed JavaScript source-map upload for `io.github.kunal26das.yify@1.8.23+105`, dist 105. Crashlytics native-symbol/mapping and Sentry ProGuard/native-symbol upload tasks completed within the successful build; separate server-ingestion receipts and live crash symbolication were not verified.

## Android artifact and offline device verification

The independent reviewer repeated the original AAB identity/signature checks and passed the optimized JNI artifact regression (1/1). A bundletool-generated universal APK preserves all 152 original executable payloads byte-for-byte: 148 native libraries across four ABIs, three DEX files and one JavaScript bundle. Each ABI has 37 compressed libraries, with `extractNativeLibs=true`. The four generated ARM64 split APKs installed on both disposable devices were pulled back and their hashes matched the generated files. APKs used an ephemeral test signer; the original upload-signed AAB remained unchanged.

API 36/4 KB and API 37/16 KB startup checks passed with stable foreground processes and no app fatal/ANR in the captured logs. Both devices accepted adult confirmation with optional analytics off, retained that choice after force-stop/restart, and visibly showed Privacy **Analytics off** and About **1.8.23 (105)**. API 37 also passed the inspected Preferences layout at font scale 1.3. The API 36 device used IPv4/IPv6 firewall isolation; the API 37 production image cannot be rooted, so it remained offline with interfaces down, empty route tables and failed direct probes before launch, after consent, after restart and at the final checkpoint. This is route-level isolation, not a firewall claim.

API 36 Search navigation was confirmed after consent, cold restart and rapid resume without the known router exception. An immediate Preferences tap after resume had no route change; a settled repeat did navigate. Premature snapshots were excluded from persistence evidence. These bounded checks do not establish that the existing navigation race is fixed or exercise arbitrary router-root remounts.

The restricted API 36 proxy then allowed public catalog and artwork recovery, a rendered movie detail and a successful local watchlist save confirmed on Watchlist. Non-allowlisted telemetry and external-provider hosts were denied; the YouTube consent gate was not accepted. Sign-in, billing/restore, ads, YouTube playback, external viewing availability and post-release health remain unverified. The independent reviewer verified all 27 evidence-file hashes and accepted the exact candidate within this scope. Both owned emulators were stopped afterward; evidence was retained. QA requested and accepted `gpt-6-sol` at medium effort; effective inference settings were not independently exposed.

## Android submission attempts

Fresh Expo and Play reads found no active submission, no code 105 bundle and production still at code 103 before submission. Attempt [8992a626-ff14-4dff-9d23-60c020e95d90](https://expo.dev/accounts/kunal26das/projects/yify/submissions/8992a626-ff14-4dff-9d23-60c020e95d90) failed at 14:17:13 UTC while Expo created its worker, before any upload or Google Play API phase. This was an Expo provisioning failure, not a Play rejection of the app. A fresh 14:18:56 UTC Play snapshot again confirmed no code 105 bundle. The supported retry command created [ad374111-535c-4e9d-93c7-a194e2335524](https://expo.dev/accounts/kunal26das/projects/yify/submissions/ad374111-535c-4e9d-93c7-a194e2335524) for the same verified build; it failed at 14:19:47 UTC with the same worker-provisioning error, also before upload.

The independently reviewed fallback uses the existing local Play publisher credential and the unchanged verified Expo-built AAB. Seven mocked checks passed for exact-byte upload, baseline and duplicate rejection, server-hash mismatch, validation failure, ambiguous commit handling and invalid local bytes. Review added `changesInReviewBehavior=ERROR_IF_IN_REVIEW` so committing cannot cancel unrelated changes already under review. A fresh live privacy-link check passed. No signing keys, credentials, grants or normal Expo release configuration changed.

## Google Play submission receipt

The root-owned direct upload began at 14:30:59 UTC after fresh Expo and Play state checks. Google returned code 105 and the exact AAB SHA-256 at 14:33:15 UTC; the production edit validated and its commit was confirmed at 14:33:20 UTC. A separate 14:33:31 UTC Play read lists production 1.8.23/code 105, status `completed`, with the same hash `7be3d6edf2437451525289e29addc7af6ad4539a0afbd8a5864ae644e4d692f6`. This is one direct upload of the original Expo-built artifact, after both Expo submission workers failed before uploading.

The authenticated [production release](https://play.google.com/console/u/0/developers/7945922940168867324/app/4974126843295183994/tracks/4698111577572507409/releases/89/details) separately shows **1.8.23 — In review**. Publishing overview lists **1.8.23 / Start full rollout** under Changes in review, running automated pre-review checks, with managed publishing off. Changes proceed to review after these checks succeed. The API's `completed` rollout assignment does not mean Google has approved or published it. Code 103 remains the last confirmed available release; code 105 is intentionally absent from the shipped-runtime ledger until availability is verified. Do not build or submit it again. Existing navigation issue YIFY-2R and post-release health remain open; no native change was published as an OTA to older runtimes.


## Availability verified on October 16

The authenticated production release details now show **1.8.23 — Available on Google Play**, released October 14 at 20:53 IST, with 100% rollout across all 171 configured countries/regions. App bundle 105 is identified explicitly and its mapping/native symbols are attached. The dashboard has no unpublished changes. The separate Play API read on October 16 at 14:49 UTC still identifies code 105 and its exact tested AAB hash. The shipped-runtime ledger now records 1.8.23; its timestamp follows the Console's minute-level release time. This closes code 105 availability only; no crash recovery or billing/provider result is inferred.
