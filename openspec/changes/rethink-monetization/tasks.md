# Tasks

## 1. Contracts and delivery plan

- [x] 1.1 Trace current purchase, ads, free/paid, privacy and server-access contracts; record baseline evidence and distinct unknowns in the design without changing live services.
- [x] 1.2 Complete proposal, capability scenarios, design and public/growth documentation; verify strict OpenSpec validation and consistency with actual recurring offers, free features and pending release status. Strict active/canonical validation passed 9/9 and archived validation passed 6/6; 58 web-export/privacy tests passed, and support-page twins match after relative-link normalization.

## 2. Membership and purchase experience

- [x] 2.1 Implement the persistent `/upgrade` destination and shared voluntary offer content; verify page persistence, contextual close behavior, safe-area/large-text layouts and account-scoped impression behavior with focused tests and rendered fixtures.
- [x] 2.2 Present only actual monthly/yearly recurring offers with SDK-localized terms; verify absent yearly configuration creates no placeholder or invented price, unsupported one-time offers remain unavailable, and sign-in never purchases automatically.
- [x] 2.3 Replace immediate repeat checkout after pending/not-granted outcomes with recovery; verify failed refresh, successful later activation, cancellation, duplicate actions and account switches in native/web purchase presentation tests.
- [x] 2.4 Add current-member actions to `/journal?tab=insights` and `/journal`, accurate status and billing/restore recovery; verify actual/empty journal states, legacy access, expired access and query-driven tab selection without changing journal privacy or free editing.
- [x] 2.5 Align settings, discovery and public support copy with the two real benefits and existing dismissal/engagement gates; verify no fictional checkout statistics, new universal server benefits or free-feature restrictions.

## 3. Advertising and operational safety

- [x] 3.1 Remove automatic post-ad sales interruption; verify requested content continues after ad completion without fetching or waiting for supporter offers.
- [x] 3.2 Implement session pacing with first two movie opens free, at least three opens and 120 seconds between actual OPENED events; verify queue exclusion, duplicate/delayed callbacks, no-fill, failed show and continued playback using fake-clock tests.
- [x] 3.3 Suppress preload/retry for cached paid state before verification; verify startup, delayed connectivity and retry transitions while preserving consent and later free-state recovery.
- [x] 3.4 Retire the obsolete lifetime-sales migration script without reading credentials or contacting services; verify syntax and that default/`--apply` invocations reject mutation, and document catalog evidence plus separate yearly setup prerequisites. `bash -n` passed; default and `--apply` each returned 64 with no stdout, credential read or network code.

## 4. Integration and independent verification

- [x] 4.1 Run required typecheck/full tests and strict active/archived OpenSpec validation on the candidate; record exact results and confirm no native, dependency, runtime or live commercial configuration change.
- [x] 4.2 Obtain independent scenario/security review and rendered design acceptance of the exact revision; cover signed-out, signed-in, active, legacy, pending and unavailable states, narrow/large-text/dark layouts, and keyboard navigation with production telemetry/purchases/ads blocked.

Validation evidence (October 17): `yarn typecheck` passed; `yarn test` passed 2,315/2,316 app tests (one existing skip) and 51/51 crashreporting tests. Native/web purchase recovery suites passed 110/110; independent focused review passed 240/240. Strict OpenSpec active/canonical 9/9 and archived 6/6 passed. Exact dependency pins, reviewed Expo doctor deviations and Production channel guard passed. Hosting and Pages exports and data-boundary checks passed. Rendered component fixtures cover monthly/yearly, guest/member/legacy, pending/unavailable, 320px, desktop, landscape, browser zoom, both themes, keyboard containment and Escape. Final exported membership page was inspected under the real app shell through a self-only CSP proxy with explicit empty catalog fixtures (preflight 5/5). Native OS font scaling, real store transactions and compatible installed OTA receipt remain unverified. See `evidence.md` for source/review boundaries.

## 5. Production delivery

- [x] 5.1 Merge through the normal reviewed PR and required CI; record merge source, prior rollback targets and successful CI receipts.
- [x] 5.2 Verify both production web targets on that source, including deployment receipts, startup/catalog checks and rendered membership behavior; distinguish export success from user availability.
- [ ] 5.3 Publish Android Production OTA for runtime 1.8.25/code 107 through the existing release workflow; record group/runtime/channel and verify receipt and behavior on a compatible installed client without synthetic production purchases/ad engagement.
- [x] 5.4 Record sanitized release evidence, actual observation start dates or remaining prerequisites, and task-owned cleanup; leave any unverified availability or recovery outcome explicitly pending.

## Workflow follow-up

- Sync only implemented requirements, and archive after tracked delivery work is complete. Keep unrelated unfinished changes active.
- Evaluate a complete 14-day release window after event/release validation and a full monthly renewal cycle; commercial outcomes remain unknown until measured.
- Yearly product creation, exact regional pricing, entitlement/package attachment and store availability validation are separate commercial setup work. October 17 read-only evidence found no yearly product/package; a ten-month-price proposal is not an active offer.

Delivery reconciliation: PR #1005 merged as `4626232a`; exact-source main CI 39029077348 and Hosting/Pages runs 39029346355/39029346412 succeeded. Android runtime 1.8.25 OTA group `2a92387a-d08d-4a4c-9f82-22cb8265d2ef` was published with maps and Sentry deployment metadata, and its Production manifest was verified. [Closure receipt](https://github.com/kunal26das/yify/pull/1005#issuecomment-6233475667) records live checks and cleanup. Task 5.3 remains unchecked only because no connected device was available to verify installed-client receipt. The subsequent Yify Plus rename is a copy/metadata refinement tracked in its PR; no yearly commercial setup or measured growth result is implied.
