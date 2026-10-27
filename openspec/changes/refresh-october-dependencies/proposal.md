# Proposal

## Why

Eight dependency PRs are pending. Their current checks expose a nondeterministic clean-checkout assertion, stale reviewed-version policies, a Sentry fixture loading gap and newly documented billing diagnostics. Integrating the related packages together avoids mismatched Firebase and Expo graphs.

## What Changes

- Integrate the updates proposed by PRs #1043–#1047 and #1050–#1052 with exact pins and a committed fresh-resolution lockfile.
- Rebase affected native source guards from reviewed published package bytes, preserving lifecycle, consent and crash-reporting behavior.
- Repair the clean-checkout assertion and affected SDK fixtures while retaining strict rejection of unknown versions, unsafe diagnostics and missing installed packages.
- Group future Firebase JavaScript and native proposals together so their required alignment is reviewed in one PR.
- Prepare a distinct native runtime and regenerate Android and iOS configuration. Validate the final source independently before merging.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency and tooling maintenance; existing product, privacy and entitlement requirements are unchanged. The change declares `skip_specs: true`.

## Impact

Root dependency graph, native compatibility patches, reviewed-version policies, bounded telemetry diagnostics, generated native projects and maintenance tests. Main CI automatically publishes the existing web sites after a successful merge. Android store publication and iOS publication are separate operations; no store or OTA release is claimed by this change.
