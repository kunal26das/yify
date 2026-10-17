# Design

## Context

This is a proposed implementation contract, not shipped behavior. See [proposal](proposal.md) and the dated [regional assessment](evidence.md). No jurisdiction is approved for default-on operation of the current measurement bundle.

At `7b68989021d85e8b1613aee48c21f19821f583d2`:

- `domain/entities/PrivacyChoices.ts` and `data/services/optionalAnalytics.ts` require adult confirmation and an explicit analytics choice. `data/services/PrivacyPreferencesImpl.ts` rejects old notice versions and defaults the whole receipt to off.
- Native/web Firebase sinks, optional Sentry telemetry and RevenueCat measurement use that choice. The welcome copy includes purchase and ad measurement. A new name alone cannot narrow the processing.
- `presentation/movies/components/watchRegion.ts` can derive the viewing country from locale/time zone and fall back to US. Users can manually change it. This is not verified jurisdiction evidence.
- Account/purchase startup continues after adult confirmation without optional analytics. Error reporting remains active; its legal-basis assessment is explicitly pending in `docs/privacy-processing-register.md`.

## Goals / Non-Goals

Provide an implementable eligibility contract and identify the evidence required before collection expands. Preserve current layouts, paid access and adult-only entry. Do not add location collection, replace analytics vendors, introduce new marketing purposes, treat diagnostics as automatically lawful, or claim every supported country has been assessed.

## Decisions

### Assess each purpose and provider configuration

The initial candidate is minimized product-use and performance measurement. Its approved field inventory must exclude advertising measurement/attribution, Firebase-to-RevenueCat measurement linkage, account identity, free text and raw location. Provider SDK identifiers, individual traces, retention and aggregation need explicit assessment; calling the category basic does not make it anonymous or exempt.

Keep the existing bundle opt-in until the narrower path is implemented and verified. Do not use a country denylist whose unlisted countries silently permit everything. The default-on allowlist starts empty; research alone does not approve an entry.

An approved entry must identify the jurisdiction and relevant state/province scope, purpose/field inventory, provider configuration, platform, assessed processing/transfer grounds, required notices/opt-outs, approving decision/evidence, review expiry and policy version. Cross-cutting obligations of the India-based operator remain applicable inputs. Expired, unavailable or unmatched entries give no default-on eligibility.

### Preserve decisions independently from notices

Replace the single boolean's implicit provenance only in the later implementation. Per-purpose state distinguishes unset, explicit permission, explicit refusal and regional default. Record the decision time, notice/purpose version and applicable policy version. Keep age confirmation separate.

Migrate a legacy saved `analytics: false` as refusal without requiring the current notice version. A legacy true value applies only to its documented scope; it cannot automatically authorize a new purpose or broader sharing. Corrupt/unreadable storage stays off. Do not treat removal of a now-obsolete receipt as an eligible first visit.

### Evaluate policy without changing layer boundaries

A pure domain decision evaluates choices, approved policy and coarse jurisdiction evidence. Platform/service implementations provide evidence through existing composition conventions. All affected sinks must consume the same effective purpose decision; Sentry transport revision checks still reject stale optional work.

Do not reuse the streaming-country preference, language or payment country as proof. Before implementing default-on operation, verify an available jurisdiction source, its confidence/failure semantics and whether state/province distinctions can be established. No new IP/geolocation vendor is selected or contacted by this proposal. Do not store raw IP or coordinates solely for policy evidence.

### Explain defaults before sending optional events

Retain the existing welcome card and Preferences layout. Product analytics and advertising purposes need accurately separated controls and provider descriptions. The default-on state must say it is a regional default and offer immediate refusal. Continue with an untouched switch is not affirmative consent. Displayed or submitted choices take precedence over a later policy lookup.

Where eligibility is unresolved, entry remains possible with analytics off. The adult declaration does not become analytics consent. Keep YouTube permission and Google UMP/CMP decisions independent. Honor relevant platform restrictions and privacy signals for the processing to which they apply; do not assume GPC bans every form of first-party statistics or ignore it for regulated sharing.

### Keep rollout evidence distinct from permission evidence

Existing consent checks establish a regression baseline, not approval of any regional exception. The later rollout needs unit/race tests plus actual provider request/storage checks for refusal, approval, withdrawal, region changes and rollback. Cover Android, web and applicable iOS behavior; prepare iOS without publishing it.

The baseline is globally opt-in measurement with no approved regional default. Success is correct effective decisions and measured coverage only within approved cohorts, with zero optional requests outside an eligible decision. Evaluate a later pilot for seven days after verified delivery; stop immediately on refusal override, unapproved payloads or stale-event leakage. No revenue forecast follows from increasing measurement coverage.

## Risks / Trade-offs

- Loss of legacy refusal on notice update → migrate refusal separately before enabling defaults.
- False geography or stale policy → unresolved state stays consent-first; policy expiry and rollback disable regional defaults.
- Bundled vendor processing exceeds an exception → approve the actual field inventory, contracts and transport behavior per purpose/platform.
- Provider SDK startup precedes policy → retain native off defaults; defer optional initialization and guard each asynchronous boundary.
- Reduced measurement coverage while assessment is incomplete → use existing consented measurement; do not manufacture permission or backfill refused events.

## Migration Plan

1. Complete the purpose/field/provider assessment and a documented decision for at least one eligible configuration. Verify jurisdiction evidence and applicable opt-outs. These are release prerequisites, not claims established here.
2. Implement and independently test receipt migration before any default can become active. Keep a kill switch that disables regional defaults without erasing explicit decisions.
3. Implement the separated purpose decisions and accurate notices. Recheck provider contracts/configuration, runtime compatibility and actual outbound traffic with isolated fixtures before bounded live verification.
4. After review, release web through existing CI and compatible Android code through the established OTA route. Native SDK default changes require a new runtime/binary; no OTA may claim to change pre-JavaScript defaults. iOS release remains outside current authorization/setup.
5. Verify receipt migration and actual delivery before enabling an assessed cohort. Roll back by disabling the affected default and confirming transport shutdown; restore the prior tested release for a code regression. Preserve explicit refusals throughout.

No implementation or deployment is performed by this planning change. The [tasks](tasks.md) separate completed preparation from prerequisite evidence, code, publication and observed outcomes.
