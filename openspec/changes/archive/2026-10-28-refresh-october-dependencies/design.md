# Design

## Context

See proposal.md for the maintenance scope. Main starts at d686275337a6ec3020f5c7cec639edd7c0c11357. Eight open Dependabot proposals share the root graph; native projects and reviewed source patches are committed. CI on main publishes both existing web targets after successful checks.

## Goals / Non-Goals

Preserve customer journeys, consent, entitlement checks and native crash protections while updating the proposed dependencies. Store publication, OTA publication, iOS publication, new permissions and new credentials are outside this merge task.

## Decisions

Integrate one coherent graph rather than merge red PRs separately. RNFirebase 27.1.0 requires Firebase JavaScript 13.1.0, Android BoM 35.0.2 and Apple SDK 13.1.1. Expo 58.0.19 requires coordinated internal resolutions. Retain exact versions, fail-closed source hashes and both fresh and frozen installation checks.

Advance the native runtime to 1.8.30/code 112 before native regeneration. Preserve the previously shipped-runtime ledger. Keep Babel 7 and TypeScript 6 adapters for tools requiring their APIs; update the fixture compiler to Babel 8.0.9.

Correct fixtures based on actual SDK contracts. Missing-package diagnostics may arrive in any Promise rejection order. New documented billing error codes remain a bounded enum; arbitrary codes and private error payloads remain rejected. Sentry fixture loading must still prove profiling and replay stay disabled by default and that explicit enabling is detected.

## Risks / Trade-offs

Native dependency changes can compile while failing at runtime. Use the existing four-ABI Android compile-only checks and preserve the distinction between compile/link evidence and installed-device behavior. Prepare iOS without publishing it. Do not claim a store release from a merge or web deployment.

Fresh resolution can introduce transitive changes beyond the named PR packages. Commit and review the actual lockfile diff, run all application and release-console gates, and verify both rendered exports.

## Migration Plan

Review the exact final integration commit independently, require successful CI and Android graph/native checks, merge through a normal PR, then verify automatic web deployments against their source. Retain a private baseline bundle for recovery. Verify every superseded PR's intended package changes on merged main before closing it and deleting completed task branches. A source revert to d686275 is the rollback path; no new Android runtime is published in this task.
