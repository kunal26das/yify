# Android 1.8.27 release evidence

## Source and identity

The owner requested a new Play Store submission. Clean main `68e73e5c0213957ce83f50f585ec93949f85b129` declares version/runtime 1.8.27 and code 109; tracked native metadata agrees on Production. [Exact-source CI 39648406890](https://github.com/kunal26das/yify/actions/runs/39648406890) passed. Application/native/lockfile inputs match the independently reviewed October 21 dependency cohort and its [compile-only QA 39639399195](https://github.com/kunal26das/yify/actions/runs/39639399195). That compile result does not substitute for the signed candidate below. No product or native source was changed in this release operation. Automatic rating popups remain absent and the manual Preferences rating row remains available.

Existing Expo credentials were reused with frozen build credentials, without automatic submission. Metadata confirmed the default Android upload key and assigned Play submission account. The pinned upload certificate came from the authenticated October 19 Play check and the exact tested code-108 AAB still accepted by Play. This turn did not independently read the Console’s copy-only fingerprint; any registered-key rejection must block submission rather than trigger key replacement.

## Signed candidate

[Build af99f0d7-4592-4402-bf59-4ff6f9f87107](https://expo.dev/accounts/kunal26das/projects/yify/builds/af99f0d7-4592-4402-bf59-4ff6f9f87107) was accepted at 2026-10-21T18:37:19.796Z and finished at 2026-10-21T19:38:31.921Z. Final metadata binds the intended source, package `io.github.kunal26das.yify`, project, production profile, version/runtime 1.8.27, code 109 and Production channel.

| Check | Verified result |
| --- | --- |
| AAB bytes | 99,684,122 |
| AAB SHA-256 | `09ca44f6fbe1874290f14f19a5ac4589846154aa0ff0a2c5ff8e72aa18cdc8ae` |
| Upload-certificate SHA-256 | `EC97730BA790E825A7F777507AA2E7188F7EF2104CF64F9FCCA8BBFF8902E79F` |
| Signed entries and native metadata | Every payload entry signed; package, version/code, runtime and Production request headers passed |
| Verifier regression suite | 10 passed |
| Actual optimized AAB JNI/R8 regression | 1 passed, 0 skipped |
| Universal APK native packaging | 37 compressed libraries per ABI across all four release ABIs; 148 total; `extractNativeLibs=true` |
| Both device split sets | 37 arm64 libraries; generated and retained installed APK bytes/signatures matched |

Independent review additionally compared AAB code, native libraries and assets with 158 universal-APK entries and 47 entries in each arm64 split set, excluding only standard bundletool-generated baseline profiles. The actual signed artifact and bounded device evidence received independent approval before submission. Candidate manifest, original AAB, generated/installed APKs, hashes and review receipts are preserved privately outside the checkout.

## Build and diagnostic uploads

Gradle and final application/artifact uploads succeeded. Expo Doctor’s three warning groups and 14 dependency recommendation mismatches were checked against the repository’s existing reviewed exceptions; no new unreviewed mismatch appeared.

Sentry completed the JS source-map upload for the candidate release, uploaded one ProGuard debug file, and uploaded 24 native debug files after finding 148. This does not establish that every found file needed another upload or that all libraries supply usable source information. Crashlytics native-symbol generation/upload and mapping-upload tasks executed successfully; no separate Firebase backend receipt or production crash-symbolication result was observed.

EAS separately skipped `UPLOAD_EMBEDDED_BUNDLE`, reporting “no channel configured for this build.” The production profile currently sets `EXPO_UPDATE_CHANNEL=Production` through its environment without an explicit profile `channel` property. This service-registration warning is distinct from the verified AAB embedded code, native Production headers and runtime. Both exact-derived installations launched their embedded code offline. Independent review considered the warning nonblocking for this store submission. Explicit profile-channel metadata and EAS embedded registration remain a future follow-up; OTA download/apply and rollback were not verified here. The reviewed build inputs were not changed merely to suppress the warning.

## Installed-device evidence and limits

Task-owned arm64 emulators ran API 36 with 4,096-byte pages and API 37 with 16,384-byte pages. Exact AVD identity, airplane mode, and IPv4/IPv6 OUTPUT DROP policy and rules were rechecked before installation and throughout execution. Test-only signing keys were used for bundletool APK installation; the upload-signed AAB was verified separately. This is not evidence for Google’s delivered APK signer or Play Billing.

Rendered screenshots and persisted storage on both targets confirmed fresh adult onboarding, adult confirmation with optional analytics off, expected offline catalog recovery, consent preserved byte-for-byte after a cold process restart, and Preferences showing Analytics off and About 1.8.27 (109). The same post-restart app PIDs stayed foregrounded for at least 136 seconds. Focused event logs showed no app crash/ANR and crash buffers were empty. QA receipt SHA-256: `3775927b489cdd227c90dbe82dadd7413a68870682478b809f80653a0d585209`. Independent final review receipt SHA-256: `c541b7c29193b7dd27c3780a1486bb72ebc03fdcf292e94610cf5082d2fb716a`.

Connected catalog/detail, Google/Firebase account flows, sync, real ads, purchases/restore, providers/YouTube, physical devices, other-ABI execution, OTA behavior, Play-delivered signing and post-release health were not exercised. Offline startup does not establish those journeys or production recovery.

## Submission and observed Play state

A fresh check at 2026-10-21T19:47:41.480702Z found exactly the intended finished code-109 build, no code-109 submission in the latest 20 submissions, and no code-109 Play bundle or release. Production remained 1.8.26/code 108. The temporary Play read edit was deleted without committing changes.

The verified build was submitted once with the explicit build ID and `play-production` profile. [Submission 34486318-8bbd-4a4b-981b-6447dbe5506b](https://expo.dev/accounts/kunal26das/projects/yify/submissions/34486318-8bbd-4a4b-981b-6447dbe5506b) was accepted at 2026-10-21T19:48:42.107Z. Accepted metadata matches Android, the intended build, production track and requested COMPLETED rollout status. The submission finished successfully at 2026-10-21T20:21:43.072Z. An authenticated Play API check at 2026-10-21T20:23:17.098Z found production 1.8.27/code 109 with completed rollout status and the exact AAB SHA-256 above. The temporary read edit was deleted without committing changes. Authenticated Console production Releases separately showed “Release 1.8.27 in review” and “In review. Go to Publishing overview”; 1.8.26 remained available. Thus the requested submission is complete, Google review is pending, and code-109 availability is not confirmed. Requested/track rollout status is not an availability result.

## Prior-release ledger correction

Authenticated Console production Releases explicitly confirmed 1.8.26 is “Available on Google Play”; the receipt was recorded at 2026-10-21T19:00:54.802Z. A fresh Play API read links code 108 to the prior tested AAB SHA-256 `ff5f9217c692ed9af27f3287e0b0aad8b3a17523acb8c4c5cd8ef477695638f1`. After independent review, the ledger backfills Android Production runtime 1.8.26 using the receipt timestamp as observed-availability record time, consistent with existing ledger writers. It is not the original publication timestamp. The Console displayed “Oct 19 8:47 PM” without a captured timezone, so no precise UTC publication time is inferred.

Code 109 remains absent from the shipped-runtime ledger pending authenticated availability. Recording 1.8.26 never makes native 1.8.27 source safe for an older-runtime OTA. No OTA or iOS release was performed in this operation.

## Delivery and cleanup

Temporary task emulators were stopped, and their private AVD/SDK copies and test signing key/password files were removed after independent evidence review. Candidate, generated/installed APK bytes, exported public test certificate, screenshots, logs, tool hashes and sanitized receipts remain private. The existing Android SDK/licenses and user AVDs were retained; no production signing/submission credentials were removed. The unrelated unfinished Compose migration worktree is outside this release and must remain untouched.

Release records proceed through independent evidence review and normal CI/merge. Any automatic web workflow caused by that merge is a separate delivery result, not a second Android build or OTA. Final branch/default-checkout and workflow receipts are retained privately after delivery. Google review, later availability and production health remain separate observations.
