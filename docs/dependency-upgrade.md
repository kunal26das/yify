# Dependency upgrade: 1.8.6 (88)

The native projects must be regenerated and rebuilt together with these JavaScript dependency changes. The runtime version advances to 1.8.6 so an older installed binary cannot accept an incompatible OTA update.

## Package and maintenance updates

The app updates React Native to 0.86.3, Firebase wrappers to 26.4.0, Google Mobile Ads to 17.1.0, RevenueCat Purchases to 10.10.1, Expo vector icons to 15.1.1, Electron to 44.4.5 and the TypeScript import resolver to 4.4.5. Expo remains on stable SDK 57.0.24; root TypeScript 6 and ESLint 9 remain within the supported peer dependency ranges.

The release console updates EAS CLI to 24.7.0, Ink to 7, React to 19.3.0, TypeScript to 7.0.2 and tsx to 4.23.15. Dependency checks now enforce exact version pins. [Dependency automation](dependency-automation.md) covers the application, release console, GitHub Actions and pinned-dependency reporting.

## Supported build baseline

Expo 57.0.24 and React Native 0.86.3 select Android API 36 for compilation and targeting, Build Tools 36.0.0, Android Gradle Plugin 8.12.0, Gradle 9.3.1, Kotlin 2.1.20 and NDK 27.1.12297006. Keep Java 17. The Android run scripts now verify the compiler version before accepting a configured JDK or an Android Studio installation.

These toolchain versions are deliberate compatibility constraints. Updating each tool independently to its vendor's newest release does not produce a supported Expo 57 build. In particular, Expo's and React Native 0.86's Gradle plugins use Kotlin 2.1.20; newer Gradle distributions introduce incompatible Kotlin metadata. See the [Expo report](https://github.com/expo/expo/issues/49550).

The supported device minimums remain Android API 24 and iOS 16.4. These minimums determine which devices can install the app; they are separate from compile and target SDK versions. Expo 57 requires Xcode 26.4 or newer. See the [Expo SDK compatibility table](https://docs.expo.dev/versions/latest/).

## Native integration changes

- React Native Firebase 26 defaults to Swift Package Manager on recent React Native versions. This app keeps static framework linkage and explicitly selects CocoaPods with the Firebase app plugin's `ios.disableSPM` option. RNFB documents that SPM requires dynamic linkage and rejects static linkage. See [RNFB iOS SPM support](https://rnfirebase.io/ios-spm).
- The ads wrapper uses `RNGMA_ANDROID_BACKEND=classic`, emitted through the existing Gradle properties plugin. This selects the existing Android SDK backend explicitly and avoids the wrapper's configuration failure when it cannot find a legacy top-level ads object in Expo's app configuration.
- The Google Services Gradle plugin follows React Native Firebase's recommended 4.5.0 through a config plugin. Expo's earlier 4.4.4 insertion otherwise prevents RNFB's plugin from applying its recommended version. The Crashlytics Gradle plugin updates to 3.0.8 through RNFB's own plugin.
- The Expo build-properties plugin enables UIKit scene support, required for apps linked with the iOS 27 SDK. This keeps lifecycle generation in the supported Expo 57 plugin. See [Expo build properties](https://docs.expo.dev/versions/latest/sdk/build-properties/).

## Rebuild procedure

Install the exact dependency versions from the lockfile, then regenerate native sources with `expo prebuild --clean --no-install`. Restore ignored local Android signing configuration after a clean prebuild when making a release build. Install iOS pods, refreshing CocoaPods metadata if a newly pinned pod is missing. Build both platforms before publishing any update for runtime 1.8.6.

Store submission, production deployment and purchase/account smoke tests are separate from local compilation.

The regenerated iOS lockfile resolves Firebase 12.18.0, Google Mobile Ads 13.6.0, PurchasesHybridCommon 19.2.0 and RevenueCat 5.90.1. These follow the selected React Native wrappers' dependency constraints. Sentry Cocoa remains 9.29.0. Native vendor releases newer than these constraints require a separate compatibility review rather than overriding the wrappers during this upgrade.

## Deferred animation upgrade

Reanimated 4.7.0 and Worklets 0.13.0 were evaluated together. Web server rendering failed in Worklets' `flushUIQueue` because `requestAnimationFrame` is unavailable on the server. Inspection of the published Worklets 0.12.2 source found the same missing fallback; a second export was not attempted with that version. The app therefore retains the proven Reanimated 4.5.5 / Worklets 0.11.4 pair. Revisit the upgrade after a compatible upstream fix, and verify both static web and hosting exports alongside Android and iOS builds.

## Remaining transitive advisory

[GHSA-vcc3-ghjq-m6fr](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr) remains open: Expo Router 57.0.22 depends on query-string 7.1.3, which uses decode-uri-component 0.2.2. Malformed percent-encoded input can cause excessive CPU usage. The patched decoder 0.5.0 and query-string 9.5.1 use ESM default exports, incompatible with the current consumers' CommonJS imports. No compatible upstream patch is published for this dependency chain; forcing either version would break URL handling.

Expo Router's configured incoming-link parser uses URL.searchParams rather than the affected decoder. A focused check with malformed query input confirmed that this parser does not call the decoder. The vendored React Navigation fallback still calls query-string.parse, so the vulnerable dependency has not been eliminated. Keep the advisory open until a compatible upstream update or separately tested migration removes it.

The release console's adm-zip and joi updates address the affected ranges behind four other open alerts. Their resolved status should be verified after these lockfile changes reach the default branch.

## Validation

- App and crash-reporting workspace tests: 1,461 passed, including dependency automation coverage. Release-console tests: 111 passed, including the EAS 24 build-receipt format. Lockfile integrity checks passed.
- Static web and hosting exports passed. Ten desktop and mobile browser checks passed without crashes or horizontal overflow.
- Android arm64 debug build passed. The final arm64 release build passed in 12 minutes 33 seconds with Google Services 4.5.0, including Hermes bundling, R8 optimization and APK packaging. Local debug signing was used; Sentry uploads were disabled and Crashlytics upload tasks were excluded.
- iOS arm64 simulator Debug build passed with Xcode 27 and the iOS 27 SDK, with code signing disabled. The built app reports version 1.8.6, build 88, minimum iOS 16.4 and the generated scene manifest. The installed pods manifest matches Podfile.lock.
- Google Services plugin tests cover version selection, idempotency, alternate quoting and explicit failure for missing or duplicated anchors and unsupported Gradle syntax. Android Java selection was checked with an unset Java home, a valid JDK 17 and Android Studio's unsupported JDK.

These checks validate compilation and local web behavior. Native sign-in, purchases and store distribution still require their normal device and release checks.
