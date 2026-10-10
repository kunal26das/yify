# Design

## Context

Evidence reconciled on 2026-10-10; see `proposal.md` for motivation. Main inspected was `0f27e88ecab833078339b3f8dbfd7ca68c63fe61`. Changes since candidate 98's source are QA, documentation and OpenSpec setup, not app/native changes. Recheck that comparison before reusing the candidate.

| Evidence | Verified result and boundary |
| --- | --- |
| [Candidate 98](https://expo.dev/accounts/kunal26das/projects/yify/builds/9baaf5ff-3774-4394-9165-4e98c574254b) | EAS metadata confirms FINISHED, production profile, Production channel, version/runtime 1.8.16, code 98, source `737a6986a485dc8542f0c04552c0b2d680f03a71`; completed 2026-10-09 19:02:25 UTC. |
| [PR #970](https://github.com/kunal26das/yify/pull/970) | Merged as `21d3b2d38d26d73f190fa214a035d624b369df0e`. Final head `c203ab7b103b5f5136211a188862266757416e6f` passed [compile-only QA](https://github.com/kunal26das/yify/actions/runs/37997593146) and [standard CI](https://github.com/kunal26das/yify/actions/runs/37997593143). Old instructions to update/merge this PR are obsolete. |
| [Compile receipt artifact](https://github.com/kunal26das/yify/actions/runs/37997593146/artifacts/11649376568) | Independently downloaded and inspected; ZIP SHA-256 `f22074a82a8c30808012498d86f2bf70399e9a70cffc9b56b313452e5a4087e3`. Six compile/check stages passed; `productionReady: false`; device, connected, billing and store checks not run. |
| [PR #972](https://github.com/kunal26das/yify/pull/972) | Draft head `ad8a85a9b1bf0e2093d690b562ae4dee7f476dc8`; [API 30/35 workflow](https://github.com/kunal26das/yify/actions/runs/37999577475) failed preflight on KVM access, before test cases. It does not establish a candidate defect. |
| Existing signed-bundle evidence | `docs/agents/verification.md` records candidate 98 AAB hash, four-ABI/static checks and Sentry ingestion. Those checks were not independently repeated during this planning pass; ingestion does not prove runtime symbolication. |
| Play and credentials | Last recorded authenticated check: 2026-10-09 20:35 UTC, production 1.8.14/code 96, no code 98 submitted, existing EAS signing/submission assignments present. This is a historical snapshot, not a fresh store check. |

Candidate 97's isolated API 35 welcome-screen smoke is superseded evidence. The existing `scripts/verify-production-aab.mjs` and its workflow still identify 97; adapt them rather than inventing another verifier. The compile-only artifacts are debug-signed and are not candidate 98.

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
