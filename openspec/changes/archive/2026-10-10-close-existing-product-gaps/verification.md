# Existing product journey audit

## Scope

Audit and repair existing journeys without adding features, dependencies, pricing, data collection or a new visual design. Baseline: `fa7d0ae82b46b4e72b801c8237d7b442b19fec7b`. Work date: 2026-10-10. Android/iOS binaries and runtime metadata are unchanged.

## Coverage and outcomes

| Journey | Review and repair | Evidence and limits |
| --- | --- | --- |
| First launch and privacy | Existing adult gate, analytics opt-in, legal access, YouTube consent and privacy controls traced. Main welcome heading receives explicit semantics. | Privacy regressions; isolated browser onboarding. No live consent provider interaction. |
| Home discovery | Isolate hero/shelf refresh generations; preserve loaded content; expose failed sections with retry; don't let an empty hero hide available shelves. | Deferred-response tests, component/selector tests, isolated partial-failure browser checks. |
| Movie browsing and search | Clearing mobile search now clears the applied query; other filters remain; empty queries do not enter recent searches. Existing pagination/filter/error recovery reviewed. | Search interaction tests and isolated phone/desktop flows. |
| Movie details and trailer | Keep details after refresh failure, explain that retained content is shown, and offer retry. Existing player consent and route-identity resets reviewed. | Real view-model/component integration tests for web and Android mocks; isolated movie route. Live YouTube playback untested. |
| Shows and episodes | Loading, pagination, detail retry and route navigation traced; explicit page/section headings. | Existing regression suite and isolated fixture routes. Provider freshness untested. |
| Subscriber Anime | Existing subscriber gate, account-revision handling and pagination reviewed. No access-policy or catalog changes. | Existing tests; anonymous browser redirect. No live paid account used. |
| Watchlist and history | Save/remove, history persistence and empty states reviewed. History controls can grow with text instead of clipping into fixed 36px rows. Preferences removal wording matches the current control. | Existing regressions, control tests and isolated persistence flow. Cross-device cloud sync untested live. |
| Journal | Existing entry, picker and summary paths reviewed. Shared dialogs announce their actual close action; actual headings are semantic, metric values remain ordinary text. | Journal/control regressions; signed-out browser state. No production journal created. |
| Streaming services and availability | Country/service selection, permission denial, unavailable/empty providers and links traced. No new provider integration or account linking. | Existing regressions; isolated unavailable-provider view. Live availability and native deep links untested. |
| Preferences and account | Preserve session on failed Firebase sign-out. Surface sign-out, deletion failure/partial completion/success; prevent overlapping account actions and clarify subscriptions must be managed separately. | Native/web mocked auth and Preferences journey tests. No real account deleted or signed out. |
| Supporter access and billing | Explicit verified refresh outcome replaces false success from cached `ready`; preserve cached access on network failure and reject stale identity results. Purchase/restore/pending/cancel paths reviewed. | Native/web purchase and paywall regressions. No live purchase, restore or cancellation. |
| Ads and support links | Ad privacy form errors now surface after cleanup and allow retry; support/website open failures give feedback. | Mocked ad and Preferences tests. No ad impressions/clicks or consent changes in production. |
| Notifications and updates | Existing permissions, preferences, daily scheduling, deep-link routing and update failure paths traced. | Existing automated suite; delivery, background execution and installed native runtime remain untested here. |

## Automated verification

- Node 24.19.0, Yarn 1.22.22, OpenSpec 1.14.1.
- Local full app suite: 2,251 passed, one existing environment failure. `scripts/verify-production-aab.test.mjs` requires GNU `timeout`, absent on this Mac. Linux CI subsequently passed all 2,252 app tests, including this test, plus 51 workspace tests.
- Crash-reporting workspace: 51/51 tests pass.
- Release console: typecheck, 150/150 tests and build pass.
- Focused catalog, controls, auth, purchase, ad and account-feedback regressions pass. Independent reviewer ran 234 focused tests and typecheck successfully.
- Changed-file ESLint reports 22 errors and one warning. Comparing each changed file with the baseline using the same ESLint runtime gives identical rule/message counts: no added lint findings.
- Strict OpenSpec active/canonical validation and `git diff --check` pass.

## Isolated rendering procedure

The preview uses a static export without `.env` injection and explicit same-origin catalog fixtures. Before navigation, a fresh headless Edge context blocks all external requests, including Sentry, TMDB and advertising; fixture artwork is fulfilled locally. It never uses the owner's browser profile or production account. Local fixtures are not evidence of live provider health.

```sh
EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_WEB_OUTPUT=static EXPO_WEB_BASE_URL='' npx expo export --platform web --clear --output-dir /tmp/yify-product-audit/web
node scripts/check-web-preview.mjs http://127.0.0.1:8793
```

Local fixture server, browser scripts, logs and screenshots are under `/tmp/yify-product-audit/`; they are ephemeral QA evidence, not application code. Preview preflight passed. Baseline routes inspected: home, movies, shows, movie details, show details, watchlist, history, journal, preferences, supporter options, anonymous anime redirect. All fit a 390px viewport with no uncaught page errors. Final functional checks against the updated export: 7/7 pass, no uncaught page errors. They cover phone and desktop applied-query clearing while preserving filters, empty results, adult confirmation with analytics remaining off, save-to-watchlist/history persistence, partial home failure with successful hero retry, and shelf failure with successful retry. The lead inspected partial-failure and history screenshots. Designer checked 30 rendered cases at 390×900 and 1440×900 in light/dark themes, plus 320×900 with simulated 200% CSS text. No uncaught page errors or document-level horizontal overflow occurred. Changed controls measure 44px normally and grow to 54–56px with enlarged text, without overlap/clipping. The journal picker was checked at 390/1440px: actual dialog heading, contextual close label, 44×44 close target and successful dismissal. The designer also inspected the home failure and empty-search states.

Existing navigation labels and history title/metadata truncate at 320px with the CSS text simulation. The changed controls remain usable; this is not evidence of native font scaling or a screen-reader pass. Evidence files: `flow-results.json`, `design-results.json`, `sheet-design-results.json` and `after-*.png`/`design-*.png` in the temporary QA directory.

## Independent review and release boundary

The lead delegated source/journey review, account/billing fixes and design/interaction review to separate specialists. Requested settings: journey engineer `gpt-6-sol`/medium; account and designer `gpt-6-astra`/high; independent security/privacy review `gpt-6-astra`/high. The runtime accepted these requests; effective settings are not independently attested. File ownership was kept separate. No nested delegation or specialist production writes were authorized.

Independent correctness review of implementation commit `76ab52251d0ee4bd91cdec88f7db6c9920eff1a8` found no actionable issues and passed 234 targeted tests, typecheck, spec validation and diff checks. Independent security/privacy review of the same commit found no actionable issues; six targeted fixture files passed 218/218 tests. [CI run 38056434789](https://github.com/kunal26das/yify/actions/runs/38056434789) passed all required jobs for that implementation commit: app tests/typecheck and native compatibility guards, release-console tests/typecheck/build, Hosting export checks and Pages export checks. Only evidence/spec synchronization and archive follow-up remain in the PR; required CI and independent review must also cover its final head before merging. Main merges can trigger existing web deployment workflows. Store release and OTA delivery are not part of this audit; `finish-android-crash-release` remains a separate active change. No native-device, live-provider, real-billing, production-deletion or regulatory-compliance certification is implied.
