# Design

## Context

Source `69c60b1e69c3535743b7fa3a82c878132e988061` passed main CI 38913531664. Hosting 38914134757 and Pages 38914134964 succeeded; live startup checks passed on both. Previous source verification covers typechecks, app/workspace/release tests and Android Debug plus iOS Simulator compilation. These checks do not establish a signed release startup pass.

The current Expo production profile uses the existing remote default upload key and submission service account. Presence was verified without reading secret values. The latest existing build is code 105; the fresh Play metadata read lists production 1.8.23/code 105 and no code 107 bundle. Store availability still needs the authenticated Console rather than the API's completed status alone.

## Goals / Non-Goals

Deliver the current source once, retaining exact artifact identity and a truthful release result. Do not add product features, modify credentials or permissions, publish iOS, or claim billing/provider/crash-health coverage from a sideloaded APK.

## Decisions

Build with the existing production EAS profile and automatic submission disabled, so the signed artifact can be verified before Play receives it. Use the current verifier with a candidate-specific manifest, existing upload-certificate fingerprint, four-ABI packaging/JNI checks and actual bundletool-generated installed APKs. Exercise startup, analytics-off consent/restart and bounded catalog/detail/watchlist paths on disposable devices, keeping unrelated telemetry blocked.

After independent artifact review, recheck Expo/Play state and submit the exact build through the existing play-production profile. If Expo's submission workers fail before upload, inspect their receipts and Play state before using the already established exact-artifact Play fallback. Never repeat an ambiguous upload blindly.

Web is already delivered at the requested source; reuse its fresh verified receipts instead of triggering a duplicate manual deployment. Any final evidence commit uses ordinary PR review and required CI, accounting for the existing automatic web workflows.

## Risks / Trade-offs

- Native regressions require signed-artifact device checks; previous version screenshots or Debug compilation cannot satisfy them.
- Play review may outlast this task; report submission and pending review accurately and keep availability tracking open.
- Live billing, sign-in/account switching and long-window crash health remain unverified unless an appropriate existing test path is available. Preserve their open tracking rather than infer success.
- Rollback cannot downgrade installed Android binaries. Halt an eligible rollout if necessary and prepare a validated higher-code correction; web rollback uses reviewed source and existing CI.
