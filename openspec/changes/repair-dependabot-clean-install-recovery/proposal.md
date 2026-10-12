# Proposal

## Why

Dependabot PR #987 passed the three required checks but failed its clean reinstall because fresh resolution added an incompatible second native dependency. Main recovery ignores failures confined to that additional job, leaving an otherwise eligible PR stranded after the dependency baseline is repaired.

## What Changes

- Retain reviewed native and Babel regexp dependency versions during fresh resolution and commit the reviewed regenerated lockfile.
- Include a completed, uniquely identified clean-install failure when deciding whether an eligible outdated Dependabot PR needs a rebase after successful main CI.
- Preserve exact source/run/attempt verification, committed lockfile provenance, eligibility limits, and branch protection.

## Capabilities

### New Capabilities

- `dependency-recovery`: Recover eligible dependency updates after their install baseline is repaired.

### Modified Capabilities

None.

## Impact

Root dependency pins and lockfile, the trusted Dependabot recovery controller, and its regression tests. No product features, native runtime upgrade, new credentials, or additional workflow permissions. Native, major, and privileged workflow updates continue to receive the review required by existing policy.
