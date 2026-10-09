# Android delivery handoff

Updated 2026-10-09 18:19 UTC. This is a sanitized evidence snapshot, not an access-control mechanism or authority to publish.

## Current source and priority

Last verified main: `934455c65bdad11f13cfc78eb3147201aed26d72` (native metadata boundary, PR #969), preserving the HSDP fix from PR #968 and the movie-details fix from PR #965. Android source declares version/runtime `1.8.16`, versionCode `98`; that declaration is not a store release. The highest-priority unfinished outcome is the Android startup-crash fix, a compatible new binary, Play delivery, and subsequent crash-health verification. The native rewrite is deferred. iOS preparation may continue; publication remains gated on authorized, complete release setup.

PR #968 merged after final-head `af61d335fa0251cc654c7185533ff47cd9a31b68` passed standard CI, clean Android regeneration, HSDP dependency verification and independent review. Main CI and both web deployments also succeeded. The graph report uses preinstalled NDK `27.3.13750724` only to configure dependencies; it does not build native code or establish compatibility with the project's release NDK. A separate isolated JVM harness directly reproduces the missing-extra exception in the unmodified HSDP 2.0.1 AAR and verifies safe completion in 2.2.0; this is not a device or full-app integration test.

PR #969 merged after exact-head CI and independent review of `2b38fbfca1499f03efa1d7db39fc8f069fd9915b`. Post-merge main CI failed at Expo doctor after its recommendation for `react-native-web` changed from installed `0.21.3` to `^0.21.4`; tests, typecheck and web exports passed. Automatic web deployments did not run, so the native-specific endpoint is not yet verified live. A focused compatibility-policy correction remains under review. Do not release candidate 97 unchanged.

## Delivery status

- Android `1.8.14` storage OTA was published and its Production/runtime `1.8.14` manifest was verified available. Group `8dd4a8cf-2751-42c4-ab15-7dc5e5dd7b7b`; source `c6cf23e21dd6dd6bad1fd2b693c0efbdce314c3f`. This JavaScript-only update does not contain the newer native crash fix.
- Web main `73c6996` passed CI and both EAS Hosting and GitHub Pages deployment workflows. Deployment receipts are in the verification record; they are not proof of every rendered journey.
- Android candidate `1.8.15` / code `97` / runtime `1.8.15`, EAS build `ee1be7b3-c44c-4956-a1ac-a676243db901`, finished building and passed exact-AAB checks plus a 20-second isolated API 35 x86_64 welcome-screen smoke. It was not submitted to Play and is superseded for release by required fixes.
- Last observed Play production was `1.8.14` / code `96`. No new store availability or crash recovery is established by these build/test receipts.

## Unresolved release gates and next action

1. Resolve the verified Expo-doctor recommendation drift through review and fresh CI, then verify both web deployments and the native-specific server endpoint before a dependent Android release.
2. Establish and validate a documented fresh-cloud setup covering pinned Node/Yarn dependencies, JDK, Android SDK/build tools, project NDK, emulator and test prerequisites together. Record failure diagnoses and changes between attempts.
3. Resolve the first fresh-hosted setup failure: run `37971814065` at source `98963f342f40f9db076281c3334595f9f987defd` could not resolve SDK package `platforms;android-37` and stopped before dependency installation or compilation. Verify the official package inventory and naming before one coherent correction. Full native compilation and four-ABI packaging remain pending.
4. Preserve the independently repeated real-bytecode failure-path regression and extend safe test-service validation through consent, connected startup, browsing, sign-in, purchase and restore. Production defaults make an unspecified test environment unsafe; fail closed. Record untested devices and paths explicitly.
5. Build the final exact source using existing Expo-managed signing; inspect the established submission route from PR #954. `play-production` targets production/completed; the `production` submission profile targets internal/draft. A successful submission is not Play review approval or user availability.
6. Verify the release receipt, Play availability and version-specific crash health separately. Only then start one measured growth experiment; unavailable metrics remain unknown. Keep business metrics and customer information out of this public record.

## Rollback and compatibility

Keep the existing production binary and compatible OTA as the baseline until new delivery is verified. Never publish native changes into runtime `1.8.14` as an OTA. For a verified OTA regression, use the authenticated Expo rollback/republish route only for the affected compatible runtime after reviewing its receipt; that recovery procedure has not been exercised here. For a binary regression, halt an active rollout where supported and prepare a validated corrective higher-version-code binary. Do not assume an uploaded older AAB can downgrade installed applications. For web, revert the offending source through reviewed CI and verify both deployment targets. Record any actual rollback and its health result before closing the incident.

## Team and runtime

Use one lead and at most three necessary specialists concurrently, without nested delegation by default. Independent reviewers inspect the final proposed commit. Customer-facing experience work requires design before implementation and rendered inspection afterward. The runtime exposes model and effort selection arguments and accepts delegations; independently effective inference settings and technical global concurrency/credential enforcement remain unknown. Repository policy and validators do not create those controls. The lead retains merge and production decisions within the owner's authorization, with one production operation at a time.
