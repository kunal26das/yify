## Why

Three dependency PRs remain open: the Expo update fails guarded-source validation, the screens update needs a native runtime review, and the release-console update is blocked by an unrelated Expo recommendation change. Integrate the reviewed updates without weakening the merge checks or mixing incompatible native runtimes.

## What Changes

- Review and validate react-native-screens 4.29.0, with a new app runtime and Android version code.
- Align Expo's updated packages, exact pins, source guards and generated native projects after inspecting the upstream changes.
- Revalidate the release-console Node type update against the repaired app baseline and use the existing automatic merge workflow where eligible.
- Preserve committed lockfile changes and record exact-head validation and merge evidence.

## Capabilities

No product requirements change. This maintenance change uses `skip_specs: true` and does not amend the existing product capability specifications.

## Impact

Root and release-console dependency manifests and lockfiles, guarded native patches, generated Android/iOS metadata, and dependency-validation evidence. Successful main CI starts the existing web deployment workflows. A merged native dependency update does not itself establish a completed Android store release or OTA delivery.

## Android delivery follow-up

After all three PRs merged and both web deployments passed, the owner explicitly requested Android deployment. Deliver the resulting runtime 1.8.23/code 105 through the existing remote Expo signing and production Play submission route, after candidate-specific bundle and device checks. No new product features, credentials, provider tests or iOS publication are introduced. Record submission separately from Google review and user availability.
