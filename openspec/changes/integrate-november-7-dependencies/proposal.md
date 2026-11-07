# Proposal

## Why

Nine Dependabot PRs are open, and every one fails required CI. The shared failure is the online Expo check: Expo now recommends `react-native-safe-area-context` ~5.11.1, which rejects the reviewed 5.10.1 and the proposed 5.11.0, so main fails too. Several proposals also need reviewed native guards, policies or adapters before they can pass.

## What Changes

Fix and merge the PRs one at a time, each on its own branch:

- #1059 first: Safe Area 5.11.1, Screens 4.30.1, Purchases 11.0.0 and Google Sign-In 17.0.0 through its upstream SwiftPM path. It retires the three 16.1.5 patches and the application-target link plugin, and keeps an exact Apple SDK 10.1.0 requirement. Runtime/build becomes 1.8.31/113, which later native PRs share.
- Then #1068 (Expo 58.0.22 / React Native 0.88.1), #1058 (Sentry 8.33.0), #1055 (Worklets 0.13.1) and #1071 (Babel 8.1.0, ESLint 10.14.0, expo-doctor 1.21.6; it supersedes #1066), each with its guard, policy or adapter updates.
- Then #1062, #1061 and #1069, which need only a refreshed lockfile on current main.
- Hold #1070 (Firebase JavaScript 13.2.0): RNFirebase 27.1.0 requires exactly 13.1.0, and the Firebase policy requires one aligned SDK.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency maintenance; product, privacy and entitlement requirements are unchanged. The change declares `skip_specs: true`.

## Impact

Dependency graphs, native compatibility guards, reviewed-version policies, generated native projects and tests. Each merge publishes both web sites through main CI. The Android 1.8.31/113 store release follows the last native PR. iOS publication and OTA updates are out of scope.
