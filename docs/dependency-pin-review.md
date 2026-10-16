# Dependency pin review — 6 October 2026

[Issue #921](https://github.com/kunal26das/yify/issues/921) tracks versions outside ordinary Dependabot updates. The Expo findings in its previous report were resolved in [PR #941](https://github.com/kunal26das/yify/pull/941). The two remaining older majors are required compatibility pins, reviewed again against the installed dependencies below. Automatic-merge rules remain unchanged.

## Updated pins

| Scope | Package | Previous | Reviewed replacement |
| --- | --- | --- | --- |
| App build tools | Xcode's UUID | 11.1.1 | 14.0.2 |
| Release console | UUID | 11.1.1 | 14.0.2 |
| Release console | Nano ID | 3.3.19 | 6.0.1 |
| Release console | Joi | 17.13.8 | 18.2.9 |
| Release console | diff | 8.0.4 | 9.0.0 |
| Release console | protobufjs | 7.6.6 | 8.8.0 |

Both installations use Node 24.19.0. UUID and Nano ID now publish ES modules, which this Node version can load from the existing synchronous CommonJS callers. Retaining their old majors solely because the callers use `require()` is unnecessary. The Xcode consumer uses `v4()` without arguments; EAS uses Nano ID for generated credential and artifact names. See [Node's module interoperability](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require) and [UUID's migration notes](https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md).

Joi's major update raises its Node requirement. Compatibility checks exercise the actual EAS configuration, credentials, environment and build-job schemas, including rejected input and coercion. diff checks exercise EAS's readable source diff. See [Joi 18 release notes](https://github.com/hapijs/joi/issues/2926) and [diff release notes](https://github.com/kpdecker/jsdiff/blob/master/release-notes.md).

protobufjs 8 changes proto3 default-scalar encoding. It is not byte-for-byte interchangeable with 7. The sole declared consumer in the release installation is Centrifuge 5.7.1, whose published protobuf runtime is bundled; EAS loads its JSON entry point. Updating the installed override does not replace that bundled codec or change the protocol EAS uses. A future consumer or transport change needs another protocol review.

Both lockfiles are regenerated from clean installations and committed. The root lockfile changes only UUID, a host tool used to generate Xcode project identifiers. It introduces no native library change and does not advance the app's runtime version.

Validation includes the app and crash-reporting tests, typechecks, exact-pin checks, the online Expo doctor with existing reviewed deviations, and all release-console tests and its build. Regression coverage exercises actual EAS consumers and Xcode project parse/write round trips. Android and iOS project generation succeeds with UUID 14. The installed EAS CLI also resolves the real Android production configuration. No store build or OTA is required for these host-tool changes.

## Required compatibility pins

| Pin | Why it remains | When to revisit |
| --- | --- | --- |
| `release/package.json`: `eas-cli/minimatch` 5.1.9 | EAS 24.9.0 calls the default export as a function when matching an iOS provisioning profile's bundle identifier. Minimatch 10 exports an object with a named function. Replacing 5 with 10 makes a valid profile fail validation. | EAS changes this caller, or a separately reviewed adapter passes exact and wildcard provisioning-profile checks. |
| `tooling/package.json`: `babel7` 7.29.7 | Worklets 0.13.0 uses Babel 7 presets that assert a Babel 7 compiler. A Babel 8 replacement fails the actual transform with `Requires Babel "^7.0.0-0"`. Expo's Babel 7 syntax plugin also rejects Babel 8. The root tools already use Babel 8.0.7. | The upstream presets/plugins support Babel 8, and Worklets transforms, web exports and native builds pass together. |

The reviewed registry candidates are minimatch 10.2.6 and Babel 8.0.7; the retained compatible-major pins are 5.1.9 and 7.29.7 respectively. Nine release compatibility tests and ten tooling tests pass against the installed 1.8.14 dependencies. Replacing the Worklets compiler with Babel 8 in an isolated in-memory probe still reproduces the Babel 7 version assertion. Later Babel 7 releases require a separate pin review.

The watcher reads `scripts/dependency-pin-reviews.json`. A review applies only when the manifest, selector, package, pinned version, all three reported registry versions and every recorded consumer version match exactly. Matching rows remain visible as `compatible-reviewed`, with the reason and this evidence. A new release, a compatible-major patch, a changed consumer or a changed pin requires another review. Missing or malformed review data and failed registry lookups keep the issue open. This is not a range exclusion or a claim that an older major is universally safe.

## Resolved Expo findings

The 1.8.14 upgrade in PR #941 resolved all eleven Expo findings from the previous issue report:

| Package | Previous pin | Validated replacement |
| --- | --- | --- |
| `@expo/cli` | 58.0.7 | 58.1.2 |
| `@expo/log-box` | 58.0.5 | 58.0.9 |
| `@expo/metro-config` | 58.0.5 | 58.0.8 |
| `@expo/metro-runtime` | 58.0.7 | 58.0.11 |
| `expo-asset` | 58.0.7 | 58.0.11 |
| `expo-constants` | 58.0.7 | 58.0.9 |
| `expo-dev-launcher` | 58.0.8 | 58.0.11 |
| `expo-font` | 58.0.2 | 58.0.6 |
| `expo-modules-autolinking` | 58.0.5 | 58.0.8 |
| `expo-modules-core` | 58.0.8 | 58.0.12 |
| `expo-task-manager` | 58.0.8 | 58.0.11 |

Direct dependencies, resolution pins and source guards advanced together, both lockfiles were regenerated and committed, and native projects were regenerated. Validation covered 1,999 tests, the exact-pin checker, Expo doctor, both web exports, a signed Android build with device smoke checks, and an unsigned iOS simulator build. Runtime 1.8.14 / Android build 96 was submitted to Google Play. The obsolete query-string override was removed because the updated Expo Router no longer uses it.

## Expo 58.0.5 tooling review

Runtime 1.8.16 updates Expo to 58.0.5 while retaining Worklets 0.13.0 and the Babel 7 compatibility alias. The installed tooling compatibility test passes an actual native Worklets transform through Babel 7 and confirms Babel 8 still compiles the mocked TypeScript and JSX fixtures. The dependency-watch tests also accept the updated, exact Expo consumer version. This evidence supports the tooling alias only; Android and iOS native builds remain separate release gates for the new runtime.

## Babel 8.0.7 review — 12 October 2026

[Babel's 8.0.7 release notes](https://github.com/babel/babel/releases/tag/v8.0.7) list compiler core, parser, helper and transform fixes, with no listed change to the TypeScript preset. This app retains the separate Babel 7 compiler for Expo and Worklets; Babel 8.0.7 compiles mocked TypeScript, TSX and CommonJS fixtures. On the exact PR dependency tree, a frozen install, app and crash-reporting typechecks, full tests and the online Expo doctor pass with the reviewed 8.0.7 deviation. The tooling test also verifies the native Worklets transform still runs through Babel 7. This is a build-tool update and does not change the app's native runtime.

The tracking issue can close when a fresh scan has no unreviewed findings or incomplete checks. Future findings reopen the same issue; registry version checks remain enabled for every pin.

## EAS 24.13.0 review — 16 October 2026

PR #1003 updates the release console to EAS CLI 24.13.0, Nano ID 6.0.2, protobufjs 8.8.1 and UUID 14.0.3. A frozen install, typecheck, all 150 release-console tests, build and exact-pin checks pass. The nine EAS compatibility tests exercise the installed consumers, including provisioning-profile matching and configuration schemas.

EAS 24.13.0 still calls the default minimatch export as a function. Keep the exact 5.1.9 override; version 10.2.6 exports an object and is not a compatible replacement. The watcher review now records the actual EAS consumer version, so subsequent consumer or registry changes trigger another review. These release-tool changes do not alter the mobile runtime.

## 16 October 2026 coordinated review

The fresh registry scan found 40 unreviewed pins, including newer Expo patches beyond the old issue snapshot. Runtime 1.8.24 aligns Expo 58.0.12 and its current SDK 58 modules with stable React Native 0.88.0 and Screens 4.30.0. Three React Native guarded files are byte-identical to rc.4; the published React Native runtime changes are version metadata and AssetRegistry type declarations. The matching Metro, polyfill, codegen and Gradle plugin packages change metadata only.

The Expo audit checks 61 source guards against integrity-verified npm archives: 13 changed and 48 identical or absent. Metro now resolves the public setup entry before native-host and legacy fallbacks; regression coverage exercises all three. Expo Core and JSI coordinate Swift noncopyable JavaScript values and ownership. Android UI advances Compose and Material3 while retaining old DatePicker color aliases. These native changes require fresh binaries and build verification; the Reanimated lifecycle patch remains unchanged.

Root override patches include UUID 14.0.3 (package metadata only), Material Symbols 0.4.50 (existing font updates plus additive filled fonts), Electron/Chromium mapping data 1.5.458, regexpu-core 6.5.3 and regjsparser 0.13.4. The Babel regexp helper remains on its current compatible major at 7.29.10: 8.0.7 requires Babel 8 and its ESM/peer dependency changes are incompatible with the shared Babel 7 path. Expo 58.0.12 and Worklets 0.13.0 still use the pinned Babel 7 adapter. Eleven installed tooling/Xcode tests and two Babel 7 Unicode-regex equivalence probes pass. Exact candidate and consumer records remain in the watcher policy. Native builds and full export results are recorded with the October 16 integration change.
