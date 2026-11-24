# Proposal

## Why

Seven Dependabot PRs opened on November 24. #1099 (Purchases 11.0.4), #1101 (Electron 45.4.1), #1102 (jose 6.2.18) and #1103 (RevenueCat web 1.78.0) pass required CI. #1098 (Sentry 8.36.0) and #1100 (Babel 8.1.3) fail only the reviewed Expo dependency check, and #1098 also changes the generated Android project. #1097 (Firebase JavaScript 13.4.0) fails the Firebase compatibility policy because React Native Firebase 27.1.1, still the latest release, depends on exactly Firebase JavaScript 13.1.0. Every proposal is based on `fc1ea8a`, before #1104, and branch protection requires an up-to-date head.

## What Changes

Integrate six proposals in one branch, following #1053 and #1090:

- #1098: Sentry React Native 8.36.0, with Android SDK 8.64.0, Cocoa 9.35.0 and Sentry Android Gradle plugin 6.27.0 in the regenerated Android project, and a reviewed Expo dependency entry.
- #1099: React Native Purchases 11.0.4 with purchases-hybrid-common 20.10.0.
- #1100: Babel 8.1.3 and its CommonJS modules transform, with a reviewed Expo dependency entry.
- #1101 Electron 45.4.1, #1102 jose 6.2.18 and #1103 RevenueCat web 1.78.0.
- A test pins that touch breadcrumbs, which Sentry 8.35.0 restores on the React Native 0.88 New Architecture, keep only their category.
- Advance runtime and build to 1.8.33/115 because Sentry and Purchases change native code.

#1097 stays open: Firebase JavaScript moves only when React Native Firebase depends on it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency maintenance; product, privacy and entitlement requirements are unchanged. The change declares `skip_specs: true`.

## Impact

Dependency manifests and lockfile, reviewed Expo deviations, a monitoring privacy test and the generated native version fields. Merging deploys both web sites from main CI, including the server-side jose update and the RevenueCat web SDK. Runtime 1.8.33 has no store build or OTA in this change; Android 1.8.32/114 remains the latest submission and keeps receiving updates only from its own compatible source.
