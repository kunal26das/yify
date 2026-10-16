# Tasks

## 1. Native dependency integration

- [x] 1.1 Inspect all five PR diffs and failing jobs and record the shared blockers in the design.
- [x] 1.2 Review upstream native source changes, align exact dependency pins and source guards, and verify install, lifecycle regressions, typecheck and full tests.
- [ ] 1.3 Regenerate Android and iOS under fresh runtimes and verify native compilation before accepting the native updates.

## 2. Tooling and pin maintenance

- [ ] 2.1 Repair the expo-doctor entrypoint for its export map and verify the focused regression plus online doctor.
- [ ] 2.2 Update release CLI and compatible transitive pins and verify release typecheck, tests and build.
- [ ] 2.3 Review current dependency-watch findings, commit supported updates and refreshed compatibility evidence, and run a fresh scan with no incomplete checks.

- [ ] 2.4 Adapt the HTML template to the new server document context and verify both exports retain scripts, fonts, route metadata and catalog isolation.

## 3. Integration and completion

- [ ] 3.1 Independently review final changes and merge accepted PRs through required CI without protection bypasses.
- [ ] 3.2 Refresh issue #921 against final main; close only when no unreviewed findings remain.
- [ ] 3.3 Verify automatic main web delivery and report native store/OTA status separately.
- [ ] 3.4 Remove completed task branches/worktrees and verify clean current main while retaining the unfinished Compose migration.
