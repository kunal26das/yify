# Dependency updates

Dependabot checks the application and its crash-reporting workspace, the separately installed release console, and GitHub Actions daily, starting at 06:00 Asia/Kolkata. Related Expo, React, React Native, Firebase and animation packages are grouped. Major releases remain visible; no permanent version ignores are configured. Ordinary updates use a three-day cooldown. Security updates bypass that cooldown, and GitHub's security alerts and automatic security updates are enabled for this repository.

## Pull request flow

1. Dependabot proposes exact manifest pins and lockfile changes.
2. Root and release-console updates get a clean reinstall in their own scope. The root job checks types, tests, Expo compatibility and both web exports; the release job checks types, tests and the console build.
3. A separate `workflow_run` workflow, defined on `main`, verifies the original signed Dependabot commit and the successful reinstall, then commits the regenerated lockfile if it changed. It can write only `yarn.lock` for the application or `release/yarn.lock` for the console. Artifact provenance, source commit, workflow attempt and the current branch head must all match.
4. The trusted workflow approves the actual `pull_request` CI run for the verified lockfile commit using a separate GitHub App. These checks appear on the PR and satisfy branch protection. For release-console updates, the publisher waits up to 15 minutes for that exact run, then verifies its completed attempt and current PR head before applying the merge rule. Live verification found that approved bot runs did not trigger a second maintenance workflow, so merge completion does not depend on that event. Manually dispatched test workflows do not satisfy GitHub's PR requirements and cannot authorize an automatic merge. Release-console patch, minor and major updates qualify for automatic merging after all required checks pass. Application and GitHub Actions updates still require review. A major version label alone does not block a tested release-console update. Manual fixes keep ordinary CI running but disable automatic lockfile writes and merges.

The application lockfile includes native transitive dependencies, so even a clean reinstall started by a small tooling update can change native code. Before merging an application dependency update, review the native changes, update the runtime version where required, regenerate native projects and verify the affected platforms. The bot never weakens Expo's compatibility policy to make a build pass.

Expo's September 24 patch recommendations were reviewed against the published package contents. The current runtime retains exact, package-specific exceptions in `scripts/expo-dependency-policy.json`: several patches only refresh release metadata, while UI, glass and core changes need a coordinated native release. The online doctor remains enabled, and changed versions or recommendations require another review. Dependabot still proposes these updates. The native changes include [UI additions](https://github.com/expo/expo/blob/9349d1457178dd9cccb8bdd3aed47473c49134e1/packages/expo-ui/CHANGELOG.md), [glass rendering fixes](https://github.com/expo/expo/blob/9349d1457178dd9cccb8bdd3aed47473c49134e1/packages/expo-glass-effect/CHANGELOG.md), and [core fixes](https://github.com/expo/expo/blob/9349d1457178dd9cccb8bdd3aed47473c49134e1/packages/expo-modules-core/CHANGELOG.md).

## Coverage outside normal Dependabot updates

The weekly dependency-watch workflow checks exact Yarn `resolutions` and the separately checked-out Dependabot metadata verifier. It publishes a report and maintains one tracking issue for outstanding findings. It updates the issue only when findings change and closes it when they clear. Upstream lookup failures are reported as failures, not treated as evidence that everything is current. Manual runs from a non-default branch produce reports without changing issues.

Hosting installs EAS CLI from the release console's committed lockfile, so a Dependabot update also updates the tool used by later deployments.

Android and iOS source projects are generated from Expo configuration and npm packages. Independent Gradle edits would be overwritten, and Dependabot does not support CocoaPods. Native Firebase, Ads, Purchases and Sentry versions therefore advance through their React Native wrappers and a regenerated iOS lockfile. Xcode, JDK and EAS build-image compatibility still require review during native upgrades; this automation does not install development tools or publish store builds.

## Workflow approval

GitHub requires approval for PR workflows triggered by commits made with `GITHUB_TOKEN`. The built-in token cannot grant that approval, so the workflow requires a private GitHub App installed only on `kunal26das/yify`, with Actions write permission and the mandatory metadata read permission. It cannot write repository contents or merge PRs. The existing Actions token still creates the signed lockfile commit.

`DEPENDABOT_APP_ID` is a repository variable. `DEPENDABOT_APP_PRIVATE_KEY` is an encrypted Actions secret, never a Dependabot secret. It is consumed only by the separate maintenance workflow whose definition, actions and scripts come from `main`. PR workflows have read-only permissions and never receive the key. Each short-lived token is limited to this repository and Actions write permission; the job uses it only for workflow approval. The trusted workflow checks the PR, commit provenance and matching CI run again before approving it.

Behind branches need an owner-authored rebase request: Dependabot rejects commands from GitHub App bots even when their tokens can write. `DEPENDABOT_REBASE_TOKEN` is a separate fine-grained user token restricted to Yify, with pull-request write and metadata read permissions. Only the trusted merge step receives it, solely to request a rebase after checking the current PR and successful CI. Maintenance requires a Dependabot acknowledgement or a newly verified signed source before reporting the request as accepted; rejected bot comments cannot suppress retries. The rebased PR must pass fresh checks and lockfile regeneration before merging.

The branch-refresh token expires on September 24, 2027; `DEPENDABOT_REBASE_TOKEN_EXPIRES_AT` records its exact expiration. Renew the same restricted credential and replace the encrypted secret before that date. The GitHub App approval credential is independent.

## Why an update stays open

A passing manually dispatched run is not evidence that required PR checks passed. The normal PR run must complete, and the branch must be current with `main`. Other reasons to remain open include a failed build, native changes requiring a new app runtime, or manual edits that disable bot writes and merges.

The September 2026 compatibility review found that React Native 0.87 is incompatible with the current stable Expo toolchain; Worklets 0.13 crashes web server rendering; and Babel 8 and TypeScript 7 break the current application build/test toolchain. Those application upgrades remain open while their builds fail. Release-console updates are independently checked by their Node 24 typecheck, tests and build, together with the application checks.

## Activation

The configuration and scheduled workflow become active after they reach the default branch. Before merging, PR checks validate the configuration and automation tests. Verify a real Dependabot lockfile write, GitHub App approval, and successful checks displayed on the PR; local tests or a successful manually dispatched run alone cannot establish that automatic merging works.

To recover a lockfile commit that is waiting for approval, manually run **Dependabot maintenance** on `main` with the original pull-request CI run ID and the exact attempt that produced its lockfile artifact. The workflow verifies the existing commit and approves its matching PR run without creating a duplicate commit. A manually dispatched CI test run cannot be used as the source.

References: [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [supported ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories), [Expo native generation](https://docs.expo.dev/workflow/continuous-native-generation/).

GitHub behavior: [eligible PR check events](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated), [bot-created PR workflow approval](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow), [approval token requirements](https://github.github.io/gh-aw/reference/glossary/#approve-workflow-run-approve-workflow-run).
