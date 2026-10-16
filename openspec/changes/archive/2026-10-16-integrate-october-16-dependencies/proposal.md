# Proposal

## Why

Five dependency PRs are blocked by incompatible native pins or the changed Expo recommendation. Issue #921 also contains resolved findings alongside outstanding exact pins. Restore validated upgrades and accurate tracking without bypassing checks.

## What Changes

- Review and integrate PRs #999–#1003, repairing native version alignment and the Expo doctor entrypoint.
- Review current dependency-watch candidates, update compatible pins and refresh evidence for required compatibility aliases.
- Regenerate native projects under new runtime versions, verify checks, merge through normal protection and clean completed branches/worktrees.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency/tooling maintenance; product behavior remains unchanged.

## Impact

Root and release dependency trees, source guards, generated Android/iOS projects, Expo validation, dependency review evidence and automatic main-branch web delivery. No new product features, new credentials, iOS publication, or OTA targeting old native runtimes.
