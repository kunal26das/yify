# Tasks

## 1. Establish blockers

- [x] 1.1 Inspect all three PR heads, required checks and maintenance decisions; record why each merge stopped.

## 2. Screens baseline

- [ ] 2.1 Review screens 4.29.0, narrow its lockfile and regenerate runtime 1.8.22/code 104; verify install, app tests, doctor and native build evidence.
- [ ] 2.2 Obtain independent final-diff review, pass required checks and merge PR #995 normally; record the exact merge and validation evidence.

## 3. Release console

- [ ] 3.1 Verify the release-console update with its typecheck and tests, refresh it against the repaired main baseline, and observe passing final-head checks and merge of PR #996.

## 4. Coordinated Expo update

- [ ] 4.1 Inspect updated upstream sources, align exact pins and guards, regenerate runtime 1.8.23/code 105, and verify install, tests, doctor, exports and affected native builds.
- [ ] 4.2 Obtain independent final-diff review, pass required checks and merge PR #994 normally; record the exact merge and validation evidence.

## 5. Integration

- [ ] 5.1 Verify final main CI, automatic web deployment receipts and rendered homepage; confirm no targeted PR remains open and record any native delivery limits.
