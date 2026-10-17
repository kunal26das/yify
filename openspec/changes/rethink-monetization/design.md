# Design

## Context

See [proposal.md](proposal.md) for motivation and the two capability deltas for observable requirements. The purchase repositories already serialize identity-sensitive work, reject stale account results, preserve cached access on temporary failures, and distinguish cancellation, pending and missing entitlements. Their 219-test focused baseline passed during the contract audit; that is baseline evidence, not validation of this change.

The starting `/upgrade` route delegates to an automatically opened modal. General checkout includes fictional insight examples, member status has no direct benefit actions, and the post-ad hook can wait for offer loading and a sales dialog before continuing playback. Native ad display already protects unknown entitlements, but preload/retry conditions ignore a paid cache until `ready` becomes true. A private mocked probe reproduced that last gap without contacting an ad provider.

## Goals / Non-Goals

**Goals:** Reuse one membership body across a real destination and contextual dialogs; preserve identity-safe purchases; make member use and recovery easy; bound advertising using actual displays; ship within runtime 1.8.25.

**Non-Goals:** Live commercial plan creation, price changes, native UI packages, automatic journal tracking, subscriber server changes, alert-pilot enablement, ad-provider configuration, new analytics identity joins, acquisition spending or a revenue forecast. Free sync, privacy requests, deletion and journal CRUD remain outside the paid boundary.

## Decisions

1. **Shared membership content, distinct page and modal containers.** Extract reusable presentation content while retaining the modal request queue and per-account lifecycle protections. `/upgrade` renders it persistently; contextual placements remain explicit user actions. Retaining the auto-open-and-redirect route would not provide a lasting member destination, while two separate offer implementations would risk divergent terms and recovery.
2. **Use existing purchase metadata and recurring products.** Display available recurring monthly and yearly offers with actual localized prices and renewal/prepaid terms; do not hard-code historical prices, invent annual savings or resurrect lifetime sales. The October 17 read-only catalog audit found only `$rc_monthly`, no yearly product/package, and did not verify exact prices. A yearly price equal to ten monthly payments for twelve months is a commercial proposal only; configuring and validating it is separate from UI readiness. Existing `remove_ads` grants, including lifetime grants, continue to activate benefits. Server-verified Anime/raw access is a separate contract, and availability alerts remain a disabled restricted pilot.
3. **Prioritize member use and recovery.** Active state offers `/journal?tab=insights` and `/journal`, accurate billing status, safe management links and platform-specific restore/check actions. Journal query handling selects Insights without bypassing its real entitlement/account gates. Pending/not-granted outcomes suppress repeat checkout until resolved; cancellation remains an ordinary return to idle. Refresh failures must not claim verified access. Keep the account-keyed presentation and serialized SDK work rather than adding a second purchase state machine.
4. **Explain value without mock checkout data.** Reuse typography, palette and accessible primitives for two benefit rows, an explicit free boundary, actual billing terms and a single purchase action. General checkout has no example statistics. Any actual insight surface derives data from the current account's journal and offers logging when empty. Public support copies the same boundaries.
5. **Bound Android ads with session pacing.** A pure domain decision uses qualifying movie-open count and last actual OPENED time; the gateway commits display state only on the real opening callback. First two opens are free; after a display, three more opens and 120 seconds are both required. An eligible no-fill or presentation failure leaves the allowance unused. Keep queue advancement excluded and preserve existing single-flight presentation and tracking semantics. Session memory avoids collecting additional browsing history; restart begins a fresh allowance and is not a claim of an installation-wide daily cap.
6. **Remove the automatic post-ad offer.** The playback continuation no longer fetches or waits for an offer after an ad. Keep voluntarily opened discovery/settings/journal offers and the existing persistent dismissal. This reduces an interruption-based sales exposure; commercial benefit is a hypothesis to measure.
7. **Honor cached paid suppression at request boundaries.** Native preload and retry checks use `adsRemoved` even when `ready` is false, rechecking after asynchronous network work. Unknown-false preload remains the existing behavior; display still waits for readiness. Fully delaying SDK initialization for all unknown accounts would be a broader policy and latency change.

