# Tasks

The build and compile work in `design.md` is existing evidence, not work to repeat. Only checked tasks have supporting evidence in `design.md`; planning and static artifact checks do not mean Android has shipped.

## 1. Candidate verification

- [x] 1.1 Refresh EAS and Play state and compare current app/native inputs with candidate 98's source; record whether that exact candidate remains usable, its downloaded hash and whether any submission already exists.
- [x] 1.2 Extend the existing production AAB verifier and workflow to accept the intended candidate identity; add passing identity and source/hash/signature/version/runtime mismatch tests and record their results.
- [x] 1.3 Verify the signed bundle's four ABIs and packaging, generate device APKs with bundletool and install them; preserve package/signature/version identity, device configuration, logs and rendered evidence for this candidate.

## 2. Framework and app journeys

- [x] 2.1 Execute the reviewed HSDP legacy failure control and corrected malformed, repeated and lifecycle cases on API 30 and a current Android target; preserve per-case results and label infrastructure-blocked cases not executed.
- [x] 2.2 Verify consent with analytics declined, restart, connected startup and browsing on the installed candidate; record persisted choice, observed requests, logs and rendered small-screen/enlarged-text results without public customer data.
- [ ] 2.3 Verify sign-in, subscriber access and account switching using an applicable authorized test path; record expected entitlement acceptance/rejection and absence of previous-account access.
- [ ] 2.4 Verify purchase and restore through a compatible Play installer/signature and billing test account; preserve sandbox results and explicitly record any untested path without real charges or refunds.

## 3. Delivery and health

- [x] 3.1 Consolidate scenario evidence, refresh affected required checks, obtain independent review of the exact release source and candidate, and document rollback; record findings and their resolution before publication.
- [x] 3.2 Recheck live release state and submit the verified candidate once through the existing authorized EAS route; record submission receipt and profile/track separately from store availability.
- [ ] 3.3 Verify Play availability for the intended version and track, and update the release ledger/handoff with actual receipts; do not mark this complete on submission acceptance alone.
- [ ] 3.4 Review at least 24 hours of version-specific Sentry and Crashlytics health after availability, with exposure and matching signatures; record recovery or regression, leave insufficient evidence inconclusive, and close only validated incidents.

## Workflow follow-up

- Update the plan when evidence changes; retain incomplete or inconclusive work as active.
- Sync the implemented requirements and archive only after the tracked outcomes are verified.
