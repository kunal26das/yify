# Evidence

## Initial review

- Base main: eb0e8da46ccec0b1ac83b86e63f8c2bc01799d20. Existing auto-merged release-console updates #1027/#1028 are preserved.
- #1023 head 688e528a8c86299edfaaaf10e9294381dafeac06: CI 39522271269 fails installation because the source manifest still requires expo 58.0.12 while the PR installs 58.0.14. The source guard is operating correctly.
- #1024 head 1ad90a558d057a4fbbd1a6ded565f71d6004ed1b: CI 39522180002 fails Expo policy because Gesture Handler 3.4.0 has not been reviewed against the accepted 3.3.0. HSDP verification passed.
- #1025 head 8578ed5720f8ea386667364bbe227595684b1378 and #1026 head 22a206633c9aaf8517fccd7ff3fa01bc259126a8 have passing exact-head CI and signed lockfile regeneration. Their skipped latest clean-install jobs reflect existing refresh commits. Grouped expo-doctor and Electron updates are outside the reviewed root auto-merge allowlist.
- Independent reviewer approved the original #1025/#1026 dependency changes for integration after checking 29 distinct changed registry integrity records and provenance. That approval does not cover the later combined tree. Electron runtime and packaging were not exercised by original CI.
- Recovery files and original PR heads are retained privately outside the checkout. The unrelated Compose migration worktree is preserved.

## Combined validation

Node 24.19.0 and Yarn 1.22.22 freshly resolved the root lockfile. The initial script-skipped install allowed source review before lifecycle execution; final frozen installation and compatibility scripts succeeded. Exact pins, Production OTA-channel validation, all 84 native-source targets and online Expo doctor passed with explicitly reviewed deviations. The Reanimated lifecycle patch and UMP guard remain enabled.

Expo regenerated both native projects and CocoaPods installed successfully. Version/runtime is 1.8.27, Android code 109. The Expo Blur patch tightened its ref type; the application now derives its ref from the exported BlurTargetView component without a cast or runtime behavior change. Detailed upstream source changes are recorded in docs/dependency-pin-review.md.

Final local typecheck passed. Application tests passed 2,360 with one intentional artifact-dependent skip; the crash-reporting workspace passed 51/51. Both Hosting and Pages exports passed rendering and catalog data-boundary checks. The release console passed frozen installation, typecheck, 150 tests and build. OpenSpec doctor and strict active/archived validation passed.

Independent native review verified the unchanged official Android UMP 4.0.0 binary guard: 26 real-SDK cases and five incompatible-bytecode cases passed. Ads advances Android GMA to 25.5.0 and iOS GMA to 13.10.0; UMP remains Android 4.0.0/iOS 3.1.0. Gesture Handler adds a native module method, reinforcing the new-runtime requirement.

An independent real Electron 44.9.0 smoke passed against the actual main/preload/static-server files with an isolated profile and local fixtures: window/tray/menu, context isolation, disabled renderer Node access, preload IPC, external-request blocking, close/reopen and clean shutdown. It substituted the notifier and used an ephemeral test port; packaging and production journeys were not exercised.

Immutable candidate review, Android all-ABI compilation and unsigned iOS Simulator compilation remain pending. Signed production startup, live ads/purchases and store release are outside this batch.
