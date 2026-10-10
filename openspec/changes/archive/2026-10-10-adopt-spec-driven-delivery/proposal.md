# Proposal

## Why

OpenSpec is installed, but Yify has no maintained requirements or automated spec checks. The recent Android handoff showed why a green build, a tested app, a published release, and confirmed crash recovery need distinct evidence.

## What Changes

- Configure concise Yify context and artifact rules covering design, platform compatibility, validation, release evidence, and measurable customer outcomes.
- Make OpenSpec the default for substantive features and cross-cutting fixes, with proportionate handling of small mechanical changes.
- Validate active changes, canonical specs, and archived task completion inside the existing required CI job.
- Demonstrate the lifecycle on this adoption, then retain a separate evidence-based Android release proposal with unfinished tasks left open.

## Capabilities

### New Capabilities

- `spec-validation`: pinned, automatic validation of the repository's OpenSpec artifacts before changes pass CI.

### Modified Capabilities

None.

## Impact

Changes are limited to OpenSpec artifacts, contributor guidance, and the existing CI workflow. The CLI remains separate from app dependencies. This adoption does not build or publish Android, change product behavior, add an agent runtime, or authorize spending. Success means valid artifacts pass, malformed requirements or incomplete archives fail, and the next Android action has concrete acceptance criteria.
