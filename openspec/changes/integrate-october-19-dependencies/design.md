# Design

## Context

See proposal.md for scope. Main is `25a90f32150cafce822137e7e586ab5d7b86ca0f`. Release-console React, Electron and EAS CLI updates already merged automatically. Six root/Actions updates remain behind strict main. The React and Sentry checks reject versions not yet reviewed by the Expo compatibility policy. The Actions PR reached Android QA but failed before Gradle: its audited toolchain still named Expo 58.0.6 and React Native 0.88.0-rc.4, while main installs 58.0.12 and 0.88.0.

## Decisions

- Integrate the six exact direct upgrades together, regenerate the root lockfile from a fresh install, and validate the resulting tree. Preserve the conservative automation boundary: native, renderer, build-tool and privileged Actions changes continue to require review. A green test alone does not expand automatic merge eligibility.
- Review React 19.3.1 against React Native 0.88 and record the intentional React/React DOM and Sentry deviations in the existing Expo policy. Preserve Expo's actual recommended versions. Do not disable dependency checks or modify renderer version guards.
- Use runtime 1.8.26, Android version code 108, and generated native projects. Sentry 8.31 changes native dependencies and the iOS build phase; RevenueCat 10.14 changes the native bridge. An OTA targeting runtime 1.8.25 cannot carry these upgrades safely.
- Keep existing privacy configuration. Exercise the installed Sentry SDK's default integration selection and real feedback-envelope path, including hidden identity, stale attachments, replay and profiling exclusion. Mock native boundaries and transport; no customer telemetry or live payments belong in these tests.
- Align the Android QA audit with the installed root manifest, add a regression against future drift, and preserve sanitized failed-check diagnostics separately from passing receipts. The workflow archives the diagnostic even when setup fails. A failed diagnostic must never satisfy compile prerequisites.
- Regenerate native sources through Expo/config plugins and CocoaPods rather than editing generated files. Preserve local ignored configuration. No UI geometry changes are intended; existing rendered export checks cover the affected web delivery surface.

## Validation and delivery

Run dependency-pin checks, typecheck, app and crash-reporting tests, Expo doctor, OpenSpec validation, both web export/render checks, and release-console CI. Obtain independent review of the exact integration commit. Compile the Android release APK/AAB for all four ABIs without signing credentials or service uploads using the existing exact-source QA workflow. Compilation does not establish signed-device startup or store availability; record that limitation explicitly.

Merge only after normal required checks and Android compilation pass. Main automatically publishes EAS Hosting and GitHub Pages. Verify those deployments against the merged revision, then close the six original PRs as superseded by the combined integration. Preserve their heads in a private recovery bundle before deleting completed branches. Keep unrelated Compose migration work.

## Risks and rollback

- Fresh resolution changes transitive dependencies beyond the six pins: review semantic lockfile changes and validate the committed tree rather than relying on the original PR results.
- Mocked SDK tests cannot prove native startup or real billing. Preserve the new runtime boundary and leave store submission and signed-device QA outside this batch.
- CocoaPods or native compilation can uncover compatibility failures: repair and re-review the candidate; do not lower gates.
- Automatic main deployments are production side effects. Allow one release owner, verify immutable deployment identifiers, and avoid duplicate manual publication.
- If web regresses, revert the integration through reviewed CI or restore the previous verified Hosting deployment. Do not send the new native SDKs to old binaries. Private baseline manifests, lockfiles and previous modules are retained under the owner's local dependency recovery directory.
