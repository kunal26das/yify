# Design

## Context

Baseline main683a60d declares Expo58/RN0.88, Firebase26.4, static Apple frameworks and disableSPM. PR1033 only changes package/lock versions, so Expo configuration and native builds fail. Firebase27 keeps the application's used JS APIs; its Crashlytics handler is byte-identical to26.4. Existing Firebase13 web usage is already aligned. See proposal.md and private source/preflight receipts for dated evidence.

## Goals / Non-Goals

Upgrade the coherent native graph and submit one verified Android binary while preserving existing account identity, consent, revenue measurement, crash grouping and UI. Prepare iOS with a resolvable, compiled Apple graph. No redesign, new data collection, credentials/grants, real purchase, synthetic production crash, iOS publication or older-runtime OTA is included. Live provider/billing journeys require legitimate test/owner setup; unexercised paths remain explicit coverage limits.

## Decisions

- Keep all five RNFirebase modules at27.0.0, Firebase JS13 and existing modular bridge/application APIs. Add a fail-closed package/configuration check covering partial installs and reviewed optional-collection/crash settings.
- Pin Kotlin2.4.20 through expo-build-properties and the UMP buildSrc source template. The buildSrc AGP API dependency exported2.2.10 through a parent classloader despite the newer application classpath; dependencyInsight and classloader evidence reproduced the difference. Align the parent graph directly and retain the bundled React Native/Expo plugin compiler declarations. Both Pika1.1.0 and Expo V2 compiler0.2.5 publish matching2.4.20 artifacts, while2.4.21 artifacts are absent. Kotlin's supported range covers existing Gradle9.4.1 and AGP9.2.1. Compile-only QA checks loaded Kotlin/R8 and resolves all release compiler classpaths through owning-project tasks, verifying two reviewed JAR hashes and aggregating reports before app compilation. Retain Gradle project locking and compiler/JVM checks; do not use metadata-version suppression.
- Remove deprecated disableSPM and select dynamic Apple frameworks in source configuration. Regenerate tracked projects through Expo only.
- Keep wrapper16.1.5 and use Google SDK10.1.0, whose public APIs used by the wrapper remain available and whose AppCheck range includes12. A deterministic version/hash-guarded bridge makes BOTH wrapper podspecs use the React Native SwiftPM helper with the exact same GoogleSignIn10.1 product. Retain the Expo adapter static-framework contract required by Expo Core and remove its obsolete CocoaPods GoogleUtilities/Recaptcha dependencies. Add the same exact Google product to the application target and its Frameworks phase through an idempotent Expo config plugin; a mixed static/dynamic fixture reproduced the missing GIDSignIn symbol without that app link and passed Debug/Release with it. Keep only the AdMob wrapper in Expo forceStaticLinking because its UMP dependency is a static binary. A private two-dynamic-pod fixture compiled Objective-C and Swift imports in Debug and Release and linked one shared GoogleSignIn PackageProduct; its GIDSignIn class appeared only once. A CocoaPods range-only bridge was rejected because it still resolves AppCheckCore11 and duplicates Google utility distribution. Full-application dependency/link/initialization evidence remains required; the SDK fixture alone is insufficient. No blind force-resolution override is accepted.
- Bump version/runtime to1.8.29 and code/build111 before regenerating native outputs. Existing1.8.28 prepared source is never mixed into an older shipped runtime.
- Use a human-owned integration branch for coordinated native/config/guard changes and normal independent review/CI. Verify all original Firebase PR pins on main before resolving that proposal. Existing main CI auto-publishes web; verify each final source and avoid duplicate manual publication.
- Build through existing Expo production profile without auto-submit, inspect the exact signed AAB and generated/installed APKs, then submit that build once through play-production. Record Expo completion, Play receipt/review and observed availability separately; only authenticated availability updates the shipped-runtime ledger.

## Risks / Trade-offs

- Mixed Apple package managers can duplicate AppCheck/Google utility products. Require dependency graph, embedded-framework and compiler/linker evidence, plus bounded startup checks; do not infer interoperability from matching version ranges.
- Major SDK/toolchain changes can expose optimization/JNI failures. Require full four-ABI release compilation, optimized JNI checks and API36/4KB plus API37/16KB installation/startup/consent persistence on the signed candidate.
- Collection defaults can silently change during regeneration. Keep existing false optional defaults and crash handler settings; check both source and built manifest/plist with regression fixtures.
- Native build scripts upload telemetry/symbols. Offline/compile-only QA must use reviewed no-upload guards and OS/process/device egress denial; normal production symbol uploads belong only to the authorized EAS build.
- Real OAuth, billing and crash delivery cannot be proven by mocks or unsigned simulators. Record exact coverage and preserve future iOS/provider verification gates without claiming publication or production recovery.

## Migration Plan

Implement and test guards/configuration, resolve and compile Apple/Android graphs, obtain exact-commit review and required CI, merge and verify automatic web publication. Recheck existing EAS/Play jobs, dispatch one production build, verify signed artifacts and isolated device gates, then submit the exact build and reconcile receipts/cleanup. Web rollback uses a reviewed source revert; binary recovery uses a higher-code corrective release or supported rollout halt. No downgrade/OTA compatibility or rollback success is assumed.
