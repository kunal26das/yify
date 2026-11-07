# Evidence

## #1059

Proposal head `ce2bdd579917a9ac8066e8fa2ee5fc8d678691a3`, based on main `525faa9`. The shared CI failure was `Unreviewed Expo dependency: react-native-safe-area-context@5.10.1; expected ~5.11.1.`; the proposed 5.11.0 also fails ~5.11.1, so the branch takes 5.11.1. The lockfile changes only Google Sign-In 17.0.0, Purchases 11.0.0 with its hybrid packages 20.1.0, Safe Area 5.11.1, Screens 4.30.1 and two unused transitive entries.

Google Sign-In 17.0.0 changes only iOS packaging: its JavaScript and Android sources match 16.1.5. The two existing source guards moved to 17.0.0 and six new guards cover the wrapper manifest, adapter podspec, Swift package, dependency selector and adapter URL forwarding. The exact-version patch replaces the three retired patches, so the manifest verifies 103 sources and two patches. The committed iOS project selects SwiftPM in the Podfile and no longer links GoogleSignIn into the application target; Podfile.lock still lists the 1.8.30 pods.

Purchases 11.0.0 uses RevenueCat Android 11.0.0 with Play Billing Library 9.1.0. The app does not call the changed Amazon sync API, and the error-code enum is unchanged.

Android prebuild changed only the version fields for 1.8.31/113. Local checks: installation guards (2 patches applied, 105 targets verified), tooling adapters, Firebase policy, exact pins, Production channel, typecheck, app and workspace tests, the reviewed Expo doctor and strict specs.
