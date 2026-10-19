# Evidence

## Starting state, 19 October 2026

Main: `25a90f32150cafce822137e7e586ab5d7b86ca0f`. Release-console updates #1016, #1018 and #1017 merged automatically overnight. Their merged manifests and lockfile are retained.

Open PR heads inspected:

| PR | Update | Reviewed head |
| --- | --- | --- |
| #1011 | React, React DOM and test renderer 19.3.1 | `1930741db382dfe7ad42041d411097ccd48e926a` |
| #1012 | Sentry React Native 8.31.0 | `4a2ef11ce834196354997166bafb39215cfa2e95` |
| #1013 | Native RevenueCat 10.14.0 | `49beffeb58d0d9b49816883c69d343bb7da12a0e` |
| #1014 | Root Electron 44.7.2 | `4eb8e7f11c5f2ab8092827fa45947188832113c2` |
| #1015 | Web RevenueCat 1.71.0 | `01fba42bce4d7e38d714cef7ef19952ddeaac0af` |
| #1019 | actions/setup-java 6.1.0 | `e5ca1e6b2c4ac8ab74fb3c823ae4e71b26e0a5f9` |

CI runs 39181546116 and 39181597218 passed typecheck and app/workspace tests, but rejected unreviewed React and Sentry versions in the explicit Expo policy. #1013–#1015 and #1019 normal CI passed. Compile-only run 39184298091 installed Java 17 successfully, then failed at prerequisite validation before Gradle. The audited toolchain drifted behind the root manifest. Maintenance run 39184645771 correctly rejected #1015's broad transitive build-tool drift. Main protection is strict and requires app, release-console and rendered-export checks. No protection bypass is planned.

## Primary-source review

- [React 19.3.1 diff](https://github.com/react/react/compare/v19.3.0...v19.3.1): Flight/server-stream patch; native reconciler unchanged. React Native 0.88 accepts React `^19.3.0`. Embedded renderer metadata alone does not prove incompatibility; device startup remains a separate check.
- [Sentry 8.31 diff](https://github.com/getsentry/sentry-react-native/compare/8.30.0...8.31.0): Android 8.61.0, Cocoa 9.30.2, native profiling cleanup and iOS source-map phase environment changes require a fresh native runtime. New feedback behavior is exercised without enabling replay or profiling.
- [RevenueCat native diff](https://github.com/RevenueCat/react-native-purchases/compare/10.13.0...10.14.0): hybrid-common bridge changes require native regeneration; no real purchases are used for validation.
- [RevenueCat web 1.71.0](https://github.com/RevenueCat/purchases-js/releases/tag/1.71.0): localization, price display, downgrade and sandbox-key fixes.
- [Electron 44.7.2](https://github.com/electron/electron/releases/tag/v44.7.2): macOS fixes and Chromium/V8 security backports.
- [setup-java 6.1.0](https://github.com/actions/setup-java/releases/tag/v6.1.0): pin `b843ebf9b913146b38da2eaa7aeddf76074ae1ad` in both existing Java workflows.

## Local validation

Node 24.19.0 and Yarn 1.22.22. A fresh install without the old root lockfile succeeded, including version-checked native/tooling postinstall guards. The previous tree and lockfile were preserved outside the checkout. Exact dependency-pin validation, typecheck and online Expo doctor passed with the existing explicitly reviewed deviations.

Expo regenerated both native projects and CocoaPods installation succeeded. Production update-channel verification passed. Native diffs include version metadata, Sentry's environment-aware symbol-upload phase, RevenueCat hybrid-common 19.12.0 and GoogleUtilities 8.1.5. The ignored local Xcode environment file was preserved. No native source was hand-edited.

Both Hosting and Pages exports passed the existing rendering and catalog-isolation checks. OpenSpec doctor and strict active/archived validation passed. Installed-Sentry consent/privacy checks passed 31/31, and Android prerequisite regressions passed 19/19. The final full app suite passed 2,360 tests with one intentional skip; crash-reporting workspace passed 51/51. Release-console frozen install, typecheck, 150/150 tests and build passed without tracked release changes. CI and exact-source native compilation remain pending.

Semantic lockfile review found 56 changed package names: 54 already occur across the original npm PRs; the fresh resolution additionally updates Browserslist and core-js-compat. Material inherited tool changes include Expo schema-utils/xcpretty, noxcturnal/Oxc optional binaries and TypeScript ESLint packages. These are explicitly part of the integration checks, not evidence of pure-JavaScript auto-merge eligibility. Native RevenueCat's hybrid mappings retain a transitive purchases-js 1.70.0 alongside the root's deliberate 1.71.0; both are reachable dependency records, not an orphaned resolution.

## Team and limits

Lead owns manifests, lockfile, generated native files, OpenSpec, merge and delivery. Bounded specialists reviewed automation and native dependencies and implemented non-overlapping QA and Sentry test fixes. Requested models: Sol/high for automation and preflight, Sol/medium for compile audit, Astra/high for SDK review. Effective runtime model/effort are not independently exposed. No specialist is authorized to publish or change production configuration. Final independent candidate review remains pending.

SDK tests mock native boundaries and transport. Compile-only artifacts are not production signed-device or store evidence. This batch does not publish a new Android store binary, iOS release or incompatible OTA.
