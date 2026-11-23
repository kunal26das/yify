# Tasks

## 1. Integration

- [x] 1.1 Apply the pins from #1074, #1075, #1076, #1077, #1081, #1083, #1084, #1086, #1087 and #1088 on main, and take #1085's release-console update from main, where it landed directly as `bff879a`, taking Expo's current 58.0.26 cohort and keeping Firebase JavaScript at the 13.1.0 that React Native Firebase 27.1.1 requires; the lockfile reaches a fixed point with no unsatisfied guarded range.
- [x] 1.2 Compare every changed guarded source with the previously published bytes and move its version and hash; installation verifies 105 targets and applies 2 patches.
- [x] 1.3 Rebase the Reanimated NodesManager patch onto 4.8.0 and pass the lifecycle fixture: 23 installed cases and 10 unpatched controls.
- [x] 1.4 Rebase the Worklets Babel 7 adapter and update the Expo dependency, Firebase and Android QA policies; drop the temporary Web Browser deviation from #1089.
- [x] 1.5 Advance runtime and build to 1.8.32/114 and regenerate the native projects; the Android diff holds only version fields and the Sentry Gradle plugin 6.25.0.
- [x] 1.6 Pass local gates: frozen install, pins, typecheck, app and workspace tests, update channel, reviewed Expo doctor, both web exports, the release console and strict specs.
- [x] 1.7 Pass the required checks and compile-only Android QA on the final PR head: compile-only runs 45207018301 and 45211030504 passed; the final head `5da730d` differs from `04a446d` only in records and main's release-console lockfile, and passed the required checks.
- [x] 1.8 Merge, confirm each proposal's pins on main and close the ten remaining proposals as superseded: merged as `e9c8d18db91e9e9ce45c9def12dd3e05a9980672`, tree-identical to `5da730d`; every pin verified on main; #1074, #1075, #1076, #1077, #1081, #1083, #1084, #1086, #1087 and #1088 closed.

## 2. Delivery

- [x] 2.1 Verify the Hosting and Pages deployments from the final main CI: main CI 45221067936, Hosting 45221896083 and Pages 45221896115 passed; both sites return HTTP 200 with every startup script, and isolated headless Chrome renders the consent screen with runtime-injected Reanimated and expo-image styles.
- [ ] 2.2 Build Android 1.8.32/114 from final main, verify the signed AAB and submit it through play-production. Built as EAS `da81d5e6-75e7-4650-a967-b33584343cb7` from `e9c8d18` and verified; submission awaits owner authorization.

## 3. Remaining gates

- [ ] 3.1 Regenerate the iOS Podfile.lock on macOS once the CocoaPods CDN serves the Google Mobile Ads podspecs, and pass iOS Debug/Release simulator builds with one linked GIDSignIn copy, no duplicate-class warnings and a sign-in URL launch check before any iOS build or update for runtime 1.8.32.
- [ ] 3.2 Move Firebase JavaScript to 13.3.0 once React Native Firebase depends on it.
