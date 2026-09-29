# Expo 58 native compatibility

The app uses Expo 58.0.0-preview.7 with React Native 0.88.0-rc.2. The SDK 57 compatibility patch payloads are removed: their native, Metro, server-rendering and Gradle fixes are included in the published SDK 58 sources. The manifest records reviewed package versions and SHA-256 source digests, including obsolete bridge files that must remain absent. It fails before applying any later patch if those sources change.

Reanimated 4.7.0 and Worklets 0.13.0 remain paired because both published compatibility tables explicitly include React Native 0.88. The SDK preview recommends Reanimated 4.6 and Worklets 0.12, whose own tables exclude React Native 0.88. The manifest also verifies the reviewed compatibility tables.

Runtime 1.8.11 also pins the reviewed transitive packages: `expo-modules-core` 58.0.8, `@expo/cli` 58.0.7, `@expo/metro-config` 58.0.5, `expo-dev-launcher` 58.0.8, and `expo-modules-autolinking` 58.0.5. Their parent packages declare ranges, so the resolutions keep a clean install on the same reviewed native sources. The direct LogBox, Metro runtime, Constants, Font and Task Manager packages also have matching resolutions, with Expo Asset 58.0.7 keeping its Constants requirement in the same cohort; this prevents nested newer native modules. React Native, its Metro config, and its JS polyfills stay on 0.88.0-rc.2 together.

Runtime 1.8.13 patches Reanimated 4.7.0's Android `NodesManager` shutdown. It serializes owned callbacks with detaching the native proxy and event/frame queues, then cancels the frame and destroys native state outside that gate. Keeping background scheduling and cancellation outside the gate avoids inversion with React Native's frame-scheduler lock. Late scheduling checks disposal again after posting. The patch is tied to exact package and source hashes; an upgrade requires another review.

The regression fixture compiles the actual Kotlin frame scheduler and Nodes manager and exercises the JNI boundary with extracted native methods. It covers active, queued and arriving callbacks, background events, draw-pass updates, reentry, idempotent disposal and lock ordering. It does not establish the cause of every historical native crash or guard every direct native callback. The related upstream report is [Reanimated issue 10279](https://github.com/software-mansion/react-native-reanimated/issues/10279).

`scripts/expo-native-compat.mjs` applies and verifies the exact patch during installation. Upstream provenance for every retired backport is recorded beside its replacement source.

Expo Android modules remain built from source and iOS uses `usePrecompiledModules: false` while validating this runtime. Gradle 9.4.1 with `android.newDsl=false` and `android.builtInKotlin=false` matches the SDK 58 preview's published template.

Run `node --test tests/expo-native-compat.test.cjs` for source guards and server-frame, shared-asset-registry and native-polyfill regressions. Android release and iOS builds plus runtime smoke tests remain required.
