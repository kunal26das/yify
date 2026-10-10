# Verification

Local checks on 2026-10-10 used Node 24.19.0 and OpenSpec 1.14.1 in the Yify repository. The change affects guidance and CI, not app behavior.

## Validation behavior

Disposable temporary fixtures exercised the CLI behavior; no fixtures or dependencies were added to the repository.

| Fixture | Command | Expected exit | Actual exit |
| --- | --- | --- | --- |
| Valid canonical requirement with scenario | `openspec validate --all --strict --json --no-interactive` | 0 | 0 |
| Requirement missing its scenario | Same | 1 | 1 |
| Archived change with completed task | `openspec validate --archived --strict --json --no-interactive` | 0 | 0 |
| Archived change with unchecked task | Same | 1 | 1 |
| Uninitialized directory | `openspec doctor --json` | 1 | 1 |

The repository health check passed, and artifact instructions included the new project context and rules. `node scripts/check-agent-team.mjs`, `git diff --check` and `git diff --exit-code -- .agents` passed. Generated skills remain untouched.

The CI step runs in the existing required `check` job after dependency installation and before app checks. It fetches the exact CLI with `npx --yes --package=@fission-ai/openspec@1.14.1 --` and disables telemetry. All three commands passed locally using that invocation. Validation initially rejected the unfinished Android scaffold, as expected; both completed change plans subsequently passed strict validation. The Android plan has 0 of 11 implementation tasks complete.

Structural validation does not establish semantic correctness, Android readiness or a deployed app. Independent final-commit review and hosted CI receipts belong in the pull request. Android delivery remains the separate active `finish-android-crash-release` change.

## Application checks

After `yarn install --frozen-lockfile` refreshed stale local Expo dependencies without changing tracked manifests or lockfiles, `yarn typecheck` passed and the crash-reporting workspace passed all 51 tests. The aggregate suite passed 2,221 of 2,222 tests; the existing emulator-readiness shell test could not run because GNU `timeout` is absent on this macOS machine (exit 127). No application or test code was changed. The required Ubuntu CI run must independently pass the full suite before merge.
