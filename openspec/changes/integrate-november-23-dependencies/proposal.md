# Proposal

## Why

Eleven Dependabot PRs are open and every one fails required CI. GitHub moved `ubuntu-latest` to Ubuntu 26.04, which broke the animation lifecycle check on every PR; #1089 fixes that separately. Expo has also moved past the reviewed 58.0.22 set: Expo 58.0.26 is published and recommends `expo-web-browser` ~58.1.0, so the online doctor fails on main and on the proposals. Several proposals additionally need rebased native guards, the Reanimated lifecycle patch, the Worklets Babel adapter or reviewed policies before they can pass.

## What Changes

Integrate all eleven proposals in one branch, following #1053:

- #1084: take Expo's current 58.0.26 cohort instead of the proposed 58.0.25 set, including `expo-web-browser` 58.1.0, `expo-router` 58.0.32, `expo-sqlite` 58.0.18, `expo-dev-client` 58.0.21 and `@expo/ui` 58.0.29, and recompute the guarded internal resolutions to a fixed point.
- #1087: Reanimated 4.8.0 and Worklets 0.14.0, with the NodesManager callback-cleanup patch rebased and the lifecycle fixture updated for the new event-handler API and the paused-by-default Worklets frame queue.
- #1083: React Native Firebase 27.1.1. Firebase JavaScript stays at 13.1.0 because 27.1.1 still requires exactly 13.1.0 and the Firebase policy requires one aligned SDK.
- #1074 Sentry 8.34.0, #1075 Gesture Handler 3.5.0 and Purchases 11.0.1, #1077 RevenueCat web 1.74.0, #1076 desktop Electron 45.2.3, #1081 node-forge 1.4.3, #1086 Babel 8.1.2, ESLint 10.15.0 and expo-doctor 1.21.8, #1085 EAS CLI 27.9.0 and release-console Electron 45.3.1, and #1088 the setup-java and create-github-app-token actions.
- Advance runtime and build to 1.8.32/114. Build 1.8.31/113 was never submitted and is superseded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency maintenance; product, privacy and entitlement requirements are unchanged. The change declares `skip_specs: true`.

## Impact

Dependency graphs, native compatibility guards, the Reanimated patch and its fixture, the Worklets adapter, reviewed-version policies, generated native projects and tests. Merging publishes both web sites through main CI. The Android 1.8.32/114 store release follows the merge. iOS publication and OTA updates are out of scope.
