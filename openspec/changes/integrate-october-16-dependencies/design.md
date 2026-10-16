# Design

## Context

Starting main is 6060999, app/runtime 1.8.23, Android code 105. Existing native source guards and Babel 7 adapters are load-bearing. Expo now recommends React Native 0.88.0 stable and Screens 4.30.0; PR #1000 still proposes rc.5 with rc.4 transitive pins. New expo-doctor exports prevent resolving its CLI as an unexported subpath.

## Decisions

- Upgrade the coordinated React Native package set only after reviewing upstream guarded bytes and native compatibility. Prefer the now-recommended stable release over the superseded rc.5 when validated. Keep source hashes and lifecycle regression tests.
- Maintain each existing PR where practical, preserve signed Dependabot ancestry, and use normal protected merges. Native changes increment the declared runtime and build number; do not reuse a shipped runtime.
- Adapt the existing custom HTML document to Expo Router's server document context. The streaming renderer supplies asset and font nodes through that public context; preserve the existing scripts, route metadata, privacy gate and static export checks, and add a missing-client-script regression. This preserves current rendering behavior rather than adding a feature.
- Resolve the doctor executable relative to its exported manifest, with a regression exercising export restrictions. Keep online dependency and source checks enabled.
- Refresh the dependency watch from the registry. Only exact candidate/consumer evidence can justify a retained compatibility pin; failed lookups cannot close the issue.
- Root owns merge decisions. Specialists implement disjoint release and doctor changes; a separate reviewer assesses their final commits. No designer is needed because this change does not alter UI.

## Risks / Trade-offs

- Native changes can compile differently across Android and iOS: regenerate through Expo, run native build checks, and distinguish verification from store publication.
- Main merges trigger automatic Pages and Hosting deployment: serialize merges and inspect delivery results.
- Existing worktrees may contain unfinished work: remove only task-owned completed worktrees; retain the dirty Compose migration.

## Migration Plan

Review sources and pins, repair PRs, run required local and CI gates, obtain independent review, then merge. Refresh issue #921 from the final main manifests. Revert the relevant merge if a regression is found; retain the prior store runtime and avoid publishing an incompatible OTA. Verify automatic web delivery and clean completed refs.
