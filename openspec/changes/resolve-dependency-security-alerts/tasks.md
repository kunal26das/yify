# Tasks

## 1. Fixes

- [x] 1.1 Add exact, consumer-scoped overrides for `@grpc/grpc-js` 1.14.7, `minimatch` 11.0.9 and `glob` 14.0.6, and move the release console's `joi` to 18.3.2; neither lockfile contains a version inside any advisory range.
- [x] 1.2 Advance #921's pins within compatible majors and record exact reviews for the retained older majors; the local watcher reports 0 findings and 0 incomplete checks.
- [x] 1.3 Verify every overridden consumer uses only APIs retained by minimatch 11 and glob 14, and replay Electron Builder's file selection against both minimatch versions with no differing decision.
- [x] 1.4 Pass local gates: frozen installs, exact pins, typecheck, app and workspace tests, update channel, reviewed Expo doctor, both web exports, a clean Android regeneration with no diff, the release console and strict specs.

## 2. Delivery

- [x] 2.1 Pass required CI and merge after #1106 (#1107 as `8b5097c230943842c3347d252cb7a0f4d900ce82`, tree-identical to `39e9749`).
- [x] 2.2 Confirm GitHub closes the seven alerts and the watcher closes #921 with zero findings (0 open alerts; watcher run 45330987834 on main reports 0 pins needing review and 0 incomplete checks).
