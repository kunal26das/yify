# Reproducible Android QA

## Run the fresh-cloud check

A same-repository pull request changing this QA setup runs **Compile-only Android QA** against its exact PR head SHA, allowing the first hosted validation before merge. After the workflow exists on the default branch, it can also be dispatched manually against an independently reviewed, immutable 40-character source SHA that contains these scripts. It uses Ubuntu 24.04, Node 24.19.0, Yarn 1.22.22, and a Temurin JDK 17. No EAS, Play, Firebase, or Sentry secrets are supplied. This workflow compiles a debug-signed release APK and AAB; it never installs or launches them, submits a release, or publishes an OTA update.

On an equivalent Linux x86_64 runner with JDK 17 and an official Android SDK:

```sh
bash scripts/android-qa/run-compile-only.sh \
  "$CHECKOUT" "$REVIEWED_SOURCE_SHA" "$EXTERNAL_QA_STATE"
```

The external state directory must not be inside the checkout. It keeps the isolated home, Gradle cache, downloaded HSDP AARs, prerequisite receipt, and evidence. Do not share it between concurrent runs. The runner removes inherited service credentials and Gradle/Java/Node overrides, disables dotenv loading and Sentry uploads, and blocks enabled upload/publish/deploy/submit Gradle tasks. Crashlytics native-symbol upload is disabled explicitly; its existing release-task dependency is disabled by the guard. These checks apply to the reviewed current build scripts; they are not an OS network sandbox for arbitrary code.

The workflow first checks the exact source, clean worktree, absence of ignored dotenv/signing/SDK overrides, compiler module, SDK command-line metadata, existing license receipt, and at least 20 GiB free. It stops before heavy installation if any prerequisite fails. It does not free unrelated files or change KVM permissions. Choose a runner with sufficient free disk rather than repeat an identical capacity failure.

SDK installation reads from closed stdin. No `yes` pipe or SDK license-acceptance command is run. If a package requires terms not already accepted on the runner, installation must stop for the owner to resolve that setup. The scripts do not download a new SDK or JDK into an unprepared machine; the manual workflow provides JDK 17 and relies on the hosted runner's official SDK and previously accepted licenses.

## Version checks and reuse

`scripts/android-qa/toolchain.json` records the audited source-required versions:

- Gradle 9.4.1, including its committed SHA-256
- Expo 58.0.5, React Native 0.88.0-rc.3, and AGP 9.2.1
- compileSdk 37, targetSdk 36, minSdk 24, and build-tools 37.0.0
- NDK 27.1.12297006; the dependency-report-only NDK override is not used for compilation
- React Native CMake 3.30.5, with CMake 3.22.1 also installed for modules using the Android Gradle Plugin default
- All four release ABIs: armeabi-v7a, arm64-v8a, x86, and x86_64

The required versions are checked against the installed React Native version catalog and native build source, not just copied into documentation. Each SDK package needs matching source.properties, API metadata where applicable, and required executables/files. A directory alone is insufficient.

The hosted image, JDK 17 patch release, platform-tools, command-line tools, and Android platform patch revision are not globally frozen binary images. Their actual revisions are captured in the receipt and must match for reuse. This is a version-checked setup, not a claim of bit-for-bit reproducible Android output.

`setup-cloud.sh` can be run independently with the same three arguments. It validates once and saves `prerequisites.json`. Subsequent runs recheck the current environment and source inputs; installation is skipped only when the receipt fingerprint still matches. Changes to the lockfile, package manifests, setup scripts, wrapper, compatibility scripts and their patch manifests/content, JDK, or SDK metadata invalidate reuse. A receipt never substitutes for tests, a native compile, or fresh artifact verification on a new app commit. SDK downloads remain disabled inside Gradle.

## Evidence and coverage

The workflow uploads setup diagnosis and test/build evidence for seven days. It does not upload the generated debug-signed binaries as a release candidate.

1. Root frozen install, dependency pins, typecheck, and complete repository test command.
2. The explicit mocked-journey groups in `mock-journeys.json`: consent and startup, catalog browsing/recovery, sign-in/session recovery, and purchase/restore. They exercise real application modules against replaced native/network boundaries. A preload refuses live fetch/socket traffic as a guard against accidental network access. These are not device tests, Firebase integration tests, or Billing sandbox tests.
3. Direct HSDP regression using unmodified, checksum-pinned official 2.0.1 and 2.2.0 AAR class bytes on minimal JVM Android stubs. Version 2.0.1 must reproduce `IllegalStateException: targetPackageName is null` in attached/configuration/new-intent callbacks; 2.2.0 must finish safely, including repeated callbacks and null/empty onCreate paths. This establishes the malformed-intent guard behavior, not Android 11 lifecycle or full-app integration.
4. Clean Android prebuild parity, actual release runtime graph resolution to HSDP 2.2.0, native release compilation, and four-ABI APK packaging checks. Source and artifact hashes are recorded. A missing `compile-only-receipt.json` means this sequence did not finish successfully.

Run just the class-byte regression without Android SDK or app dependencies:

```sh
bash scripts/android-qa/run-hsdp-regression.sh "$EXTERNAL_AAR_CACHE"
```

The harness needs a JDK compiler module. JDK 21 can run this isolated regression, although the native build requires JDK 17. Cached artifacts are checksum-verified before execution; missing AARs are downloaded only from Google's official Maven endpoint.

Run the grouped mocked journeys after the frozen install:

```sh
node scripts/android-qa/run-mock-journeys.mjs "$EXTERNAL_EVIDENCE_DIRECTORY"
```

The prior production-AAB verifier is a separate, candidate-specific historical check. Its offline welcome-screen observation does not prove the connected journeys below and must not be reused as proof for a different binary.

## Connected device gate

Connected preflight deliberately fails closed. Omitting `.env` does not isolate the application: checked-in native Google services, Firebase client defaults, AdMob identifiers, and update URLs can still reach production before JavaScript consent. Do not enable device networking on this build to work around the gate.

Before adding a connected workflow, independently review a test-only native configuration and verify these prerequisites before the first app process starts:

- A separate test package and test Firebase project/native google-services configuration; existing approved test Google OAuth identity and signing SHA registration; no production fallback.
- Test ad application/unit identifiers or disabled ads. No real ad impressions or clicks.
- Telemetry and OTA endpoints disabled or routed exclusively to approved test services, including native auto-initializers.
- Deny-by-default device egress, verified before launch, with only approved test endpoints permitted. Repository account credentials and production services must remain unavailable to the device.
- An existing approved Firebase test identity. Auth-emulator tests and mocked tokens do not prove Google sign-in integration.
- RevenueCat Test Store for non-billing integration, or an existing Google Play license-tester account with a Play-installed internal-test binary for actual Billing sandbox purchase/restore. An ordinary sideloaded debug-signed APK does not establish Play Billing integration. Verify the test-purchase indicator before checkout; any real charge is out of scope.

The device matrix must cover fresh and repeat launch; interrupted/failed privacy persistence; analytics declined and withdrawn; offline-to-connected startup; process restart; browse/filter/detail navigation; sign-in cancellation, repeat taps and recovery; purchase cancellation/pending/double taps; restore empty/owned/repeated; account changes during in-flight operations; and relaunch with the restored entitlement. Record exact source, binary hash, API/device, test configuration, and per-case result. Test Android 11/API 30 as well as a current Android version for the original crash context.

After this gate and the required independent review pass, a newly production-signed binary needs its own immutable EAS build/source/runtime/version evidence, bundletool-derived APK checks, installation proof, and approved Play release. Compile-only success alone is not release readiness.
