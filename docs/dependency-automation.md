# Dependency updates

Dependabot checks the application and its crash-reporting workspace, the separately installed release console, and GitHub Actions daily, starting at 06:00 Asia/Kolkata. Related Expo, React, React Native, Firebase and animation packages are grouped. Major releases remain visible; no permanent version ignores are configured. Ordinary updates use a three-day cooldown. Security updates bypass that cooldown, and GitHub's security alerts and automatic security updates are enabled for this repository.

## Pull request flow

1. Dependabot proposes exact manifest pins and lockfile changes.
2. Root and release-console updates get a clean reinstall in their own scope. The root job checks types, tests, Expo compatibility and both web exports; the release job checks types, tests and the console build.
3. A separate job verifies the original signed Dependabot commit and the successful reinstall, then commits the regenerated lockfile if it changed. It can write only `yarn.lock` for the application or `release/yarn.lock` for the console. Artifact provenance, source commit, workflow attempt and the current branch head must all match.
4. CI runs again against the committed result. Only release-console patch updates qualify for automatic merging, after all required checks pass. Minor, major, application and GitHub Actions updates remain reviewable PRs. Manual fixes keep ordinary CI running but disable automatic lockfile writes and merges.

The application lockfile includes native transitive dependencies, so even a clean reinstall started by a small tooling update can change native code. Before merging an application dependency update, review the native changes, update the runtime version where required, regenerate native projects and verify the affected platforms. The bot never weakens Expo's compatibility policy to make a build pass.

## Coverage outside normal Dependabot updates

The weekly dependency-watch workflow checks exact Yarn `resolutions` and the separately checked-out Dependabot metadata verifier. It publishes a report and maintains one tracking issue for outstanding findings. It updates the issue only when findings change and closes it when they clear. Upstream lookup failures are reported as failures, not treated as evidence that everything is current. Manual runs from a non-default branch produce reports without changing issues.

Hosting installs EAS CLI from the release console's committed lockfile, so a Dependabot update also updates the tool used by later deployments.

Android and iOS source projects are generated from Expo configuration and npm packages. Independent Gradle edits would be overwritten, and Dependabot does not support CocoaPods. Native Firebase, Ads, Purchases and Sentry versions therefore advance through their React Native wrappers and a regenerated iOS lockfile. Xcode, JDK and EAS build-image compatibility still require review during native upgrades; this automation does not install development tools or publish store builds.

## Activation

The configuration and scheduled workflow become active after they reach the default branch. Before merging, PR checks validate the configuration and automation tests. The new release-console writeback path must also be observed on its first real Dependabot PR; local tests cannot reproduce GitHub's bot signatures or issue a real bot update.

Validation: 1,572 app/workspace/release-console tests passed, along with typechecks, the release-console build, workflow syntax validation and exact-pin checks. A live read-only scan checked 15 pins with no failed lookups; seven had newer major versions to review. No tracking issue was created during validation.

References: [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [supported ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories), [Expo native generation](https://docs.expo.dev/workflow/continuous-native-generation/).
