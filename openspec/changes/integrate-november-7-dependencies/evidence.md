# Evidence

## #1059

Proposal head `ce2bdd579917a9ac8066e8fa2ee5fc8d678691a3`, based on main `525faa9`. The shared CI failure was `Unreviewed Expo dependency: react-native-safe-area-context@5.10.1; expected ~5.11.1.`; the proposed 5.11.0 also fails ~5.11.1, so the branch takes 5.11.1. The lockfile changes only Google Sign-In 17.0.0, Purchases 11.0.0 with its hybrid packages 20.1.0, Safe Area 5.11.1, Screens 4.30.1 and two unused transitive entries.

Google Sign-In 17.0.0 changes only iOS packaging: its JavaScript and Android sources match 16.1.5. The two existing source guards moved to 17.0.0 and six new guards cover the wrapper manifest, adapter podspec, Swift package, dependency selector and adapter URL forwarding. The exact-version patch replaces the three retired patches, so the manifest verifies 103 sources and two patches. The committed iOS project selects SwiftPM in the Podfile and no longer links GoogleSignIn into the application target; Podfile.lock still lists the 1.8.30 pods.

Purchases 11.0.0 uses RevenueCat Android 11.0.0 with Play Billing Library 9.1.0. The app does not call the changed Amazon sync API, and the error-code enum is unchanged.

Android prebuild changed only the version fields for 1.8.31/113. Local checks: installation guards (2 patches applied, 105 targets verified), tooling adapters, Firebase policy, exact pins, Production channel, typecheck, app and workspace tests, the reviewed Expo doctor and strict specs.

## #1068

Proposal head `d5f02eb48308456b36c6ef993648d627b1a7bcaa`. The proposal installs Expo 58.0.22 but leaves the guarded internal resolutions at their 58.0.19 levels. The resolutions now follow the lowest published versions that satisfy every installed dependent, computed to a fixed point: modules core 58.0.29, CLI 58.1.18, Metro config 58.0.20, dev launcher 58.0.18, dev menu 58.0.12, autolinking 58.0.16, asset 58.0.19, modules JSI 58.0.21, file system 58.0.13, config 58.0.10, config plugins 58.0.11, image utils 0.12.6, inline modules 0.2.8, local build cache 58.0.10, prebuild config 58.0.18, require utils 58.0.5, router server 58.0.20, Babel preset 58.0.23 and the React Native 0.88.1 internals.

Of the guarded sources in upgraded packages, 16 changed and were compared with the previously installed bytes; the rest are byte-identical, and React Native's three guards and the Reanimated patch are unchanged. The Android compile-only pin moves to `io.github.expo:expo-modules-v2-compiler-plugin:0.2.7-2.4.20`, SHA-256 `20d6e9896a8f028436ae7a0badf89639960efd903ba2ebeea524e8e7e3a0ac37`, matching Maven Central's published SHA-1. The reviewed Expo and React Native deviations move to 58.0.22 and 0.88.1; eight Expo modules now carry newer-patch recommendations, which the doctor accepts. Android prebuild produced no further changes.
