# Design

## Navigation after container teardown

Expo Router 58 exposes one module-level `router`. `ImperativeRoutingQueueBridge`, rendered inside every `BaseNavigationContainer`, binds it in a layout effect and, in that effect's cleanup, unconditionally assigns `unboundRouter`, whose methods throw "The imperative router is unavailable before the first render has finished." The cleanup does not check whether another container is still bound. When a React surface for a previous activity instance is torn down after a newer surface has mounted, or when the container's own Suspense boundary hides mounted content, the global router stays unbound while the visible screen is fully rendered. Every YIFY-2R event is an Android 17 launch with two activity-lifecycle bursts about one second apart before the crashing tap; the precise platform trigger for the second surface is not observable because breadcrumb data is scrubbed.

`useRouter()` builds the same imperative API from the `RoutingQueue` context of the component's own tree. Its intents are queued to the container that owns the component and drained there, independent of the global binding. Every screen and component in `app/` and `presentation/` now uses it, including the native notification-open handler, which receives the router from `AppShell`. The web notification service in `data/` runs outside React and keeps the global router; web has a single document surface.

A behavioural test reproduces the incident: with the global router throwing Expo Router's exact error, top-bar destination navigation must push, dismiss to an existing route and update parameters through the scoped router. A source test rejects reintroducing the global `router` import in screens and components. Both fail against the previous source.

## Android 7.x startup

On an isolated API 25 arm64 emulator, the exact 1.8.29/code 111 production bundle logs `Cannot install Expo Modules v2: java.lang.NoClassDefFoundError: Failed resolution of: Ljava/nio/file/Path;` from `io.github.expo.modules.v2.types.TypeConverterRegistry.<clinit>` while registering `ApplicationModule`, then the first `requireNativeModule('ExpoApplication')` throws. `java.nio.file` exists only from API 26, so the whole v2 registry fails on every API 24 and 25 device. The Expo Modules v2 React artifacts 0.2.8 and 0.3.0 contain the same class-literal reference, so no upstream version removes it.

Android core library desugaring with the NIO specification rewrites `java.nio.file` references in app and library bytecode to the bundled `j$` implementation for this minSdk-24 app. The v2 native library's JNI surface references only `java.lang`, `java.util` and `java.nio.ByteBuffer`, which desugaring does not rename, so the reviewed JNI contract is unaffected. Raising `minSdkVersion` to 26 was rejected: Expo SDK 58 supports API 24, and it would strand affected users on a binary that cannot start.

`withCoreLibraryDesugaring` follows the existing `withHsdpVersion` pattern: Groovy only, exactly one `android` and one `dependencies` block, idempotent when the exact configuration is present in any position, and fail-closed for any other desugaring declaration or pre-existing compile options. The tracked Android project is regenerated from the plugin.

## Browser extension errors

The SDK rewrites stack-frame URLs to `app:///` before `beforeSend`, so the event alone cannot distinguish an extension's `content.js` from the app. The web `beforeSend` now inspects the original error's stack in the hint and drops the event only when it contains at least one URL and every URL uses a browser-extension scheme. Application, mixed, frameless and native events follow the unchanged sanitization and Crashlytics mirroring path.

## Triage of remaining reports

- Catalog and TMDB `http_429`/`http_5xx`, `network_error` and web `request_failed` events are upstream or transport conditions. The 848 `http_502` and all 85 `http_429` events fall within the same 2026-11-03 15:10 to 2026-11-04 04:21 UTC outage of the configured catalog host; tests deliberately keep persistent failures visible after one bounded retry, so the capture policy is unchanged.
- AdMob `internal_error` with zero adapters, update-check `UpdateFailedToLoad`, Remote Config initialization, RevenueCat `store_problem`/`configuration` (one event from a region where Play Billing is unavailable) and a single token-refresh failure are environmental and low volume; their existing classification is retained.
- Crashlytics SoLoader issues `cd6b3acd29ec90faaa72eca18d6fd238`, `6594f4da6779522bbf82a41d86272b58` and `4e6ae7e56faac7e62433cef75dc3fba2` match the previously documented sandbox templates: different models report byte-identical device totals of 33,029,513,216 B RAM and 53,665,050,624 B storage, or the 2,061,844,480 B / 6,228,115,456 B "Pixel 8 Pro" template. No real handset is affected, so no guard is added.
- Play vitals reports one `nativePollOnce` input-dispatch ANR on an Honor Pad X8a with no report text; the main thread was idle in its message loop.

## Validation and rollback

Typecheck, full app and workspace tests, the new navigation and plugin tests, prebuild regeneration, both web exports and an API 25 launch of a locally built desugared release APK verify the change. Roll back the navigation or monitoring change by reverting its commit through reviewed CI. Removing desugaring requires a new binary and would restore the API 24–25 launch failure.
