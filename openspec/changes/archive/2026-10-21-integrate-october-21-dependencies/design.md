# Design

## Context

The integration starts from main eb0e8da46ccec0b1ac83b86e63f8c2bc01799d20. The four PRs share the root lockfile and are behind main. Their individual checks do not establish compatibility of a merged dependency graph.

## Decisions

- Use one reviewed integration PR and fresh Yarn resolution. Preserve the baseline manifests, lockfiles, modules and original PR heads privately for recovery.
- Review actual upstream package diffs before advancing exact source hashes. Keep unchanged sources guarded, preserve the Reanimated lifecycle patch and UMP metrics protection, and preserve online Expo validation with explicit justified deviations.
- Advance the five exact transitive Expo resolutions required by the SDK patch rather than retaining incompatible floors. Keep Babel 7 and TypeScript 6 compatibility adapters intact.
- Native upgrades use a new runtime 1.8.27/code 109 and generated projects. Never distribute them to binaries on runtime 1.8.26 through OTA.
- Keep automatic merge eligibility conservative. Compiler, doctor, Electron and native package updates still require review; a green check alone does not expand policy.

## Validation and delivery

Run exact-pin/source-guard checks, typecheck, application/workspace tests, online Expo validation, strict OpenSpec validation, both web exports and render/data-boundary checks, and release-console CI. Regenerate native sources through configuration and CocoaPods. Independently review the final code and lockfile, compile all four Android ABIs through the exact-source credential-free workflow, and prepare/compile iOS where available. Use an isolated Electron profile and mocked content for a bounded runtime smoke; do not read real desktop state or request production services.

Merge after required PR checks and native compilation pass. Verify automatic main CI, Hosting and Pages publication. Signed production startup, live purchases, native store delivery and production crash health are not established by these checks.

## Risks and rollback

Fresh resolution can change transitives beyond the original pins; inspect semantic lockfile changes and their integrity. Native SDK changes can fail builds even when JavaScript tests pass. Repair and repeat affected checks without lowering gates. Automatic web publication is a production effect; avoid duplicate manual deployments. Revert through tested source or restore the prior Hosting deployment if regressions occur, while preserving the native runtime boundary.
