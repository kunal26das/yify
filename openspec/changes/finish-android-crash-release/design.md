# Design

## Context

Evidence refreshed for the 2026-10-10 deployment request; see `proposal.md` for motivation. Release source is `f6064f0f0e5322d7b2df137db700b8953eb6c650`. Compared with candidate 98's original source, native/config/dependency inputs are unchanged, but PR #975 adds app recovery, account feedback and accessibility fixes. A fresh production build (`5adeee2b-643f-44a2-b2ab-f10a697da949`) therefore replaces the old candidate for this delivery. It retains the unused versionCode 98 and runtime/version 1.8.16. EAS finished this build at 2026-10-10 14:54:08 UTC. Its signed artifact passed identity and packaging checks, but actual device startup failed; it must not be submitted.

| Evidence | Verified result and boundary |
| --- | --- |
| [Candidate 98](https://expo.dev/accounts/kunal26das/projects/yify/builds/9baaf5ff-3774-4394-9165-4e98c574254b) | EAS metadata confirms FINISHED, production profile, Production channel, version/runtime 1.8.16, code 98, source `737a6986a485dc8542f0c04552c0b2d680f03a71`; completed 2026-10-09 19:02:25 UTC. |
| [PR #970](https://github.com/kunal26das/yify/pull/970) | Merged as `21d3b2d38d26d73f190fa214a035d624b369df0e`. Final head `c203ab7b103b5f5136211a188862266757416e6f` passed [compile-only QA](https://github.com/kunal26das/yify/actions/runs/37997593146) and [standard CI](https://github.com/kunal26das/yify/actions/runs/37997593143). Old instructions to update/merge this PR are obsolete. |
| [Compile receipt artifact](https://github.com/kunal26das/yify/actions/runs/37997593146/artifacts/11649376568) | Independently downloaded and inspected; ZIP SHA-256 `f22074a82a8c30808012498d86f2bf70399e9a70cffc9b56b313452e5a4087e3`. Six compile/check stages passed; `productionReady: false`; device, connected, billing and store checks not run. |
| [PR #972](https://github.com/kunal26das/yify/pull/972) | Draft head `ad8a85a9b1bf0e2093d690b562ae4dee7f476dc8`; [API 30/35 workflow](https://github.com/kunal26das/yify/actions/runs/37999577475) failed preflight on KVM access, before test cases. It does not establish a candidate defect. |
| Existing signed-bundle evidence | `docs/agents/verification.md` records candidate 98 AAB hash, four-ABI/static checks and Sentry ingestion. Those checks were not independently repeated during this planning pass; ingestion does not prove runtime symbolication. |
| Play and credentials | Last recorded authenticated check: 2026-10-09 20:35 UTC, production 1.8.14/code 96, no code 98 submitted, existing EAS signing/submission assignments present. This is a historical snapshot, not a fresh store check. |

Candidate 97's isolated API 35 welcome-screen smoke is superseded evidence. The existing `scripts/verify-production-aab.mjs` and its workflow now accept an explicit candidate manifest, which still identifies failed build `5adeee2b-643f-44a2-b2ab-f10a697da949` until a replacement is verified. The compile-only artifacts are debug-signed and are not a production AAB.

The exact release source passed CI [38058350181](https://github.com/kunal26das/yify/actions/runs/38058350181): 2,252 app tests, 51 crash-reporting workspace tests and 150 release-console tests, plus typechecks and both web-export checks. Both web targets subsequently deployed and passed live desktop/mobile browsing checks. On 2026-10-10 at 14:30 UTC, the Play API still showed production 1.8.14/code 96 and no uploaded code 98; the temporary read-only inspection edit was deleted. Expo showed no submission newer than October 5.

The owner explicitly requested keeping PR #972 closed. Framework validation continues separately on disposable local Android devices; none of that PR's implementation is required to merge for this release.

## Latest candidate result

Build `5adeee2b-643f-44a2-b2ab-f10a697da949` produced a 99,920,698-byte AAB with SHA-256 `d81e0f21a6cb0f4d763811d10e438b6d6b40c218e5bc498049a31ddef17872a1`. Independent verification confirmed source identity, package/version/runtime/channel, every signed entry, upload certificate, compressed native libraries and all four ABIs. Bundletool 1.18.3 generated ephemeral-test-signed device APKs; installed APK bytes matched the generated APKs on a fresh API 37 ARM64 emulator with 16 KB pages and font scale 1.3. These checks do not constitute a startup pass.

The installed app exited immediately with `Cannot find native module 'ExpoApplication'`. The React Native fatal bridge logged the failure locally and terminated the process; no Play submission occurred. The emulator remained offline and no production crash was deliberately uploaded. The failed build is retained as diagnostic evidence and must be replaced by a verified build after the native-module cause is repaired. Build logs report successful Sentry source-map upload and completed Crashlytics/Sentry mapping and native-symbol tasks; this is upload evidence, not proof of production crash recovery.

The explicit-candidate verifier also now accepts both legacy and build-tools 37 APK certificate output, while rejecting missing or conflicting signer fingerprints. Its tests cover the format change observed on the actual generated APK.

## Native startup correction

The pre-R8 registry generated from source contained `ApplicationModule` and `HapticsModule`, while the failed code 98 AAB defined neither module nor `ExpoModulesV2ModuleList`. The registry is loaded by reflection. The correction preserves that registry and Expo v2 module subclasses through `app.json` ProGuard rules, then regenerates Android. Version/runtime 1.8.17 and code 99 isolate this native change from older binaries.

A guarded local release minification succeeded. A DEX class-definition and method-table check passed on its actual optimized output and rejected the failed code 98 AAB. The production verification workflow now runs this check explicitly against the downloaded AAB before generating test APKs. Local optimized output is not a replacement for verification and device testing of the new signed EAS artifact.

PR #977 merged this first correction as `02d12e0114e25ded3671da0bc36881931608451b`. Its required CI passed, but the actual local ARM64 release APK for version 1.8.17/code 99 aborted during startup on the isolated API 36 device. APK SHA-256 `eda5c448a7a3ebd27c3f795aa47c2dfd109e755c2709ac73e99b02f552e83cfd`; failure: `NoSuchFieldError` for `io.github.expo.kolibri.NativeObject.nativePointer`. Independent inspection found R8 renamed that long field to `a`, although native JNI code requests its original name. Other JNI-referenced Expo v2 classes were also renamed. The earlier module-presence guard passed this APK, so it did not cover the complete JNI contract.

EAS build `cb09f4c1-f0ea-4d5e-b290-889f54c5a567` for code 99 was cancelled before submission after this device failure. Its optional compile-only CI run was also cancelled as superseded. The device remained offline and its app data was cleared after preserving the log. The replacement must preserve the scoped Kolibri and Expo v2 JNI classes and members, add field and method descriptor checks against actual optimized DEX, reject this failed APK as a regression control, and pass device startup before another store submission is attempted.

The replacement source in `f97e308630c187388ab5feb9bf29fb571c05e022` preserves both JNI namespaces and moves native runtime/version to 1.8.18 with code 100. The expanded artifact check inspects 20 JNI class definitions, typed fields and method descriptors. It rejects the failed code 99 APK at the missing `NativeObject.nativePointer:J` field. Generated Android and iOS version metadata agree. Local build and device verification are still pending at this point; source tests alone do not authorize submission.

## Framework device evidence

Separate HSDP tests completed on disposable AOSP ARM64 emulators for API 30 and API 36 using local harness commit `476a8f3be991d16b29a0b06632c8c85af5046740`. Each API passed four legacy 2.0.1 crash controls and six corrected 2.2.0 safe finishes, including actual configuration and new-intent callbacks, malformed creation and repeat calls. Saved events were replayed against the classifier; installed APK hashes and process identities matched. Both test apps lacked INTERNET permission, and app-process socket creation was denied. This establishes the focused framework regression result, not Firebase integration or production recovery.

Receipt SHA-256: API 30 `fea993964751a81fa8345ad105449ca0ddac99e5d96c31eb3646f94bb31a7459`; API 36 `25f7d609086a1546637ebe4532636cd935aa2e0bc5f3ee0247f0ecdf51b44602`. Local adaptations changed the image ABI to ARM64, checked the installed command-line tools 22.0 and labeled execution as local HVF. PR #972 remains closed; its repaired harness is local and is not being merged. The obsolete hosted run `38060121705` was cancelled after local validation; it is not passing device evidence.

## Decisions

1. **Reuse the signed candidate if its relevant source is unchanged.** Compare app/native/config/dependency inputs and verify its receipt and downloaded hash. A new build is warranted by a required source fix or failed candidate, not newer documentation commits. Preserve successful compile receipts instead of replaying them as a substitute for missing device checks.
2. **Extend the existing verifier and tests.** Supply explicit expected identity, reject mismatches and bind bundletool-generated APK/device evidence to the signed AAB. Verify all four ABIs and native-library packaging as required by `CLAUDE.md`. Keep the receipt distinction between static, install, device and connected checks.
3. **Run the missing framework and app checks on usable infrastructure.** Use a permitted API 30 and current Android target. Reuse PR #972's reviewed harness if appropriate, or equivalent verified device execution; merging that PR is not itself a release requirement. Diagnose the KVM prerequisite once rather than retrying identical failures. Preserve legacy HSDP failure control and corrected malformed/repeated/lifecycle outcomes.
4. **Use the smallest valid provider test path.** Start with existing mocks/isolated services. The handoff records bounded owner-account checks as authorized; verify applicable session authorization before use. No intentional ad activity, real charges/refunds, synthetic production crashes or other-customer writes. Billing verification must identify a compatible Play installer, signature and license-tester configuration; an ordinary sideload is insufficient. Missing access is a concrete gap, not a reason to create a new credential system.
5. **Publish with the established route after independent evidence review.** EAS commands use `bash scripts/eas.sh`. Refresh live store/build state first; `play-production` targets production/completed whereas the `production` submit profile targets internal/draft. Record acceptance, review and availability separately, avoiding duplicate submissions.
6. **Observe recovery before incident closure.** Compare the candidate version's affected crash signatures and exposed sessions/users in Sentry and Crashlytics over at least 24 hours after availability. State denominators and platform/version coverage; low exposure remains inconclusive. The elapsed window alone is not proof. Define any necessary longer window from the observed baseline; do not close issues merely because symbol uploads succeeded.

No UI redesign is part of this release plan. QA still inspects rendered consent, browsing and billing journeys, including small screens and enlarged text, for regressions. If a UI correction is needed, involve the designer and update affected scenarios before implementation. Web checks remain required for shared-code changes; iOS remains preparation-only.

## Risks and rollback

- Infrastructure or provider prerequisites may be unavailable: record the exact unexecuted checks and obtain only the missing existing access. Never label compilation as device coverage.
- Native runtime mismatch: never send this native fix as an OTA to runtime 1.8.14. Its previously shipped storage OTA is separate evidence.
- Binary regression: halt an active rollout where supported, then prepare a validated corrective higher-version-code binary. Do not assume an old AAB can downgrade installed apps.
- Web regression from shared work: revert through reviewed CI and verify both web deployment targets. Source-only planning changes need no app rebuild.
- Sparse release usage: keep recovery under observation with honest exposure figures; do not manufacture crashes or customer activity.

## Implementation and delivery order

Refresh candidate/store state, extend and test the existing verifier, complete framework and signed-candidate journeys, review the consolidated evidence, submit once, verify availability, then assess version-specific health. Use `tasks.md` for progress; planning artifacts being present does not mean the release is complete.
