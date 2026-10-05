# Expo 58 native compatibility

The app uses Expo 58.0.3 with React Native 0.88.0-rc.3. The SDK 57 compatibility patch payloads are removed: their native, Metro, server-rendering and Gradle fixes are included in the published SDK 58 sources. The manifest records reviewed package versions and SHA-256 source digests, including obsolete bridge files that must remain absent. It fails before applying any later patch if those sources change.

Reanimated 4.7.0 and Worklets 0.13.0 remain paired because both published compatibility tables explicitly include React Native 0.88. The stable SDK 58.0.3 bundle now recommends these same versions. The manifest also verifies the reviewed compatibility tables.

Runtime 1.8.14 pins the coordinated transitive packages: `expo-modules-core` 58.0.12, `expo-modules-jsi` 58.0.8, `@expo/cli` 58.1.2, `@expo/metro-config` 58.0.8, `expo-dev-launcher` 58.0.11, and `expo-modules-autolinking` 58.0.8. These versions satisfy the stable SDK's parent requirements. Matching direct-package resolutions prevent nested older native modules. React Native, its Metro config, and its JS polyfills stay on 0.88.0-rc.3 together.

The upgrade retains 39 identical guarded source files and reviews eight changes: Expo's alternate-platform factory passes development-menu configuration; CLI accepts two additional legacy asset-registry imports; Image, LogBox and UI Gradle changes are version strings; Core updates the module Gradle plugin to 0.2.2 and its publishing repository configuration. Removed legacy bridge files must remain absent. Both React Native scheduler sources are unchanged, and the Reanimated lifecycle patch retains its exact before/after hashes.

Runtime 1.8.13 patches Reanimated 4.7.0's Android `NodesManager` shutdown. It serializes owned callbacks with detaching the native proxy and event/frame queues, then cancels the frame and destroys native state outside that gate. Keeping background scheduling and cancellation outside the gate avoids inversion with React Native's frame-scheduler lock. Late scheduling checks disposal again after posting. The patch is tied to exact package and source hashes; an upgrade requires another review.

The regression fixture compiles the actual Kotlin frame scheduler and Nodes manager and exercises the JNI boundary with extracted native methods. It covers active, queued and arriving callbacks, background events, draw-pass updates, reentry, idempotent disposal and lock ordering. It does not establish the cause of every historical native crash or guard every direct native callback. The related upstream report is [Reanimated issue 10279](https://github.com/software-mansion/react-native-reanimated/issues/10279).

`scripts/expo-native-compat.mjs` applies and verifies the exact patch during installation. Upstream provenance for every retired backport is recorded beside its replacement source.

Expo Android modules remain built from source and iOS uses `usePrecompiledModules: false` while validating this runtime. Gradle 9.4.1 with `android.newDsl=false` and `android.builtInKotlin=false` is retained for the source-built SDK 58 runtime.

Run `node --test tests/expo-native-compat.test.cjs` for source guards and server-frame, shared-asset-registry and native-polyfill regressions. Android release and iOS builds plus runtime smoke tests remain required.