## Risks / Trade-offs

- Fewer interstitials and no post-ad offer may reduce short-term ad revenue or sales exposure → compare genuine production payments, ads per active usage cohort, refunds and retention after release; do not claim uplift from fewer interruptions alone.
- Shared content refactoring can duplicate impressions or lose modal callbacks → cover direct-page and modal visibility, account remounts, repeated presses, interrupted sign-in and stale completion handlers.
- Restricting display to supported recurring plans can expose a configuration problem as no offer → retain explicit retry and existing-purchase recovery; do not silently substitute unsupported plans.
- Pending-payment suppression can become a dead end → expose refresh/restore and clear recovery only on an appropriate current-account result; test failed checks and later successful activation.
- Ad OPENED can be delayed or duplicated → commit once on the actual callback and preserve single-flight presentation; test failures and delayed events with a fake clock.
- A source-valid interface can still clip or trap focus → inspect narrow/short, large-text, light/dark, keyboard and screen-reader semantics in rendered fixtures; unit tests are not device evidence.

## Validation and migration plan

1. Complete focused membership, journal-route, payment-state, ad-break, pacing and cached-paid tests; run required typecheck/full tests and strict active/archived OpenSpec validation. Compare lint with baseline where applicable.
2. Obtain independent review of the exact revision and rendered web/Android-compatible layouts with production telemetry, purchases and ads blocked. Record unexecuted native/store journeys explicitly. Confirm package/runtime/native files remain unchanged.
3. Merge through the normal reviewed PR/CI path. Verify both production web publications with exact-source receipts and rendered startup checks; a successful export alone is insufficient.
4. Publish one Android Production OTA compatible with runtime 1.8.25/code 107 through the existing release workflow. Verify update identity/channel/runtime and a compatible installed client's received behavior. Do not conflate publication with receipt.
5. Preserve the previous production web source and Android update identifiers before publication. If access, billing, privacy, startup or playback regresses, restore the prior compatible release through existing rollback workflows; do not loosen entitlements or change native runtime to recover a JavaScript regression.
6. Record receipt URLs and actual rollout dates in tasks/evidence, then sync implemented specs and archive only fully completed release work. Leave production commercial observation separate from delivery completion.

## Measurement and stopping criteria

The new release's live baseline is unknown. Historical aggregate snapshots and offline fixtures do not establish a current ordered conversion cohort. After both released clients and real consented event values are verified, record actual start dates and compare a complete 14-day window, separating platform, release, existing members and exposed free-user cohorts. Measure genuine RevenueCat production first payments, refunds and first renewals separately from analytics offer/checkout activity. Observe a complete monthly renewal cycle before judging retention. No new analytics identity linkage or customer content is required.

Pause expansion immediately for incorrect charges/access, impossible restore/cancel recovery, cross-account data, consent violations, blocking crashes or playback failures. If offers fail to load, fix delivery before considering pricing. If checkout errors, refunds or user-reported unwanted charges worsen materially against an established comparable baseline, investigate and roll back the relevant change; low traffic or an absent baseline means inconclusive rather than success. No campaign or spend is authorized by the growth budget ceiling.

## Open questions

Actual store/client offer availability and prices, the release-specific measured baseline and eventual retention impact remain unverified despite the read-only catalog inventory. These do not change the actual-recurring-offer contract or authorize production billing tests. Actual publication, client receipt and rendered acceptance remain tasks until evidence is supplied.

## Follow-up name

The owner selected a paid-tier rename on October 17; the chosen customer-facing brand is **Yify Plus**. This is a copy/metadata-only refinement: benefits, free access, product/entitlement identifiers, analytics placement IDs, routes, legal anchors and billing configuration remain the same. Existing paid and legacy grants retain access. Store checkout titles and current RevenueCat display names use the new brand; historical receipt names are not rewritten. Validation and publication are recorded in the follow-up PR.
