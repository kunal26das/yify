# Evidence

## Report inventory, 2026-11-23

Sentry `kudos-labs/yify` returned 27 unresolved issues active in 30 days; three are unhandled: YIFY-2R (router, five events, all Android 17, 1.8.27 and 1.8.29), YIFY-2Z (ExpoApplication, two events, Lenovo TB-8504F, Android 7.1.1, 1.8.29) and YIFY-33 (browser extension, one web event). The rest are handled operation failures.

Crashlytics returned 35 issues for the Android app in 30 days, with 95.45% crash-free users. Fatal issues: three SoLoader launch issues, two router issues mirroring YIFY-2R and one ExpoApplication issue mirroring YIFY-2Z. All 85 `api.catalog.movies failed (http_429)` events occurred between 2026-11-03 15:20 and 2026-11-04 04:21 UTC from 16 installations, inside the window of the 848-event `http_502` issue YIFY-2J, against the catalog host configured in Remote Config.

Play Developer Reporting `errorIssues:search` for 2026-10-20 to 2026-11-21 returned one issue: a single `nativePollOnce` input-dispatch ANR on version code 111, API 36, Honor Pad X8a, with no report text.

## Router reproduction and fix

Every YIFY-2R breadcrumb trail shows app start, then two `ui.lifecycle` bursts about one to one and a half seconds apart, then the crashing tap on `presentation/movies/constants/destinations.ts:80` (`router.push`). Expo Router 58.0.26 and 58.0.31 ship identical `routingQueueContext.js`: the bridge cleanup always assigns `unboundRouter`.

`tests/component-navigation.test.cjs` makes the global router throw Expo Router's exact message. Against the previous source both of its tests fail; with the fix, destination navigation pushes, dismisses to an existing route and updates parameters through `useRouter()`. Typecheck passes. Full suite: 2,467 app tests with 2,466 passing and the existing artifact-dependent skip, plus 51 workspace tests.

## Android 7.x reproduction and fix

Isolation: dedicated AVD `yify_triage_api25` (Google APIs, arm64-v8a, API 25) started with `-dns-server 127.0.0.1`; `sentry.io` and Firebase hosts did not resolve and `wlan0`/`radio0` were taken down. The running `emulator-5554`, which belongs to another session, was not used.

The 1.8.29/code 111 production AAB from build `84e88043-9b37-455f-af29-bb7234b79e47` was converted to a debug-signed universal APK with bundletool 1.18.3. Launch logged:

```
E ExpoModulesCore: ❌ Cannot install Expo Modules v2: java.lang.NoClassDefFoundError: Failed resolution of: Ljava/nio/file/Path;
	at io.github.expo.modules.v2.types.TypeConverterRegistry.<clinit>
	at expo.modules.application.ApplicationModule.define$ExpoModulesV2
W System.err: ss4: Cannot find native module 'ExpoApplication'
I AndroidRuntime: VM exiting with result code 0, cleanup skipped.
```

`javap` on `io.github.expo:expo-modules-v2-react` 0.3.0 shows `ldc_w class java/nio/file/Path` in `TypeConverterRegistry`; 0.2.8 has the identical `classes.jar`. The arm64 `libexpo-modules-v2.so` declares API 24 and its JNI class references are `java.lang`, `java.util`, `java.nio.ByteBuffer`, Kotlin and Expo types only.

`node --test tests/core-library-desugaring-plugin.test.cjs tests/hsdp-version-plugin.test.cjs tests/android-release-plugin.test.cjs` passes 9 tests. `EXPO_UPDATE_CHANNEL=Production expo prebuild --platform android --no-install` changed only the two desugaring blocks in `android/app/build.gradle`, and the committed channel check passes.

A local arm64 release APK built from the fix with `scripts/android-qa/compile-only.gradle` and `SENTRY_DISABLE_AUTO_UPLOAD=true` finished in 10m 3s; Crashlytics symbol/mapping and Sentry mapping upload tasks were skipped. It is debug-signed and for local verification only (SHA-256 `dcc700a72c7ff29a5cfa3206aab838920acc5ddb145a578b188d82cbdf052303`). On the same isolated API 25 emulator it logged `✅ Expo Modules v2 installed 3 module(s) on globalThis.expo.modules`, `Running "main"` and `Displayed io.github.kunal26das.yify/.MainActivity: +1s171ms`. The adult gate rendered; after confirming with analytics off, home showed the expected offline state, the top-bar Watchlist link navigated, a font-scale change recreated the activity (old surface stopped, new surface started) and the Movies and Shows links still navigated. No fatal exception or router error was logged; the process stayed alive throughout. RevenueCat logged the expected billing-unavailable errors for an emulator without Play Store.

The same APK on a dedicated API 37 (Android 17) Google Play arm64 AVD with 16 KB pages, airplane mode on and DNS pointed at an unused resolver, logged `✅ Expo Modules v2 installed 3 module(s)` and `Displayed … +1s777ms`. After the adult gate with analytics off, the Watchlist link navigated; two font-scale changes each stopped the old React surface and started a new one, and the Movies and Shows links navigated afterwards. No fatal exception or router error was logged and the process stayed alive.

## Web monitoring

`tests/sentry-privacy.test.cjs` passes 24 tests, including extension-only Chrome, Firefox and Safari stacks dropped and application, mixed, frameless and native events kept.

## SoLoader fingerprint

Crashlytics events in 89 days: `cd6b3acd…` 57 events on "vivo S1" and "Motorola One Vision", and `6594f4da…` 14 events on "Huawei Enjoy 9s", all reporting byte-identical totals of 33,029,513,216 B memory and 53,665,050,624 B storage on Android 11; `4e6ae7e5…` 20 events on "Pixel 8 Pro" Android 14 reporting 2,061,844,480 B memory and 6,228,115,456 B storage, the template already recorded for this crash family. Identical totals across incompatible models identify emulated sandboxes, consistent with the absence of any SoLoader report in Play vitals.
