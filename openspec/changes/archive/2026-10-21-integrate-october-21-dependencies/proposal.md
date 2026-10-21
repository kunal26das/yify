# Proposal

## Why

Four application dependency PRs require review. Expo installation fails its exact native-source guard, Gesture Handler fails the reviewed Expo dependency policy, and tooling/Electron updates are deliberately outside automatic merge eligibility. Integrate the compatible changes without bypassing those safeguards.

## What Changes

- Integrate the direct upgrades proposed by #1023, #1024, #1025 and #1026 and commit a freshly resolved lockfile.
- Align Expo's required CLI, Babel preset, core, development launcher and application package resolutions with the new SDK patch; review guarded sources and retain all crash protections.
- Regenerate Android/iOS and Pods under version/runtime 1.8.27, Android code 109; align compile-only QA's audited Expo version.
- Validate the combined tree, obtain independent review, then merge and verify the established automatic web publication. Close superseded PRs only after confirming their changes reached main and clean up completed branches.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency maintenance without new product behavior.

## Impact

Root dependency tree, Expo source guards and compatibility policy, generated native projects and QA audit metadata. Existing release-console updates on main remain intact. A store release, old-runtime OTA and iOS publication are outside this batch.
