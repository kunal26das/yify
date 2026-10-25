# Firebase 27 migration and Android release evidence

## Source and validation

[PR #1039](https://github.com/kunal26das/yify/pull/1039) merged normally as `ec216d5a41672ebeda82d883af4b1d29ce5a92bb`, with the same tree as independently reviewed candidate `068f874090d54f7468dbf7f0dbc5736d6b68fb25`. All five RNFirebase 27.0.0 pins and the original proposal's exact lock blob were verified on main before PR #1033 was closed as superseded. Verified private Git bundles preserve baseline, original proposal, candidate and merged refs.

The graph retains Firebase JS13, Google wrapper 16.1.5, classic ads backend, manual consent-gated revenue reporting and existing identity/crash contracts. The guarded Google Sign-In 10.1 SwiftPM bridge, dynamic Firebase frameworks and static Expo-adapter/AdMob requirements are described in design.md. A range-only CocoaPods bridge was rejected after resolving incompatible AppCheckCore 11. Installed/source guards reject partial graphs, unknown native patches and changed collection controls.

Frozen installation, 101 source guards, app/workspace typecheck, targeted ESLint, both rendered web exports, reviewed Expo doctor and strict OpenSpec validation passed. App tests passed 2,463 cases, with one existing artifact-dependent test deferred to the signed AAB; crashreporting passed 51. Release-console typecheck,151 tests and build passed. Mocks cover identity isolation, sign-in recovery, consent, purchase attribution and crash forwarding; they do not establish connected provider behavior.

[PR CI 40218270325](https://github.com/kunal26das/yify/actions/runs/40218270325), [HSDP 40218270335](https://github.com/kunal26das/yify/actions/runs/40218270335) and [native CI 40218270371](https://github.com/kunal26das/yify/actions/runs/40218270371), attempt1, passed on 068f874. Independently downloaded native evidence artifact 12609079947 has SHA256 `834cb62a6bcb1d3076803c2d04c8218473c677b45047b3730108ce3f94f3235d`. It verifies 18 source fingerprints, actual Kotlin 2.4.20/R8 9.2.14, both reviewed compiler JAR hashes across 57 release configurations, the HSDP real-bytecode regression and full APK/AAB compilation with 37 compressed libraries per ABI. Compiler mismatches fail before compilation; metadata checks and Gradle project locking remain enabled. CI uploaded evidence, not its APK/AAB binaries. Production signing and runtime proof follow below.

Existing dependency advisories were assessed against affected tooling and gRPC-server paths; no advisory remediation or dismissal is claimed.

## Apple prepare-only evidence and remaining gate

The full graph resolves Firebase 13.0.0, GoogleSignIn 10.1.0, AppCheck 12.0.0, GoogleUtilities 8.1.5 and GoogleAppMeasurement 13.0.1. Legacy Firebase/Google SDK CocoaPods entries are absent. Generated app-target package/product/Frameworks references retain the shared Google product and its required Expo static adapter. Full unsigned Debug and Release simulator builds passed on Xcode 27.1 under probed parent/child IPv4/IPv6 network denial, with automatic package updates, signing, bundling and uploads disabled.

Independent artifact review checked52 Release/54 Debug Mach-O products, universal arm64/x86_64 linkage, one shared GoogleSignIn class owner, static AdMob placement, five RNFB frameworks and embedded Google privacy resources. Version/runtime 1.8.29/build 111, Production and collection defaults match. Verified app archives are retained: Debug SHA256 `165446eb1086ab65df275b56f0b6a00b05b8c5240263c85ac5c6d96a1bb067b7`; Release `f2b97a25e7d0553ffd6bf285c12dbef9b5aac0da7db7be60ee277caf1174b2b9`.

These simulator products omit JavaScript and were never launched. App-process network-denial inheritance was not established, so iOS initialization was not exercised. Task 2.2 remains unchecked for that explicit remaining gate; preserve it before a future iOS release. Compile/link/embedding success does not establish OAuth, billing, production signing, crash delivery or publication. No iOS publication occurred.

## Merged-source web delivery

[Main CI 40221770804](https://github.com/kunal26das/yify/actions/runs/40221770804), automatic [Hosting 40222089363](https://github.com/kunal26das/yify/actions/runs/40222089363) and [Pages 40222089299](https://github.com/kunal26das/yify/actions/runs/40222089299), attempt1, passed for ec216d5. At2026-10-25T18:42:08Z, both canonical sites matched 10 HTML routes and 5 startup JavaScript assets each against source-bound deployment artifacts. Hosting identifier is `ujkuk857s7`; final readback receipt SHA256 `6f029933e84fefa6a338bc039746bd74280a06685deb5f44f7ad0b95289d594f`. No manual web publication was dispatched. This is point-in-time HTML/JavaScript delivery evidence, not an interactive live-service or Android availability result.

## Exact signed Android build

[Expo build 84e88043-9b37-455f-af29-bb7234b79e47](https://expo.dev/accounts/kunal26das/projects/yify/builds/84e88043-9b37-455f-af29-bb7234b79e47) finished at 2026-10-25T19:17:07.075Z from ec216d5, using the existing remote signing assignment without automatic submission. Metadata binds Android production, package `io.github.kunal26das.yify`, app/runtime 1.8.29, code 111, Production and fingerprint `73caacae0e2e079d763df6c58910dd96ad0305c5`. The fingerprint is server-recorded, not independently recomputed from the cloud environment. Prepared 1.8.28/code 110 remains unused.

The 99,893,440-byte AAB SHA256 is `45519b1ffa7a8ecc7d0c82a76acede0f9780a815471d214bd92157d27e8969eb`. Every payload entry and the upload certificate were verified; the certificate matches accepted code 109. Manifest/resources agree on identity, version/runtime, native Production and SDK 24/36/37 floor/target/compile values. Independently decoded FIREBASE_JSON_RAW equals exact source configuration; manifest/bootstrap analytics, ad-delay, crash and Sentry controls remain preserved. The optimized Expo/Kolibri JNI artifact test passes 1/1 with zero skips.

Universal APK SHA256 `d08f2073e0f8f28427cb609e0f23fa62e4a084b6749b5d5e9cb51d003af8c2fd` contains 148 compressed native libraries, 37 in each of four ABIs, with extraction enabled. Every library matches the signed AAB; both 64-bit ABIs have minimum PT_LOAD alignment 16384. APKs use a one-day local test signer, not the Play app-signing certificate. Independent signed-artifact review SHA256: `1e439afd2e15611977225c2ed8a25f8be399eb5c2e21e2ab37d3f0fcd20dad30`.

Cloud logs record successful Sentry JavaScript-map, ProGuard and native-symbol uploads and executed Crashlytics mapping/native-symbol tasks. Source-map processing was pending at acknowledgement; service-side ingestion, symbolication, crash grouping and recovery are unverified. The installed CLI rejects an uppercase profile channel, so the source retains its existing no-channel profile and native Production headers. This build's actual metadata also reports Production; no channel migration was introduced.

## Installed offline runtime checks

Wiped, snapshot-free task AVDs ran under a probed host network sandbox plus guest IPv4/IPv6 OUTPUT DROP and airplane mode. Exact PID/start/executable/AVD/image/port/open-file ownership preceded mutations. Initial empty-emulator failures were traced to netsim Wi-Fi startup and controller identity/home assumptions before Yify installation. Independently reviewed private fixes select the local Wi-Fi backend, exact headless executable and exact -avd argument, and scope console authentication to the emulator's private home. Network permissions, watchdogs and app/source binaries were unchanged.

On API 36/4096-byte and API 37/16384-byte arm64 guests, all four installed splits match prepared hashes, signer, package and code 111;37 arm64 library bytes match the signed AAB. Fresh guards passed before first/cold starts and after observations. Both devices rendered adult onboarding, continued with analytics off, showed the bounded offline error/retry state, Privacy off and About 1.8.29 (111). Consent persisted after cold process restart. A stable app PID remained foreground across five samples for 120.795091 seconds on API 36 and 120.252431 seconds on API 37. No Yify fatal, ANR or linking failure appears in captured logs. Intentional force-stops, nonfatal bundletool service-query timeouts, offline SDK warnings and pre-app system Bluetooth crashes were retained separately.

Journey receipt SHA256: `9f9faa6c9fa56857b296c3e4ae42a56ff03014e93f76d6f6a1c0f1d36fafd848`. Final independent runtime review: `6d833fe6c7960b9796a25f1477e29621f0f0b0b61f6e3dc7cba9474f18f3b680`. Scope is fresh test-signed installation and cold persistence. Real provider/purchase/restore/ads/backend journeys, catalog data recovery, OTA, physical devices, other-ABI execution, Play-installed signing and production health remain unverified.

## Play submission and availability boundary

Fresh Expo checks found exactly the intended finished code 111 build, no active operation and no matching submittedBuild submission. Authenticated Play read at 2026-10-25T20:01:02Z found production 1.8.27/code 109 and no code 111 bundle/release; its uncommitted temporary edit was deleted. The initial unsupported submit --json invocation was rejected locally without creating a job. After help/duplicate verification, the supported exact-ID command without --json created one remote job. The view/list commands support JSON; dispatch does not in this installed CLI.

[Submission 6d1d1fe6-1620-4da5-bc27-2f85b858c376](https://expo.dev/accounts/kunal26das/projects/yify/submissions/6d1d1fe6-1620-4da5-bc27-2f85b858c376), accepted at 2026-10-25T20:02:59.503Z, finished at 2026-10-25T20:04:09.776Z through play-production. Metadata binds the exact tested build/source, Android production and requested COMPLETED rollout. Authenticated Play read at 2026-10-25T20:06:00.022Z confirms production 1.8.29/code 111 with completed rollout setting and exact AAB SHA256 above. The temporary read edit was deleted without commit. Do not resubmit code 111.

Play's rollout setting and Expo completion do not establish Google review or public availability. Those remain unverified; the shipped-runtime ledger stays unchanged at last verified available 1.8.26/code 108. No native change was sent as an older-runtime OTA, and no iOS release occurred.

## Cleanup and record delivery

After review, both apps were uninstalled while isolated; owned QEMU processes, AVD data/configs and leases were removed. Test signer/password and private emulator home/auth material were erased. Private API 37 SDK metadata/image hashes were archived before SDK removal. Cleanup receipt SHA256: `d38cec618d62491d9ca9767ffdd395dca9121b0fc6499b062f4923cad4aca056`. Primary SDK, unrelated devices, production credentials and unfinished Compose migration were retained.

Verified Apple app/fixture products, compiler JARs, logs, graphs and artifacts remain archived after private caches were removed. Completed Firebase branches/task refs were removed after recovery-bundle verification; no task worktree was created. This records change still requires its own CI, normal merge, automatic web readback and final branch cleanup; task 3.4 remains pending that delivery. The migration stays active for iOS initialization in task 2.2.
