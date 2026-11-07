# Design

## Context

Main starts at `525faa9c0015b6ae6050ff91eb7b7ec3ca572e8a` with runtime 1.8.30/code 112, which was never built or shipped. Android 1.8.29/code 111 is the latest Play submission.

## Decisions

Merge #1059 first because it owns the Safe Area recommendation that blocks every other PR's CI. Take 5.11.1 instead of the proposed 5.11.0 to match Expo; keep every other proposed version, preserving the three-day cooldown.

Google Sign-In 17.0.0 ships the SwiftPM path the 16.1.5 patches added. Select it with `iosDependencyManager: "spm"`, retire the patches and `withGoogleSigninSpm`, and guard the upstream sources. Upstream accepts any GoogleSignIn 10.x, so a one-line podspec patch keeps the requirement at exactly 10.1.0, and a test checks the committed `Package.resolved`. The adapter now forwards URLs to the dynamic RNGoogleSignin framework, so the application-target link is removed rather than duplicated. The wrapper's JavaScript and Android sources are unchanged.

Purchases 11.0.0 moves Android to RevenueCat 11.0.0 with Play Billing Library 9.1.0, Kotlin 2.2.21 and a compileSdk 35 floor; the app compiles against 37 with Kotlin 2.4.20. Its only API change is the Amazon sync signature, which the app does not call. Error codes are unchanged.

Advance runtime/build to 1.8.31/113 in the first native PR and keep it for the series, because no binary is built until the last native PR merges.

Later PRs rebase guards, policies and resolutions from reviewed published bytes; their decisions are recorded in the evidence as each merges.

## Risks / Trade-offs

Native changes can compile and still fail at runtime. PR CI covers the Android graph; a signed-AAB check precedes Play submission. On-device startup, live purchases and sign-in are not verified in this task. iOS cannot be compiled here: regenerate Podfile.lock and pass simulator builds on macOS before any iOS release.

## Migration Plan

Merge each PR after its required CI passes, verify web delivery from main CI, then build and submit Android 1.8.31/113 from final main. Roll back by reverting the individual squash commit. Never resubmit code 113 or send this native graph as an OTA to older runtimes.
