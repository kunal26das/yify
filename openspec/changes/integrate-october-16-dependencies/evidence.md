# Verification evidence

## Coordinated Expo/RN update — 16 October

Starting main: 60609992297bffbf4eba1c1009a5de27260f1873. Original PR #1000 head: 0bffaba060de80d44c215e68ee5d867ebb5fe080.

- Exact pins, frozen install and 71 native source guards pass. Reanimated lifecycle fixture passes 23 installed cases and 10 upstream controls.
- Typecheck passes; full app suite: 2,293 passed, one skipped, zero failures; crash-reporting workspace: 51 passed.
- Online Expo doctor passes with documented Sentry/Babel/TypeScript and native-config deviations; dependency checking remains enabled.
- Android arm64 Debug compilation passes in 9m25s (1,264 tasks). APK package/runtime code 106, 38 native libraries, compressed/extractNativeLibs packaging check passes. This is development-build evidence, not a store release or device smoke test.
- Native projects regenerated through Expo; CocoaPods resolution succeeds. iOS simulator compilation is still pending at this checkpoint.
- Hosting export and HTML/data-boundary checks pass after adapting the custom HTML document to the streaming renderer. Pages export and browser hydration verification are pending at this checkpoint.
- Focused web-export tests: 43 passed. Pin-watcher tests: 49 passed. OpenSpec current and archived strict validation passes.
- Fresh registry scan: four remaining findings, all release-console pins or the EAS consumer review covered by PR #1003. No incomplete lookups. Babel 7 and regexp-helper compatibility holds have exact candidate/consumer evidence.

Separate prepared changes: PR #1002 wrapper commit 00323b85f3f9a139ae7fac32c862aadc602abb02 (28 focused tests); PR #1003 release commit 49fe1ca6178684a3af1798ca7dcf2cfc4bd8d296 (150 release tests, typecheck, build and frozen install). Independent reviews found no actionable issue in either prepared commit or PR #999. Purchases PR #1001 remains separate and requires a new native runtime after this baseline lands.

No October 16 store submission or OTA has been published. Main merges trigger the existing automatic web workflows. Final merge, deployment and cleanup receipts will be appended after verification.
