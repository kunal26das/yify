# Expo native patches

`scripts/expo-native-compat.mjs` runs from `postinstall`. It checks that the installed React Native version equals `reactNative` in `manifest.json`, then applies every entry in `files` to `node_modules`. Each entry names the package, its exact version, the target file, the SHA-256 of the file before and after the patch, the patch file in this folder and the upstream reference. An unexpected package version or source digest fails the install before any file is written, and a repeated install is a no-op.

`yarn check:pins` runs the same check in `--check` mode, so a missing patch fails CI.

## Reanimated 4.8.0 `NodesManager` teardown

`reanimated-nodes-lifecycle.patch` (before `dbb35ac7…`, after `482f7af2…`) serialises Reanimated's Android `NodesManager` callbacks with native teardown and clears its nullable event handler, so frame, event and queued callbacks cannot reach a destroyed native proxy. It fixes the teardown SIGABRT tracked in [Reanimated issue 10279](https://github.com/software-mansion/react-native-reanimated/issues/10279). `scripts/check-reanimated-lifecycle.mjs` and `tests/fixtures/reanimated-lifecycle/` compile the real Kotlin sources and exercise the patched lifecycle in the `Native crash guards` CI job.

## Upgrading a patched package

When a patched package changes version, rebase the patch onto the new upstream source, record the new `before` and `after` digests and version in `manifest.json`, and run the native crash guards. Remove the entry and its patch when upstream ships the fix.
