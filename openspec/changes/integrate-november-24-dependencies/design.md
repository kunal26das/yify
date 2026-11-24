# Design

## Context

Main is `a9f91f36890194b1189e1ee68aff12aeeed113d1` at runtime 1.8.32/code 114. Android 1.8.32/114 was submitted to Play production on November 23, and Android Production OTAs from #1104 serve runtimes 1.8.29 and 1.8.32.

## Decisions

Integrate in one branch because the proposals share `yarn.lock` and must be rebased onto main. Keep every proposed version. Leave #1097 open: `@react-native-firebase/app` 27.1.1 is the latest release and declares `firebase: 13.1.0`, so a root Firebase JavaScript 13.4.0 would install a second SDK, which `scripts/firebase-compatibility.json` rejects.

Sentry 8.36.0 changes native code: Android SDK 8.62.0 to 8.64.0, Cocoa 9.33.0 to 9.35.0 and Gradle plugin 6.25.0 to 6.27.0, while the JavaScript SDK stays 10.78.0 and the CLI 3.8.2. Its 8.35.0 fixes restore touch breadcrumbs on the React Native 0.88 New Architecture and resolve every Sentry Android module to one version. The app wraps its root with `Sentry.wrap`, so touch breadcrumbs return; `sanitizeBreadcrumb` drops their message and keeps only allowlisted attributes, and a new test pins that a touch breadcrumb keeps only its category. The new watchdog-termination and breadcrumb options are opt-in and unused; replay, profiling and default PII remain disabled.

Purchases 11.0.4 moves purchases-hybrid-common from 20.4.0 to 20.10.0 (Android 11.4.0, iOS 5.103.1). Its one app-level fix passes an undefined `appUserID` to native when `configure` is called without one, which is how the app configures before account binding. Its web mappings depend on RevenueCat web 1.75.0 while the app's own web SDK moves to 1.78.0; main already carried the same two-copy shape (1.73.2 and 1.74.0), and web uses only the app's copy through its `.web.ts` split.

Babel 8.1.3 fixes spread, block-scoping, module-transform, generator and parser edge cases. It compiles test fixtures only; Expo and Worklets keep the pinned Babel 7 adapter, whose reviewed hashes still verify.

Advance runtime/build to 1.8.33/115 because native modules change. Android prebuild with `--clean` changes only the version fields and the Sentry Gradle plugin. As in #1090, the iOS plists take the generated version fields while the committed CocoaPods output, workspace, `Package.resolved` and privacy manifest are kept; a prebuild without `pod install` would delete them.

## Risks / Trade-offs

Native changes can compile and still fail at runtime. Required CI and compile-only Android QA cover the Android graph; device startup, live purchases and Sentry delivery need a store candidate's checks before release. iOS needs its own CocoaPods regeneration and simulator builds before any iOS release.

## Migration Plan

Merge after required CI and compile-only Android QA pass on the final head, verify web delivery from main CI, confirm every pin on main and close the six proposals as superseded. Roll back by reverting the squash commit. Never send this native graph as an OTA to runtime 1.8.32 or older.
