# Tasks

## 1. Integration

- [x] 1.1 Apply the exact pins from #1098, #1099, #1100, #1101, #1102 and #1103 on main and regenerate the lockfile; a frozen install is a fixed point and installation verifies 105 guarded targets and applies 2 patches.
- [x] 1.2 Review Sentry 8.36.0 and Babel 8.1.3 and update their reviewed Expo dependency entries; the reviewed doctor passes.
- [x] 1.3 Pin touch-breadcrumb sanitization, which Sentry 8.35.0 restores on the React Native 0.88 New Architecture, with a test.
- [x] 1.4 Advance runtime and build to 1.8.33/115 and regenerate the native projects; the Android diff holds only version fields and the Sentry Gradle plugin 6.27.0, and the iOS plists take only the generated version fields.
- [x] 1.5 Pass local gates: pins, typecheck, app and workspace tests, update channel, reviewed Expo doctor, both web exports, the release console and strict specs.
- [x] 1.6 Pass the required checks and compile-only Android QA on the final PR head (required run 45322820047 and compile-only run 45322872581 on `482981b`).
- [x] 1.7 Merge, confirm each proposal's pin on main and close the six proposals as superseded (#1106 as `28795655675320fde2beff6110391983fdc4c0c1`, tree-identical to `482981b`; #1098–#1103 closed).

## 2. Delivery

- [x] 2.1 Verify the Hosting and Pages deployments from the final main CI (for `8b5097c`, after #1107: CI 45327226294, Hosting 45327709049 and Pages 45327709083).
- [x] 2.2 Build Android 1.8.33/115 from `8b5097c` and verify the signed AAB, its four ABIs and an isolated 16 KB-page device launch (EAS build `8b31e5b2-85b3-481e-a42d-57141cdd23b0`).
- [ ] 2.3 Pass the CI production-bundle verification on main for the recorded candidate.
- [ ] 2.4 Submit through `play-production` and confirm 1.8.33/115 with the tested bundle on the Play API.

## 3. Remaining gates

- [ ] 3.1 Move Firebase JavaScript beyond 13.1.0 (#1097 proposes 13.4.0) once React Native Firebase depends on it.
- [ ] 3.2 Regenerate the iOS Podfile.lock on macOS and pass iOS simulator builds before any iOS build or update for runtime 1.8.33.
