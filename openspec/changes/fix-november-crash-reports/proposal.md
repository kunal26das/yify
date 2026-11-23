# Proposal

## Why

The November 23 review of Sentry, Crashlytics and Play vitals for shipped runtime 1.8.29/code 111 found two fatal application defects and one source of third-party noise:

- [YIFY-2R](https://kudos-labs.sentry.io/issues/YIFY-2R) and Crashlytics `974abf009f4f205c5ea5b99d751e30db` / `06bdf391c12da9c4cde2a00533f4cc4f`: tapping a top-bar destination crashed with "The imperative router is unavailable before the first render has finished." All five Sentry events come from Android 17 devices that recorded two activity-lifecycle bursts shortly after launch.
- [YIFY-2Z](https://kudos-labs.sentry.io/issues/YIFY-2Z) and Crashlytics `6b90b4af98d0c8810b7343cf710a0fc9`: every launch on an Android 7.1.1 tablet failed with "Cannot find native module 'ExpoApplication'".
- [YIFY-33](https://kudos-labs.sentry.io/issues/YIFY-33): a browser extension's content-script timeout was recorded as an unhandled web error and attributed to `app:///content.js`.

## What Changes

- Screens and components navigate through the router returned by `useRouter()`, which is bound to their own Expo Router tree, instead of the module-level imperative router that Expo Router resets whenever any navigation container is torn down.
- Android builds enable core library desugaring with the exact `com.android.tools:desugar_jdk_libs_nio:2.1.5` library through a new `withCoreLibraryDesugaring` config plugin, so Expo Modules v2 can resolve `java.nio.file.Path` on API 24 and 25.
- Web error reporting drops events whose original stack frames all come from browser extensions.

## Capabilities

### New Capabilities

- `app-stability`: navigation resilience to container teardown, startup on every supported Android API level, and exclusion of browser-extension failures from web error reporting.

### Modified Capabilities

None.

## Non-goals

- Upstream catalog, TMDB, AdMob, update-check, Remote Config and store failures remain reported as designed. They are recorded as environmental in the evidence; changing which persistent failures are captured is a separate monitoring-policy decision.
- The sandbox-only SoLoader launch crashes keep their recorded disposition: no in-app guard.
- No OTA is published to shipped runtimes. The desugaring change is native and ships with the next binary.

## Impact

Android native build configuration changes, so it ships in the next binary (runtime 1.8.32/code 114 prepared by the November 23 dependency integration). JavaScript navigation and web monitoring changes ship with that binary and the next web deployment. No permissions, entitlements, consent defaults or data boundaries change.
