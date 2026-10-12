# Design

## Context

PR #987 CI run 38194086031 failed only `Dependabot clean reinstall (root)`. The signed committed lockfile qualifies under the existing JavaScript update policy; its fresh resolution introduced 37 unrelated package changes, including native versions. `failedPullRequestCI` currently inspects only the three mandatory CI jobs.

## Goals and non-goals

Restore the existing eligible-update path after a reviewed baseline fix. Do not broaden automatic merge eligibility or treat failed validation as success. Coordinated Expo/native upgrades are outside this repair.

## Decisions

Keep react-native-screens 4.28.0 and expo-dev-menu 58.0.10 as explicit resolutions. Retain Babel regexp helper 7.29.7 because the newer helper requires regexpu-core above the existing reviewed pin. Review and commit the remaining generated JavaScript/tooling lock changes.

After verifying the exact current PR, failed CI attempt, and all required job identities, also consider its completed failed clean-install job when the PR has not already received a signed refresh. Require the exact dependency scope and reject ambiguous, incomplete, or unrelated job evidence. The normal Dependabot rebase acknowledgement, fresh CI, artifact commit, final checks, and merge remain authoritative.

## Risks and validation

Fresh lock resolution can introduce new native code: use the installed Expo doctor, source guards, exhaustive lock review, typechecks, full tests, both web exports, and browser checks with synthetic catalog fixtures and outbound telemetry blocked. Controller regression tests cover clean-only failure, required-check failure, nonfailure outcomes, ambiguity, and stale provenance. Independently review the final commit.

## Delivery and rollback

Merge only after required CI succeeds. Main CI automatically deploys both web targets; verify its result and the eligible PR's rebase/merge. Reverting the repair restores prior dependency/recovery behavior without changing service permissions. Do not claim all dependency PRs are eligible; record real blockers separately.
