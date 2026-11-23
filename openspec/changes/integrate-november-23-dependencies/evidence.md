# Evidence

## Proposals and failures

All eleven proposals were based on main `f2b91eb`. #1088 and #1085 touch only workflows or the release console, yet failed "Typecheck and tests" on the Ubuntu 26.04 runner's sanitizer lookup, which #1089 fixed as `01f4761`. The others also failed on unreviewed Expo deviations (`react-native-gesture-handler@3.5.0`, `@babel/core@8.1.2`), the Firebase policy (`@react-native-firebase/app` 27.1.1) or stale native guards. #1076 and #1077 had lockfiles regenerated from scratch by the maintenance workflow; only their own package entries are carried.

| PR | Proposed | Integrated |
| --- | --- | --- |
| #1074 | Sentry 8.34.0 | 8.34.0 |
| #1075 | Gesture Handler 3.5.0, Purchases 11.0.1 | both |
| #1076 | desktop Electron 45.2.3 | 45.2.3 |
| #1077 | RevenueCat web 1.74.0 | 1.74.0 |
| #1081 | node-forge 1.4.3 | 1.4.3 |
| #1083 | RNFirebase 27.1.1, Firebase JS 13.3.0 | 27.1.1; Firebase JS stays 13.1.0 |
| #1084 | Expo 58.0.25 set (24 packages) | Expo 58.0.26 set |
| #1085 | EAS CLI 27.9.0, release Electron 45.3.1 | landed directly on main as `bff879a` after Dependabot rebased it to EAS CLI 27.11.0 and Electron 45.4.1; the branch takes main's console manifest and lockfile |
| #1086 | Babel 8.1.2, ESLint 10.15.0, expo-doctor 1.21.8, modules-commonjs 8.1.2 | all |
| #1087 | Reanimated 4.8.0, Worklets 0.14.0 | both |
| #1088 | setup-java `d1374f8`, create-github-app-token 3.4.0 | both |

## Expo 58.0.26

Expo published 58.0.26 after #1084 opened; it recommends `expo-web-browser` ~58.1.0, `expo-router` ~58.0.32, `expo-sqlite` ~58.0.18, `expo-dev-client` ~58.0.21 and `@expo/ui` ~58.0.29, so the integration takes those instead of #1084's versions. The online check now reports only the reviewed deviations: Sentry, React and React DOM, Gesture Handler, Reanimated, Worklets, Babel and TypeScript.

The guarded resolutions follow the lowest published versions that satisfy every installed dependent, iterated until no requested range is unsatisfied: modules core 58.1.0, autolinking 58.1.0, JSI 58.0.23, CLI 58.1.21, Metro config 58.0.23, dev launcher 58.0.21, dev menu 58.0.13, asset 58.0.21, file system 58.0.14, config 58.0.12, config plugins 58.0.13, image utils 0.12.7, inline modules 0.2.10, local build cache 58.0.12, Metro file map 58.0.6, prebuild config 58.0.20, require utils 58.0.6, router server 58.0.23 and Babel preset 58.0.26, with LogBox, Metro runtime, constants, task manager and font following their direct pins. The two remaining unsatisfied requests, `electron-to-chromium` and `@react-native/normalize-colors`, were already present on main.

Nineteen of the 105 guarded targets changed: twelve Expo sources and seven Reanimated and Worklets targets. Each was diffed against the bytes in the previously installed published tarball; [the native compatibility notes](../../../patches/expo-native/README.md) summarize every change. Modules core 58.1.0 changes three guarded files (iOS app-context runtime ownership, SwiftUI child unmount and the Android Gradle version string); its other Android change makes the headless app loader report an app as running only while its React context has no current activity. Its modules-v2 Gradle plugin stays 0.2.7 and its module Gradle plugin is byte-identical, so the Android QA compiler pins are unchanged. The Expo 58.0.26 template sets `UIViewControllerBasedStatusBarAppearance` to true.

## Reanimated and Worklets

Reanimated 4.8.0's NodesManager is unchanged in its teardown logic, so the cleanup patch is still required. The rebased patch applied to the pristine 4.8.0 file (`dbb35ac7…`) produces `482f7af2…`; diffing the 4.7.1 patched output (`31006b95…`) with it shows only the upstream 4.7.1 to 4.8.0 changes and the handler reset to `null`. The fixture now compiles the installed `EventNames.kt`, stubs the nullable `EventHandler`, models the native proxy's self-reference that releases its Java part after in-flight calls, and resumes the Worklets frame queue, then drains its first empty frame, before each case. On macOS with JDK 17 and Apple clang 21, all 23 installed cases pass and all ten unpatched-4.8.0 controls show native calls rejected while stale callbacks, events or frames remain.

Worklets 0.14.0's Babel plugin (`098dd250…`) still contains five Babel core imports; the adapter's output is `b9407ca3…`.

## Firebase and Sentry

React Native Firebase 27.1.1 still depends on exactly Firebase JavaScript 13.1.0, Android BoM 35.0.2 and Apple SDK 13.1.1; its fixes are an iOS SPM archive signature workaround and the Crashlytics dSYM input name. The policy moves to 27.1.1 and keeps 13.1.0.

Sentry 8.34.0 moves Cocoa to 9.33.0 and the JavaScript SDK to 10.78.0; Android 8.62.0 and CLI 3.8.2 are unchanged, and its Gradle plugin 6.25.0 only aligns those bundled versions. Detecting `expo/fetch` enables fetch breadcrumbs and spans, which pass the existing origin-only sanitizers with no trace propagation targets. `logsOrigin: 'js'` keeps native logs off. JS hang tracking, long-task metrics and Hermes UI profiling are opt-in and stay disabled; the consent test now proves JS hang tracking is absent from the app's configuration and present only when enabled.

## Native projects

Android prebuild changed the version fields for 1.8.32/114 and the Sentry Gradle plugin to 6.25.0. CocoaPods could not download two Google Mobile Ads podspecs from its CDN (HTTP/2 framing errors), so the committed iOS pods, workspace, `Package.resolved` with GoogleSignIn 10.1.0 and privacy manifest are kept. The iOS Info.plist and Expo.plist take the generated version fields and the template's status bar setting; `RCTNewArchEnabled` remains as written by CocoaPods.

## Local checks

On the merged head: frozen installation (105 targets verified, 2 patches applied, tooling adapters and Firebase policy), exact pins, typecheck, 2,460 app tests with one artifact-dependent skip and 51 workspace tests, Production update channel, the reviewed Expo doctor, both web exports with their checks, the release console's typecheck, 151 tests and build, the lifecycle fixture and strict specs. After main gained #1085, the console's frozen installation from main's lockfile, typecheck and 151 tests pass again.

## CI

On head `7098013`, CI run 45207018348 passed the three required checks on the Ubuntu 26.04 image, including the lifecycle fixture with all 33 cases, 2,460 app tests with one skip and 51 workspace tests; compile-only Android QA 45207018301 built the release graph in 35 minutes and passed, and HSDP verification 45207018763 passed. After merging #1091, head `04a446d` regenerated an identical Android project with its desugaring settings and the 1.8.32/114 fields, passed CI run 45211030533, compile-only Android QA 45211030504 and HSDP verification 45211030726. #1085 then landed on main, so the final head takes its release-console files; the required checks and compile-only QA must pass again on that head.
