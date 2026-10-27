# Dependency maintenance evidence

## Scope and provenance

Starting main: `d686275337a6ec3020f5c7cec639edd7c0c11357`. The integration preserves the direct updates proposed by these exact PR heads, with the additional pins needed for a coherent installed graph:

| PR | Reviewed proposal head | Direct changes |
| --- | --- | --- |
| #1043 | `5233cf25961d8f8ed76837aae4200579e5090a04` | Sentry 8.32.0 |
| #1044 | `0243e2237edd2700b4bbc12a7a627244bf859e75` | In-app updates 0.13.0, Ads 17.4.0, Purchases 10.15.1 |
| #1045 | `76548fb2fad35fd0706f09727e8b7d2ed49fa42a` | Electron 45.0.0, builder 26.18.0 |
| #1046 | `e266901a4914b9b4260c85f8e906bf1e60475337` | jose 6.2.13 and its regenerated transitive graph |
| #1047 | `33d7d76df158ad991d0e59e22bbf033e222147d7` | RevenueCat JS 1.73.1, Firebase JS 13.1.0 |
| #1050 | `f3b16a27cb01df0e8fe9b5ab4482a84f2304cc30` | All five RNFirebase modules 27.1.0 |
| #1051 | `c942703e9bef69ea5f6034c85fd6d97c9885293e` | Root and tooling Babel 8.0.9 |
| #1052 | `91bddfb4b0ba3205d2d8aa964e4d3a53ff85357f` | Expo 58.0.19 and 17 companion updates |

RNFirebase's published metadata requires Firebase JavaScript 13.1.0, Android BoM 35.0.2 and Apple SDK 13.1.1. The compatibility policy retains minimum Android API 24, Kotlin 2.4.20, Google Sign-In Apple 10.1.0 and every existing collection/crash default. Runtime/build 1.8.30/112 separates the new native graph from previously published binaries. The shipped-runtime ledger is unchanged.

## Root causes and corrections

The clean-checkout regression assumed the first rejected concurrent filesystem read would name the Firebase app package. CI instead reported the missing auth package. The assertion now accepts only the seven actual required SDK metadata paths, with the exact ENOENT diagnostic; installed-graph validation remains mandatory.

The Sentry fixture now loads the installed UI profiling integration with a native boundary that fails on use. It verifies default exclusion, both current and deprecated explicit profiling options, and exclusion when native integrations are disabled. Existing replay, Hermes profiling, screenshots, view hierarchy and consent-withdrawal controls remain covered.

The installed RevenueCat 19.14.1 error enum adds documented numeric values 36 through 41. Sanitization admits exactly 0–26 and 28–42; 27, 43, arbitrary values, wrong types and private billing payloads remain rejected. Firebase JavaScript and native packages are now grouped together for future Dependabot proposals. Automatic merge allowlists and permissions are unchanged.

Expo config-plugins 58.0.10 requires Xcode parser 4.0.0, which uses Node's cryptographic UUID generator and removes its UUID dependency. The obsolete scoped UUID override was replaced with an exact Xcode 4.0.0 pin. The real parser test preserves 32 unique groups and their references through serialization and reparsing.

## Native source review

The version/hash source guard still checks 97 unmodified sources and four patched outputs. All four actual compatibility patches are unchanged. Fourteen upgraded Expo package versions cover 83 guarded source entries; 15 contents changed and were compared with old pristine archives and integrity-verified new published tarballs. The private source-audit receipt SHA256 is `27e8d4cdf9c45161b8da919b6f88b8ef3ebe5988b2cc774fce20e2e00f479874`.

Reviewed deltas include version declarations, coordinated bundled recommendations, dynamic SwiftPM dependency recording, SwiftUI appearance/safe-area propagation, inherited class registration, JSI native memory accounting and complete buffer writes, chunked arrays, frozen-state cleanup, and Router nested POP_TO behavior. Existing runtime/lifecycle, deep-link, splash, background-location and source-patch guards remain enforced. The application's Kotlin compiler pin is distinct from bundled Gradle-plugin build declarations; compiler artifact verification remains required.

## Verification

- A full install without prior node_modules or yarn.lock succeeded; all 101 native source checks, three tooling patches and the aligned Firebase policy passed. The former installation was preserved outside the checkout during verification.
- Frozen installation passed without changing the new lockfile; all native/tooling patches were already applied and verified.
- Focused consent/privacy/clean-checkout tests: 32 passed. Compatibility/doctor policy tests: 120 passed. Follow-up Xcode, native metadata, QA prerequisites and grouping checks: 28 passed.
- Both Hosting and Pages exports rendered and passed catalog/server-only data isolation checks.
- Release console: typecheck, 151 tests and build passed.
- Full application tests: 2,463 passed, one pre-existing signed-artifact-dependent test skipped. Crash-reporting workspace: 51 passed. Typechecks and targeted ESLint passed; 390 automation tests passed.
- Strict active and archived OpenSpec validation, doctor and team policy checks passed.

iOS pods and SwiftPM resolution completed with Firebase 13.1.1, Google Sign-In 10.1.0, AppCheck 12.0.0, GoogleUtilities 8.1.5 and Sentry Cocoa 9.31.0. Native regeneration preserves the existing privacy manifest and phase order. SDK-only JSI simulator prewarming is distinct from compiling or launching the app.

## Exact-source acceptance and integration

