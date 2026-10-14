# Evidence

## Initial state, 14 October 2026

- Main: `8e459663e089e46e8d76090128dbebe3c0b33be5`, runtime 1.8.21/code 103.
- PR #994, `964eda76511db2e3f3e4e2c1f5bacf27848effb0`: CI [38555423385](https://github.com/kunal26das/yify/actions/runs/38555423385) fails installation because Expo 58.0.7 does not match the source-reviewed 58.0.6 guard. Android dependency verification fails at the same guard.
- PR #995, `04492751b19121ea73853d3c5788b41ea4b7489c`: required CI passes. Maintenance [38556148353](https://github.com/kunal26das/yify/actions/runs/38556148353) intentionally stops after lockfile publication because a native screens minor update is outside the automatic root upgrade policy.
- PR #996, `8fe62ba758769317e6e416c784e6e54513779c48`: CI [38557558288](https://github.com/kunal26das/yify/actions/runs/38557558288) fails only the app's screens recommendation check; its release-console and web checks pass. The remote Expo recommendation changed from 4.28 to 4.29 after the previously passing main CI. This is not evidence of a Node types defect.
- Independent automation review found no controller defect requiring a policy bypass.

## Local release-console verification

- Frozen installation and typecheck pass for #996.
- Initial full suite: 149/150 pass. The TUI recovery test observed `confirm` before a queued render committed `result`; its single `setImmediate()` wait did not reliably synchronize with React.
- The test repair uses React `act()` for the asynchronous release transition and Ink's render-flush API. Targeted tests pass 3/3; the full release-console suite passes 150/150; typecheck and build pass. The repair is included with the screens baseline, keeping #996's dependency-only provenance intact. No production release was attempted by these mocked tests.

## Screens validation

- Implementation `d27b80b5924999531c387bce2d341773aaa1ac21` pins screens 4.29.0, narrows the Yarn diff to that dependency, regenerates runtime 1.8.22/code 104, and resolves RNScreens 4.29.0 through CocoaPods.
- Frozen install, typecheck, dependency pins, reviewed Expo Doctor, clean prebuild and pod install pass. App suite: 2,289 pass, one skip, zero failures; crash-reporting workspace: 51 pass, zero failures.
- Independent review of that implementation found no actionable issues. Android debug compilation is still running; iOS compilation and device validation remain unverified.

## Delivery boundaries

The existing runtime 1.8.21/code 103 Android build was previously submitted to Google Play. This dependency integration is separate: native runtime bumps require their own store build before publishing matching OTA updates. No new store availability or live billing/provider validation is claimed by these PR checks.
