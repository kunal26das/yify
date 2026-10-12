# Design

## Context

PR #987 CI run 38194086031 failed only `Dependabot clean reinstall (root)`. The signed committed lockfile qualifies under the existing JavaScript update policy; its fresh resolution introduced 37 unrelated package changes, including native versions. `failedPullRequestCI` currently inspects only the three mandatory CI jobs.

After the repaired #987 merged as `f0d0d0b1b99517d343d43d391eb86fa672f9648e`, maintenance run 38214343274 dispatched main CI run 38214406273 with `GITHUB_TOKEN`. That run succeeded, but no Hosting or Pages `workflow_run` followed. Earlier bot-dispatched CI run 38196528025 also had no downstream deployment, while human-push main CI run 38213562355 created both deployment runs immediately. The deployment workflows accept successful main `workflow_dispatch` CI. We infer that GitHub suppresses the downstream event for CI dispatched with `GITHUB_TOKEN`; GitHub's [token-trigger rules](https://docs.github.com/en/actions/concepts/security/github_token) explain that only the direct `workflow_dispatch` run is exempt from recursive-run suppression, and its [workflow-run rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run) constrain chained workflow triggers.

## Goals and non-goals

Restore the existing eligible-update path after a reviewed baseline fix. Do not broaden automatic merge eligibility or treat failed validation as success. Coordinated Expo/native upgrades are outside this repair.

## Decisions

Keep react-native-screens 4.28.0 and expo-dev-menu 58.0.10 as explicit resolutions. Retain Babel regexp helper 7.29.7 because the newer helper requires regexpu-core above the existing reviewed pin. Review and commit the remaining generated JavaScript/tooling lock changes.

After verifying the exact current PR, failed CI attempt, and all required job identities, also consider its completed failed clean-install job when the PR has not already received a signed refresh. Require the exact dependency scope and reject ambiguous, incomplete, or unrelated job evidence. The normal Dependabot rebase acknowledgement, fresh CI, artifact commit, final checks, and merge remain authoritative.

Keep merged-PR and exact-current-main reads on the job's read-only `GITHUB_TOKEN`. After those existing checks pass, use a separate repository-scoped token minted from the existing Dependabot GitHub App with only Actions write permission for the CI `workflow_dispatch` POST. Require this distinct token and client with no `GITHUB_TOKEN` fallback. The existing PR author, merged-by, tested-head, and main-head checks remain unchanged; a failed credential check or dispatch fails the job. Lower the job's `GITHUB_TOKEN` Actions grant from write to read.

## Risks and validation

Fresh lock resolution can introduce new native code: use the installed Expo doctor, source guards, exhaustive lock review, typechecks, full tests, both web exports, and browser checks with synthetic catalog fixtures and outbound telemetry blocked. Controller regression tests cover clean-only failure, required-check failure, nonfailure outcomes, ambiguity, and stale provenance. Independently review the final commit.

Dispatch regression tests must demonstrate that the read calls use `GITHUB_TOKEN`, only the POST uses the App client, and missing or reused credentials cannot dispatch. Workflow assertions verify existing App identity, exact repository scope, Actions-only write grant, and read-only job permissions. Static tests cannot prove GitHub emits the subsequent `workflow_run`; observe a future eligible bot merge and confirm its successful main CI triggers both deployments.

## Delivery and rollback

Merge only after required CI succeeds. Verify the eligible PR's rebase/merge and the resulting main CI. A successful human-push CI can verify web delivery of this code, but only a later eligible bot merge can prove the repaired App-dispatch chain. Keep automatic web delivery open until both downstream deployment runs are observed. Reverting the repair restores prior dependency/recovery behavior without changing service permissions. Do not claim all dependency PRs are eligible; record real blockers separately.
