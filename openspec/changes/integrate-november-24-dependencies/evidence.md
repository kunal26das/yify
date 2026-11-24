# Evidence

## Proposals, 2026-11-24

All seven proposals are based on `fc1ea8a`. Required CI at proposal time:

| PR | Change | Result |
| --- | --- | --- |
| #1097 | `firebase` 13.1.0 → 13.4.0 | Install, tests, exports and dependency checks fail: `package.json dependencies.firebase: expected "13.1.0", received "13.4.0".` |
| #1098 | `@sentry/react-native` 8.34.0 → 8.36.0 | Doctor: `Unreviewed installed Expo dependency: @sentry/react-native@8.36.0; reviewed 8.34.0.` Dependency check: Android prebuild changes `android/build.gradle`. |
| #1099 | `react-native-purchases` 11.0.1 → 11.0.4 | Pass |
| #1100 | `@babel/core` and `@babel/plugin-transform-modules-commonjs` 8.1.2 → 8.1.3 (root and `tooling/`) | Doctor: `Unreviewed installed Expo dependency: @babel/core@8.1.3; reviewed 8.1.2.` |
| #1101 | `electron` 45.2.3 → 45.4.1 | Pass |
| #1102 | `jose` 6.2.15 → 6.2.18 | Pass |
| #1103 | `@revenuecat/purchases-js` 1.74.0 → 1.78.0 | Pass |

`npm view @react-native-firebase/app@latest` reports 27.1.1 with `dependencies.firebase` `13.1.0`; the published versions end at 27.1.1.

## Upstream review

- Sentry React Native 8.35.0: Android SDK 8.62.0 → 8.64.0, Cocoa 9.33.0 → 9.34.0, opt-in `_experiments.enableWatchdogTerminationsV2` (iOS) and `enableUserInteractionBreadcrumbs` (Android), restored touch breadcrumbs and rage-tap detection on the React Native 0.88 New Architecture, masked prepared text layouts in Android replay, and one resolved version for every Sentry Android module. 8.36.0: Cocoa 9.35.0, native Android start when replay is excluded, and a debug-only Metro symbolication fallback. The installed package keeps JavaScript SDK 10.78.0 and CLI 3.8.2. Sentry Android Gradle plugin 6.26.0 and 6.27.0 bump its bundled Android SDK to 8.64.0 and add an experimental Compose snapshot option.
- React Native Purchases 11.0.2–11.0.4: purchases-hybrid-common 20.4.0 → 20.10.0 (Android 11.1.0–11.4.0, iOS 5.102.0–5.103.1, web mappings 1.75.0) and an undefined `appUserID` passed to native when `configure` omits it. The app calls `Purchases.configure({apiKey, automaticDeviceIdentifierCollectionEnabled: false})`.
- Babel 8.1.3: spread evaluation order, block scoping and `using`, module import-phase errors, generator round-trips and parser error recovery.

## Integration

The pins match the six proposals exactly. `yarn install` regenerated the lockfile; postinstall reported `Expo RN 0.88.1 compatibility: 2 applied, 105 verified.`, verified the tooling compatibility layer and matched the Firebase policy. `yarn install --frozen-lockfile` left the lockfile unchanged. RevenueCat web resolves to 1.78.0 for the app and 1.75.0 under the Purchases web mappings, the same two-copy shape main had at 1.74.0 and 1.73.2.

`CI=1 EXPO_NO_GIT_STATUS=1 EXPO_UPDATE_CHANNEL=Production expo prebuild --platform android --no-install --clean` changed `versionCode` 115, `versionName` 1.8.33, `expo_runtime_version` 1.8.33 and `sentry-android-gradle-plugin` 6.25.0 → 6.27.0. An iOS prebuild without `pod install` deleted `Podfile.lock`, the workspace, `Package.resolved` and `PrivacyInfo.xcprivacy` and rewrote the project and `Info.plist`; those were restored, and the plists take only the generated `CFBundleShortVersionString` 1.8.33, `CFBundleVersion` 115 and `EXUpdatesRuntimeVersion` 1.8.33.

## Local checks

Exact pins, typecheck, `yarn test` (2,475 of 2,476 app tests with the existing artifact-dependent skip, plus 51 workspace tests), the update channel, the reviewed Expo doctor, both web export checks, the release console's frozen install, typecheck, 151 tests and build, and `openspec validate --all --strict` (20 of 20) pass. The new touch-breadcrumb test passes against the existing sanitizer.

## Merge and delivery

#1106 merged as `28795655675320fde2beff6110391983fdc4c0c1`, tree-identical to `482981b`, after required run 45322820047 and compile-only Android QA run 45322872581 passed; every pin was confirmed on main and #1098–#1103 were closed as superseded. Its deploy runs stopped at the current-main recheck because #1107 had already merged; main `8b5097c` (after #1107) passed CI 45327226294 and deployed through Hosting 45327709049 and Pages 45327709083.

## Production candidate

EAS build `8b31e5b2-85b3-481e-a42d-57141cdd23b0` built 1.8.33/115, runtime 1.8.33, channel Production, from `8b5097c230943842c3347d252cb7a0f4d900ce82` and finished at 2026-11-24T05:01:34.789Z. Its AAB is 101,099,969 bytes with SHA-256 `94beb31afec38944d19117495e2d34096346ef6babaf74c10fc69ecb29e5c1c8`. `verify-production-aab.mjs` passed `candidate`, `fetch` (exact finished build; re-fetched bytes identical), `bundle` (manifest, runtime resource, every signed entry and upload certificate `EC97730B…9E79F`) and `apks`; the R8 artifact test found the reflected Expo modules; and a bundletool universal APK carries 37 compressed libraries in each of the four ABIs.

Device-targeted split APKs (base, arm64-v8a, en, xxhdpi) signed with an ephemeral key installed on a new API 37 Google Play arm64 emulator with 16 KB pages, whose DNS refused telemetry, ads, OTA and YouTube hosts. It logged `Expo Modules v2 installed 3 module(s)` and displayed MainActivity in 450 ms; after the adult gate with analytics off, home rendered artwork, Browse, a movie page, Watchlist and Shows opened, and a font-scale change recreated the activity in the same process with navigation still working. No fatal exception, router error, native-module error, image failure or ANR was logged.
