# Proposal

## Why

Three dependency PRs from October 23 remain open on October 25. Expo fails guarded installation, Firebase 27 rejects the legacy iOS configuration, and the native integrations lack a new runtime; green JavaScript CI alone cannot validate the combined native graph.

## What Changes

- Integrate the reviewed updates from PRs 1032 and 1034 with coordinated exact resolutions, source guards and committed lockfile changes.
- Keep Firebase PR 1033 open with verified native migration blockers: the current Google Sign-In wrapper pins an incompatible Apple SDK family, and Android Kotlin is below Firebase 27 requirements. Preserve Firebase 26.4 and its working configuration.
- Regenerate native projects with version/runtime 1.8.28 and build 110, then validate builds and existing mocked journeys.
- Merge after independent review and required checks, verify automatic web delivery, and close only fully superseded dependency PRs.

## Capabilities

No product requirements change. This is dependency/build maintenance; skip_specs is true. Existing automatic merge eligibility remains conservative for native updates.

## Impact

Root dependencies, compatibility guards, generated Android/iOS projects and lockfiles. Firebase configuration remains unchanged. No new product features, permissions, credentials, paid services, store submission or OTA publication are included.
