# Proposal

## Why

Dependabot PR #987 passed the three required checks but failed its clean reinstall because fresh resolution added an incompatible second native dependency. Main recovery ignored failures confined to that additional job, leaving an otherwise eligible PR stranded after the dependency baseline was repaired. After #987 merged, its successful bot-dispatched main CI did not start either web deployment workflow.

## What Changes

- Retain reviewed native and Babel regexp dependency versions during fresh resolution and commit the reviewed regenerated lockfile.
- Include a completed, uniquely identified clean-install failure when deciding whether an eligible outdated Dependabot PR needs a rebase after successful main CI.
- Dispatch post-merge main CI with the existing repository-scoped GitHub App Actions token so successful CI can trigger the downstream web delivery workflows.
- Preserve exact source/run/attempt verification, committed lockfile provenance, eligibility limits, and branch protection.

## Capabilities

### New Capabilities

- `dependency-recovery`: Recover eligible dependency updates after their install baseline is repaired.

### Modified Capabilities

None.

## Impact

Root dependency pins and lockfile, the trusted Dependabot recovery controller, post-merge CI dispatch, and their regression tests. No product features, native runtime upgrade, new credentials, or additional workflow permissions. The post-merge job's `GITHUB_TOKEN` now needs only read access; the existing App token remains limited to repository-scoped Actions write. Native, major, and privileged workflow updates continue to receive the review required by existing policy.
