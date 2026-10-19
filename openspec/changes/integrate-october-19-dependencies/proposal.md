# Proposal

## Why

Six dependency PRs need coordinated compatibility review or have stale validation inputs. Restore a tested dependency baseline and actionable Android preflight failures without bypassing the checks that stopped unsafe automatic merging.

## What Changes

- Integrate the exact proposed React 19.3.1, Sentry 8.31.0, native Purchases 10.14.0, web Purchases 1.71.0, Electron 44.7.2 and setup-java 6.1.0 updates from PRs #1011–#1015 and #1019.
- Record exact reviewed Expo deviations, regenerate native projects and update Pods under new version/runtime 1.8.26 and build 108. Native dependency updates must not become an OTA for shipped runtime 1.8.25.
- Re-audit the Android QA toolchain record and report failed preflight checks without creating a reusable passing receipt.
- Commit the freshly regenerated lockfile, retain privacy/crash/payment protections, run appropriate JS/web/native checks, and independently review the combined result before merge.
- Reconcile the original PRs only after their exact changes are present in the verified combined source; clean up completed branches and verify automatic web publication.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency/tooling maintenance, not a new product behavior. The existing native preflight remains strict; its failure diagnostics improve.

## Impact

Root dependency tree, Expo compatibility policy, generated Android/iOS projects, Android QA scripts/tests/documentation, workflow action pins and SDK privacy regression coverage. The three overnight release-console updates already merged remain intact. Main CI triggers the established web deployments. No new credentials, collection purposes, iOS publication, store submission or OTA targeting old native runtimes is included.
