# Design

## Context

See proposal.md for motivation. Main at `8e459663e089e46e8d76090128dbebe3c0b33be5` has runtime 1.8.21 and Android version code 103. Native dependencies use exact pins and source-reviewed compatibility patches. Dependabot's automatic root upgrades deliberately cover a limited JavaScript-only set; native changes require review. Expo's remote screens recommendation changed after the last passing main CI.

## Goals / Non-Goals

Make each PR independently reviewable with committed lockfiles, passing required checks and honest native validation. Keep the existing restricted automatic merge policy. This work does not alter app features, account access, billing or consent, and does not claim store availability from a successful Git merge.

## Decisions

- Integrate screens first as runtime 1.8.22/code 104. It repairs the baseline recommendation mismatch that blocks the release-only PR. Narrow its lockfile to the reviewed package instead of carrying unrelated fresh-resolution churn.
- Integrate Expo next as runtime 1.8.23/code 105 after the screens baseline. Inspect upstream guarded sources and dependency recommendations before updating guards. Merely relaxing version assertions would conceal compatibility assumptions.
- Rebase and validate the release-console PR against the repaired main branch. Keep its scope separate rather than adding an unrelated app dependency to it. Let normal automation merge it if all eligibility and required checks pass.
- Regenerate native projects through Expo and configuration plugins. Validate JavaScript, the release console, doctor checks and affected native builds; record any untested device or live-service behavior explicitly.
- Independently review the final diff before pushing and merge through normal required checks. Observe main CI and the existing automatic web workflow; no manual force-merge or redundant production deployment.

## Risks / Trade-offs

- Native updates can compile while still changing lifecycle behavior → retain existing patches after source comparison and run the available native verification; do not infer a store/device rollout from build success.
- Expo recommendations can change independently of a PR → record the actual mismatch and validate against the current recommendation without removing compatibility gates.
- Concurrent updates can overwrite a runtime or lockfile → use isolated worktrees, sequential merges and refresh the later PR against main.
- Web workflows start automatically after successful main CI → serialize merges around production operations and inspect the deployed result before reporting delivery.

## Migration Plan

Merge the reviewed screens baseline, refresh and integrate the release-console update, then merge the coordinated Expo change. Verify required checks on each final head and main after integration. Revert an offending merge through a reviewed PR if needed; restoring a previous store runtime requires a separate compatible release decision.
