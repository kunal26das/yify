# Tasks

## 1. Connectivity

- [x] 1.1 Implement web reachability corroboration and verify browser false positives, genuine offline/reconnect, SSR, provider failures, timeout and event races with focused tests. The monitor/request suite passes 39 tests; a live-network browser with a forced negative connectivity flag loads catalog content without an offline banner.

## 2. Startup

- [x] 2.1 Remove the web font readiness barrier and verify delayed/failed font rendering without changing native startup. Browser QA with font requests aborted still renders the consent controls and homepage content.
- [x] 2.2 Keep the real home list mounted while the hero loads and verify visible shelves load independently, partial failures remain recoverable and refresh keeps content. The home/consent regression tests pass; browser QA delaying the hero by five seconds shows a usable shelf and preserves the same list scroll element through hero completion.
- [x] 2.3 Verify first-ever and returning privacy journeys, phone/desktop layouts, slow loading and reduced motion in rendered previews; record evidence. Slow-script returning visits keep the inert home layout without a false dialog. Missing, malformed, outdated, unavailable or revoked receipts restore the required gate; stalled scripts expose focusable recovery links. Independent rendered design review passed for phone/desktop. Reduced-motion startup passed; extreme CSS zoom exposed a possible existing title overflow that is not established as a regression or as OS text-scaling behavior.

## 3. Integration and delivery

- [x] 3.1 Pass typecheck, full tests, export checks and OpenSpec validation; obtain independent code and scenario review. Typecheck, Hosting/Pages exports and strict OpenSpec validation pass. Full suite: 2,274 app tests and 51 crashreporting tests passed, one existing test skipped. Independent code/security/privacy review approved d576984; rendered QA and design review passed. Changed-file lint matches the base revision's four existing findings.
- [x] 3.2 Commit, merge through passing CI and verify live Hosting and Pages startup/connectivity behavior. PR #980 merged as b79e862 after green reviewed-head CI. Main CI 38078671974 and deployments 38078986099 (Hosting) / 38078986090 (Pages) succeeded on October 10 UTC. Guarded live checks passed first consent with analytics off, returning hydration, forced false browser-offline with real catalog responses, genuine offline/recovery and actual hero images on both targets. No browser page errors were observed.

## Workflow follow-up

- Archive and synchronize the spec after verified delivery.
