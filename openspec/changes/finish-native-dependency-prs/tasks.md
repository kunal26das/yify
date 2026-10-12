# Tasks

## 1. Sentry integration

- [x] 1.1 Review Sentry 8.30 upstream changes, update its compatibility policy, regenerate native projects under runtime 1.8.19, and pass install, doctor, typecheck and crash-reporting regressions.
- [x] 1.2 Independently review the exact repaired #983 head and merge after required CI succeeds; record the commit and actual checks.

## 2. Billing and web integration

- [x] 2.1 Review RevenueCat 10.12.2 and RN Web 0.21.4, reconcile the asset-registry guard, regenerate native projects under runtime 1.8.20, and pass fresh installation, billing/privacy tests and both web export checks.
- [ ] 2.2 Integrate the preceding merge, independently review the exact repaired #984 head and merge after required CI succeeds; record rendered fixture checks and platform gaps.

## 3. Expo and React Native integration

- [ ] 3.1 Rebase the proposed Expo/RN dependency set and source guards against upstream, regenerate native projects under runtime 1.8.21, and pass fresh installation, compatibility and native lifecycle regressions.
- [ ] 3.2 Integrate the preceding merges, independently review the exact repaired #982 head and merge after required CI succeeds; record full application validation and native compilation evidence.

## 4. Integrated verification

- [ ] 4.1 Verify the combined Android native graph, packaging and isolated emulator startup; record actual ABIs, source commit, commands and any iOS gaps.
- [ ] 4.2 Verify final main CI, both web publication receipts and public routes; confirm no requested PR remains open and the primary checkout is clean.

## Workflow follow-up

- Archive once every tracked implementation and verification task has evidence.

## Evidence

### Sentry

- Source repair: `c85841e2aed1a0a5a0e6ad01825bf05fc4d8fe7a`; integration `163682085061ec6a9b5a869ab90fb553d729f53f` has the identical application/native tree, plus this OpenSpec change.
- Independent lead review verified package and lock deltas, generated runtime 1.8.19/code 101, Sentry Gradle working-directory fix, unchanged Android permissions, and semantic iOS dependency/project changes. Original Dependabot package/lock delta is retained exactly.
- Fresh no-lock resolution produces the committed lockfile; frozen install, exact pins, Expo doctor, typecheck, 2,288 application tests (one expected skip), 51 crashreporting tests and 74 focused Sentry tests pass.
- Local JDK 17 compile-only arm64-v8a release APK succeeds: 2,309 Gradle tasks. SDK upload tasks are skipped by the existing compile-only guard. APK SHA256 `865ab21cd5799131acc08b518db5fdc71eb16430c173231b02d63c23485a40c9`; native packaging verifier confirms 37 arm64 libraries and `extractNativeLibs=true`. All-ABI integrated compilation and isolated emulator verification remain pending.
- CocoaPods resolves successfully. Only RNSentry changes in parsed PODS (8.29.0 to 8.30.0); vendored Sentry Cocoa advances to 9.30.1. Local podspec checksums and generated project UUIDs are regenerated; semantic project settings/phases remain unchanged. iOS compilation has not been performed for this repair.

- Sentry PR #983 merged as `f1486c28ddd26601eb8fefcc0786dccdbb06e4f5` after exact-head CI, web/release-console checks and Android dependency graph passed. Independent reviewer also passed 109 focused tests. Isolated API 35 arm64 emulator cold launch, welcome consent with analytics off, Preferences navigation and background/relaunch passed; outbound IPv4/IPv6 was blocked before first app start and no fatal/native-loader error appeared.

### Billing and web

- Standalone repair `0ac5f19cec188a7d755d497b8195998d49d8b66a`; combined Sentry source `32840d40fda1b7aa8b28d8555c1ee6d7420c5083`; integrated application/native tree is identical. Runtime 1.8.20/code 102, RevenueCat native SDK 10.12.2, RN Web 0.21.4, shared asset registry and explicit identifier-collection opt-out preserved.
- Fresh no-lock standalone install and combined frozen install pass. Combined source guards (67), doctor, pins, typecheck, 2,288 app tests (one expected skip), 51 crashreporting tests, Pages/Hosting exports and catalog isolation checks pass.
- Desktop 1365px and mobile 390px fixture browser checks pass for welcome/home/movies/preferences with outbound telemetry blocked and analytics off. Rendered artifacts were captured for review. No production purchase occurred.
- Clean native regeneration and CocoaPods resolve RNSentry 8.30.0, RNPurchases 10.12.2, PurchasesHybridCommon 19.10.0 and RevenueCat 5.94.0. Generated Xcode project UUID churn has no semantic setting changes. The plist regression now parses values rather than asserting generated whitespace. Existing incremental Android prebuild anchor limitation remains; clean prebuild passes.
