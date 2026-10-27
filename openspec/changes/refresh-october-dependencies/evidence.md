# Dependency maintenance evidence

## Scope and provenance

Starting main: `d686275337a6ec3020f5c7cec639edd7c0c11357`. The integration preserves the direct updates proposed by these exact PR heads, with the additional pins needed for a coherent installed graph:

| PR | Reviewed proposal head | Direct changes |
| --- | --- | --- |
| #1043 | `5233cf25961d8f8ed76837aae4200579e5090a04` | Sentry 8.32.0 |
| #1044 | `0243e2237edd2700b4bbc12a7a627244bf859e75` | In-app updates 0.13.0, Ads 17.4.0, Purchases 10.15.1 |
| #1045 | `76548fb2fad35fd0706f09727e8b7d2ed49fa42a` | Electron 45.0.0, builder 26.18.0 |
| #1046 | `e266901a4914b9b4260c85f8e906bf1e60475337` | jose 6.2.13 and its regenerated transitive graph |
| #1047 | `33d7d76df158ad991d0e59e22bbf033e222147d7` | RevenueCat JS 1.73.1, Firebase JS 13.1.0 |
| #1050 | `f3b16a27cb01df0e8fe9b5ab4482a84f2304cc30` | All five RNFirebase modules 27.1.0 |
| #1051 | `c942703e9bef69ea5f6034c85fd6d97c9885293e` | Root and tooling Babel 8.0.9 |
| #1052 | `91bddfb4b0ba3205d2d8aa964e4d3a53ff85357f` | Expo 58.0.19 and 17 companion updates |

RNFirebase's published metadata requires Firebase JavaScript 13.1.0, Android BoM 35.0.2 and Apple SDK 13.1.1. The compatibility policy retains minimum Android API 24, Kotlin 2.4.20, Google Sign-In Apple 10.1.0 and every existing collection/crash default. Runtime/build 1.8.30/112 separates the new native graph from previously published binaries. The shipped-runtime ledger is unchanged.

## Root causes and corrections

The clean-checkout regression assumed the first rejected concurrent filesystem read would name the Firebase app package. CI instead reported the missing auth package. The assertion now accepts only the seven actual required SDK metadata paths, with the exact ENOENT diagnostic; installed-graph validation remains mandatory.

The Sentry fixture now loads the installed UI profiling integration with a native boundary that fails on use. It verifies default exclusion, both current and deprecated explicit profiling options, and exclusion when native integrations are disabled. Existing replay, Hermes profiling, screenshots, view hierarchy and consent-withdrawal controls remain covered.

The installed RevenueCat 19.14.1 error enum adds documented numeric values 36 through 41. Sanitization admits exactly 0–26 and 28–42; 27, 43, arbitrary values, wrong types and private billing payloads remain rejected. Firebase JavaScript and native packages are now grouped together for future Dependabot proposals. Automatic merge allowlists and permissions are unchanged.

Expo config-plugins 58.0.10 requires Xcode parser 4.0.0, which uses Node's cryptographic UUID generator and removes its UUID dependency. The obsolete scoped UUID override was replaced with an exact Xcode 4.0.0 pin. The real parser test preserves 32 unique groups and their references through serialization and reparsing.

## Native source review

The version/hash source guard still checks 97 unmodified sources and four patched outputs. All four actual compatibility patches are unchanged. Fourteen upgraded Expo package versions cover 83 guarded source entries; 15 contents changed and were compared with old pristine archives and integrity-verified new published tarballs. The private source-audit receipt SHA256 is `27e8d4cdf9c45161b8da919b6f88b8ef3ebe5988b2cc774fce20e2e00f479874`.

Reviewed deltas include version declarations, coordinated bundled recommendations, dynamic SwiftPM dependency recording, SwiftUI appearance/safe-area propagation, inherited class registration, JSI native memory accounting and complete buffer writes, chunked arrays, frozen-state cleanup, and Router nested POP_TO behavior. Existing runtime/lifecycle, deep-link, splash, background-location and source-patch guards remain enforced. The application's Kotlin compiler pin is distinct from bundled Gradle-plugin build declarations; compiler artifact verification remains required.

## Verification

- A full install without prior node_modules or yarn.lock succeeded; all 101 native source checks, three tooling patches and the aligned Firebase policy passed. The former installation was preserved outside the checkout during verification.
- Frozen installation passed without changing the new lockfile; all native/tooling patches were already applied and verified.
- Focused consent/privacy/clean-checkout tests: 32 passed. Compatibility/doctor policy tests: 120 passed. Follow-up Xcode, native metadata, QA prerequisites and grouping checks: 28 passed.
- Both Hosting and Pages exports rendered and passed catalog/server-only data isolation checks.
- Release console: typecheck, 151 tests and build passed.
- Full application tests: 2,463 passed, one pre-existing signed-artifact-dependent test skipped. Crash-reporting workspace: 51 passed. Typechecks and targeted ESLint passed; 390 automation tests passed.
- Strict active and archived OpenSpec validation, doctor and team policy checks passed.

iOS pods and SwiftPM resolution completed with Firebase 13.1.1, Google Sign-In 10.1.0, AppCheck 12.0.0, GoogleUtilities 8.1.5 and Sentry Cocoa 9.31.0. Native regeneration preserves the existing privacy manifest and phase order. SDK-only JSI simulator prewarming is distinct from compiling or launching the app.

Exact-commit independent review, cloud native compilation, automatic publication receipts and final cleanup are recorded below when completed. Compilation does not prove installed-device startup, live purchases/ads, production crash delivery or store availability. No new Android store or OTA release is claimed by this maintenance merge.
