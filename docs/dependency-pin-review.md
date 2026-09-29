# Dependency pin review — 29 September 2026

[Issue #921](https://github.com/kunal26das/yify/issues/921) tracks versions outside ordinary Dependabot updates. An open finding means a newer version exists; it does not establish that the replacement works with its callers. This review does not suppress findings or change automatic-merge rules.

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
| `release/package.json`: `eas-cli/minimatch` 5.1.9 | EAS 24.8.0 calls the default export as a function when matching an iOS provisioning profile's bundle identifier. Minimatch 10 exports an object with a named function. Replacing 5 with 10 makes a valid profile fail validation. | EAS changes this caller, or a separately reviewed adapter passes exact and wildcard provisioning-profile checks. |
| `tooling/package.json`: `babel7` 7.29.7 | Worklets 0.13.0 uses Babel 7 presets that assert a Babel 7 compiler. A Babel 8 replacement fails the actual transform with `Requires Babel "^7.0.0-0"`. Expo's Babel 7 syntax plugin also rejects Babel 8. The root tools already use Babel 8.0.6. | The upstream presets/plugins support Babel 8, and Worklets transforms, web exports and native builds pass together. |

Both pins are on the newest available version in their required major as of this review. They remain visible in the watcher; newer patches, majors and lookup failures are not ignored. Existing transform tests and the release consumer checks protect these compatibility requirements.

## New Expo findings

A fresh scan also finds seven packages newer than the native combination validated in [PR #927](https://github.com/kunal26das/yify/pull/927):

| Package | Validated pin | Candidate |
| --- | --- | --- |
| `@expo/cli` | 58.0.7 | 58.0.8 |
| `@expo/log-box` | 58.0.5 | 58.0.6 |
| `@expo/metro-runtime` | 58.0.7 | 58.0.8 |
| `expo-asset` | 58.0.7 | 58.0.8 |
| `expo-constants` | 58.0.7 | 58.0.8 |
| `expo-font` | 58.0.2 | 58.0.3 |
| `expo-task-manager` | 58.0.8 | 58.0.9 |

These are pending native upgrades, not completed compatibility reviews. Font 58.0.3 includes an [iOS font-registration crash fix](https://github.com/expo/expo/pull/50561). Advance the relevant direct dependencies, resolution pins and source guards together; regenerate native projects, verify Android/iOS builds and web exports, and advance the runtime if native code changes. A tools-only pin review must not silently replace this build validation.

After the six upgrades above, the live report contains nine findings: these seven Expo candidates and the two required compatibility pins. Keep #921 open until the outstanding versions are addressed. The automatic report remains authoritative for current registry versions.
