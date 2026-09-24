# Expo 57 compatibility with React Native 0.87.1

This application retains the stable Expo 57 package line while building the requested React Native 0.87.1 runtime. Expo 57 ordinarily recommends React Native 0.86.3. These backports do not establish general upstream support for an arbitrary Expo/RN pairing; the application must pass its native release builds and runtime checks before shipping.

`node scripts/expo-native-compat.mjs` applies the reviewed changes during installation. The manifest fixes the React Native version, each affected package version, and the complete SHA-256 digest of every original and resulting file. The script validates every target and patch result before writing any changes, accepts already applied files, and rejects unknown package contents or versions. `--check` verifies that all patches are already applied. A package upgrade requires re-reviewing and regenerating its patch and hashes against the published package.

| Backport | Purpose |
| --- | --- |
| [Expo #50507](https://github.com/expo/expo/pull/50507) | Provide inert animation-frame functions only in Expo server rendering, so Worklets 0.13 imports do not schedule browser frames or throw during static exports. |
| [Expo #46641](https://github.com/expo/expo/pull/46641) | Remove legacy iOS bridge callbacks deleted from React Native 0.87's root view factory. |
| [Expo #49600](https://github.com/expo/expo/pull/49600) | Explicitly initialize Android dynamic view properties under RN's serializable-state API. |
| [Expo #48034](https://github.com/expo/expo/pull/48034) and [#48770](https://github.com/expo/expo/pull/48770) | Resolve the standalone RN JavaScript polyfills package after removal of `rn-get-polyfills`; update Metro's asset registry path. |
| [Expo #49444](https://github.com/expo/expo/pull/49444) | Keep generated assets, public RN imports, and internal relative RN imports on one registry; support both named and direct registry exports. |
| [Expo #46766](https://github.com/expo/expo/pull/46766), [#46829](https://github.com/expo/expo/pull/46829), and [#50114](https://github.com/expo/expo/pull/50114) | Register autolinking-generated Kotlin through AGP 9’s Variant Sources API, generate the inline-module provider as Kotlin, and compile that plugin against the matching AGP API. The new task file is accepted only when absent or when its exact reviewed contents are already present. |
| [Expo #46769](https://github.com/expo/expo/pull/46769) and [#46830](https://github.com/expo/expo/pull/46830) | Use the public Android library DSL after removal of library target SDK/version-name APIs, preserve the explicit built-in-Kotlin opt-out, and register publishing when the release component becomes available. |
| [Expo #47638](https://github.com/expo/expo/pull/47638) | Replace dev-launcher bridge/RedBox interception and early packager swizzling with public RN APIs. Upstream-deleted source files retain their existing license as empty compatibility placeholders so CocoaPods references remain valid; the existing protocol header retains only the React stack-frame import needed by Swift. |
| [Expo #47782](https://github.com/expo/expo/pull/47782) | Anchor iOS Expo Insights bundle completion to RN’s app-startup-end marker after removal of the separate bundle-end accessor. |
| [Expo #47256](https://github.com/expo/expo/pull/47256) | Use modern prebuilt RN header/module-map handling for source-built Expo pods and quote Swift compatibility header paths. |
| [Expo #48770](https://github.com/expo/expo/pull/48770) | Add the relocated ReactCommon include root; remove a deleted dev-launcher iOS header; retain Room constructors during shrinking; explicitly generate Android BuildConfig for affected Expo modules; upgrade the three Expo Gradle plugin Kotlin compilers to 2.2.21 so they can read Gradle 9.4.1's Kotlin 2.3 metadata. |

The patches target published npm package sources, including compiled JavaScript where that is what the package executes. New explanatory source comments from upstream are omitted; upstream references remain in this file and in the manifest.

Expo's Android modules are compiled from source using `expo.autolinking.android.buildFromSource: [".*"]`. iOS sets `expo-build-properties.ios.usePrecompiledModules: false`. Expo 57 artifacts compiled for its recommended RN version must not be reused against the changed native runtime. RN's own prebuilt core remains version-matched to the installed RN package.

The app's Gradle config plugin selects Gradle 9.4.1 and AGP 9's documented legacy DSL/Kotlin compatibility flags. This preserves Expo 57's build integration while native validation identifies any further necessary changes. It does not replace the Expo build plugins with preview SDK packages.

Run `node --test tests/expo-native-compat.test.cjs` for the guard, idempotency, SSR, asset registry, and native polyfill regressions. Android and iOS builds remain necessary to validate the native portions; these JavaScript checks do not substitute for compiling and exercising the application.
