# Design

## Context

Release source `f1f615755c6abf8f8cfd3cbe33c242efa4cc02a0` declares Android version/runtime 1.8.26 and code 108 in both package and tracked native files. The `production` EAS profile builds a store AAB with the existing remote default upload key; `play-production` targets Google Play production with completed release status. The release console would auto-submit, so the lead built `42aab099-ec20-4c31-80d1-394e755f06e6` separately. It finished at 14:00:25.758 UTC with the exact source/version/code/runtime/channel and no scheduled submission.

The previous confirmed Play release and ledger entry are 1.8.25/code 107. The lead's 13:27 UTC Play read found production 107 completed and no code 108 bundle. The checked-in production AAB candidate manifest and GitHub verification workflow still name code 105; they are historical and will not be used to claim verification of code 108. Exact-source CI and existing compile-only checks do not establish production-signed installation.

## Goals / Non-Goals

**Goals:** Keep one build-to-bundle-to-device-to-submission chain, with independent review before Play upload and a separate availability receipt before ledger recording.

**Non-Goals:** Repeat existing web publication, alter signing or Play credentials, publish iOS, send native changes as an OTA to 1.8.25, or claim real billing/provider or crash recovery from isolated APK tests.

## Decisions

1. **Keep build and submission separate.** The console's combined Android Production action would schedule Play submission before the signed bundle and device gates finish. The completed EAS build was submitted once after device QA and final approval; a second build is justified only after inspecting its final state and source.
2. **Pin and verify the exact candidate locally.** The private code-108 candidate binds the completed EAS metadata, downloaded AAB SHA-256 and upload certificate. Direct local checks cover signed entries, Play upload-certificate match, manifest/runtime/Production channel, optimized JNI contracts, and compressed native libraries across all four ABIs. The checked-in code-105 manifest and its fixed GitHub workflow were not run for code 108. Independent review covered the static artifact and bounded offline device evidence before submission.
3. **Use AAB-derived installed APKs for the device gate.** Generate universal and device-specific APKs with the pinned bundletool and a disposable signer; verify split payloads and installed bytes. Check startup, consent with optional analytics off after restart, version display, and an offline watchlist read/render/restart fixture on available 4 KB and 16 KB Android targets. Record device configuration, network isolation, rendered screens, logs and gaps. The fixture does not exercise adding or saving a title, connected catalog/detail retrieval, Play signing or Play Billing eligibility.
4. **Submit once after rechecking live state.** The lead inspected the build, submissions and Play production track for duplicate or ambiguous work, then submitted the verified build ID through `play-production`. EAS finished the submission and Play recorded the exact tested code-108 AAB. A failed or uncertain future worker would require receipt and Play inspection before any retry or reviewed exact-artifact fallback.
5. **Record delivery in stages.** The finished EAS submission and Play API production track/hash match prove upload, not review approval or user availability. Authenticated Console review was still running at the 14:33 UTC read. Use authenticated Console availability for the shipped-runtime ledger and record its observed release time. Preserve post-release version-specific crash/ANR health as a separate observation.

## Risks / Trade-offs

- Remote build or submission can continue after a local command exits → inspect EAS and Play before retrying.
- Local artifact and device checks have no code-108 GitHub verifier workflow receipt → retain exact commands, inputs, hashes, logs and independent review; label the checked-in code-105 workflow as historical.
- Isolated test signing and blocked provider traffic limit coverage → state unexecuted account, purchase, restore, ads, YouTube and provider journeys; use only applicable authorized test paths for later claims.
- Play review can delay availability → leave the ledger and availability task pending until the Console confirms the release.
- Android binaries cannot be downgraded in place → halt an eligible rollout if necessary and prepare a validated higher-code correction; for a compatible OTA regression, use the existing reviewed Expo rollback path.

## Migration Plan

The exact build was verified, passed bounded offline device QA and independent approval, and was submitted once after a fresh duplicate check. EAS and Play confirmed the terminal submission and exact AAB. Next verify authenticated availability, reconcile the ledger, evidence and sanitized team handoff, and observe version-specific health. No application data migration is involved.
