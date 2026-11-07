# Tasks

## 1. Pull requests

- [x] 1.1 #1059: Safe Area 5.11.1, Screens, Purchases 11, Google Sign-In 17 and runtime 1.8.31/113; verify required CI and merge.
- [x] 1.2 #1068: Expo 58.0.22 / React Native 0.88.1 with rebased guards and resolutions; verify required CI and merge.
- [x] 1.3 #1058: Sentry 8.33.0 with its reviewed deviation; verify required CI and merge.
- [x] 1.4 #1055: Worklets 0.13.1 with its adapter and guards; verify required CI and merge.
- [x] 1.5 #1071, which supersedes #1066: Babel 8.1.0, ESLint 10.14.0 and expo-doctor 1.21.6 with the reviewed Babel deviation; verify required CI and merge.
- [x] 1.6 #1062, #1061 and #1069: refresh lockfiles on current main; verify required CI and merge.
- [ ] 1.7 #1070: hold Firebase JavaScript 13.2.0 until RNFirebase depends on it.

## 2. Delivery

- [x] 2.1 Verify the Hosting and Pages deployments from the final main CI.
- [ ] 2.2 Build Android 1.8.31/code 113 from final main, verify the signed AAB and submit it through play-production.

## 3. Remaining gates

- [ ] 3.1 Regenerate the iOS Podfile.lock on macOS and pass iOS Debug/Release simulator builds with one linked GIDSignIn copy, no duplicate-class warnings and a sign-in URL launch check before any iOS build or update for runtime 1.8.31.
