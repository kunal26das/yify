# Tasks

## 1. Dependency baseline

- [x] 1.1 Pin the existing native versions and compatible regexp helper, and verify a true no-lock install with Expo doctor.
- [x] 1.2 Commit and independently inspect the regenerated lockfile, run typecheck/full tests and both web export checks; verify desktop/mobile browser fixtures without outbound telemetry.

## 2. Recovery behavior

- [x] 2.1 Handle clean-only failure and prove exact-scope, nonfailure, ambiguity, refreshed-head, and provenance cases with controller regression tests.
- [x] 2.2 Pass full repository validation and independent review on the final repair commit.
- [x] 2.3 Route post-merge CI dispatch through the existing repository-scoped App Actions token, keep reads on `GITHUB_TOKEN`, and pass missing-token and token-routing regressions.

## 3. Delivery

- [x] 3.1 Merge with required CI passing and verify main CI plus automatic web delivery.
- [x] 3.2 Verify the eligible RevenueCat JavaScript PR is rebased, validated, and merged by the existing automation; record any remaining manual dependency blockers.
- [x] 3.3 Observe a successful main CI from a later eligible bot merge trigger both web deployment workflows; do not substitute a human-push deployment for this chain verification.

## Workflow follow-up

- Archive after delivery evidence is recorded and all tracked tasks are complete.

## Evidence

PR #991 merged as b42a6b1 after all required CI jobs, Android dependency verification, and independent security review passed. Its dependency baseline passed 2,274 application tests and 51 crash-reporting tests (one existing skip), both web exports, Expo doctor, and desktop/mobile fixture checks with external telemetry blocked. The final recovery controller suite passed 135 tests; the final application suite passed 2,285 tests plus 51 crash-reporting tests, with one existing skip.

Dependabot rebased PR #987 to fc312463; all six checks passed, including a true clean reinstall. GitHub Actions automatically merged it as f0d0d0b on 2026-10-12. Main CI run 38214406273 succeeded, but no downstream deployment runs were created. The separate App dispatch fix passes 210 combined controller, main-CI, and delivery-workflow tests and strict OpenSpec validation. PR #992 passed final independent security review and required CI [38216290475](https://github.com/kunal26das/yify/actions/runs/38216290475) at `9ee8db7`, then merged as `009ab6ce18d95ea3d8c47629fbe96801b27228cc`. Main CI [38216890033](https://github.com/kunal26das/yify/actions/runs/38216890033) passed. Pages [38217302822](https://github.com/kunal26das/yify/actions/runs/38217302822) succeeded; Hosting [38217303043](https://github.com/kunal26das/yify/actions/runs/38217303043) published and promoted deployment `9sxzc5bvyr`, then failed on a Sentry metadata HTTP 503. The successful publication receipt was retained, and no duplicate publication was forced. Existing App access was reused without creating or expanding credentials.

Manually reviewed and merged updates: GitHub Actions #990, Babel #985, Electron #986, and Firebase #988. PRs #982, #983, and #984 subsequently merged on 12 October after coordinated native compatibility validation. Native updates remain outside automatic merge policy.

On 14 October, maintenance [38566031983](https://github.com/kunal26das/yify/actions/runs/38566031983) automatically merged eligible release-console PR #996 as `afd00133df1e57241d649a0fb32eb042ebee486b`. The existing `yify-dependabot-ci[bot]` App dispatched main CI [38566837457](https://github.com/kunal26das/yify/actions/runs/38566837457) on that exact commit. CI succeeded and automatically generated both downstream `workflow_run` deployments: Hosting [38567360620](https://github.com/kunal26das/yify/actions/runs/38567360620) and Pages [38567360537](https://github.com/kunal26das/yify/actions/runs/38567360537), both successful. Hosting promoted deployment `6ua48xczqw` to `https://yify.expo.app`; Pages delivered `https://kunal26das.github.io/yify/`. This completes the previously pending live bot-triggered delivery proof.
