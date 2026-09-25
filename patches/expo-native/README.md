# Expo 58 native compatibility

The app uses Expo 58.0.0-preview.6 with React Native 0.88.0-rc.1. The SDK 57 compatibility patch payloads are removed: their native, Metro, server-rendering and Gradle fixes are included in the published SDK 58 sources. The manifest records reviewed package versions and SHA-256 source digests, including obsolete bridge files that must remain absent. It fails before applying any later patch if those sources change.

Reanimated 4.7.0 and Worklets 0.13.0 remain paired because both published compatibility tables explicitly include React Native 0.88. The SDK preview recommends Reanimated 4.6 and Worklets 0.12, whose own tables exclude React Native 0.88. The manifest also verifies the reviewed compatibility tables.

The current manifest applies no package source modifications. `scripts/expo-native-compat.mjs` retains strict patch support for independently reviewed future fixes. Upstream provenance for every retired backport is recorded beside its replacement source.

Expo Android modules remain built from source and iOS uses `usePrecompiledModules: false` while validating this runtime. Gradle 9.4.1 with `android.newDsl=false` and `android.builtInKotlin=false` matches the SDK 58 preview's published template.

Run `node --test tests/expo-native-compat.test.cjs` for source guards and server-frame, shared-asset-registry and native-polyfill regressions. Android release and iOS builds plus runtime smoke tests remain required.