Independent app/privacy/tooling/lockfile and native/source reviews accepted candidate `6f6f33100c5548bea5a92770309f8018fe94feb0`. [PR #1053](https://github.com/kunal26das/yify/pull/1053) merged normally as `78d69442cc0fb4fa30800f0459e370ad28423bc9`; the complete trees are identical. All 39 manifest changes from the eight proposals were verified again on merged main before their duplicate PRs were closed. The original PR heads remained unchanged at closure.

Candidate CI [40557584554](https://github.com/kunal26das/yify/actions/runs/40557584554) and main CI [40564552444](https://github.com/kunal26das/yify/actions/runs/40564552444), attempt 1, passed all four required jobs. The automatic Dependabot-only clean-install job was skipped for this human integration; the full fresh and frozen local installations remain separate evidence.

Android [40557584535](https://github.com/kunal26das/yify/actions/runs/40557584535), job 122377661957, passed four-ABI release compilation and packaging. Evidence artifact 12762435441 SHA256 `9e724afff87700069d08710a42263c86111fb92e01b1ac9154b47b61f8ff0c3e` matches GitHub's digest. All three preflights match the candidate's 18 source fingerprints. Kotlin 2.4.20, R8 9.2.14 and 57 compiler configurations passed the two pinned compiler artifact checks. Five telemetry upload tasks were explicitly skipped and late-task rejection regressions passed. The packaging report records 148 compressed native libraries, 37 for each ABI, `extractNativeLibs=true` and code 112. Recorded test APK SHA256 is `fc50a13819733ad230b9a51ca7974f55c6af11f186fd430d2db7b154fcdaec3e`; test AAB is `bb634b5741c5dfa9bab6697e81538200d2e9e317dc1f12b67e6f61e07034c718`. Raw Android binaries and per-project compiler JSON were not archived; independent review used the archived reports, aggregate compiler verification and recorded hashes.

HSDP [40557584646](https://github.com/kunal26das/yify/actions/runs/40557584646), job 122377660446, passed minSdk 24 and strict/resolved HSDP 2.2.0 checks. Its PR merge checkout has the same complete source tree as the candidate; this dependency-reporting job does not compile native code.

Protected iOS Simulator Debug and Release builds passed on clean candidate 6f6f331 with the outer network-denial probe, sanitized environment, locked SwiftPM versions, developer signing disabled, both Sentry upload-disable flags and `SKIP_BUNDLING=1`. Every embedded framework has arm64 and x86_64 slices; the inspected GIDSignIn and GIDGoogleUser classes each have one defining owner per architecture. Version/runtime 1.8.30/build 112 and Production channel passed inspection. Full app archives were byte-verified against file manifests: Debug SHA256 `13a996971cdf9f4d83ddffab18dcdc9e99d3f66c8bc05c0bb58171799cce090a`; Release `44b51d240e30d14b6ba7c6fe921617a79153dda76d7fabcb6a4eed23ab4af7f9`. Executables have linker-generated ad-hoc signatures with no developer team identity. No JavaScript bundle or app launch was tested. Native privacy and Firebase configuration metadata were independently inspected; this does not prove SDK initialization or runtime collection behavior.

The independent aggregate native review receipt SHA256 is `3a573adce3f43a52816ea72aed8089cf07684afcd54b4731b081ce3183d728db`. Compilation does not prove installed-device startup, live purchases/ads, production crash delivery or store availability. No new Android store or OTA release is claimed by this maintenance merge.

## Verified web delivery

Automatic Hosting [40565264608](https://github.com/kunal26das/yify/actions/runs/40565264608) and Pages [40565264488](https://github.com/kunal26das/yify/actions/runs/40565264488), attempt 1, succeeded for merged source 78d6944 after main CI 40564552444. Independent readback verified the exact CI attempt, deployment workflow source/checkout and Sentry deployment receipts. Both `https://yify.expo.app/` and `https://kunal26das.github.io/yify/` matched 10 HTML routes and five startup JavaScript assets each against their immutable Hosting deployment or Pages export artifact. Final readback receipt SHA256 is `1059e697ddc2cd907185686a914eeb8b130e6b66bd97fbd38d7a2666a093484b`. This records point-in-time HTTP/byte delivery; account journeys, live billing and native publication remain outside that claim.

## Cleanup and local tooling

Private baseline and merged-source recovery bundles were verified before branch cleanup. All completed integration/Dependabot remote branches were already absent after PR closure and their stale refs were pruned; the completed local integration branch was deleted after tree/provenance verification. Clean current main was verified before opening this documentation-only closeout. The unfinished Compose migration branch/registration remains intentionally retained. No task worktree was created.

Both iOS archives, manifests, logs, probes and receipts are preserved. Task build/package caches and the former root installation were moved reversibly to Trash; physical disk-space recovery is not claimed. The one SDK-only JSI framework container and its non-production placeholder slices were quarantined privately. Subsequent scans found no such container or cache symlink pointer in normal node_modules, Pods or shared build/package caches. Source guards still pass 0 applied/101 verified. No task compiler remains running, and shared caches, credentials and user devices were not changed.

Electron 45.0.0 SDK archives match their official checksums and both root/release executables match the archive; Node-only execution under network denial passed. Strict app-bundle signature validation did not pass for the bare linker-ad-hoc SDK bundle, which has no sealed resource manifest. No packaged desktop app, developer signature or desktop application launch is asserted.
