# Tasks

## 1. Dependency baseline

- [x] 1.1 Pin the existing native versions and compatible regexp helper, and verify a true no-lock install with Expo doctor.
- [x] 1.2 Commit and independently inspect the regenerated lockfile, run typecheck/full tests and both web export checks; verify desktop/mobile browser fixtures without outbound telemetry.

## 2. Recovery behavior

- [x] 2.1 Handle clean-only failure and prove exact-scope, nonfailure, ambiguity, refreshed-head, and provenance cases with controller regression tests.
- [ ] 2.2 Pass full repository validation and independent review on the final repair commit.

## 3. Delivery

- [ ] 3.1 Merge with required CI passing and verify main CI plus automatic web delivery.
- [ ] 3.2 Verify the eligible RevenueCat JavaScript PR is rebased, validated, and merged by the existing automation; record any remaining manual dependency blockers.

## Workflow follow-up

- Archive after delivery evidence is recorded and all tracked tasks are complete.

## Evidence

The dependency baseline passed 2,274 application tests and 51 crash-reporting tests (one existing skip), both web exports, the online Expo doctor, and desktop/mobile browser onboarding, catalog, and Preferences checks with synthetic data and outbound telemetry blocked. The recovery controller suite passed 134 tests. The simulated rebased RevenueCat update passed eligibility checks and a true no-lock install regenerated a byte-identical lockfile. Final CI and live recovery remain pending.
