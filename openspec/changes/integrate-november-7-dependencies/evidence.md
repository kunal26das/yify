# Evidence

## #1059

Proposal head `ce2bdd579917a9ac8066e8fa2ee5fc8d678691a3`, based on main `525faa9`. The shared CI failure was `Unreviewed Expo dependency: react-native-safe-area-context@5.10.1; expected ~5.11.1.`; the proposed 5.11.0 also fails ~5.11.1, so the branch takes 5.11.1. The lockfile changes only Google Sign-In 17.0.0, Purchases 11.0.0 with its hybrid packages 20.1.0, Safe Area 5.11.1, Screens 4.30.1 and two unused transitive entries.

Google Sign-In 17.0.0 changes only iOS packaging: its JavaScript and Android sources match 16.1.5. The two existing source guards moved to 17.0.0 and six new guards cover the wrapper manifest, adapter podspec, Swift package, dependency selector and adapter URL forwarding. The exact-version patch replaces the three retired patches, so the manifest verifies 103 sources and two patches. The committed iOS project selects SwiftPM in the Podfile and no longer links GoogleSignIn into the application target; Podfile.lock still lists the 1.8.30 pods.

Purchases 11.0.0 uses RevenueCat Android 11.0.0 with Play Billing Library 9.1.0. The app does not call the changed Amazon sync API, and the error-code enum is unchanged.

Android prebuild changed only the version fields for 1.8.31/113. Local checks: installation guards (2 patches applied, 105 targets verified), tooling adapters, Firebase policy, exact pins, Production channel, typecheck, app and workspace tests, the reviewed Expo doctor and strict specs.

## #1068

Proposal head `d5f02eb48308456b36c6ef993648d627b1a7bcaa`. The proposal installs Expo 58.0.22 but leaves the guarded internal resolutions at their 58.0.19 levels. The resolutions now follow the lowest published versions that satisfy every installed dependent, computed to a fixed point: modules core 58.0.29, CLI 58.1.18, Metro config 58.0.20, dev launcher 58.0.18, dev menu 58.0.12, autolinking 58.0.16, asset 58.0.19, modules JSI 58.0.21, file system 58.0.13, config 58.0.10, config plugins 58.0.11, image utils 0.12.6, inline modules 0.2.8, local build cache 58.0.10, prebuild config 58.0.18, require utils 58.0.5, router server 58.0.20, Babel preset 58.0.23 and the React Native 0.88.1 internals.

Of the guarded sources in upgraded packages, 16 changed and were compared with the previously installed bytes; the rest are byte-identical, and React Native's three guards and the Reanimated patch are unchanged. The Android compile-only pin moves to `io.github.expo:expo-modules-v2-compiler-plugin:0.2.7-2.4.20`, SHA-256 `20d6e9896a8f028436ae7a0badf89639960efd903ba2ebeea524e8e7e3a0ac37`, matching Maven Central's published SHA-1. The reviewed Expo and React Native deviations move to 58.0.22 and 0.88.1; eight Expo modules now carry newer-patch recommendations, which the doctor accepts. Android prebuild produced no further changes.

## #1058

Proposal head `a80665738de0547c64371b3145f70e76b6be2495`. Sentry 8.33.0 uses Android 8.62.0, Cocoa 9.32.0, JavaScript 10.77.1 and CLI 3.8.2; the Android Gradle plugin stays at 6.24.0. Native screenshot masking now defaults on. Deferred hard-crash envelopes apply only to the `onerror` mechanism; the app's crash bridge reports `react_native.crash_bridge.global` with `onerror: false`, so fatal reporting is unchanged. The reviewed deviation moves to 8.33.0. Consent, privacy and crash-reporting tests pass.

## #1055

Proposal head `53486170e0e407c53d0daef6c6313e6f78aee6f3`. Worklets 0.13.1 changes only its version string, Jest resolver and prebuilt OXC plugin binaries. Its native sources, both guarded files and the Babel plugin used through the Babel 7 adapter are byte-identical to 0.13.0, so the adapter and guards change only their version. Expo 58.0.22 bundles 0.13.0 exactly, so the reviewed deviation records 0.13.1; Reanimated 4.7.1 accepts it. Tooling compatibility and worklet execution tests pass.

## #1071

Dependabot closed #1066 after #1059 merged and opened proposal head `b02ab9ce6358a54973a0b89503277d48bda6a549` on main `13e51ab`: Babel core 8.1.0 replaces 8.0.10, ESLint 10.14.0 is unchanged and expo-doctor 1.21.6 joins the group. Babel core 8.1.0 adds the `generate` export and three opt-in assumptions (`noClassPrototypeAssign`, `noConstructorPrimitiveReturn`, `noUninitializedThis`); its remaining changes raise the Babel 8 parser, generator, helpers, traverse and types floors to 8.1.0, which the lockfile already resolves. Expo and Worklets keep the pinned Babel 7 adapter, and the reviewed Babel deviation moves to 8.1.0. expo-doctor 1.21.6 reports the same reviewed deviations. The lockfile is the proposal's deduplicated graph plus Worklets 0.13.1 from #1055. Local checks: installation guards (2 patches applied, 105 targets verified), exact pins, the reviewed Expo doctor, typecheck, 2,461 app tests with one skipped and 51 workspace tests.

## Merges and delivery

Merged in order on main: #1059 `8f29d4c`, #1069 `566de04`, #1068 `fd3bba8`, #1058 `13e51ab`, #1055 `b49c512`, #1071 `6f9da3c`, #1062 `393a1af` and #1061 `53b90cb`. Main requires current branches, so each branch was updated from main and passed the required checks on its final head before its squash merge. After #1059 merged, Dependabot closed #1066 and opened #1071. The maintenance workflow had regenerated the #1062 and #1061 lockfiles from scratch, which also moved unrelated Babel and build-tool records; both carry only their own package entries instead. #1070 stays open because React Native Firebase 27.1.0, the latest release, still depends on Firebase 13.1.0.

Main CI passed on `53b90cb`, and Hosting run 260 and Pages run 659 deployed it. Both sites return their routes with the expected titles, the Hosting catalog routes respond, and headless Chromium renders the 1.8.31 consent screen on both with no page errors and no third-party request before consent.

An Expo connector build `7d5ee6cf-ff61-4d9f-ae37-87f9e54e8d1c` stopped before compilation because its token could not read the Android signing credentials; it produced no artifact. Expo build `083adda6-e58c-4a40-9bc7-442ec8b7ff87` then finished from `53b90cb` with the remote signing assignment and without automatic submission: Android production, 1.8.31, code 113, runtime 1.8.31, Production. The 98,632,511-byte AAB SHA256 is `5ff81adf3b4a5358660732eb6979a06ee6a2fafb8b08d44c4b9c44698e4c93c2`. The bundle manifest, runtime resource, every signed entry and the upload certificate verify. Its universal APK has 148 compressed native libraries, 37 in each of four ABIs, with extraction enabled.

The optimized-JNI check failed because its expected Expo modules v2 contract was stale. The 0.2.7 native library no longer references `AsyncContext.drainInlineSettles`; it requests `AsyncContext.createPromises(JI)[PromiseHandle` and `SharedObject.getAdditionalMemoryPressure()I`, and every Expo-typed JNI signature it contains resolves to a retained DEX method. The verification-only correction requires those two methods and drops the removed one. The corrected check passes against this AAB and still fails against the 1.8.29 bundle, which predates `createPromises`. No application source or binary changed.
