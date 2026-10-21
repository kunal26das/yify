# Design

## Context

The candidate source is clean main `68e73e5c0213957ce83f50f585ec93949f85b129`. Exact-source CI passed. Its application/native/lockfile tree matches the independently reviewed and compiled October 21 dependency cohort; those results establish source readiness, not signed store readiness.

## Decisions

- Reuse the existing Expo-managed upload key and submission account with frozen credentials. No replacement key or new account grant is needed.
- Build without automatic submission so verification can gate the exact signed AAB. Submit only its verified build ID using `play-production`.
- Pin source, version/runtime, code, channel, bundle hash and upload certificate in a private candidate manifest. Reuse the candidate-aware verifier, bundletool and four-ABI native-library checks.
- Test candidate-derived APKs on task-owned offline 4 KB and 16 KB devices, recording installed bytes, startup, adult confirmation with optional analytics off, cold restart and About version. Keep connected account, billing, real ads and provider flows unverified unless independently isolated and exercised.
- Preserve remote build/submission receipts and query uncertain outcomes before any retry. Record review separately from Play availability; do not enable runtime 1.8.27 in the shipped ledger prematurely.

## Risks and recovery

Compilation can miss signed packaging or runtime failures; inspect the actual bundle and install its derived APKs. An upload may finish before Play review; report that distinction explicitly. A store binary cannot be downgraded by OTA; a later incident requires a compatible JavaScript update or a new higher-code binary. Do not republish current native dependencies under older runtime labels.

## Delivery

Verify the accepted production build, download and pin its artifact, finish signed/device review, recheck duplicates and credentials, submit once, then inspect terminal upload and Play status. Reconcile sanitized evidence through normal review/CI and preserve private artifacts while cleaning task-owned devices, caches and branches.
