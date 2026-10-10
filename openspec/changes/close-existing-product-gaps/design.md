# Design

## Context and audit

Source baseline: `fa7d0ae82b46b4e72b801c8237d7b442b19fec7b`, 2026-10-10. Independent product-design, journey and account reviews covered all existing primary routes and their supporting view models. These are code-confirmed defects; rendered and provider evidence is tracked separately in verification.

| Area | Confirmed gap | Correction |
| --- | --- | --- |
| Home | Old hero/shelf requests survive refresh; empty hero hides populated shelves; failed shelves disappear; retained hero hides refresh failure | Request generations and explicit partial-failure/retry states |
| Movie details | Refresh error replaces retained details | Full error only without details; compact notice and retry otherwise |
| Search | Mobile rejects empty submit | Apply empty query, preserve other filters and exclude empty history |
| Account | Sign-out clears state after Firebase failure | Propagate truthful outcome, preserve session on failure and show feedback |
| Supporter | Ready cached state is mistaken for successful refresh | Explicit refresh result with cached-access preservation |
| Delete account | Outcome/partial deletion not announced; conflicting actions remain enabled; billing consequence omitted | Precise result feedback, pending-action guard and concise billing reminder |
| Privacy/support | Native ad privacy and browser-link failures disappear | Existing toast feedback and repeatable operation state |
| Shared controls | Small fixed-height action pills; unrelated sheet close label; absent heading semantics; obsolete removal copy | Existing spacing/type styles, flexible targets, contextual labels and explicit heading roles |

Shows/anime pagination, movie filtering, watchlist/history storage, journal, streaming availability, notifications, privacy persistence, YouTube consent and protected catalog boundaries were also traced. No additional concrete defect was established in those areas during source review; this is not a claim of exhaustive runtime correctness. Reduced-motion behavior is a rendered check because the app already has system reduced-motion configuration.

## Decisions

- Reuse current layouts, typography, palettes, spacing, toast and action primitives. No redesign, dependencies, feature flags, new destinations or analytics events. Error/retry feedback completes existing interactions.
- Scope request generations to the home view model and guard results, catch and cleanup. Retain successful content where sensible; avoid showing another movie's stale details when route identity changes.
- Give account/purchase operations explicit reliable results rather than inferring success from cached readiness. Preserve account/revision guards. Background refresh callers must safely handle the new result contract. Match native and web implementations.
- Keep deletion ordering as implemented; describe partial completion honestly rather than expanding this repair into a new deletion transaction protocol. No live deletion tests. Avoid exposing raw provider errors or customer identifiers in copy or evidence.
- Add heading roles at semantic call sites, never globally to all large text. Replace fixed action heights with minimums/padding, and inspect narrow/enlarged-text wrapping. Correct the shared close label through the existing title.

## Validation and delivery

Use deferred promises and mocked providers to reproduce stale-response, failed-refresh, failed-signout, partial-deletion and failed-form cases. Inspect a local web export with same-origin catalog fixtures and all external requests blocked before navigation, at phone and desktop sizes, both themes and enlarged text. Run preview preflight, typecheck, focused tests, aggregate tests and required CI. Inspect rendered changes with the designer and obtain independent review of the exact final commit.

Web/browser evidence does not establish native SDK or real-store correctness. Use available native test infrastructure if practical; record absent device/real-provider checks precisely. No production purchases, ads, deletion, permission changes or new services. Shared JavaScript changes require the existing release route and compatible runtime; the pending native binary plan remains separate. This change does not publish a store build or OTA. Revert through normal reviewed source/CI if regression is found; main merges trigger existing web workflows.

## Risks

- Broader operation result contracts can affect silent callers: inspect every call site and cover both platform implementations.
- Concurrent writers can overlap shared screens: assign exclusive paths; the lead integrates only after the owner finishes.
- Static correctness can miss focus, text clipping or partial failure layout: rendered verification and explicit limitations remain required.
