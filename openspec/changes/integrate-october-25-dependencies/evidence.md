# October 25 dependency integration evidence

## Baseline and scope

Starting main: `d13f9a26a98df948ce85ea43159bb1dac043cf94`. Original PR heads: #1032 `71919ad9b188e98036bcb49b7f0892494e9ba845`, #1033 `bce5f5abe04a06cfa2d1a2fe465cd175ad237f87`, #1034 `2b1159f8f63eb467873f1a559f702af11c70fa56`. A verified private Git bundle preserves the baseline and all three heads. No credentials, grants, billing or recurring workflows were changed.

PR1032 fails postinstall because its Expo version differs from guarded sources. PR1033 fails unsupported iOS disableSPM configuration. PR1034's original clean reinstall and refreshed CI passed; automatic native merging is intentionally excluded by the reviewed root policy. There is no verified automation malfunction in this batch.

## Compatible candidate

Version/runtime 1.8.28, Android code/iOS build 110. Includes every proposed direct pin from1032 and1034, coordinated Expo transitive resolutions and GlassEffect58.0.4 deduplication within Router's supported range. Firebase stays26.4; no automatic AdMob adapter or duplicated revenue event path is introduced.

Verified16 exact Expo tarballs with registry SHA-512 and embedded versions. Forty-four existing source guards advance versions:37 byte-identical,7 changed. Independent source review examined scheduler liveness/completion, class/prototype registration and symbol descriptors. Added12 companion guards; all96 targets pass with no pending patch. The Reanimated patch is unchanged. Semantic lockfile review found52 changed package-version sets and no same-version integrity mutation. Actual read-only Core and FileSystem scanner checks succeeded with macro schema8.

## Local verification

- Fresh Yarn1.22.22 resolution completed and its lockfile is committed with this candidate. Frozen installation passed without lock drift. Node24.19.0 and JDK17 are retained.
- App/workspace typecheck passed. App tests:2360 passed,0 failed,1 existing artifact-dependent optimized-JNI skip. Crashreporting:51 passed. Focused native/tooling compatibility:31 passed. Focused dependency-watch/Android-QA fixtures passed after updating audited Expo and stale compatibility-review fixture versions; rejection assertions remain intact.
- Online Expo doctor passed with the existing explicit structural and reviewed SDK recommendation deviations. A first run caught duplicate GlassEffect versions; exact deduplication fixed that gate without disabling it.
- Both Hosting/server and Pages/static exports and render/data-boundary checkers passed. Release-console typecheck, tests and build passed. Strict OpenSpec and team checks passed before commit.
- Expo regenerated native projects in Production mode. CocoaPods1.17.0 installation succeeded; iOS privacy manifest, workspace, Podfile, Firebase configuration and startup delegate are preserved. Info.plist and Expo runtime are1.8.28/110 and Production. Xcode27.1 is available.

## Independent reviews and pending gates

Release preflight requested Sol/high, source review Astra/high, security review Astra/high and native QA Sol/medium per repository role preferences. Accepted/effective model settings are not independently exposed. Specialists had read-only repository scope except explicitly cleared build output. Security review passed222 targeted mocked tests on the installed graph and found no concrete consent/auth/crash/revenue boundary regression. Exact-commit review, native compilation, required PR CI, merge and automatic web publication are pending and will be reconciled in the PR closure and final delivery records.

No connected/native-device startup, runtime teardown/reload, physical device, Play-delivered signing, actual ads, sign-in, purchases/restore, real telemetry or production health result is established. There is no signed store candidate, store submission, OTA or iOS publication in this batch.

## Firebase27 remains open

The supported migration requires Kotlin>=2.4 and SPM/dynamic Apple frameworks. Current Kotlin2.2 and static/disableSPM configuration cannot accept it as proposed. GoogleSignIn9.2's podspec requires AppCheckCore~>11.0 and its SPM manifest starts at11, while Firebase13 uses AppCheck12. The published React Native wrapper16.1.5 pins GoogleSignIn~>9.0; upstream GoogleSignIn10.1 supports AppCheck12 but is outside that range. Keep1033 open until a compatible supported wrapper and coordinated native migration/build/journey checks are ready. Do not force dependency overrides or suppress compiler metadata checks.

## Delivery and cleanup

Pending normal PR checks, exact native compilation and review. Existing main CI automatically publishes Hosting and Pages after a merge; avoid duplicate manual deployments. Close only superseded PRs after confirming their proposed pins on main. Preserve the unrelated Compose migration branch and unfinished state. Task-specific branch/ref/helper cleanup and final evidence reconciliation remain tracked tasks.
