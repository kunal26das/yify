# Yify v2.0.0 implementation spec

Status: integrated and final for implementation, 2026-11-26, then revised the same day after three independent reviews (technical feasibility, product and policy coverage, execution and migration safety). Appendix D records how every review point was handled, and Appendix T maps every research finding to the section that addresses it. This document replaces the three section drafts (`A-architecture-data.md`, `B-design-ux.md`, `C-monetization-platform-ops.md`); they stay in this folder only as history. Implementers read this file and nothing else from the spec folder.

Repository: `kunal26das/yify`. Work branch: `redesign/v2`, cut from the current `main` (`3c6d6c1` on 2026-11-26). `3c6d6c1` is `0f7a9ab` plus the YIFY-36 Browse hotfix (#1110, `d00ad7d`) and the monthly grouped Dependabot config (#1111), so every `path:line` citation of the v1 tree that says `0f7a9ab` still applies, except in `app/movies.tsx`, `.github/dependabot.yml`, `tests/dependabot-config.test.cjs`, `docs/dependency-automation.md` and `docs/releases.md`. All v1 sources are deleted from `redesign/v2` by F0 (Part W); read them with `git show v1-baseline:<path>`. The tag `v1-baseline` marks `3c6d6c1` (W0); `main` keeps moving during v2 work (monthly Dependabot), so every v1 citation refers to the tag, not to `main`.

Toolchain that does not change (decision 12): Expo SDK 58 (`expo` 58.0.26), React Native 0.88.1, React 19.3.1, expo-router 58.0.32, Reanimated 4.8.0, react-native-worklets 0.14.0, TypeScript 7.0.2, Babel 8 for tests, ESLint 10. Library versions that v2 keeps exactly: react-native-purchases 11.0.4, @revenuecat/purchases-js 1.78.0, react-native-google-mobile-ads 17.4.0, @sentry/react-native 8.36.0, react-native-youtube-iframe 2.4.1, expo-sqlite 58.0.18. The one deliberate version change is the owner-requested Firebase alignment of decision 12: `@react-native-firebase/*` 27.2.0 with `firebase` 13.3.0 (Part 0, I-6).

## How to read this document

- **Precedence.** Part 0 (charter and conflict resolutions) overrides Parts A, B and C. Within Parts A to C, the text has already been edited to match Part 0; where a sentence still disagrees with Part 0, Part 0 wins and the sentence is a defect in this document.
- **Parts.** Part A: architecture, domain, edge API, data layer, storage, migration, sync, routes. Part B: information architecture, design system, components, screens, copy, accessibility, store listing. Part C: monetization, ads, web platform, Android platform, telemetry, engineering system. Part W: the work breakdown (F0-A to F0-D, P1 to P9, C, I). Part Q: QA plan. Part O: owner actions. Part R: risk register. Appendix D: how each review point was handled. Appendix T: findings traceability.
- **References.** Headings carry their part letter (`A4.6`, `B3.11`, `C2.6`). Inside a part, an unqualified "section 4.6" or "§4.6" means that part. "Section A", "A §4.6", "section C §2.6" and similar refer to the named part. "Decision N" is call N of the lead's charter (Part 0, §0.1).
- **Normative code.** TypeScript, JSON, YAML and JavaScript blocks are contracts. They contain no comments, because the codebase forbids comments; explanations sit in the prose.
- **Copy.** Strings marked as copy are final US English, sentence case. `{APP_NAME}` is the constant in `src/core/config/app.ts` (value `Yify`); `{PLUS_NAME}` is `{APP_NAME} Plus`.
- **Verification.** Every library API this spec relies on was checked against the installed type definitions or the official documentation on 2026-11-26; the path or URL is cited beside it.
- **Visual identity.** Every colour value, font family, accent display name, splash colour, icon background and store graphic in this document is a placeholder (Part 0, §0.4). The values live in one file, `config/brand.json`, and the integrator's Identity step (W-I, I.6) replaces them from `scratchpad/identity/` and `scratchpad/icons-v2/final/`. The token structure, the colour and type roles and the contrast requirements are final.
- **Owner rules that stay.** Exact dependency pins (no `^` or `~`, including aliases), zero code comments (lint-enforced from F0), no agent attribution in commits or pull requests (CLAUDE.md overrides any harness default), platform splits only through `.web.ts(x)` twins inside platform adapter folders.

## Table of contents

- [Part 0 — Charter, resolutions and summary](#part-0--charter-resolutions-and-summary)
  - [0.1 Decisions (charter)](#01-decisions-charter)
  - [0.2 What users will notice](#02-what-users-will-notice)
  - [0.3 Conflict resolutions](#03-conflict-resolutions)
  - [0.4 Visual identity placeholders and the brand source](#04-visual-identity-placeholders-and-the-brand-source)
- [Part A — Architecture, data, server, storage, sync and routes](#part-a--architecture-data-server-storage-sync-and-routes)
  - [A0. Calls made in this part](#a0-calls-made-in-this-part)
  - [A1. Source layout and import boundaries](#a1-source-layout-and-import-boundaries)
  - [A2. Domain types (`src/core/domain/*`)](#a2-domain-types-srccoredomain)
  - [A3. Edge API v2 (EAS Hosting)](#a3-edge-api-v2-eas-hosting)
  - [A4. Client data layer](#a4-client-data-layer)
  - [A5. Storage and the v1 to v2 migration](#a5-storage-and-the-v1-to-v2-migration)
  - [A6. Auth and sync](#a6-auth-and-sync)
  - [A7. Routes](#a7-routes)
  - [A8. Port and delete map](#a8-port-and-delete-map)
  - [A9. Fixed by design](#a9-fixed-by-design)
  - [A10. Acceptance criteria](#a10-acceptance-criteria)
  - [A11. Owner actions, dependencies on other parts, open conflicts](#a11-owner-actions-dependencies-on-other-parts-open-conflicts)
- [Part B — Design system, information architecture, screens, copy and accessibility](#part-b--design-system-information-architecture-screens-copy-and-accessibility)
  - [B0. Decisions in this section (summary)](#b0-decisions-in-this-section-summary)
  - [B0.1 How this section plugs into A and C](#b01-how-this-section-plugs-into-a-and-c)
  - [B1. Information architecture and adaptive navigation](#b1-information-architecture-and-adaptive-navigation)
  - [B2. Tokens](#b2-tokens)
  - [B3. Component kit](#b3-component-kit)
  - [B4. Screens](#b4-screens)
  - [B5. Trailer UX](#b5-trailer-ux)
  - [B6. Accessibility and web keyboard behaviour](#b6-accessibility-and-web-keyboard-behaviour)
  - [B7. Delete and port inventory (`presentation/`, 152 files, 20,370 lines)](#b7-delete-and-port-inventory-presentation-152-files-20370-lines)
  - [B8. Store listing (one validated Play edit at release step f)](#b8-store-listing-one-validated-play-edit-at-release-step-f)
  - [B9. Open conflicts and owner decisions](#b9-open-conflicts-and-owner-decisions)
- [Part C — Monetization, Android and web platform, telemetry, CI and process](#part-c--monetization-android-and-web-platform-telemetry-ci-and-process)
  - [C0. Contracts with other parts](#c0-contracts-with-other-parts)
  - [C1. Yify Plus](#c1-yify-plus)
  - [C2. Ads on Android](#c2-ads-on-android)
  - [C3. Web platform](#c3-web-platform)
  - [C4. Android](#c4-android)
  - [C5. Telemetry](#c5-telemetry)
  - [C6. Engineering system](#c6-engineering-system)
  - [C7. Owner actions (consoles and stores only)](#c7-owner-actions-consoles-and-stores-only)
  - [C8. Open points](#c8-open-points)
- [Part W — Work breakdown](#part-w--work-breakdown)
  - [W0. Protocol for every stream](#w0-protocol-for-every-stream)
  - [W-F0. Foundation (four parts and spike S1; lands before any stream)](#w-f0-foundation-four-parts-and-spike-s1-lands-before-any-stream)
    - [F0.1 Parts, order and gates](#f01-parts-order-and-gates)
    - [F0-A Reset, step by step](#f0-a-reset-step-by-step)
    - [F0.2 Repository files F0 writes or changes](#f02-repository-files-f0-writes-or-changes)
    - [F0.3 Deletions and moves](#f03-deletions-and-moves)
    - [F0.4 `src/core` deliverables](#f04-srccore-deliverables)
    - [F0.5 Cross-feature contracts (frozen signatures with placeholders)](#f05-cross-feature-contracts-frozen-signatures-with-placeholders)
    - [F0.6 Screens and routes (F0-D)](#f06-screens-and-routes-f0-d)
    - [F0.7 Server skeleton, stubs and fixtures (F0-B)](#f07-server-skeleton-stubs-and-fixtures-f0-b)
    - [F0.8 Tests F0 adds](#f08-tests-f0-adds)
    - [F0.9 Acceptance](#f09-acceptance)
    - [F0.10 Out of scope for F0](#f010-out-of-scope-for-f0)
  - [W-P. Parallel streams](#w-p-parallel-streams)
    - [P1. Edge API v2 and server](#p1-edge-api-v2-and-server)
    - [P2. Home](#p2-home)
    - [P3. Search](#p3-search)
    - [P4. Title, season, person and trailer player](#p4-title-season-person-and-trailer-player)
    - [P5. Library, diary, lists, migration and sync](#p5-library-diary-lists-migration-and-sync)
    - [P6. Account, You, settings and consent](#p6-account-you-settings-and-consent)
    - [P7. Plus, purchases and ads](#p7-plus-purchases-and-ads)
    - [P8. Web: server rendering, SEO, legacy URLs and web checks](#p8-web-server-rendering-seo-legacy-urls-and-web-checks)
    - [P9. Android platform](#p9-android-platform)
    - [Stream C. Docs, workflows, legal pages and listing text (parallel with P*)](#stream-c-docs-workflows-legal-pages-and-listing-text-parallel-with-p)
  - [W-I. Integration and release](#w-i-integration-and-release)
    - [I.1 Merge order into `redesign/v2`](#i1-merge-order-into-redesignv2)
    - [I.2 Hotspots](#i2-hotspots)
    - [I.3 Gate commands](#i3-gate-commands)
    - [I.4 Final wiring checklist](#i4-final-wiring-checklist)
    - [I.5 Release (decision 13)](#i5-release-decision-13)
    - [I.6 Identity step (integrator; Part 0, §0.4)](#i6-identity-step-integrator-part-0-04)
- [Part Q — QA plan](#part-q--qa-plan)
  - [Q1. Static gates](#q1-static-gates)
  - [Q2. Web: local run and screenshots](#q2-web-local-run-and-screenshots)
  - [Q3. Android: release build and emulator smoke](#q3-android-release-build-and-emulator-smoke)
  - [Q4. Cross-platform flows](#q4-cross-platform-flows)
  - [Q5. Upgrade from 1.8.33 with v1 data (release step d)](#q5-upgrade-from-1833-with-v1-data-release-step-d)
  - [Q6. Policy checklist](#q6-policy-checklist)
  - [Q7. Budgets](#q7-budgets)
  - [Q8. Firestore rules](#q8-firestore-rules)
  - [Q9. Legacy URLs](#q9-legacy-urls)
  - [Q10. Accessibility](#q10-accessibility)
- [Part O — Owner actions](#part-o--owner-actions)
- [Part R — Risk register](#part-r--risk-register)
- [Appendix D — Review dispositions](#appendix-d--review-dispositions)
  - [D.1 Rejected or deferred](#d1-rejected-or-deferred)
  - [D.2 Applied with a change](#d2-applied-with-a-change)
  - [D.3 Applied as proposed](#d3-applied-as-proposed)
- [Appendix T — Findings traceability](#appendix-t--findings-traceability)

# Part 0 — Charter, resolutions and summary

## 0.1 Decisions (charter)

The lead's calls in `scratchpad/decisions.md` are final. This table states each one and where this spec implements it.

| # | Decision | Implemented in |
|---|---|---|
| 1 | Positioning: a movie and TV discovery plus diary app. TMDB (movies, TV, people) is the only catalog, always reached through our own edge API, never from clients. YTS, EZTV and Nyaa are removed from the client. | A3 (edge API), A4.1 (client calls only `/api/v2`), A1.5 (architecture test bans upstream hosts), Q6 (bundle greps) |
| 2 | Delete every torrent surface. Legacy `/api/catalog/*` stays for installed 1.8.x clients, stripped of torrent data; subscriber, anime and availability routes are deleted. | A3.7, B7, C6.4, Q6 |
| 3 | Keep the name "Yify"; remove every "YTS" reference; centralise the display name; recommend a rename in the final report. | `config/brand.json` read by `src/core/config/app.ts`, `app.config.js` and `scripts/brand/stamp-public.mjs` (Part 0 §0.4, I-4); neutral legacy identifiers (I-52); B conventions; Part O item O-20 |
| 4 | No 18+ gate; `include_adult=false`; a non-blocking privacy prompt; content renders immediately, including in web HTML; AdMob UMP stays for EEA consent on Android. | A3.3.2, B4.13 (prompt that can be deferred, I-17), B5.2 (the first trailer tap is the YouTube agreement point, I-62), C2.4, C3.2 |
| 5 | Android and web only. Delete Electron and GitHub Pages. No iOS work; keep the iOS identifiers in `app.json`. CNG only if proven. | C3.1, C4.13 (`android/` and `ios/` leave git together, only if P-CNG passes; I-41), Part W parts F0-A and P9 |
| 6 | Yify Plus on the existing Play SKUs; anonymous Android purchase; paced Android interstitial on the title-open tap only; no web ads or checkout UI; web checkout behind `EXPO_PUBLIC_WEB_CHECKOUT`; no Buy-me-a-coffee. | C1, C2, B4.12, B5.4; the paywall opens only from the You card, `/plus` and the four contextual moments (I-15) |
| 7 | Features kept: Home, Search, unified Title page, Where to watch, People, TV seasons, Library (Watchlist, Watched diary, Lists, Recent), sign-in and sync, Plus, share links that unfurl. | B4 (screens), A3.4 (data), C3.2 (unfurl) |
| 8 | Features removed: torrent surfaces, availability alerts, notifications and background task, location permission, mini-player, queue, autoplay-next, PiP, rotating hero, glass and blur, scroll-progress pill, genre-rail explosion, store-review remnants, YTS image repair, Remote Config. | A8, B7, C4.9 |
| 9 | Sentry is the single crash, error and metrics tool, with native init before Crashlytics is removed; remove Crashlytics, `@yify/crashreporting` and expo-insights; expected failures are metrics; GA4 behind consent with a small catalog. | C4.11, C5 |
| 10 | Feature-sliced `src/`, direct imports, TanStack Query, one purchase state machine, twins only inside platform adapters, boundaries lint in CI, server code in `src/server`. | A1, A4.2, C1.5 |
| 11 | Migrate YTS-keyed local and synced data to TMDB ids through the edge API, idempotently, keeping unresolved entries visible. | A5.4, A6.6 |
| 12 | One CI workflow whose jobs are named `Typecheck and tests` and `Web exports render and isolate catalog data`; delete Dependabot automation, tripwires, release console, OpenSpec, evidence logs and dead workflows; keep crash-fixing patches and plugins; toolchain stays; Firebase 27.2.0 / `firebase` 13.3.0 exception; staged rollout; flexible in-app updates; version-based runtime. | C6, Part W (F0, C), I-5, I-6 |
| 13 | Ship as the v2.0.0 store binary, `versionCode` 116, runtime exactly `2.0.0`; release order (a) gates, (b) Firestore rules, (c) merge and web/API deploy verified live, (d) EAS production build verified on device including upgrade over 1.8.33, (e) staged Play rollout at 20 %, (f) listing refresh in one validated edit; the new flat icon from `scratchpad/icons-v2/final/`. Legacy catalog keeps serving 1.8.x. No price or RevenueCat product changes. | C4.8, Part W (I.5, I.6), Part Q, Part O, B8. versionCode 116 is uploaded once: EAS Submit puts it on the production track as a draft, and one validated Play edit starts the 20 % rollout together with the listing refresh (I-51). |

## 0.2 What users will notice

- Yify opens straight into content. There is no 18+ screen, no download button, no torrent qualities, seeds or file sizes anywhere, and no Anime tab.
- Movies and TV shows live together. One Title page shows the trailer button, your watchlist and diary actions, and **Where to watch** right under them, with your own streaming services first and a JustWatch credit.
- New TV show pages list seasons and episodes, and actors and directors are tappable, with their own filmography pages.
- Search is live as you type and covers movies, TV shows and people. Browsing has simple filters (type, genre, year, rating, "On my services") that never apply hidden defaults.
- Navigation is a standard Android bottom bar (Home, Search, Library, You), a side rail on tablets and foldables, and a header with a centred search box on desktop web. Android back and predictive back behave as expected.
- The Library brings together the Watchlist, a Watched diary with dates, half-star ratings, notes and rewatches, up to three custom lists for free, and Recently viewed. All of it works without signing in; signing in syncs it.
- Existing watchlists, journals, collections and history move over automatically. A few old titles may show "Saved in an older version of Yify" until they can be matched.
- Trailers only play when you tap them, and nothing covers the player. On Android an occasional full-screen ad can appear when you open a title, never in the first three opens and never around a trailer.
- Yify Plus is an honest supporter plan on the same prices: no Yify ads on Android, unlimited lists, a year-in-review, and accent colours. It can be bought without an account on Android and shows up on the web after sign-in.
- The web version loads several times less JavaScript, renders real content and proper link previews for titles and people, and returns real 404s.
- The app is smaller to download and install, crashes are reported to one place, and store updates download in the background and install when you tap Restart or while the app is in the background.
- Yify has a fresh look and a new flat icon (the visual identity comes from the Identity step, §0.4).

## 0.3 Conflict resolutions

Each row resolves a disagreement between the drafts, or between a draft and the charter. Parts A to C have been edited to match.

| # | Topic | Drafts said | Resolution |
|---|---|---|---|
| I-1 | Navigation tree | A (A13) pushed detail routes above the tabs and built tabs with `expo-router/ui`; B kept detail routes inside each tab stack through shared routes and used `expo-router/js-tabs`. | **B's design.** `expo-router/js-tabs` `Tabs` with the custom `AppTabBar`; four tab stacks `(home)`, `(search)`, `(library)`, `(you)` with detail routes shared through the array group `(home,search,library,you)` (docs.expo.dev/router/advanced/shared-routes and router/basics/common-navigation-patterns, "One screen, two tabs"; anchors per group verified in `node_modules/expo-router/build/layoutAnchor.js`). Library sections use `expo-router/ui` headless tabs. URLs are unchanged. The final route tree is A7.1. |
| I-2 | Feature folders | A: `account/sync`, `player`, `monetization`; B: `features/trailer`, `features/plus`. | Feature list: `shell`, `home`, `search`, `title`, `person`, `player`, `library`, `sync`, `account`, `settings`, `you`, `monetization`, `legacy`. Sync moves out of `account` into `src/features/sync/` (I-27). B's `trailer` is `player`; B's `plus` is `monetization`. |
| I-3 | Twin placement | A allowed twins only in `src/core/platform/**`, `src/core/ui/**`, `src/features/*/platform/**`, three named core adapters and the route twins; C placed twins in `plus/`, `ads/` and `player/`. | **A's rule.** C's twins live in `src/features/monetization/platform/` (`purchasesAdapter`, `adConsent`, `interstitialGateway`, `openTitle`) and `src/features/player/platform/` (`TrailerPlayer`, `youtubeIframeApi`). Public entry points are files in each feature's `public/`. |
| I-4 | Display-name constant | B: `src/core/config/brand.ts`; A and C: `src/core/config/app.ts`. | `config/brand.json` is the single source of the display name (`appName`) and of every brand value (§0.4). `src/core/config/brand.ts` types it; `src/core/config/app.ts` exports `APP_NAME` (from it), `PLUS_NAME`, `SITE_ORIGIN`, `PLAY_STORE_URL`, `PACKAGE_ID`, `APP_VERSION` and `AUTH_PROXY_HOSTS`. `app.config.js` sets `expo.name` from it; `scripts/brand/stamp-public.mjs` writes it into the static web files; `tests/scripts/brand.test.cjs` fails on a stray literal. A rename is one edit plus `yarn brand:stamp`. |
| I-5 | Runtime and versionCode | C: fingerprint runtime, EAS remote `versionCode` with `autoIncrement`. | **Decision 13 wins.** `runtimeVersion` equals `package.json` `version` (exactly `2.0.0`, no environment override); `package.json` keeps `versionCode: 116`; `eas.json` keeps `appVersionSource: "local"`; no `autoIncrement`. The rule "bump `version` whenever native code changes" stays and is backed by the OTA guard (I-40). C4.1, C4.2, C4.8, C6.3 and C6.8 are rewritten accordingly. |
| I-6 | Firebase versions | Task baseline: `@react-native-firebase/*` 27.1.1, `firebase` 13.1.0. | **Decision 12 exception.** `@react-native-firebase/app`, `auth` and `analytics` 27.2.0 (published 2026-11-25) with `firebase` 13.3.0 (published 2026-11-11), which `@react-native-firebase/app@27.2.0` declares as its exact `dependencies.firebase` (`npm view`). Dependabot PR #1097 is superseded and closes when v2 merges. `scripts/check-dependency-pins.mjs` asserts that every `@react-native-firebase/*` shares one version and that root `firebase` equals `@react-native-firebase/app`'s `dependencies.firebase`. |
| I-7 | Required checks | C: the owner must remove `Typecheck and test release console` from branch protection. | Already done (decision 12, 2026-11-26). The v2 jobs keep the two required names; no owner action. |
| I-8 | Web deploy trigger | C: manual-only `deploy-web.yml`. | Decision 13(c) says merging to `main` deploys. `deploy-web.yml` runs on `push` to `main` (docs-only changes ignored) and on manual dispatch, then runs live smoke checks (C6.2). Needs the `EXPO_TOKEN` repository secret (O-9). |
| I-9 | `TMDB_API_KEY` visibility | C: "secret"; A: "sensitive". | **Sensitive.** EAS Hosting cannot deploy secret variables (docs.expo.dev/eas/environment-variables/usage). |
| I-10 | App Links prefixes | C: `/title`, `/person`, `/movie`, `/show`; A added `/search`, `/plus`. | All six, in C4.1. |
| I-11 | `/guide` | A waited on a product call; C dropped the redirect. | `public/guide.html` and `public/guide/` describe v1 (Movies, Shows, location permission, "Check availability") and are deleted. `/guide` redirects permanently to `/`. |
| I-12 | "Unlimited lists" | C's copy says unlimited; A caps synced lists at 100 live lists, 200 list records and 2,000 items. | Decision 6 names the benefit "unlimited custom lists", so the headline stays. The caps are storage safeguards: they appear only when reached ("You've reached the maximum of 100 lists.") and in the Terms ("Plus list storage has a fair-use limit of 100 lists and 2,000 listed titles per account."). |
| I-13 | Accent names | A placeholders `teal`, `indigo`, `gold`, `rose`; B: `rust` (free), `teal`, `plum`, `forest`, `cobalt`. | Stored accent ids are neutral so the identity can change without a data migration (they are synced): `default` (free), `accent1`, `accent2`, `accent3`, `accent4`. Display names and colours come from `config/brand.json` (placeholders until the Identity step, §0.4). |
| I-14 | Home "Coming soon" | B left it out; A's `/home` has no upcoming rail. | Not in v2.0. Home has at most 8 sections (B4.1). |
| I-15 | Paywall placements | C: `you_tab`, `plus_route`, `list_limit`, `insights`, `ad_free_row`, `accent_theme`; B added `home_card`, `you_card` and a web header link. | `PaywallPlacement = 'you_card' \| 'plus_route' \| 'list_limit' \| 'insights' \| 'ad_free_row' \| 'accent_theme'`. `you_tab` is dropped (the You tab's entry is the card). The Home Plus card and the expanded-web "Get Plus" header link are dropped: decision 6 lists the You tab, `/plus` and the contextual moments only. |
| I-16 | Opening titles | C: `openTitle(navigate, {source, surface, contentType, contentId})` with prefetch by the caller; B drew the pre-ad screen with poster and title; B's `MediaCard` (in `core/ui`) called `openTitle` directly, which `core` may not import. | `OpenTitleInput` gains `title` and `posterPath`. Feature code opens titles only through `useOpenMedia(surface)` (`src/features/title/public/useOpenMedia.ts`), which prefetches `titleQueryOptions` and calls `openTitle`. Kit components take callbacks: `MediaCard.onOpen`, `PosterGrid.onOpen`, `Rail.onOpen`. |
| I-17 | Consent prompt cadence | B: re-shown until three dismissals. | Shown until answered once per `V2_NOTICE_VERSION`. "Allow", "Not now" and × all record a decision (× and "Not now" store `analytics: false`). `V2_NOTICE_VERSION = 'v3'`; a fresh install stores `noticeVersion: ''`, so the prompt is due (A2.7). An unanswered prompt is deferred after 60 s visible or three title pages: it hides for the session without recording an answer and returns on the next cold start. Answering or deferring resolves it for UMP (B4.13, C2.4), so an ignored card never blocks ads. |
| I-18 | Sign-out and deletion copy | A and B wrote different strings; B's deletion text said device-only data stays, but A's deletion clears the account's data from the device. | Final copy is in B4.11. Deletion clears the account's synced data on the server and on the device (A6.7). |
| I-19 | Entitlement cache key | C: `plus.entitlement.v1` on Android, `yify.plus.v1` on web. | `plus.entitlement.v1` on both platforms (raw JSON, no envelope), so no platform branch is needed and the web theme script reads one key. |
| I-20 | Web region guess | Decision 8 says "device locale + manual picker"; A uses `/api/v2/geo` on web. | Accepted: the server's `eas-ip-country` header is a first guess on web only, because desktop browsers report `en-US`; it needs no permission and is never stored server-side. Native uses the locale only. The privacy policy mentions it (C stream). |
| I-21 | Sign-out clears local account data | A11; B adopted it. | Accepted, with the stash for unsynced edits (A6.7). |
| I-22 | Old signed-in v1 web tabs | They fail catalog requests until reloaded once subscriber routes are deleted. | Accepted (decision 2). |
| I-23 | Fonts and icons | C: Ionicons SVG paths on web, `@expo/vector-icons` on Android, no new devDependency; B: Material Symbols Rounded, subset font on Android, inline SVG on web, `subset-font` devDependency. | **B's icons**, plus WOFF2 web fonts built by the same tool: `subset-font` 2.9.0 (devDependency, published 2026-09-20) is used by `scripts/icons/build-icons.mjs` and `scripts/fonts/build-fonts.mjs`; generated files are committed. Web loads 3 WOFF2 faces from `public/fonts/` through `@font-face`; Android embeds the 3 TTF faces with the `expo-font` config plugin. |
| I-24 | Server imports | A: server may import only `src/server` and `src/core/domain`. | Server code may also import `src/core/config/**` (constants such as `APP_NAME` and `SITE_ORIGIN`), which is itself pure. |
| I-25 | Search URL codec location | A: `features/search/searchUrl.ts` while `searchHref` lives in `core/navigation`. | The codec and `SearchUrlState` move to `src/core/navigation/searchUrl.ts`, so `core` never imports a feature. |
| I-26 | Expanded-web header search | B: header keystrokes update `q` through `useUrlState().commit()`, which the header cannot reach. | The Search screen registers its `url.commit` with `registerSearchCommit()` (`src/features/search/headerQuery.ts`). The header's 300 ms timer calls the registered commit (scoped `navigation.setParams`); when no Search screen is mounted it calls `router.navigate(searchHref({q}))`. Both run from timer callbacks started in `onChangeText`, never from effects. |
| I-27 | Sync ownership | A: sync engine under `features/account/sync`; account's session called `sync.setAccount`. | `src/features/sync/` owns the engine, transport use, v1 import, deletion helpers and status. Sync subscribes to `subscribeUid`. Account orchestrates sign-out (`signOut.ts`) and deletion (`deletion.ts`) through `features/sync/public/sync.ts`; `account/public/session.ts` never imports sync, so there is no import cycle. |
| I-28 | Server code in web route twins | A: `loader` and `generateMetadata` declared in the route file, bodies call `src/server/seo`. | The bodies load server code with `await import('@/server/seo/…')`. The Babel plugins remove the declarations from client bundles before Metro collects dependencies, so a dynamic import inside them cannot enter the client bundle (`node_modules/babel-preset-expo/build/plugins/server-data-loaders-plugin.js`, `server-metadata-plugin.js`). The architecture test forbids static `@/server` imports in `app/**/*.tsx`. |
| I-29 | Migration notice | A: a one-off notice; B: a dismissible Watchlist banner. | B's banner; dismissing it sets `noticeShown`. |
| I-30 | Test runner | A: `node --test` with type stripping; v1 needed a resolve harness for `@/` imports. | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup/register.mjs --test …` with a `module.registerHooks` resolver for `@/`, `@assets/` and extensionless `.ts(x)` imports and a loader for `.json` imports (prototyped on Node 24.19.0). Source is erasable TypeScript only, enforced by `erasableSyntaxOnly` and `verbatimModuleSyntax` (A1.3). Components are tested through the Babel 8 loader `tests/helpers/loadTs.cjs` with `react-test-renderer` 19.3.1 (A1.6). |
| I-31 | `presentation/` fates | A8.5 and B7 overlapped and disagreed (hero, hover card, web placeholder, prefetch path). | B7 is authoritative for `presentation/`; A8.5 is removed. |
| I-32 | `trailer_start.surface` | C: `title \| person`; B: trailers on Title and Home. | `title \| home`. |
| I-33 | Kit components used by one feature | B put `StarRating`, `DatePickerSheet`, `ImageViewer`, `ProviderRow` and `TrailerFrame` in `core/ui`. | They live in their only consumer: `StarRating` and `DatePickerSheet` in `src/features/library/components/`, `ImageViewer` and `ProviderRow` in `src/features/title/components/`, `TrailerFrame` in `src/features/player/public/`. Their contracts in B3 are unchanged. |
| I-34 | Legacy redirect list | A: `LEGACY_REDIRECTS` in `app.config.js`; C: legal redirects in `app.json`. | One file, `config/legacy-redirects.json`, read by `app.config.js` and by tests. |
| I-35 | Web headers | C: headers built in `app.config.js`; `frame-src` allowed `yify-2da67.firebaseapp.com`. | One module, `config/webHeaders.cjs`, used by `app.config.js`; `src/server/seo/securityHeaders.ts` repeats the enforced CSP and a test asserts equality. Because web auth is same-origin (A6.1), `frame-src` lists `'self'` instead of the firebaseapp host. |
| I-36 | Parallel development without a server | — | F0 ships `/api/v2` route adapters backed by committed v2 fixtures (`src/server/fixtures/v2/`), so client streams work before P1 lands. It also ships `src/server/tmdb/titles.ts` with its final signatures answering from those fixtures, and stubs for every other adapter target (A3.8). P1 keeps fixture mode behind `YIFY_API_FIXTURES=1` for local development, tests and the CI web checks, which therefore never call TMDB; no EAS environment sets it. |
| I-37 | Notifications | C removes them; A asks for an orphaned-job check. | Removed entirely. The QA plan checks an upgraded device for the orphaned `yify-new-movies-check` job (Q5). |
| I-38 | Native-library packaging | C drops `useLegacyPackaging`, reversing 2026-09-29. | Accepted on C4.6's evidence, gated by the staged rollout and Sentry native events (R-3). |
| I-39 | Firestore rules tests | A: emulator tests in CI. | A separate job, `Firestore rules`, runs the emulator suite with `firebase-tools` 15.36.0 through `npx` when `firestore.rules` or its tests change. It is not a required check, but it must pass before the rules deploy (Q8). |
| I-40 | OTA safety under a version-based runtime | — | `scripts/eas.sh update …` refuses to publish when native inputs (`package.json` dependency sections, `yarn.lock`, `app.json`, `app.config.js`, `plugins/`, `patches/`, `android/` if tracked) differ from the git tag `android-v<version>` created at the production build (C4.8). |
| I-41 | `ios/` | Tracked and stale after v2's dependency changes. | Stays tracked, and outside every check, until the CNG proof gate passes; then `android/` and `ios/` leave git in the same commit (C4.13). Decision 5 makes untracking conditional on that proof. |
| I-42 | Person opens in GA4 | C: `select_content` from `openTitle`. | Person links fire `select_content {content_type: 'person'}` themselves. |
| I-43 | `expo-doctor` | C deleted the doctor wrapper but kept the devDependency. | Removed. CI runs `expo install --check` with `expo.install.exclude`. |
| I-44 | `@xmldom/xmldom` | C removes it; `tests/expo-v2-proguard.test.cjs` used it for an iOS plist. | Removed; the test keeps only its Android assertions (P9). |
| I-45 | Account deletion order and copy | A reauthenticates first; B wrote the dialog. | A's order with the merged dialog (B4.11). |
| I-46 | `HealthResponse.tmdbKey` | A: `'env' \| 'fallback'`. | `'env' \| 'fallback' \| 'fixtures'`, so fixture mode is visible. |
| I-47 | `fetchConfig` | A's endpoint list kept `fetchConfig` although `/config` is gone. | Replaced by `fetchHealth`. |
| I-48 | Snackbars from non-React code | Updates (C4.5) and sync need snackbars outside components. | `showSnackbar(request)` is exported from `src/core/ui/components/SnackbarHost.tsx` next to `useSnackbar()`. |
| I-49 | Trailer request signal for ad pacing | B: the trailer tap records the request time; C's policy reads it. | `reportTrailerState('requested' \| 'playing' \| 'stopped')` in `src/features/monetization/public/ads.ts`; the player calls it. |
| I-50 | v1 tests | C deleted tooling tests; A kept domain tests by porting. | F0 deletes every v1 `tests/*.test.cjs` except eleven plugin and script tests, which move to `tests/plugins/` and `tests/scripts/` (Part W, F0.3). Ported domain tests move with their code. |
| I-51 | Play submission of 2.0.0 | I.5 uploaded 116 to the internal track and then again to production; Play rejects a version code it already has. | 116 is uploaded once. (d) verifies bundletool APKs built from the EAS production AAB and signed with the upload key (fresh install, upgrade over a same-key 1.8.33). (e) `eas submit --profile play-production --id <buildId>` puts it on the **production** track as a `draft`. (f) One Play Developer API edit (`scripts/play-release.mjs`) updates every listing language, uploads the screenshots, feature graphic and icon, sets production to `versionCodes: ["116"]`, `status: "inProgress"`, `userFraction: 0.2`, validates and commits. The rollout start and the listing refresh are one validated edit (decision 13 (e) and (f)). |
| I-52 | Legacy identifiers | v2 carried `yts:` keys, `/api/v2/legacy/yts` and `resolve.yts`. | Neutral names: `LegacyKey = 'v1:<id>' \| 'imdb:tt…'`, `/api/v2/legacy/movie/{v1Id}`, `ResolveRequest {imdb, v1}`, query key `legacy-movie`. Code that talks to the retired catalog source lives only in `src/server/legacy/**` and retires with the legacy catalog (O-21). `/resolve` tries an exact TMDB title-and-year match before the legacy lookup (A3.4.13). |
| I-53 | Firestore REST reads | One `batchGet` under v1's 850,000-character cap. | One `GET` per changed section, capped at `2 × budget + 65,536` characters; v1 documents read with a 2,162,688-character cap; an import failure never blocks section sync (A6.5, A6.6). |
| I-54 | SSR loaders and HTML caching | Loaders threw the slug 301 and the 404 for every request and set `Cache-Control` on their JSON. | Canonical 301s (relative `Location`) and 404s only for document requests; loader-data requests (`Accept: application/json`) get `null` with `no-store`. HTML `Cache-Control` comes from the router plugin's `pageHeaders`. The public host comes from `X-Forwarded-Host` (C3.2). |
| I-55 | Metadata outside the title and person twins | Only the three twins could export `generateMetadata`; `<title>` never changed after in-app navigation. | Static routes export a synchronous `generateMetadata` built from the pure `src/core/config/seo.ts`; `ScreenScaffold` sets the client-side title with `<Head>` from `expo-router/head` (C3.2, B3.27). |
| I-56 | Flexible in-app updates | `expo-in-app-updates` 0.13.0 completes a downloaded update itself, restarting the app mid-task. | A one-line patch removes the automatic `completeUpdate()`; the app shows "Restart" or installs while it is in the background (C4.5). |
| I-57 | Server state across bundles | "Per isolate" caches and limiters could be duplicated, because each route, loader and the renderer is its own bundle. | All server singletons live in `getServerState()` on `globalThis` (A1.2, A3.3). |
| I-58 | Foundation size and v1 instructions | One F0 agent; v1 `CLAUDE.md` in force until stream C merged last. | F0 splits into F0-A (reset, every deletion, CI, interim `CLAUDE.md` and `AGENTS.md`), F0-B (core and server skeleton), F0-C (design system) and F0-D (shell, contracts, routes); spike S1 runs before F0-D freezes the routes (Part W). |
| I-59 | Caps and migrated data | Diary cap 2,000 against up to 2,500 migrated entries; Recent cut from 500 to 200. | Caps block new local additions and never evict on migration or merge. Diary 2,500 entries; Recent 500 entries with a 150,000-byte budget (A2.6, A6.2). |
| I-60 | Privacy policy and Data safety during the rollout | v2-only texts at step (c). | The privacy policy keeps a "Yify 1.8 and earlier (Android)" section and Data safety keeps the 1.8.x declarations until 2.0.0 is at 100 % and no track distributes 1.8.x (C6.8, O-10). |
| I-61 | Crash noise from emulator farms | Halt rules counted every Sentry user. | `plugins/withSentryInstallSource.js` tags `installer` and `split_count` natively; halt rules and alerts count only Play installs with split APKs (C4.11, I.5). |
| I-62 | YouTube API agreement | The trailer consent panel linked only YouTube's privacy policy. | The first-trailer panel is the agreement point: "By playing, you agree to the {APP_NAME} Privacy Policy and the YouTube Terms of Service", with three links (B5.2; YouTube API Services Developer Policies III.A.1 and III.A.2). |
| I-63 | Default plan on the paywall | C1.8: monthly first and preselected; B4.12: yearly preselected. | C1.8 wins (only monthly has ever sold); B4.12 is edited to match. |

## 0.4 Visual identity placeholders and the brand source

The owner rejected the warm cream, rust and brown look on 2026-11-26 ("I want something fresh"; decisions, "Visual identity override"). A separate identity workflow (`scratchpad/identity/`) and icon workflow (`scratchpad/icons-v2/final/`) produce the replacement; neither output was final when this spec was written. Therefore:

- **Placeholders.** Every colour hex in B2 (colour roles, accents, the contrast tables), the Lora and Hanken Grotesk pairing (B2.4), the accent display names, the splash and adaptive-icon colours (B2.12, C4.1), the theme colour, the store screenshots' look, the feature graphic and the store icon are placeholders. Implementers wire them through `config/brand.json`; nobody tunes or re-justifies them.
- **Final.** The token structure is final: Material 3 colour roles for light and dark (`ColorRoles`, B2.11), the five accent slots, the type roles and scale, spacing, shape, motion, and the contrast requirements (text at least 4.5:1, UI boundaries and focus rings at least 3:1, B2.2).
- **Banned for v2** (the release gate greps the hex values): brown, rust, terracotta, tan, beige, cream or parchment palettes; serif headlines on cream; anything that reads like Claude or Anthropic UI, including `#D97757`, `#9C452B` and `#F3F0E9`.

**One source.** `config/brand.json` holds every brand value. `src/core/config/brand.ts` imports it and exports it typed (JSON imports work in Metro, in `tsc` through `resolveJsonModule`, and in tests through the A1.6 loader):

```ts
import type {Accent} from '@/core/domain/preferences';
import data from '../../../config/brand.json';

export type BrandColorRole =
  | 'surface' | 'surfaceContainerLowest' | 'surfaceContainerLow' | 'surfaceContainer' | 'surfaceContainerHigh'
  | 'surfaceContainerHighest' | 'onSurface' | 'onSurfaceVariant' | 'outline' | 'outlineVariant' | 'primary'
  | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer' | 'secondaryContainer' | 'onSecondaryContainer'
  | 'error' | 'onError' | 'errorContainer' | 'onErrorContainer' | 'inverseSurface' | 'inverseOnSurface'
  | 'inversePrimary' | 'ratingStar' | 'scrim' | 'mediaScrim' | 'onMedia' | 'focusRing';
export type BrandAccentRole = 'primary' | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer' | 'inversePrimary' | 'focusRing';

export interface BrandAccent {
  id: Accent;
  name: string;
  light: Record<BrandAccentRole, string>;
  dark: Record<BrandAccentRole, string>;
}

export interface BrandFont {
  family: string;
  file: string;
  web: string;
  weight: 400 | 500 | 600 | 700;
}

export interface BrandConfig {
  status: 'placeholder' | 'final';
  appName: string;
  colors: {light: Record<BrandColorRole, string>; dark: Record<BrandColorRole, string>};
  accents: readonly BrandAccent[];
  fonts: {display: BrandFont; body: BrandFont; bodyStrong: BrandFont};
  androidIconBackground: string;
}

export const brand: BrandConfig = data as BrandConfig;
```

- `fonts.*.file` is the TTF path inside `node_modules` that Android embeds; `fonts.*.web` is the WOFF2 file name in `public/fonts/` that `scripts/fonts/build-fonts.mjs` writes.
- Derived values, never stored twice: Android `primaryColor` is the `default` accent's light `primary`; the splash, `theme-color` and manifest colours are `colors.light.surface` and `colors.dark.surface`.
- F0-A writes `config/brand.json` with the B2 placeholder values and `status: "placeholder"`.
- **Readers:** `src/core/config/app.ts` (`APP_NAME`), `src/core/ui/theme/tokens.ts` (colours, accents, accent names, type families), `app.config.js` (`expo.name`, `primaryColor`, splash colours, adaptive-icon `backgroundColor`, the `expo-font` list; C4.1), `scripts/fonts/build-fonts.mjs`, and `scripts/brand/stamp-public.mjs` (`yarn brand:stamp`).
- **The stamp script** writes the brand values into the static web files that cannot import JSON: `public/manifest.json` (`name`, `short_name`, `background_color`, `theme_color`), `public/brand.css` (`:root` `--c-*` variables that `public/legal.css` uses), the text of every `<span class="app-name">` in the legal pages, and the `· <appName>` suffix of their `<title>`. `tests/scripts/brand.test.cjs` fails when a stamped file disagrees with `config/brand.json`, and when a file in `src/` or `app/` outside `src/core/config/` contains the app name as a word (`/\bYify\b/`, with the protocol header names `X-Yify-*` excepted); copy uses `{APP_NAME}` (B conventions).
- **Identity step** (W-I, I.6). When `scratchpad/identity/` has a final direction and `scratchpad/icons-v2/final/` exists, the integrator lands one PR that:
  - replaces the values in `config/brand.json` and sets `status: "final"`;
  - recomputes the B2.2 contrast table with `spec/B-design-ux-tools/matrix.py` (every text pair at least 4.5:1, every boundary at least 3:1);
  - adds or swaps font packages with exact pins if the families change;
  - copies `scratchpad/icons-v2/final/repo/**` over the same repository paths and applies every edit in `scratchpad/icons-v2/final/CHANGES.md` (decision 13: the adaptive icon has a solid `backgroundColor` and no background image);
  - runs `yarn brand:stamp` and writes `store-artifacts/v2/feature-graphic.png` and `store-artifacts/v2/icon-512.png`.

  If `final/` already exists when F0-A starts, F0-A copies the icon files and the Identity step only changes the palette and fonts.
- **Release gate** (I.5 step a):
  - `config/brand.json` has `status: "final"`;
  - none of the banned hex values appears in `config/`, `src/`, `public/` or `app.json`;
  - the icon files under `assets/` and `public/` are byte-identical to `scratchpad/icons-v2/final/repo/**`;
  - the resolved app config references no `android-icon-background.png`.

# Part A — Architecture, data, server, storage, sync and routes

Scope: source layout and import boundaries, domain types, the v2 edge API and the legacy catalog API, the client data layer, local storage and the v1 to v2 migration, auth and sync, routes, and the port and delete map for `app/`, `domain/`, `data/` and `instrumentation/`. Part B owns visuals, components and screens; Part C owns monetization, ads, web output, Android build configuration, telemetry and CI.

Conventions used in this part:

- `path:line` cites the v1 tree at `0f7a9ab` (read it with `git show main:<path>`).
- "Verified:" cites the installed `.d.ts` file or the official doc page read on 2026-11-26.
- TypeScript blocks are normative shapes without comments; explanations are in the prose.
- "Copy:" marks user-facing strings. Part B may restyle them but must not change their meaning.

## A0. Calls made in this part

| # | Call | Why |
|---|---|---|
| A1 | `src/` tree with `core/`, `features/<name>/`, `server/`; routes stay in root `app/`; `@/*` maps to `./src/*`; `src/app/` must never exist. | Decision 10. Root `app/` keeps expo-router auto-detection and the API route URLs. Expo uses `src/app` as the router root whenever that folder exists (`node_modules/@expo/cli/build/src/start/server/metro/router.js:151-157`). |
| A2 | Cross-feature imports only through `src/features/<name>/public/**`; no `index.ts` barrels anywhere in `src/`. | Decision 10 (direct imports). Enforced with the installed `import/no-restricted-paths` (eslint-plugin-import 2.32.0) plus `no-restricted-syntax`. |
| A3 | Platform twins (`*.web.ts[x]`) only in platform adapter folders: `src/core/platform/**`, `src/core/ui/**` and `src/features/<name>/platform/**`, plus three named core adapters (`core/api/baseUrl`, `core/query/lifecycle`, `core/storage/kv`) and the three SSR route twins (A7.1). | Decision 10 ("twins inside platform adapters"), checkable by folder. |
| A4 | Title identity is `TitleKey` = `"movie:<tmdbId>"` or `"tv:<tmdbId>"`; unresolved v1 items use `LegacyKey` = `"imdb:tt…"` or `"v1:<id>"` (Part 0, I-52). | Decision 11; v1 history keys already use `movie:<v1 id>`, so v2 data lives under new storage keys to avoid ambiguity. |
| A5 | One edge API under `/api/v2/*` on EAS Hosting; clients never call TMDB, YTS, EZTV or Nyaa. Home is one aggregate request. | Decision 1; fixes the 21-request home fan-out and the India/Russia TMDB blocks. |
| A6 | Images load directly from `image.tmdb.org`; a device that fails to load TMDB images while online switches itself to `/api/v2/img/*` for 24 h. | Keeps EAS request cost near zero for unblocked users and survives ISP blocks. |
| A7 | TanStack Query `@tanstack/react-query` **5.107.1** is the only new runtime dependency of this part. | Decision 10. Published 2026-11-06; 5.108.0 (2026-11-17) is under two weeks old. |
| A8 | Local KV stays on `expo-sqlite/kv-store` (native) and `localStorage` (web); every value this part owns is a versioned JSON envelope under keys prefixed `v2.`; Part C's entitlement, ad-pacing and update-prompt keys keep Part C's names (A5.2). | expo-sqlite 58 stays. v1 keys use `<ns>:<key>`, so prefixes never collide. |
| A9 | v2 sync data lives in `users/{uid}/sections/{section}` (one document per section). v2 never writes the v1 fields of `users/{uid}` and reads them once per account for import. | A v2 field in `users/{uid}` would make every v1 write fail the v1 `hasOnly` rule (`firestore.rules:15-25`). |
| A10 | Sync runs on start, sign-in, foreground, reconnect and a 2 s debounce after local edits. No polling. Every write is a precondition commit. | Fixes BE-6 and BE-7. |
| A11 | Signing out removes account-synced data from the device (after a final push or a private stash). | Prevents settings and library leaking between accounts on shared devices. |
| A12 | The diary works without sign-in (local first) and syncs after sign-in. "Watched" equals "has at least one live diary entry". | Merges v1 watched marks and journal into one model (DES-8). |
| A13 | Navigation: `expo-router/js-tabs` with four tab stacks; detail routes are shared by the stacks through the array group `(home,search,library,you)` (Part 0, I-1). URL writes happen only in event handlers through `useUrlState().commit()`. | Fixes YIFY-36 by construction and keeps the bar, rail or web header visible on detail pages. |
| A14 | Legacy `/api/catalog/*` keeps serving old installs with `torrents: []`, no swarm or download fields, empty Shows and Episodes, no raw data; subscriber, native-subscriber and availability routes are deleted. | Decision 2. |
| A15 | Content URLs are `/title/movie/{id}-{slug}`, `/title/tv/{id}-{slug}` and `/person/{id}-{slug}`. `/movie/…` and `/show/…` are legacy-only paths that redirect. | v1 builds still installed claim `/movie` and `/show` App Links and would open a v2 share link in the old app, which cannot parse it; `/title` links open in the browser on those devices. It also removes the YTS/TMDB integer ambiguity. |
| A16 | Sync is its own feature, `src/features/sync/` (Part 0, I-27). | Account and sync are owned by different work streams and must not import each other in a cycle. |

---

## A1. Source layout and import boundaries

### A1.1 Tree

The right-hand column names the work stream that owns each path after F0 (Part W). "F0" means the path is frozen after F0 and only the integrator changes it; the part in brackets (F0-A to F0-D) writes it.

```
app/                                      expo-router routes only (A7.1)                                   F0, except the files listed in A7.1
src/
  core/
    architecture.test.ts                  A1.5                                                              F0
    domain/                               pure TypeScript                                                   F0
      api.ts account.ts keys.ts library.ts person.ts preferences.ts providers.ts search.ts title.ts
      dates.ts slug.ts legacyUrls.ts                                                                         F0 (F0-A)
      insights.ts                         diary insights (port of journalInsights.ts)                       P5
      sync/types.ts                       SectionName, SyncStatus, SyncedStoreAccess                        F0
      sync/*.ts (codecs, merges, clamp)   A6.4                                                              P5
      legacy/                             v1 formats, conversion, rekey (A5.4)                              P5
    api/                                  client for /api/v2 (A4.1)                                         F0
      baseUrl.ts baseUrl.web.ts client.ts errors.ts decode.ts endpoints.ts batch.ts health.ts summaryCache.ts
    query/                                TanStack Query wiring (A4.2)                                      F0
      client.ts retry.ts keys.ts lifecycle.ts lifecycle.web.ts QueryProvider.tsx
    storage/                              KV + versioned codecs (A5)                                        F0
      kv.ts kv.web.ts json.ts keys.ts legacyV1.ts
    store/createStore.ts                  external store + selector hook                                    F0
    navigation/                                                                                             F0
      urlState.ts                         useUrlState (YIFY-36 fix)
      hrefs.ts                            titleHref, personHref, seasonHref, listHref, searchHref, shareUrl, mediaHref
      searchUrl.ts                        SearchUrlState and its codec (Part 0, I-25)
      singular.ts                         singularById for dangerouslySingular stacks
    platform/                             SDK and device adapters (.web twins allowed)
      appState.ts appState.web.ts         one foreground subscription                                       F0
      network.ts network.web.ts           online subscription (port of ExpoNetworkMonitor)                  F0
      locale.ts locale.web.ts             device region (port of watchRegion.deviceRegion)                  F0
      openUrl.ts openUrl.web.ts           external links (port of openStreamingLink + openLegalPage)        F0
      share.ts share.web.ts               share sheet (port of shareLink)                                    F0
      haptics.ts haptics.web.ts           port of use-haptics                                                F0
      auth/firebaseAuth.ts firebaseAuth.web.ts idToken.ts                                                   P6
      firebase/webApp.ts webApp.web.ts                                                                      P6
      firestore/rest.ts                   Firestore REST transport                                          P5
      telemetry/                          Sentry, GA4, operations, diagnostics (C5)                         F0
      updates/storeUpdates.ts storeUpdates.web.ts  Play in-app updates (C4.5)                               P9
    ui/                                   design system and navigation chrome (Part B)                      F0 (F0-C)
      theme/ components/ navigation/ icons/ layout/ media/
      images.ts imageHost.ts overlays.ts a11y.ts a11y.web.ts format.ts systemBars.ts systemBars.web.ts webProps.d.ts
      document/                           WebDocument.tsx, the web document that app/+html.tsx renders        P8
    config/                                                                                                 F0 (F0-A)
      app.ts                              APP_NAME (from config/brand.json), PLUS_NAME, SITE_ORIGIN, PLAY_STORE_URL,
                                          PACKAGE_ID, APP_VERSION, AUTH_PROXY_HOSTS
      brand.ts                            typed view of config/brand.json (Part 0, §0.4)
      legal.ts                            PRIVACY_URL, TERMS_URL, DELETE_ACCOUNT_URL, SUPPORT_URL, SUPPORT_EMAIL
      seo.ts                              page titles and static-route metadata (C3.2), pure
      telemetry.ts                        SENTRY_DSN and SENTRY_ENVELOPE_URL for server alerts (A3.2)
  features/
    shell/       AppRoot, AppTabBar, start sequence, RootErrorBoundary, NotFoundScreen                     F0
    home/        Home screen, featured card, sections                                                       P2
    search/      Search screen, filters, recent searches, HeaderSearch                                      P3
    title/       Title and Season screens, Where to watch, useAvailability, useOpenMedia, titleQuery         P4
    person/      Person screen                                                                               P4
    player/      TrailerFrame (public), TrailerPlayer twins in platform/                                    P4
    library/     Watchlist, Diary (+ insights), Lists, List, Recent; stores; v1 local migration             P5
    sync/        sync engine, v1 account import, deletion helpers, status                                    P5
    account/     session, sign-out, account deletion, account settings screen                               P6
    settings/    settings screens; preferences, consent and region stores; consent prompt; pickers          P6
    you/         You tab screen                                                                              P6
    monetization/ plus/ (machine, paywall), ads/ (policy, session), platform/ (twins), components/, screens/, public/   P7
    legacy/      client resolvers for v1 URLs                                                                P8
  server/
    env.ts                                                                                                   P1
    http/        respond.ts cachePolicy.ts params.ts admission.ts deadline.ts lastGood.ts fetchJson.ts log.ts
                 state.ts report.ts                                                                         P1
    tmdb/        client.ts dto.ts project.ts images.ts trailer.ts limiter.ts titles.ts fixtures/            P1
    endpoints/   home.ts discover.ts search.ts title.ts season.ts person.ts genres.ts providers.ts
                 regions.ts availability.ts find.ts resolve.ts legacyMovie.ts geo.ts health.ts image.ts     P1
    fixtures/v2/ committed v2 responses for fixture mode (Part 0, I-36)                                    P1
    legacy/      catalog/ (handler.ts parameters.ts projections.ts mapYts.ts types.ts), yts/ (client.ts dto.ts),
                 lookup.ts; the only code that talks to the retired catalog source (Part 0, I-52)          P1
    auth/        firebaseProxy.ts                                                                            P1
    middleware/  legacyRedirects.ts                                                                          P1
    seo/         titlePage.ts personPage.ts metadata.ts jsonLd.ts notFoundHtml.ts securityHeaders.ts sitemaps.ts   P8
config/
  brand.json             brand source (Part 0, §0.4)                                                        integrator (I.6)
  legacy-redirects.json  webHeaders.cjs                                                                     F0 (F0-A)
  android/ ios/          Firebase app config (unchanged)
tests/
  setup/register.mjs     helpers/        contracts/      plugins/        scripts/        firestore/       web/
  policy/                bannedStrings.cjs, the one banned-strings list (A1.5 check 8, C3.8, Q6)
```

Every feature folder uses the same sub-folders when it needs them: `screens/` (route-level components, imported only by `app/`), `components/`, `hooks/`, `stores/`, `platform/` (SDK adapters and `.web` twins used only by this feature), `public/` (the only files other features and `app/` may import). A feature never imports another feature's `screens/`, `components/`, `hooks/`, `stores/` or `platform/`. Monetization additionally uses `plus/` and `ads/` for its pure logic.

Tests are colocated with their subject (A1.6). The `tests/` folder holds the test setup, shared helpers, contract tests across layers, and tests for plugins, scripts, Firestore rules and the web export.

### A1.2 Dependency rules

| From \ may import | core/domain | core/config | core/* (other) | features/X (own) | features/Y/public | app | server |
|---|---|---|---|---|---|---|---|
| core/domain | yes | no | no | no | no | no | no |
| core/config | yes | yes | no | no | no | no | no |
| core/* (other) | yes | yes | yes | no | no | no | no |
| features/X | yes | yes | yes | yes | yes | no | no |
| app/** `.tsx` routes | yes | yes | yes | `screens/`, `public/` only | yes | yes | only `await import('@/server/seo/…')` inside `loader` and `generateMetadata` of the three web route twins (Part 0, I-28) |
| app/** `+api.ts`, `+middleware.ts` | yes | yes | no | no | no | no | yes |
| server | yes | yes | no | no | no | no | yes |

Additional rules:

- `core/domain` and `core/config` may not import React, React Native, Expo, Firebase, Sentry or TanStack packages.
- No `Platform.OS`, `typeof window`, `typeof document` or `typeof navigator` in features, routes or server code, except inside `src/features/<name>/platform/**`. Core is not restricted, but its twins stay in `core/platform`, `core/ui` and the three named adapters.
- Third-party SDKs are contained (A1.5, check 7): ads, purchases and RevenueCat only in `src/features/monetization/platform/`; YouTube and WebView only in `src/features/player/platform/`; Sentry only in `src/core/platform/telemetry/`; Firebase packages only in `src/core/platform/{auth,firebase,telemetry}/`; Google Sign-In only in `src/core/platform/auth/`; `expo-sqlite` only in `src/core/storage/`; `expo-in-app-updates` and `expo-updates` only in `src/core/platform/{updates,telemetry}/`.
- No global `router` import from `expo-router` anywhere (YIFY-2R). Inside `useEffect`, `useLayoutEffect` or `useInsertionEffect` callbacks: no `setParams`, no `replace`, `push`, `navigate`, `dismissTo` or `back` on a router or navigation object, and no `commit` on a URL-state object (YIFY-36).
- No `index.ts` or `index.tsx` files under `src/`.
- No module performs side effects at import time (no listeners, timers or network), except `src/core/platform/telemetry/sentry(.web).ts`, which `entry.ts` imports first. Everything else starts from `src/features/shell/start.ts` after mount (A4.6). This keeps web server rendering clean.
- `Alert.alert` and `window.confirm` are banned; confirmations use `useConfirm()` (B3.7).
- TypeScript is erasable: no `enum`, `namespace`, parameter properties (`constructor(readonly x: T)`) or `import x = require()`, and type-only imports use `import type`. Node's type stripping, which runs every `.test.ts` file, throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on the first and fails to link the second (reproduced on Node 24.19.0); A1.3 makes `tsc` reject both.
- Server code keeps cross-request state (the isolate cache and last-good entries, the TMDB limiter, admission buckets, the health probe, the alert throttle) only in `getServerState()` from `src/server/http/state.ts`, which stores one object at `globalThis.__yifyServer`. The export builds a separate bundle for every API route, every loader, the middleware and the renderer (`node_modules/@expo/cli/build/src/export/exportStaticAsync.js:675-686`), so module-level `let` state is not shared between them.

### A1.3 `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "paths": {
      "@/*": ["./src/*"],
      "@assets/*": ["./assets/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/*.test.ts", "node_modules", "dist", "dist-hosting", "docs"]
}
```

`verbatimModuleSyntax` makes a type imported without `import type` an error (TS1484), and `erasableSyntaxOnly` rejects enums, namespaces and parameter properties (TS1294). Both options exist in TypeScript 7.0.2 (`node_modules/typescript/dist/api/compilerOptions.d.ts:30,106`); the integrator typechecked a sample with them on 2026-11-26, including a JSON default import, which `expo/tsconfig.base.json` allows through `resolveJsonModule: true` and `module: "preserve"` (`spec/integrator-lab/strip/`).

### A1.4 ESLint config (replaces `eslint.config.js`)

Verified: `tooling/node_modules/eslint-plugin-import/lib/rules/no-restricted-paths.js` (2.32.0) accepts zones with `target` (string or string[], path or glob), `from` (all globs or no globs), `except` (globs when `from` is a glob, otherwise paths relative to `from`) and `message`; globs are matched with minimatch 3.1.5 against absolute paths (`**/src/features/*/public/**` matches `/…/src/features/library/public/x.ts` and not `/…/src/features/library/stores/x.ts`). `eslint-plugin-boundaries` is not installed and is not needed. The `no-comments` rule is the inline plugin from C6.7 (no new dependency).

This file is the complete v2 `eslint.config.js`. It merges the boundary zones, the YIFY-36 and YIFY-2R guards, the platform-split rules, the design-token rules (B2) and the no-comments rule. Flat config does not merge options of one rule across blocks, so blocks that set `no-restricted-syntax` repeat the shared selector lists on purpose, and their order matters: a later block replaces the earlier setting for the files it matches.

```js
const path = require('path');
const {defineConfig} = require('eslint/config');
const expoConfig = require('./tooling/eslint.cjs');

const FEATURES = ['shell', 'home', 'search', 'title', 'person', 'player', 'library', 'sync', 'account', 'settings', 'you', 'monetization', 'legacy'];

const EFFECT = 'CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/]';
const NAV_MESSAGE = 'Navigation and URL writes belong in event handlers, never in effects (YIFY-36). Render <Redirect> for render-time redirects.';
const NAV_IN_EFFECT = [
  {selector: `${EFFECT} CallExpression[callee.property.name='setParams']`, message: NAV_MESSAGE},
  {selector: `${EFFECT} CallExpression[callee.object.name=/^(router|navigation)$/][callee.property.name=/^(replace|push|navigate|dismissTo|back)$/]`, message: NAV_MESSAGE},
  {selector: `${EFFECT} CallExpression[callee.object.name=/^(url|[a-z]+Url)$/][callee.property.name='commit']`, message: NAV_MESSAGE},
];
const DIALOG_MESSAGE = 'System dialogs are banned. Use useConfirm() from src/core/ui/components/ConfirmDialog.';
const SYSTEM_DIALOGS = [
  {selector: "CallExpression[callee.object.name='Alert'][callee.property.name='alert']", message: DIALOG_MESSAGE},
  {selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]", message: DIALOG_MESSAGE},
];
const TOKEN_MESSAGE = 'Use theme tokens from src/core/ui/theme for colours, type and shape.';
const TOKENS = [
  {selector: 'Literal[value=/^#[0-9A-Fa-f]{3,8}$/]', message: TOKEN_MESSAGE},
  {selector: 'Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]', message: TOKEN_MESSAGE},
  {selector: 'Property[key.name=/^(fontSize|lineHeight|letterSpacing|fontFamily|fontWeight)$/]', message: TOKEN_MESSAGE},
  {selector: "Property[key.name='borderRadius'][value.type='Literal']", message: TOKEN_MESSAGE},
];
const PLATFORM_OS = {
  selector: "MemberExpression[object.name='Platform'][property.name='OS']",
  message: 'Split by platform with .web.ts(x) twins in a platform adapter folder (src/core/platform, src/core/ui, src/features/<name>/platform).',
};
const TYPEOF_DOM = {
  selector: "UnaryExpression[operator='typeof'][argument.name=/^(window|document|navigator)$/]",
  message: 'Environment checks live in platform adapter folders.',
};
const wholeFile = (message) => ({selector: 'Program', message});
const NODE_GLOBALS = Object.fromEntries([
  '__dirname', '__filename', 'Buffer', 'process', 'require', 'module', 'exports', 'console', 'URL', 'URLSearchParams',
  'fetch', 'Response', 'Request', 'Headers', 'AbortController', 'AbortSignal', 'TextEncoder', 'TextDecoder',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'structuredClone',
].map((name) => [name, 'readonly']));

const yify = {
  rules: {
    'no-comments': {
      meta: {type: 'problem', schema: []},
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (comment.type === 'Shebang') continue;
              context.report({loc: comment.loc, message: 'Comments are not allowed in this codebase.'});
            }
          },
        };
      },
    },
  },
};

const zones = [
  {target: './src/core', from: ['./src/features', './src/server', './app'],
    message: 'core must not depend on features, server code or routes.'},
  {target: './src/core/domain', from: './src/core', except: ['./domain'],
    message: 'core/domain imports only core/domain.'},
  {target: './src/core/config', from: './src/core', except: ['./config', './domain'],
    message: 'core/config holds constants and may import only core/domain.'},
  {target: './src/features', from: ['./src/server', './app'],
    message: 'features must not import server code or routes.'},
  ...FEATURES.map((feature) => ({
    target: `./src/features/${feature}`,
    from: './src/features/**',
    except: [`**/src/features/${feature}/**`, '**/src/features/*/public/**'],
    message: `features/${feature} may use other features only through their public/ folder.`,
  })),
  {target: './src/server', from: ['./src/core', './src/features', './app'], except: ['./domain', './config'],
    message: 'server code imports only src/server, src/core/domain and src/core/config.'},
  {target: './app', from: './src/features/**',
    except: ['**/src/features/*/screens/**', '**/src/features/*/public/**'],
    message: 'Routes import feature screens or public modules only.'},
  {target: './app/**/*.tsx', from: './src/server', except: ['./seo'],
    message: 'Only +api.ts, +middleware.ts and the web route twins (through src/server/seo) may use server code.'},
];

const CLIENT = ['src/core/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'];
const ALLOWED_TWINS = [
  'src/core/platform/**',
  'src/core/ui/**',
  'src/features/*/platform/**',
  'src/core/api/baseUrl.web.ts',
  'src/core/query/lifecycle.web.ts',
  'src/core/storage/kv.web.ts',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'android/**', 'ios/**', 'dist/**', 'dist-hosting/**', 'public/**', 'assets/**', '**/node_modules/**',
      'desktop-dist/**', 'store-artifacts/**', 'store-listing/**', 'docs/**', '.claude/**', '.expo/**', 'expo-env.d.ts',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    plugins: {yify},
    rules: {'yify/no-comments': 'error'},
  },
  {
    files: ['**/*.cjs', 'plugins/**/*.js', 'tooling/**/*.js', '*.config.js'],
    languageOptions: {sourceType: 'commonjs', globals: NODE_GLOBALS},
    rules: {'@typescript-eslint/no-require-imports': 'off'},
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {sourceType: 'module', globals: NODE_GLOBALS},
  },
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {typescript: {project: path.join(__dirname, 'tsconfig.json'), alwaysTryTypes: true}},
    },
    rules: {
      'import/no-restricted-paths': ['error', {basePath: __dirname, zones}],
      'no-restricted-imports': ['error', {
        paths: [{name: 'expo-router', importNames: ['router'],
          message: 'Use useRouter(), <Link> or <Redirect>. The global router throws before the root navigator mounts (YIFY-2R).'}],
      }],
    },
  },
  {
    files: CLIENT,
    rules: {'no-restricted-syntax': ['error', ...NAV_IN_EFFECT, ...SYSTEM_DIALOGS, ...TOKENS]},
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['src/features/*/platform/**'],
    rules: {'no-restricted-syntax': ['error', ...NAV_IN_EFFECT, ...SYSTEM_DIALOGS, ...TOKENS, PLATFORM_OS, TYPEOF_DOM]},
  },
  {
    files: ['src/core/ui/theme/**/*.{ts,tsx}'],
    rules: {'no-restricted-syntax': ['error', ...NAV_IN_EFFECT, ...SYSTEM_DIALOGS]},
  },
  {
    files: ['app/+html.tsx', 'src/server/**/*.ts', 'app/**/*+api.ts', 'app/+middleware.ts'],
    rules: {'no-restricted-syntax': ['error', PLATFORM_OS, TYPEOF_DOM]},
  },
  {
    files: ['src/**/*.web.{ts,tsx}'],
    ignores: ALLOWED_TWINS,
    rules: {'no-restricted-syntax': ['error', wholeFile('Platform twins (*.web.ts[x]) live only in src/core/platform, src/core/ui, src/features/<name>/platform or the three named core adapters.')]},
  },
  {
    files: ['src/**/index.{ts,tsx}'],
    rules: {'no-restricted-syntax': ['error', wholeFile('No barrels. Import the module file directly.')]},
  },
  {
    files: ['src/core/domain/**/*.ts', 'src/core/config/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {patterns: [{
        group: ['react', 'react-*', 'react-native', 'react-native/*', 'expo', 'expo-*', '@expo/*', 'firebase', 'firebase/*', '@react-native-firebase/*', '@sentry/*', '@tanstack/*'],
        message: 'core/domain and core/config are platform-free TypeScript.',
      }]}],
    },
  },
]);
```

Notes for the implementer:

- The effect selectors are lexical and target only navigation objects (`router`, `navigation`), any `setParams`, and `commit` on a `useUrlState` result. Convention: the hook result is always named `url` or `<thing>Url` (`const url = useUrlState(searchUrlCodec)`), so string `.replace` and array `.push` inside effects stay legal.
- `app/+html.tsx` and server code are exempt from the token rules: the document CSS and the 404 HTML are generated from tokens (`src/core/ui/theme/webCss.ts`) or are server pages.
- The three web route twins are checked by name in the architecture test (A1.5) rather than here, because their folder names contain brackets, parentheses and commas.
- `yarn lint` is `eslint --max-warnings 0 .`. eslint-config-expo defines no Node globals, so without the two Node blocks `__dirname`, `Buffer` and `process` fail `no-undef` in plugins, scripts and tests (feasibility review, item 2, reproduced with ESLint 10.15.0). The globals map is inline, so no new dependency is needed. Inline `eslint-disable` comments are impossible because comments are banned.
- The integrator ran these rules over every v1 file that F0 keeps on 2026-11-26 (`spec/integrator-lab/lint/eslint.v2.cjs`, 36 files: the kept plugins, scripts, the eleven moved tests, the Firestore rules test, `babel.config.js` and `tooling/*.cjs`). The only findings were the comment at `plugins/withAndroidRelease.js:39` and the two comment lines at the top of `tests/firestore-rules.integration.cjs`, which F0-A removes.
- F0-A deletes `desktop/`, `release/`, `openspec/` and `.agents/`, so they need no ignore entries. `desktop-dist/` (untracked build output), `.claude/` (local agent worktrees, which would otherwise be linted as source) and `.expo/` are ignored because `eslint .` also walks untracked folders.

### A1.5 Architecture guard test

`src/core/architecture.test.ts` (`node --test`, A1.6) reads the file tree and source text and asserts:

1. `src/app/` does not exist (Expo would switch its router root to it).
2. `app/` contains exactly the files listed in A7.1; an unlisted or missing file fails the test with the path.
3. Every `app/**/*.tsx` file has at most 30 lines, `app/+html.tsx` included: it renders `WebDocument` from `src/core/ui/document/WebDocument.tsx` (P8, C3.2).
4. No `index.ts` or `index.tsx` exists under `src/`.
5. `.web.ts(x)` files exist only under `src/core/platform/**`, `src/core/ui/**` and `src/features/*/platform/**`, at the three named core adapters (`src/core/api/baseUrl.web.ts`, `src/core/query/lifecycle.web.ts`, `src/core/storage/kv.web.ts`), and at the three web route twins of A7.1.
6. `loader` is exported only by the three web route twins. `generateMetadata` is exported only by the three web twins (async; the body is `await import('@/server/seo/…')` and one call) and by the static route files listed in C3.2, which export a synchronous `generateMetadata` that calls only `src/core/config/seo.ts` (Part 0, I-55). No `app/**/*.tsx` file contains a static import of `@/server` (`/from\s+['"]@\/server\//`); the twins load server code only through `await import('@/server/seo/` (Part 0, I-28).
7. SDK containment. For every `import … from '<pkg>'`, `import('<pkg>')` and `require('<pkg>')` in `src/**` and `app/**` (tests excluded), the importing path must start with an allowed prefix:

   | Package pattern | Allowed importer prefixes |
   |---|---|
   | `react-native-google-mobile-ads` | `src/features/monetization/platform/` |
   | `react-native-purchases`, `@revenuecat/purchases-js` | `src/features/monetization/platform/` |
   | `react-native-youtube-iframe`, `react-native-webview` | `src/features/player/platform/` |
   | `@sentry/react-native`, `@sentry/browser` | `src/core/platform/telemetry/` |
   | `@react-native-firebase/*`, `firebase`, `firebase/*` | `src/core/platform/auth/`, `src/core/platform/firebase/`, `src/core/platform/telemetry/` |
   | `@react-native-google-signin/google-signin` | `src/core/platform/auth/` |
   | `expo-sqlite`, `expo-sqlite/*` | `src/core/storage/` |
   | `expo-in-app-updates`, `expo-updates` | `src/core/platform/updates/`, `src/core/platform/telemetry/` |
   | `expo-network`, `expo-localization`, `expo-web-browser`, `expo-linking`, `expo-haptics` | `src/core/platform/` |
   | `@tanstack/react-query` | `src/core/query/`, `src/core/api/`, `src/features/` |
   | any package | never from `src/core/domain/` or `src/core/config/`; from `src/server/` only `import type … from 'expo-router/server'` (server code sets headers by returning `Response` objects and never imports `expo-server` at runtime) |

8. Banned strings. `tests/policy/bannedStrings.cjs` exports the one list that this test, `scripts/check-web-export.mjs` (C3.8) and Q6 share: `/\byts\b/i`, `/yts\.(mx|pw|lt|am|ag|to)/i`, `/img\.yts\./i`, `/accel\.li/i`, `/eztv/i`, `/nyaa/i`, `/wsrv\.nl/i`, `/torrent/i`, `/magnet:/i`, `/urn:btih:/i`, `/8b6ff243/`, `/buymeacoffee/i`, `/adsbygoogle/i` and `/googlesyndication/i`. Outside `src/server/legacy/**` and test files, no file under `src/` or `app/` matches any of them. Legacy identifiers are neutral (`v1:` keys, `/legacy/movie`, `ResolveRequest.v1`; Part 0, I-52), and the v1 parsers in `src/core/domain/legacy/` keep only the fields v2 converts, so no client file needs an exemption. No file under `src/` or `app/` contains `api.themoviedb.org` outside `src/server/**`.
9. Every `src/features/*/public/*` file exports at least one symbol and imports no other feature's non-public file (a duplicate of the lint zone that also covers dynamic imports).

The test prints every violation, not only the first. The no-comments rule is enforced by `yarn lint` (A1.4).

### A1.6 Tests: runner, conventions and helpers

`package.json`:

```json
{
  "scripts": {
    "test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup/register.mjs --test 'src/**/*.test.ts' 'src/**/*.test.cjs' 'tests/*/**/*.test.ts' 'tests/*/**/*.test.cjs' 'tests/*/**/*.test.mjs'"
  }
}
```

Node 24.19.0 strips TypeScript types natively (`process.features.typescript === 'strip'`) and propagates `--import` to the test-file subprocesses. Strip-only mode accepts erasable syntax only (A1.2, A1.3). `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` silences the reparse warning that every ES-module `.ts` file triggers because the root `package.json` has no `type`. `tests/setup/register.mjs` resolves `@/…` to `src/…`, `@assets/…` to `assets/…`, extensionless relative imports from `.ts(x)` files and paths that already carry an extension, and serves `.json` files as ES modules with a default export, using `module.registerHooks` (prototyped against Node 24.19.0 on 2026-11-26 and re-run by the integrator with an explicit-field error class, a JSON fixture import and a JSON import inside `src/core/config/brand.ts`; `spec/integrator-lab/strip/`):

```js
import {registerHooks} from 'node:module';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceExtensions = ['.ts', '.tsx'];

function findSource(base) {
  if (extname(base) && existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of sourceExtensions) {
    if (existsSync(base + extension)) return base + extension;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of sourceExtensions) {
      const index = join(base, `index${extension}`);
      if (existsSync(index)) return index;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith('@/')) base = join(root, 'src', specifier.slice(2));
    else if (specifier.startsWith('@assets/')) base = join(root, 'assets', specifier.slice(8));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parent = fileURLToPath(context.parentURL);
      if (sourceExtensions.includes(extname(parent)) && !extname(specifier)) base = resolve(dirname(parent), specifier);
    }
    if (base) {
      const file = findSource(base);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      const text = readFileSync(fileURLToPath(url), 'utf8');
      return {format: 'module', source: `export default ${text};`, shortCircuit: true};
    }
    return nextLoad(url, context);
  },
});
```

Conventions:

| Kind | File | How it runs | May import |
|---|---|---|---|
| Pure logic (domain, codecs, policies, stores without React Native, server code, `src/core/api/{errors,client,retry,decode,batch,health}`) | `*.test.ts` next to the subject | natively (type stripping) through the hook | anything that is erasable TypeScript (A1.2), uses `import type` for types, and imports no React Native, Expo or `.tsx` module, directly or transitively; JSON imports are fine |
| Modules that touch React, React Native, Expo or JSX (components, hooks, adapters) | `*.test.cjs` next to the subject | `tests/helpers/loadTs.cjs` (Babel 8 transform with `mocks`) | the module under test with every native package replaced by a mock |
| Cross-layer contracts, plugins, scripts, Firestore rules, web export | `tests/<area>/*.test.{ts,cjs,mjs}` | natively or through `loadTs.cjs` | as above |

Helpers (F0):

- `tests/helpers/loadTs.cjs`: port of `tests/helpers/load-typescript.cjs` and `transpile-typescript.cjs` from v1 with `@/` mapped to `src/` and `@assets/` to `assets/`. Signature: `loadTs(file: string, mocks?: Record<string, unknown>): any`.
- `tests/helpers/rnMock.cjs`: a `react-native` mock whose host components (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`, `TextInput`, `Modal`, `Image`, `ActivityIndicator`, `KeyboardAvoidingView`) are plain string host types that keep their props, plus `StyleSheet.create`, `Platform` (`OS: 'android'`), `AccessibilityInfo` (spies), `AppState`, `Linking`, `useWindowDimensions` (settable size) and `useColorScheme`.
- `tests/helpers/render.cjs`: `render(element)` with `react-test-renderer` 19.3.1, returning `{root, update, unmount, byRole(role), byLabel(label)}`.

Rules: fixtures are synthetic (no real user data); tests never call the network except the Firestore emulator suite and the web-export checks against local servers; a test that needs time uses an injected clock, never real timers longer than 50 ms.

---

## A2. Domain types (`src/core/domain/*`)

### A2.1 Keys (`keys.ts`)

```ts
export type MediaType = 'movie' | 'tv';
export type TitleKey = `movie:${number}` | `tv:${number}`;
export type PersonKey = `person:${number}`;
export type LegacyKey = `v1:${number}` | `imdb:tt${string}`;
export type EntryKey = TitleKey | LegacyKey;

export const TITLE_KEY_PATTERN = /^(movie|tv):([1-9]\d{0,9})$/;
export const LEGACY_KEY_PATTERN = /^(?:v1:[1-9]\d{0,9}|imdb:tt\d{7,10})$/;

export function titleKey(type: MediaType, id: number): TitleKey;
export function parseTitleKey(value: string): {type: MediaType; id: number; key: TitleKey} | null;
export function isLegacyKey(value: string): value is LegacyKey;
export function isEntryKey(value: string): value is EntryKey;
export function personKey(id: number): PersonKey;
```

`parseTitleKey` rejects ids above 2147483647. `LegacyKey` values are produced only by the v1 migration (section 5.4). A `v1:<id>` key carries the numeric movie id that Yify 1.x stored; only the legacy lookup on the server understands it (Part 0, I-52).

### A2.2 Titles (`title.ts`)

```ts
import type {MediaType, PersonKey, TitleKey} from './keys';
import type {RegionAvailability} from './providers';

export interface Genre {
  id: number;
  name: string;
  types: MediaType[];
}

export interface TitleSummary {
  key: TitleKey;
  type: MediaType;
  id: number;
  slug: string;
  title: string;
  originalTitle: string;
  year: number | null;
  releaseDate: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  voteCount: number;
  genreIds: number[];
  originalLanguage: string;
}

export type VideoType = 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | 'Behind the Scenes' | 'Bloopers' | 'Opening Credits';

export interface Video {
  key: string;
  type: VideoType;
  name: string;
  official: boolean;
  language: string | null;
  publishedAt: string | null;
}

export interface CastCredit {
  personKey: PersonKey;
  personId: number;
  slug: string;
  name: string;
  character: string;
  profilePath: string | null;
  episodeCount: number | null;
}

export interface CrewCredit {
  personKey: PersonKey;
  personId: number;
  slug: string;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

interface TitleDetailsBase extends TitleSummary {
  tagline: string;
  genres: Genre[];
  runtimeMinutes: number | null;
  certification: string | null;
  imdbId: string | null;
  status: string;
  homepage: string | null;
  cast: CastCredit[];
  crew: CrewCredit[];
  videos: Video[];
  trailer: Video | null;
  recommendations: TitleSummary[];
  availability: RegionAvailability;
}

export interface MovieDetails extends TitleDetailsBase {
  type: 'movie';
  collection: {id: number; name: string} | null;
}

export interface EpisodeSummary {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface TvDetails extends TitleDetailsBase {
  type: 'tv';
  seasons: SeasonSummary[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
  inProduction: boolean;
  lastAirDate: string | null;
  nextEpisode: EpisodeSummary | null;
  lastEpisode: EpisodeSummary | null;
  networks: {id: number; name: string; logoPath: string | null}[];
  createdBy: {personKey: PersonKey; name: string}[];
}

export type TitleDetails = MovieDetails | TvDetails;

export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtimeMinutes: number | null;
  stillPath: string | null;
  rating: number | null;
}

export interface SeasonDetails {
  key: TitleKey;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  posterPath: string | null;
  episodes: Episode[];
}
```

Field rules (enforced by the server projection, section 3.3):

| Field | Rule |
|---|---|
| `title` | movie `title`, tv `name`; falls back to `original_title`/`original_name`; trimmed; max 300 chars. |
| `year` | integer from the first 4 chars of `release_date`/`first_air_date` when it matches `^\d{4}-\d{2}-\d{2}$`, else `null`. |
| `rating` | `Math.round(vote_average * 10) / 10` when `vote_count >= 10`, else `null`. |
| `overview` | summaries: max 300 chars, cut at the last space and suffixed with `…`; details: max 5000 chars. |
| `posterPath`, `backdropPath`, `stillPath`, `profilePath`, `logoPath` | TMDB file path matching `^/[A-Za-z0-9_-]{6,80}\.(jpg\|jpeg\|png\|svg)$`, else `null`. Never a full URL. |
| `slug` | `slugify(title)` (section 3.3.6); empty for titles without Latin letters or digits, in which case URLs use the bare id. |
| `cast` | max 20, TMDB order. `crew`: max 10, jobs in priority `Director`, `Creator`, `Screenplay`, `Writer`, `Novel`, `Original Music Composer`, `Director of Photography`. |
| `videos` | YouTube only, key `^[A-Za-z0-9_-]{11}$`, max 8; `trailer` = section 3.3.5 rule. |
| `recommendations` | max 12, adult removed. |

### A2.3 People (`person.ts`)

```ts
import type {PersonKey} from './keys';
import type {TitleSummary} from './title';

export interface PersonSummary {
  key: PersonKey;
  id: number;
  slug: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  knownFor: TitleSummary[];
}

export interface PersonCredit {
  title: TitleSummary;
  character: string | null;
  jobs: string[];
  episodeCount: number | null;
}

export interface PersonDetails {
  key: PersonKey;
  id: number;
  slug: string;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownForDepartment: string | null;
  imdbId: string | null;
  alsoKnownAs: string[];
  knownFor: TitleSummary[];
  credits: PersonCredit[];
}
```

### A2.4 Where to watch (`providers.ts`)

```ts
import type {MediaType} from './keys';

export type RegionCode = string;
export type OfferType = 'stream' | 'free' | 'ads' | 'rent' | 'buy';
export const OFFER_TYPES: readonly OfferType[] = ['stream', 'free', 'ads', 'rent', 'buy'];

export interface Provider {
  id: number;
  name: string;
  logoPath: string | null;
  priority: number;
}

export interface RegionAvailability {
  region: RegionCode;
  offers: Record<OfferType, Provider[]>;
  link: string | null;
  attribution: 'JustWatch';
}

export interface Region {
  code: RegionCode;
  name: string;
}

export interface CatalogProvider extends Provider {
  types: MediaType[];
}

export type MyServices = Record<RegionCode, number[]>;
```

`stream` is TMDB `flatrate`. `link` is the TMDB watch page for the region (`https://www.themoviedb.org/{movie|tv}/{id}-…/watch?locale={REGION}`), validated with the rule ported from `data/repositories/StreamingRepositoryImpl.ts:27-36`. `RegionCode` always matches `^[A-Z]{2}$`.

### A2.5 Search and discover (`search.ts`)

```ts
import type {MediaType} from './keys';
import type {OfferType, RegionCode} from './providers';
import type {PersonSummary} from './person';
import type {TitleSummary} from './title';

export type SearchType = 'all' | 'movie' | 'tv' | 'person';

export type SearchResult =
  | {kind: 'title'; title: TitleSummary}
  | {kind: 'person'; person: PersonSummary};

export type DiscoverSort = 'popular' | 'rating' | 'release' | 'title';

export interface DiscoverParams {
  type: MediaType;
  genres: number[];
  providers: number[];
  monetization: OfferType[];
  region: RegionCode | null;
  sort: DiscoverSort;
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  language: string | null;
}

export interface Paged<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}
```

### A2.6 Library (`library.ts`)

```ts
import type {EntryKey} from './keys';

export interface TitleSnapshot {
  title: string;
  year: number | null;
  posterPath: string | null;
  slug: string;
}

export interface WatchlistEntry {
  addedAt: number;
  snapshot: TitleSnapshot;
}

export interface WatchlistState {
  entries: Partial<Record<EntryKey, WatchlistEntry>>;
  removed: Partial<Record<EntryKey, number>>;
}

export interface LibraryEntry extends WatchlistEntry {
  key: EntryKey;
}

export type HalfStars = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface DiaryEntry {
  id: string;
  key: EntryKey;
  snapshot: TitleSnapshot;
  watchedOn: string | null;
  rating: HalfStars | null;
  note: string;
  rewatch: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

export interface DiaryState {
  entries: Record<string, DiaryEntry>;
  clearedAt: number;
}

export interface ListItem {
  at: number;
  value: boolean;
  snapshot: TitleSnapshot;
}

export interface UserList {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  removedAt: number;
  items: Partial<Record<EntryKey, ListItem>>;
}

export interface ListsState {
  lists: Record<string, UserList>;
  clearedAt: number;
}

export interface RecentEntry {
  viewedAt: number;
  snapshot: TitleSnapshot;
}

export interface RecentState {
  entries: Partial<Record<EntryKey, RecentEntry>>;
  removed: Partial<Record<EntryKey, number>>;
  clearedAt: number;
}

export const LIMITS = {
  watchlist: 2000,
  diary: 2500,
  listsMax: 100,
  listRecords: 200,
  listItemsTotal: 2000,
  listName: 60,
  recent: 500,
  note: 1000,
  recentSearches: 10,
  tombstoneHorizonMs: 90 * 24 * 60 * 60 * 1000,
} as const;
```

Caps block new local additions only (the store refuses the write and shows the limit copy of 5.2). Migration, `rekey` and sync merges never evict entries: v1 can hold 500 journal entries plus 2,000 watched marks, and two devices can each be near a cap. A section above its byte budget gets the `oversized` sync status (6.5) until the user removes items. Recently viewed is the one rolling list: `recordView` trims the oldest entries beyond `LIMITS.recent` and writes tombstones for them, so other devices drop them too (Part 0, I-59).

Naming: `LibraryEntry` is what watchlist selectors return (a `WatchlistEntry` plus its key; the stored map keeps the key only as the record key). The diary's `DiaryEntry` is the "watched entry"; custom lists are `UserList`; recently viewed items are `RecentEntry`.

Rules:

- `DiaryEntry.id` matches `^[A-Za-z0-9_-]{1,100}$`. New ids: `d_${stamp.toString(36)}_${random10}`. Migrated v1 journal ids (`j_…`) keep their id; migrated v1 watched marks get `w1_<v1 id>` (the numeric v1 movie id that keyed the mark), so every device derives the same id whatever it knew about IMDb codes.
- The diary codec's `normalize` drops a migrated watched mark (`w1_…` with no date, rating or note) when another live entry has the same key after `rekey`, by setting its `deletedAt` to the larger `updatedAt` of the two entries, so devices converge on one entry (execution review, item 20).
- `watchedOn` is a local calendar date `YYYY-MM-DD` (validated with the ported `isJournalDate`, `domain/policies/journal.ts:28-32`) not after today, or `null` when the date is unknown (only for migrated v1 watched marks).
- `rating` is half-star units: `1` = 0.5 star, `10` = 5 stars (same encoding as v1 `domain/entities/Journal.ts:14`).
- A title is "watched" when it has at least one entry with `deletedAt === 0` and `max(updatedAt, deletedAt) > clearedAt`. `rewatch` is set by the user, and set automatically on migration for every journal entry after the earliest one for the same key.
- A deleted diary entry keeps only a tombstone: `snapshot.title` becomes `"Removed entry"`, `note` `""`, `rating` `null` (port of `data/repositories/JournalRepositoryImpl.ts:93-95`).
- A removed list keeps `{name: "Removed list", removedAt}` and drops its items (port of `domain/policies/libraryMerge.ts:8,55`).
- `UserList.id`: v1 ids `c_…` are kept; new ids `l_${stamp.toString(36)}_${random10}`.
- All stamps are integers in ms produced by `nextStamp(now, latest) = Math.max(Math.trunc(now), latest + 1)` (port of `data/repositories/LibraryRepositoryImpl.ts:139-143`), so stamps are strictly increasing per section on one device.

### A2.7 Preferences and consent (`preferences.ts`)

```ts
import type {MyServices, RegionCode} from './providers';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Accent = 'default' | 'accent1' | 'accent2' | 'accent3' | 'accent4';

export interface Preferences {
  theme: ThemePreference;
  accent: Accent;
  region: RegionCode | null;
  services: MyServices;
  recentPaused: boolean;
  trailerCaptions: boolean;
}

export type PreferenceStamps = Record<keyof Preferences, number>;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  accent: 'default',
  region: null,
  services: {},
  recentPaused: false,
  trailerCaptions: false,
};

export interface Consent {
  analytics: boolean;
  youtube: boolean;
  noticeVersion: string;
  decidedAt: string | null;
}

export const V2_NOTICE_VERSION = 'v3';

export const DEFAULT_CONSENT: Consent = {
  analytics: false,
  youtube: false,
  noticeVersion: '',
  decidedAt: null,
};

export function consentPromptDue(consent: Consent): boolean {
  return consent.decidedAt === null || consent.noticeVersion !== V2_NOTICE_VERSION;
}
```

- `Preferences` syncs per field (section 6.4). `Consent` and the detected region never sync.
- `accent`: Plus feature. Rendering goes through section C's `effectiveAccent({stored, status, fallback: 'default'})`, so free users see `default`; the stored value is kept so a returning subscriber gets their accent back. The ids are neutral slots; names and colours come from `config/brand.json` (B2.3; Part 0, I-13 and §0.4). Unknown stored values, including v1-era names, decode to `default`.
- `services`: TMDB provider ids per region, max 64 per region, max 250 regions, encoded JSON max 2800 chars (limits ported from `data/repositories/PreferencesRepositoryImpl.ts:30-32`).
- Effective region: `preferences.region ?? detectedRegion ?? 'US'` (section 4.4).
- The non-blocking consent prompt is B4.13 (settings feature). `V2_NOTICE_VERSION = 'v3'` is final; it differs from v1's `2026-09-25-v2` (`domain/entities/PrivacyChoices.ts:1`). The prompt is due while `consentPromptDue(consent)` is true: a fresh install (`noticeVersion: ''`, `decidedAt: null`) and every migrated v1 record see it until they answer. Until then the stored choices apply (analytics off by default). Any answer, including dismissing the prompt, records `decidedAt` and `V2_NOTICE_VERSION` (Part 0, I-17). A deferral (B4.13) is session state in the consent store and is never written.

### A2.8 Plus status (owned by section C)

Part C owns the entitlement types and constants: `PlusStatus` (`'unknown' | 'free' | 'plus'`), `EntitlementSnapshot`, `PlusEntitlement`, `PaywallPlacement`, `PLUS_ENTITLEMENT = 'remove_ads'` and `FREE_CUSTOM_LIST_LIMIT = 3`, all exported from `src/features/monetization/public/types.ts` (Part W, F0.5). The RevenueCat entitlement identifier stays `remove_ads` (`domain/entities/Entitlement.ts:1`). No `core/domain` type duplicates them.

This section consumes only the gating API, through `features/monetization/public/plus.ts` (section C §1.11): `usePlus().status` and `ensureKnown()`, `canCreateCustomList()` before a list is created (5.2), `effectiveAccent()` when rendering the accent (2.7) and `insightsAccess()` for diary insights.

### A2.9 Account (`account.ts`)

Port unchanged from `domain/entities/Account.ts` (`Account`, `AuthSession`, `INITIAL_AUTH_SESSION`) and `domain/entities/AuthTokenError.ts`.

### A2.10 API types (`api.ts`)

```ts
import type {Genre, SeasonDetails, TitleDetails, TitleSummary, Video} from './title';
import type {PersonDetails} from './person';
import type {CatalogProvider, Region, RegionAvailability, RegionCode} from './providers';
import type {Paged, SearchResult, SearchType} from './search';
import type {TitleKey} from './keys';

export type RailId = 'trending' | 'popular-movies' | 'popular-tv' | 'in-theaters' | 'streaming-now' | 'acclaimed' | 'new-episodes';

export interface HeroItem extends TitleSummary {
  trailer: Video | null;
}

export interface Rail {
  id: RailId;
  kind: 'ranked' | 'posters';
  items: TitleSummary[];
}

export interface HomeResponse { v: 2; region: RegionCode; generatedAt: string; hero: HeroItem[]; rails: Rail[] }
export interface DiscoverResponse extends Paged<TitleSummary> { v: 2 }
export interface SearchResponse extends Paged<SearchResult> { v: 2; q: string; type: SearchType }
export interface TitleResponse { v: 2; title: TitleDetails }
export interface SeasonResponse { v: 2; season: SeasonDetails }
export interface PersonResponse { v: 2; person: PersonDetails }
export interface GenresResponse { v: 2; genres: Genre[] }
export interface RegionsResponse { v: 2; regions: Region[] }
export interface ProvidersResponse { v: 2; region: RegionCode; providers: CatalogProvider[] }
export interface AvailabilityRequest { region: RegionCode; keys: TitleKey[] }
export interface AvailabilityResponse { v: 2; region: RegionCode; items: Partial<Record<TitleKey, RegionAvailability | null>>; failed: TitleKey[] }

export interface ResolvedTitle {
  key: TitleKey;
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  imdbId: string | null;
}

export interface FindResponse { v: 2; imdbId: string; match: ResolvedTitle }
export interface LegacyMovieResponse { v: 2; v1Id: number; imdbId: string; match: ResolvedTitle; path: string }
export interface V1Candidate { id: number; title: string | null; year: number | null }
export interface ResolveRequest { imdb: string[]; v1: V1Candidate[] }
export interface ResolveResponse {
  v: 2;
  imdb: Record<string, ResolvedTitle | null>;
  v1: Record<string, ResolvedTitle | null>;
  failed: {imdb: string[]; v1: number[]};
}
export interface GeoResponse { v: 2; country: RegionCode | null }
export interface HealthResponse { v: 2; ok: true; upstream: 'ok'; legacy: 'ok' | 'retired'; tmdbKey: 'env' | 'fallback' | 'fixtures' }

export type ApiErrorCode =
  | 'invalid_request' | 'not_found' | 'method_not_allowed' | 'payload_too_large'
  | 'rate_limited' | 'upstream_rate_limited' | 'upstream_unavailable' | 'upstream_timeout' | 'internal';

export interface ApiErrorBody { error: {code: ApiErrorCode; message: string; retryAfterSeconds?: number} }
```

Every success body is an object with `v: 2`. Fields are only ever added, never renamed or removed, while native 2.x clients exist; a breaking change gets `/api/v3`.

---

## A3. Edge API v2 (EAS Hosting)

### A3.1 Runtime facts this design relies on

All verified on 2026-11-26.

| Fact | Source |
|---|---|
| EAS Hosting caches API responses by `Cache-Control` (`public`, `s-maxage`, `max-age`) and honours `stale-while-revalidate` and `stale-if-error`; `stale-if-error` applies when the route crashes or returns 500, 502, 503 or 504. `CDN-Cache-Control` targets the edge only. | docs.expo.dev/eas/hosting/reference/caching |
| EAS caches `POST` when the body is under 1 MB and the response says `public`; the cache key is URL plus body. `Vary` adds request headers to the key. Cached requests still count toward the request quota. | same page |
| Assets are served from the new deployment as soon as an alias moves ("Expo Hosting will ignore its cached assets when you assign a new deployment to an alias"). The page says this only for assets: cached API and HTML responses may outlive a promotion until their `s-maxage` ends, so C3.2 caps HTML at 600 s until spike S2 shows otherwise. | same page ("Asset caching") |
| If a route does not handle `OPTIONS`, EAS answers with a permissive default CORS response. | docs.expo.dev/eas/hosting/reference/responses-and-headers |
| Requests carry `X-Real-IP`, `eas-ip-country`, `eas-colo`, `Origin`, `X-Forwarded-Host`. | same page |
| Runtime is Cloudflare Workers isolates; no Cache API or KV is documented, so the only server-side state is per-isolate memory. The export builds separate bundles for each API route, loader, the middleware and the renderer, so that memory is shared only through `globalThis` (A1.2). | docs.expo.dev/eas/hosting/reference/worker-runtime; `node_modules/@expo/cli/build/src/export/exportStaticAsync.js:675-686` |
| `request.url` is the deployment's own URL (`https://yify--<deploymentId>.expo.app/…`); `X-Forwarded-Host` and `Origin` carry the host the client used. Host decisions (robots, environment) read `X-Forwarded-Host`, and redirects use relative `Location` headers. | docs.expo.dev/eas/hosting/reference/responses-and-headers ("Request URL and origin") |
| EAS documents no per-request subrequest, CPU or duration limit; Cloudflare's default is 50 subrequests per invocation on its Free plan. Every v2 handler makes at most 40 upstream fetches per invocation (isolate-cache hits are free), and spike S2 measures the real limit before any cap is raised. | developers.cloudflare.com/workers/platform/limits (feasibility review, item 10) |
| Server env vars must be plain text or sensitive (not secret), are uploaded per deployment by `eas deploy --environment production`, and need a redeploy to change. | docs.expo.dev/eas/environment-variables/usage |
| `expo-server` 58.1.0 (a dependency of expo-router, not of the app) exports `runTask`, `deferTask`, `setResponseHeaders`, `StatusError`, `origin`, `environment`, `requestHeaders`, `MiddlewareFunction`, `LoaderFunction`, `GenerateMetadataFunction`. v2 server code uses standard `Request`/`Response` and imports only the types re-exported by `expo-router/server` (`MiddlewareFunction`, `GenerateMetadataFunction`, `Metadata`, `RequestHandler`), so no new dependency is needed. | `node_modules/expo-server/build/cjs/runtime/api.d.ts`, `build/cjs/types.d.ts`, `build/cjs/metadata.d.ts`; `node_modules/expo-router/build/server/index.d.ts` |
| API route files cannot have platform extensions (`+api.web.ts` is not supported). | docs.expo.dev/router/web/api-routes |
| `+middleware.ts` is stable in SDK 58 and runs with `web.output: "static"` when `apiRoutes: true`; it does not run for client-side navigation. | docs.expo.dev/router/web/middleware |
| TMDB: about 40 requests per second, respect `429`; at most 500 pages of 20 results; `append_to_response` capped at 20 items (TMDB staff, forum); watch-provider data must be attributed to JustWatch; commercial use needs a licence. | developer.themoviedb.org/docs/rate-limiting, /docs/faq, /reference/movie-watch-providers; themoviedb.org/talk threads on page 500 |

### A3.2 Common contract for every `/api/v2/*` route

**Request validation.** Strict: unknown query parameters, duplicated parameters and out-of-range values return `400 invalid_request`. The client builds query strings with keys in sorted order so equal requests share one edge cache entry.

| Parameter | Pattern / range |
|---|---|
| `region` | `^[A-Z]{2}$` |
| `type` (path) | `movie` or `tv` |
| `id` (path) | `^[1-9]\d{0,9}$`, at most 2147483647 |
| `season` (path) | `^(0\|[1-9]\d{0,2})$`, at most 500 |
| `page` | `^[1-9]\d{0,2}$`, at most 500 |
| `q` | 1–100 characters after trimming, no `[\u0000-\u001f\u007f]` |
| `genres` | `^\d{1,6}(,\d{1,6}){0,4}$` |
| `providers` | `^\d{1,6}(,\d{1,6}){0,19}$` |
| `monetization` | comma list of distinct values from `stream,free,ads,rent,buy` |
| `sort` | `popular`, `rating`, `release`, `title` |
| `year_from`, `year_to` | `^(19\|20\|21)\d{2}$`, `year_from <= year_to` |
| `rating_min` | `^(10\|[0-9](\.5)?)$` |
| `lang` | `^[a-z]{2}$` |
| `imdbId` (path) | `^tt\d{7,10}$` |
| `v1Id` (path) | `^[1-9]\d{0,9}$` |
| POST bodies | `Content-Type: application/json`, at most 16 384 bytes, else `413 payload_too_large` |

**Responses.** `Content-Type: application/json; charset=utf-8`, `X-Content-Type-Options: nosniff`, `X-Yify-Source: upstream | memory | last-good`. No `Access-Control-Allow-Origin` header: web clients call same-origin, native clients do not need CORS, and third-party sites cannot read the API from browsers. Every route exports `OPTIONS` returning `204` with `Allow: GET, POST, OPTIONS` (as applicable) and no CORS headers, so EAS's permissive default never applies.

**Error envelope.** `ApiErrorBody` (section 2.10):

| Status | `code` | When | `Retry-After` | `Cache-Control` |
|---|---|---|---|---|
| 400 | `invalid_request` | validation failed | none | `public, max-age=60, s-maxage=3600` |
| 404 | `not_found` | TMDB 404 or `status_code` 34, adult title, v1 id unknown or legacy lookups retired | none | `public, max-age=3600, s-maxage=86400` |
| 405 | `method_not_allowed` | wrong method | none | `no-store` |
| 413 | `payload_too_large` | body over 16 KiB or too many ids | none | `no-store` |
| 429 | `rate_limited` | admission bucket empty | seconds until a token, 1–60 | `no-store` |
| 503 | `upstream_rate_limited` | TMDB 429 and no last-good | TMDB value or 10, max 60 | `no-store` |
| 502 | `upstream_unavailable` | TMDB or legacy upstream 5xx, 401, invalid body, and no last-good | 30 | `no-store` |
| 504 | `upstream_timeout` | handler deadline passed | 10 | `no-store` |
| 500 | `internal` | unexpected exception (logged) | 30 | `no-store` |

`message` is a short English sentence for logs; clients never show it.

**Cache policies** (`src/server/http/cachePolicy.ts`):

```ts
export const CACHE_POLICIES = {
  list: 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600, stale-if-error=604800',
  search: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800',
  detail: 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=604800',
  person: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800',
  reference: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, stale-if-error=2592000',
  mapping: 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000, stale-if-error=2592000',
  availability: 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=604800',
  resolve: 'public, max-age=0, s-maxage=86400, stale-if-error=604800',
  image: 'public, max-age=31536000, s-maxage=31536000, immutable',
  lastGood: 'public, max-age=60, s-maxage=60',
  private: 'private, no-store',
} as const;
export type CachePolicyName = keyof typeof CACHE_POLICIES;
```

A response assembled with any `last-good` part uses `lastGood`, so the edge does not pin stale data for long.

**Timeouts.** Per upstream attempt: TMDB 8 s, legacy upstream 10 s, TMDB image 10 s. Handler deadlines: single GET 12 s, `availability` 12 s, `resolve` 20 s, `home` 12 s (rails still pending at the deadline are dropped, section 3.4.1). Client timeouts (15 s GET, 25 s POST, section 4.1) are longer than every handler deadline, so the server always answers first.

**Upstream fetch budget.** `withApi` gives each invocation a `FetchBudget` of 40 upstream fetches (A3.8); isolate-cache hits and in-flight sharing cost nothing. Fan-out endpoints stay inside it by construction: `home` makes at most 18 calls, `availability` at most 40 (40 keys), `resolve` stops starting fetches when the budget is spent and lists the remaining ids in `failed`, and each sitemap file makes at most 25. Single-call endpoints never reach it.

**Response size caps.** Projection caps keep bodies small; `respond.ts` measures the serialized body and, above the cap, logs `oversize` and returns `500 internal` (a bug, caught by tests): home 150 KB, discover/search 60 KB, title 80 KB, season 300 KB, person 200 KB, genres 8 KB, regions 20 KB, providers 80 KB, availability 200 KB, resolve 120 KB, find/legacy 4 KB. Upstream bodies above 3 000 000 bytes (checked on `content-length` and on the text) are rejected as `invalid`.

**Admission** (`src/server/http/admission.ts`, port of `data/server/catalog/admission.ts` with its test). Keyed on `X-Real-IP`; the buckets live in `getServerState()` (A1.2). Edge-cached responses never reach the worker, so these limits only see misses.

| Bucket | Capacity | Refill | Concurrency |
|---|---|---|---|
| per IP, JSON routes | 120 | 120 per minute | 16 |
| per IP, `img` | 600 | 600 per minute | 32 |
| per isolate | 1200 | 1200 per minute | 64 |

Cost: 1 per GET; `availability` `ceil(keys / 10)`; `resolve` `ceil(ids / 10)`. At most 4096 tracked IPs.

**Logging.** One `console.log` line per request (EAS Hosting keeps console output; v2.0 forwards no log stream, only the two alert events below):

```json
{"t":"api","route":"title","status":200,"ms":412,"source":"upstream","colo":"bom","upstream":[{"host":"tmdb","status":200,"ms":380}]}
```

Never log query strings that contain the TMDB key, IP addresses, Firebase tokens or request bodies.

**Alerts to Sentry** (`src/server/http/report.ts`, no dependency). For `500 internal` and for `tmdb_auth` (A3.3.2), `reportServerEvent(kind, {route, colo})` posts one Sentry envelope to `SENTRY_ENVELOPE_URL` (`src/core/config/telemetry.ts`, derived from the public DSN; a test asserts it matches `sentry.options.json`):

- `POST <SENTRY_ENVELOPE_URL>` (`https://o4512058491338752.ingest.us.sentry.io/api/4512058497695744/envelope/`) with `Content-Type: application/x-sentry-envelope`;
- body: three newline-separated JSON lines: the envelope header `{"event_id","sent_at","dsn"}` (the `dsn` header authenticates the request, so no auth header is needed), the item header `{"type":"event","length"}` and the event `{"event_id","timestamp","platform":"javascript","level":"error","logger":"yify-server","environment","release":"yify@<APP_VERSION>","message":{"formatted":"<kind>"},"tags":{"route","colo"}}`, where `environment` is `production` when `X-Forwarded-Host` is `yify.expo.app` and `preview` otherwise (develop.sentry.dev/sdk/data-model/envelopes);
- at most one event per kind per minute per isolate (throttle in `getServerState()`), awaited with a 1 s timeout before the error response returns, so only failing requests pay for it. Server code cannot import `expo-server`'s `runTask` at runtime (A1.5 check 7). No request data other than the route name and colo is sent.

### A3.3 Server internals

#### A3.3.1 Environment (`src/server/env.ts`)

| Variable | Visibility (EAS) | Default | Use |
|---|---|---|---|
| `TMDB_API_KEY` | sensitive, production and preview | `TMDB_FALLBACK_KEY` | TMDB credential |
| `YIFY_LEGACY_CATALOG` | plain | `on` | `gone` turns legacy `/api/catalog/*` into 410 (section 3.7) |
| `FIREBASE_AUTH_HOST` | plain | `yify-2da67.firebaseapp.com` | auth proxy target (section 6.1) |
| `TMDB_API_BASE_URL` | plain | `https://api.themoviedb.org/3` | lets CI and the SSR spike point the client at a fixture server (section C contract) |
| `YIFY_API_FIXTURES` | plain | unset | `1` answers every `/api/v2` route and every `src/server/tmdb/titles.ts` helper from `src/server/fixtures/v2/` (Part 0, I-36); local development, tests and the CI web checks only, never set in an EAS environment |

`TMDB_FALLBACK_KEY` is a constant in `src/server/env.ts` whose value is copied verbatim from `data/datasources/config/remoteConfigKeys.ts:3` (the same value the shipped web bundle and Remote Config already expose; `RemoteAppConfig.ts:77` and `RemoteAppConfig.web.ts:24` read it). The spec does not reproduce it. Owner action: create a new TMDB key for the server, store it as `TMDB_API_KEY`, and retire the public key after v1 clients are gone. `/health` reports `tmdbKey: 'env' | 'fallback'`, so a deploy that silently fell back (for example because the variable was created with `secret` visibility, which EAS Hosting does not deploy) shows up in one `curl`.

Auth rule: if the key value starts with `eyJ` (a v4 read access token) send `Authorization: Bearer <key>`; otherwise append `api_key=<key>` as the last query parameter. The key never appears in cache keys, logs or responses.

#### A3.3.2 TMDB client (`src/server/tmdb/client.ts`)

```ts
export type UpstreamFailure = 'not_found' | 'rate_limited' | 'unavailable' | 'timeout' | 'auth' | 'invalid';

export class UpstreamError extends Error {
  readonly failure: UpstreamFailure;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(failure: UpstreamFailure, status: number | null, retryAfterSeconds: number | null) {
    super(failure);
    this.name = 'UpstreamError';
    this.failure = failure;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface FetchBudget {
  remaining: number;
}

export function tmdbGet<T>(path: string, query: Record<string, string>, ttlMs: number,
  decode: (body: unknown) => T, signal: AbortSignal, budget?: FetchBudget): Promise<Cached<T>>;
```

The fields are declared explicitly because Node's type stripping rejects parameter properties (A1.2). `budget` is decremented before every network fetch (never for a cache hit); when it is spent, `tmdbGet` throws `UpstreamError('unavailable', null, 10)` without fetching, and fan-out endpoints report that item as a transient failure (A3.2).

Behaviour:

1. URL `${TMDB_API_BASE_URL}${path}?${sorted(query)}` plus the credential (3.3.1). Cache key: path plus sorted query, no credential.
2. Goes through `cached()` (3.3.3) and the isolate limiter (8 concurrent upstream fetches, state in `getServerState()`; waiting longer than 4 s fails as `timeout`).
3. `fetch` with `AbortSignal.any([signal, AbortSignal.timeout(8000)])` (both used by the current server, `data/server/catalog/cancellation.ts:14`), headers `Accept: application/json`.
4. A network-level failure (fetch throws, not an HTTP status) is retried once after 250 ms. HTTP errors are never retried by the server; the client owns retries (section 4.2).
5. Status mapping: 404 `not_found`; 401 `auth` (logged as `{"t":"api","alert":"tmdb_auth"}`); 429 `rate_limited` with `Retry-After` parsed (default 10, max 60); 5xx `unavailable`; other non-2xx `invalid`. A 200 body with `success: false` maps `status_code` 34 to `not_found`, 25 to `rate_limited`, anything else to `invalid`.
6. Body size cap 3 000 000 bytes, then `JSON.parse`, then `decode` (DTO validators in `src/server/tmdb/dto.ts`, ported from the parsers in `data/datasources/TmdbApiDataSource.ts:66-132` and extended for the new endpoints). A decode failure is `invalid`.

Request defaults: `language=en-US` on every call; `include_adult=false` on every `discover` and `search` call. Titles whose details return `adult: true` are answered with 404 (decision 4).

`src/server/tmdb/titles.ts` exposes the typed helpers that the endpoints and the web route twins' `loader`/`generateMetadata` (C3.2) share. They return `null` for unknown ids and for `adult: true` records; `region: null` yields empty availability, so server-rendered HTML carries no region-specific data:

```ts
export function getMovie(id: number, region: RegionCode | null, signal: AbortSignal): Promise<MovieDetails | null>;
export function getTv(id: number, region: RegionCode | null, signal: AbortSignal): Promise<TvDetails | null>;
export function getPerson(id: number, signal: AbortSignal): Promise<PersonDetails | null>;
export function discover(type: MediaType, page: number, signal: AbortSignal): Promise<Paged<TitleSummary>>;
export function popularPeople(page: number, signal: AbortSignal): Promise<Paged<PersonSummary>>;
```

F0-B creates this file with these final signatures, answering from `src/server/fixtures/v2/` (`title.movie.<id>.json`, `title.tv.<id>.json`, `person.<id>.json`, `discover.<type>.json` and `people.popular.json` for every page), so P8 codes against it before P1 lands (execution review, item 6). P1 replaces the bodies with TMDB calls and keeps the fixture answers whenever `YIFY_API_FIXTURES=1`, which the CI web checks set (C3.6, C3.8): SSR loaders and sitemaps then never call TMDB in CI.

#### A3.3.3 In-isolate cache and last-good fallback (`src/server/http/lastGood.ts`)

```ts
export interface Cached<T> {
  value: T;
  source: 'memory' | 'upstream' | 'last-good';
}

export function cached<T>(key: string, ttlMs: number,
  load: () => Promise<{value: T; bytes: number}>): Promise<Cached<T>>;
```

- LRU `Map` held in `getServerState()` (A1.2), at most 400 entries and 24 000 000 summed `bytes` (the upstream text length). Each entry stores `freshUntil = now + ttlMs` and `staleUntil = now + 7 days`.
- Fresh hit: return `memory`. Concurrent misses for the same key share one in-flight promise.
- Load success: store and return `upstream`.
- Load failure with `not_found`: store a negative entry for `min(ttlMs, 1 hour)` and rethrow.
- Load failure of any other kind: if an entry exists and `now < staleUntil`, return it as `last-good`; otherwise rethrow.

This complements, and does not replace, EAS `stale-if-error`: the edge covers popular URLs across isolates; the isolate cache covers composite responses (home) and the window right after a deploy, when the edge cache is cold.

TTL table (upstream calls):

| Upstream | TTL |
|---|---|
| trending, popular, now_playing, discover, on_the_air, search | 15–30 min (see each endpoint) |
| movie/tv details, season, videos, watch/providers, top_rated | 6 h |
| person | 24 h |
| genres, regions, provider lists | 24 h |
| find, legacy movie lookups | 30 days |

#### A3.3.4 Projection rules (`src/server/tmdb/project.ts`)

Implements the field rules in section 2.2. Reuses the text sanitizer from `data/server/catalog/projections.ts:15-48` (`decoded` and `text`) for every free-text field, and the TMDB watch-link validation from `data/repositories/StreamingRepositoryImpl.ts:27-36`. Items without a title, adult items and items whose `media_type` is not `movie`, `tv` or `person` are dropped.

Availability mapping: TMDB `results[REGION]` keys `flatrate` → `stream`, `free` → `free`, `ads` → `ads`, `rent` → `rent`, `buy` → `buy`. Providers sorted by `display_priority` ascending, then name; duplicates by `provider_id` removed within each offer type; missing region yields all-empty offers and `link: null`.

Certification: movies use `release_dates.results` for the region, picking the first non-empty `certification` in release-type order 3, 4, 5, 6, 2, 1, falling back to `US`, else `null`. TV uses `content_ratings.results` for the region, falling back to `US`, else `null`.

Runtime: movie `runtime` when above 0; TV `episode_run_time[0]`, else `last_episode_to_air.runtime`, else `null`.

#### A3.3.5 Trailer selection (`src/server/tmdb/trailer.ts`)

Candidates: videos with `site === 'YouTube'` and `key` matching `^[A-Za-z0-9_-]{11}$`. Order by: type (`Trailer` before `Teaser`), then `official` first, then language (`en`, then the title's original language, then others), then `published_at` newest first. `trailer` is the first candidate, or `null` (clips and featurettes stay in `videos` but are never the trailer). If the details call (language `en-US`) yields no trailer and `original_language !== 'en'`, the server makes one extra call `GET /3/{type}/{id}/videos?language={original_language}` and repeats the selection.

#### A3.3.6 Slugs (`src/core/domain/slug.ts`)

ASCII-only, at most 60 characters (section C's rule, plus `&` → `and` and dropped apostrophes). Section C's canonical URLs and slug redirects import this same function, so app links and canonical URLs cannot disagree; an empty slug makes the canonical URL the bare id, with no trailing hyphen:

```ts
export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/g, '');
}
```

| Input | Slug |
|---|---|
| `The Matrix` | `the-matrix` |
| `Amélie` | `amelie` |
| `Spider-Man: Across the Spider-Verse` | `spider-man-across-the-spider-verse` |
| `Fast & Furious` | `fast-and-furious` |
| `千と千尋の神隠し` | (empty: the URL is `/title/movie/129`) |

The server puts `slug` on every summary, credit and resolved title; the function is pure TypeScript in `core/domain`, so the client can rebuild a slug for snapshots without a network call (no Unicode property escapes, so Hermes is not a concern).

### A3.4 Endpoints

All paths are under `https://yify.expo.app/api/v2`. Response types are in section 2.10.

#### A3.4.1 `GET /home?region=IN`

Upstream calls, in parallel through the limiter:

| # | Call | TTL | Used for |
|---|---|---|---|
| 1 | `/trending/all/day` | 15 min | hero candidates |
| 2 | `/trending/all/week` | 15 min | rail `trending` (ranked, top 10, movie and tv only) |
| 3 | `/movie/popular?page=1&region={R}` | 30 min | rail `popular-movies` |
| 4 | `/movie/now_playing?page=1&region={R}` | 30 min | rail `in-theaters` (omitted if fewer than 8 items) |
| 5 | `/discover/movie?include_adult=false&page=1&primary_release_date.lte={today}&sort_by=primary_release_date.desc&vote_count.gte=20&watch_region={R}&with_watch_monetization_types=flatrate` | 30 min | rail `streaming-now` (omitted if fewer than 8) |
| 6 | `/tv/popular?page=1` | 30 min | rail `popular-tv` |
| 7 | `/movie/top_rated?page=1` | 6 h | rail `acclaimed` |
| 8 | `/tv/on_the_air?page=1` | 1 h | rail `new-episodes` |
| 9 | `/{type}/{id}/videos?language=en-US` for the first 10 hero candidates | 6 h | hero trailers |

`{today}` is the UTC date. Hero: from call 1 keep movie/tv items with both `poster_path` and `backdrop_path`, in trending order; attach `trailer` from call 9; take the first 5 with a trailer, then fill to 5 with the remaining candidates (`trailer: null`). Rail order: `trending`, `popular-movies`, `in-theaters`, `streaming-now`, `popular-tv`, `acclaimed`, `new-episodes`; 20 items per rail except `trending` (10).

Failure handling: a failed rail without last-good is omitted. If the hero and at least four rails fail, the route answers `502 upstream_unavailable`. Rails still pending at the 12 s deadline are omitted and the response uses the `lastGood` policy. Otherwise policy `list`.

The rail titles are client copy keyed by `RailId` (B4.1). Default copy: `trending` "Trending this week", `popular-movies` "Popular movies", `in-theaters` "In theaters", `streaming-now` "New on streaming", `popular-tv` "Popular TV", `acclaimed` "Critically acclaimed", `new-episodes` "New episodes".

Example (one item per array shown):

```json
{
  "v": 2,
  "region": "IN",
  "generatedAt": "2026-11-26T10:00:00.000Z",
  "hero": [{
    "key": "movie:603", "type": "movie", "id": 603, "slug": "the-matrix",
    "title": "The Matrix", "originalTitle": "The Matrix", "year": 1999, "releaseDate": "1999-03-30",
    "overview": "Set in the 22nd century, The Matrix tells the story of a computer hacker…",
    "posterPath": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", "backdropPath": "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    "rating": 8.2, "voteCount": 26412, "genreIds": [28, 878], "originalLanguage": "en",
    "trailer": {"key": "vKQi3bBA1y8", "type": "Trailer", "name": "The Matrix (1999) Official Trailer", "official": true, "language": "en", "publishedAt": "2021-11-23T17:00:12.000Z"}
  }],
  "rails": [{"id": "trending", "kind": "ranked", "items": []}]
}
```

#### A3.4.2 `GET /discover`

Parameters: `type` (required), `page` (default 1), `genres`, `providers`, `monetization`, `region` (required when `providers` or `monetization` is present), `sort` (default `popular`), `year_from`, `year_to`, `rating_min`, `lang`.

Mapping to `GET /discover/{type}?include_adult=false&language=en-US&page={page}`:

| v2 parameter | movie | tv |
|---|---|---|
| `genres=28,12` | `with_genres=28\|12` (any of) | same |
| `providers=8,119` | `with_watch_providers=8\|119&watch_region={R}` | same |
| `monetization=stream,free` | `with_watch_monetization_types=flatrate\|free&watch_region={R}` | same |
| `providers` without `monetization` | adds `with_watch_monetization_types=flatrate\|free\|ads` | same |
| `sort=popular` | `sort_by=popularity.desc` | same |
| `sort=rating` | `sort_by=vote_average.desc&vote_count.gte=200` | same |
| `sort=release` | `sort_by=primary_release_date.desc&primary_release_date.lte={today}` | `sort_by=first_air_date.desc&first_air_date.lte={today}` |
| `sort=title` | `sort_by=title.asc` | `sort_by=name.asc` |
| `year_from=1990` | `primary_release_date.gte=1990-01-01` | `first_air_date.gte=1990-01-01` |
| `year_to=1999` | `primary_release_date.lte=1999-12-31` (the earlier of this and `{today}` when `sort=release`) | `first_air_date.lte=…` |
| `rating_min=7` | `vote_average.gte=7&vote_count.gte=50` (200 when `sort=rating`) | same |
| `lang=hi` | `with_original_language=hi` | same |

Response `DiscoverResponse`, `totalPages = min(total_pages, 500)`. TTL 30 min. Policy `list`.

#### A3.4.3 `GET /search?q=dune&type=all&page=1`

`type` defaults to `all`. Calls `/search/multi`, `/search/movie`, `/search/tv` or `/search/person` with `query={q}` (trimmed, inner whitespace collapsed), `include_adult=false`, `language=en-US`, `page`. Persons become `{kind: 'person'}` with `knownFor` from `known_for` (max 3, adult removed). TTL 15 min. Policy `search`. The client sends `q` lower-cased (section 4.3) so case variants share a cache entry.

#### A3.4.4 `GET /title/{type}/{id}?region=IN`

| type | Call (TTL 6 h) |
|---|---|
| movie | `/movie/{id}?append_to_response=videos,credits,release_dates,recommendations,external_ids,watch/providers` |
| tv | `/tv/{id}?append_to_response=videos,aggregate_credits,content_ratings,recommendations,external_ids,watch/providers` |

Plus the conditional original-language videos call (3.3.5). The appended `watch/providers` object contains every region; the projection keeps only `region`. The isolate cache holds the full upstream response, so other regions for the same title cost no upstream call. TV cast comes from `aggregate_credits` (`roles[0].character`, `total_episode_count`). Policy `detail`; 404 `not_found` for unknown ids and adult titles.

#### A3.4.5 `GET /title/tv/{id}/season/{season}`

Calls `/tv/{id}/season/{season}` (6 h). Episodes keep `id`, numbers, `name`, `overview` (max 1000 chars), `air_date`, `runtime`, `still_path`, rating rule; crew and guest stars are dropped; at most 400 episodes. Policy `detail`.

#### A3.4.6 `GET /person/{id}`

Calls `/person/{id}?append_to_response=combined_credits,external_ids` (24 h). Credits: cast and crew merged per title key; multiple characters joined with ` / `; TV `episode_count` summed; crew `job`s collected; adult and untitled items dropped; sorted by year descending (unknown last), then `vote_count` descending; at most 200. `knownFor`: 8 credits with the highest `vote_count` from the person's department side (cast when `known_for_department === 'Acting'`, crew otherwise). `biography` max 5000 chars. Policy `person`.

#### A3.4.7 `GET /genres`

Calls `/genre/movie/list?language=en` and `/genre/tv/list?language=en` (24 h). Merged by id with `types`, sorted by name. Policy `reference`.

#### A3.4.8 `GET /regions`

Calls `/watch/providers/regions?language=en-US` (24 h); returns `{code: iso_3166_1, name: english_name}` sorted by name (parser ported from `TmdbApiDataSource.ts:93-103`). Policy `reference`.

#### A3.4.9 `GET /providers?region=IN`

Calls `/watch/providers/movie?watch_region={R}` and `/watch/providers/tv?watch_region={R}` (24 h). Merged by `provider_id`; `priority = display_priorities[R] ?? display_priority ?? 999`; `types` from which list contained it; sorted by priority then name; at most 300. Policy `reference`.

#### A3.4.10 `POST /availability`

Body `{"region":"IN","keys":["movie:603","tv:1399"]}`: 1–40 distinct valid `TitleKey`s (the upstream fetch budget of A3.2), sorted ascending by the client (stable cache key). For each key the server calls `/{type}/{id}/watch/providers` (6 h, all regions cached) and projects the region; concurrency 6; deadline 12 s. TMDB 404 gives `items[key] = null`; keys not finished or failing transiently are listed in `failed`. Policy `availability` (cached by body at the edge).

```json
{"v": 2, "region": "IN", "items": {"movie:603": {"region": "IN", "offers": {"stream": [{"id": 8, "name": "Netflix", "logoPath": "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg", "priority": 1}], "free": [], "ads": [], "rent": [], "buy": []}, "link": "https://www.themoviedb.org/movie/603-the-matrix/watch?locale=IN", "attribution": "JustWatch"}}, "failed": []}
```

#### A3.4.11 `GET /find/{imdbId}`

Calls `/find/{imdbId}?external_source=imdb_id` (30 days). Picks `movie_results[0]`, else `tv_results[0]` (adult skipped); otherwise 404. Response `FindResponse`. Policy `mapping`.

#### A3.4.12 `GET /legacy/movie/{v1Id}`

Resolves an old Yify 1.x movie id (old shared links `/movie/8462`, v1 data without IMDb ids). The endpoint (`src/server/endpoints/legacyMovie.ts`) calls `legacyMovieLookup(v1Id, signal, budget)` from `src/server/legacy/lookup.ts`; `src/server/legacy/**` is the only v2 code that talks to the retired catalog source (Part 0, I-52):

1. `GET https://movies-api.accel.li/api/v2/movie_details.json?movie_id={v1Id}` (10 s timeout, 30-day isolate cache, no retry on HTTP errors). The host is the current hard-coded upstream (`data/datasources/YtsApiDataSource.ts:13`).
2. `data.movie.imdb_code` must match `^tt\d{7,10}$`; a non-`ok` status, `movie.id === 0` or a missing code is 404.
3. `find` on the IMDb id (3.4.11).

Response `{"v":2,"v1Id":8462,"imdbId":"tt4154756","match":{…},"path":"/title/movie/299536-avengers-infinity-war"}`. Policy `mapping`. An upstream outage answers `502 upstream_unavailable` with `Retry-After: 60`. Nothing from the upstream other than the IMDb id leaves the server. After the legacy sunset (`YIFY_LEGACY_CATALOG=gone`, A3.7) the route answers `404 not_found` without an upstream call, and clients mark the key final.

#### A3.4.13 `POST /resolve`

Batch resolution for the migration (A5.4 phase B). Body `{"imdb":["tt0133093"],"v1":[{"id":8462,"title":"Avengers: Infinity War","year":2018}]}`, at most 20 ids in total (`413 payload_too_large` above that). For each id, in this order:

1. `imdb` ids: `find` (3.4.11).
2. `v1` ids with a title and a year: one TMDB call `GET /search/movie?query={title}&include_adult=false&language=en-US&page=1`. The match is accepted only when exactly one result has a normalized `title` or `original_title` equal to the normalized stored title and a release year within ±1 of the stored year. Normalization: NFKD, combining marks removed, lower case, `&` → `and`, punctuation removed, whitespace collapsed. This resolves most journal and history entries without the legacy source (coverage review, issue 5).
3. Otherwise, while the legacy catalog is on: the legacy lookup of 3.4.12.

Results:

- `null` means definitively not found: no unique title match and the legacy lookup answered 404, or the legacy lookups are retired.
- Ids in `failed` hit a transient error, the deadline or the invocation's fetch budget (A3.2); the client retries them later.
- Concurrency: TMDB 6, legacy 4. Deadline 20 s. Policy `resolve`.

#### A3.4.14 `GET /geo`

`{"v":2,"country":"IN"}` from the `eas-ip-country` request header when it matches `^[A-Z]{2}$` and is not `XX` or `T1`, else `null`. Policy `private`. Used only by the web client's first region guess (section 4.4).

#### A3.4.15 `GET /health`

Uptime probe for the monitor section C repoints (its §5.8). The handler calls TMDB `/configuration` at most once per 60 s per isolate (the outcome is cached in `getServerState()`) with a 3 s timeout. Until the legacy sunset (O-21) it also probes the legacy upstream the same way (`list_movies.json?limit=1` through `src/server/legacy/`), because most Android users keep using `/api/catalog` during the staged rollout. Healthy: `200 {"v":2,"ok":true,"upstream":"ok","legacy":"ok","tmdbKey":"env"}`; after the sunset `legacy` is `retired`. Either upstream failing: the standard `502 upstream_unavailable` envelope (3.2), so the uptime monitor alerts on a legacy outage too. In fixture mode it answers `{"v":2,"ok":true,"upstream":"ok","legacy":"ok","tmdbKey":"fixtures"}` without upstream calls. Policy `private`, so every probe sees the live state; the probe never touches the edge cache.

There is no runtime configuration endpoint. v1 read two Remote Config values: `tmdb_api_key` moves server-side and `buy_me_a_coffee_url` goes with its feature. There is no ads flag (the owner's 2026-09-08 instruction; section C §2.1), so `@react-native-firebase/remote-config` is removed (decision 8).

#### A3.4.16 `GET /img/{size}/{file}`

Image proxy, section 3.5.

### A3.5 Image strategy (decision)

**Decision: direct first, automatic per-device proxy fallback.** Research shows `api.themoviedb.org` is blocked for some users in India (web) and Russia (native); the live web session loaded `image.tmdb.org` from an Indian network without problems, and proxying every image would turn each poster into a billed EAS request (cached requests still count, 3.1). So:

- `src/core/ui/images.ts`:

```ts
export type ImageSize = 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'h632';
export function imageUrl(path: string | null, size: ImageSize): string | null;
```

  Direct mode returns `https://image.tmdb.org/t/p/{size}{path}`. Proxy mode returns `{API_ORIGIN}/api/v2/img/{size}{path}` on native and `/api/v2/img/{size}{path}` on web, except `.svg` paths, which always use `https://image.tmdb.org/t/p/original{path}`. `null` for a null or invalid path.

- Sizes by use: poster in rails and grids `w342`; poster thumbnail in rows (up to 64 dp) `w154`; title page poster `w342`; hero and backdrops `w780` on compact widths, `w1280` from 840 dp; episode stills `w300`; profiles `w185`; provider logos `w92`.

- `src/core/ui/imageHost.ts` keeps `{mode: 'direct' | 'proxy', until: number}` in memory and in KV key `v2.image.host`. Every TMDB image component reports `onLoad` and `onError`. Switch rule: in direct mode, while `onlineManager.isOnline()` is true, three errors with zero successes since launch switch to proxy for 24 h and persist it. In proxy mode the mode reverts to direct on the first launch after `until`. Components re-render through `useImageHostMode()`.

- Proxy route `app/api/v2/img/[size]/[file]+api.ts` (`src/server/endpoints/image.ts`): `size` must be one of the `ImageSize` values (never `original`); `file` must match `^[A-Za-z0-9_-]{6,80}\.(jpg|jpeg|png)$` (`.svg` logos are always loaded directly because TMDB serves them only at `original`). It fetches `https://image.tmdb.org/t/p/{size}/{file}` (10 s timeout, 5 MB cap), streams the body with the upstream `Content-Type` (`image/jpeg` or `image/png` only, anything else is 502) and policy `image`. Upstream 404 is 404.

- No v2 code renders an image URL that `imageUrl` did not build; the architecture test (1.5, check 8) fails on the banned host strings outside `src/server/legacy/**`.

### A3.6 Attribution

- TMDB (FAQ requirement): Settings › About and the web footer show the approved TMDB logo, less prominent than the Yify logo, and the sentence **"This product uses the TMDB API but is not endorsed or certified by TMDB."** The asset lives at `assets/attribution/tmdb.svg` (P6 adds the approved logo; O-26).
- JustWatch (watch-provider requirement): every view that renders `RegionAvailability` or the provider picker shows **"Streaming data from JustWatch"**, linking to `availability.link` when present, else `https://www.justwatch.com`. The API marks every availability object with `attribution: 'JustWatch'`; the shared `WhereToWatch` component renders the line whenever it renders offers.
- Commercial licence for a monetized app: owner action (decision 6).

### A3.7 Legacy `/api/catalog/*` and deleted routes

Installed Android builds 1.8.17–1.8.33 and stale web tabs call `https://yify.expo.app/api/catalog/{operation}?v=2`. The route stays (`app/api/catalog/[operation]+api.ts` imports `src/server/legacy/catalog/handler.ts`), ported from `data/server/catalog/{handler,parameters,projections,repositories}.ts` without the subscriber, Nyaa and EZTV paths.

| Operation | Legacy v2 behaviour |
|---|---|
| `movies` | Same validation and projection as today (`parameters.ts:5-8`, `projections.ts:180-187`). `sort_by` values `download_count`, `seeds` and `peers` are rewritten to `like_count` before the upstream call, so no ranking uses swarm or download data. |
| `movie` | Same projection with `torrents: []` when `v=2`; `downloadCount` is never sent; `likeCount` stays. |
| `suggestions`, `parental-guides` | Unchanged. |
| `shows` | `{"shows":[],"pageNumber":1,"hasMore":false}` with no upstream call. |
| `episodes` | `[]` with no upstream call. |
| `anime`, `access` | `403` (unchanged). |

- Old-client compatibility, checked against `data/datasources/WebCatalogClient.ts:156-187`: an empty `torrents` array parses to an empty list and missing swarm fields default to 0, so old builds show no Download pill, no qualities grid and an empty Shows tab without errors.
- **Hard rule for every legacy response.** Installed 1.8.17+ builds run each response through `metadataOnly` (`v1-baseline:data/datasources/WebCatalogClient.ts:19-21,94-105`), which throws on any object key named `torrent`, `hash`, `infoHash`, `info_hash`, `url`, `magnetUrl`, `magnet_url`, `torrentUrl`, `torrent_url`, `download_count` or `size_bytes`, and on any string matching `/magnet\s*:|urn:btih:|\.torrent(?:$|[?\s#])/i`. One throw empties that screen for every installed user, and an innocent `url` field is enough. The projections never emit those keys or strings.
- **Contract test** (P1): `tests/contracts/v1/webCatalogParsers.ts` vendors the parse functions and `metadataOnly` from `v1-baseline:data/datasources/WebCatalogClient.ts` (comments removed, domain types inlined), and `tests/contracts/legacy-v1-client.test.ts` runs them over the handler's output for every operation and fixture. It asserts no throw and the expected empty `torrents`, `shows` and `episodes`. `scripts/check-legacy-contract.mjs --origin <url>` runs the same parsers over HTTP; spike S2 runs it against the preview alias, and release step (c) against production.
- Upstream: one attempt per request (the immediate 5xx retry of `JsonRequest.ts:158-163` is removed), a single retry only for network failures after 250 ms, 10 s timeout, 3 MB cap, isolate last-good per upstream URL.
- Caching: lists `public, max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=604800`; `movies` with `query` `public, max-age=60, s-maxage=60, stale-if-error=86400`; `movie`, `suggestions`, `parental-guides` `public, max-age=600, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800`; `shows`, `episodes` `public, max-age=3600, s-maxage=86400`. Errors keep `no-store` and now carry `Retry-After` (502: 30, 504: 10, 429: bucket wait).
- `Access-Control-Allow-Origin: *` and the existing OPTIONS handling (`handler.ts:59,81-93`) stay for old cross-origin clients; responses add `X-Yify-Legacy: 1`.
- Deleted: `app/api/subscriber-catalog/[operation]+api.ts`, `app/api/native-subscriber-catalog/[operation]+api.ts`, `app/api/availability-alerts/status+api.ts` and everything behind them. After the deploy they return 404. Expected side effects: a signed-in v1 web tab opened before the deploy shows catalog errors until it reloads (`SubscriberCatalogAccess.ts:151-163` treats 404 as a failure); native 1.8.17+ simply hide Anime. Owner action: remove the `YIFY_SUBSCRIBER_*` and availability variables from the EAS environment after the deploy.
- Sunset: when Play Console shows versions below 2.0.0 on fewer than 2% of active devices for 30 consecutive days, set `YIFY_LEGACY_CATALOG=gone`. Every legacy operation then answers `410` with `{"error":"This version of Yify is no longer supported. Update the app from Google Play."}` and `Cache-Control: public, max-age=3600, s-maxage=86400`. The same switch retires `/api/v2/legacy/movie` (404), the legacy step of `/resolve`, the middleware's `/movie/{id}` lookup and the legacy health probe. Delete `src/server/legacy/**` one release later.
- **Builds 1.8.16 and older** call the catalog sources directly (the movie host from the Remote Config parameter `base_url_yify`, the TV feed from a host compiled into the app; `research/backend.md` §2.2) and are out of this server's reach. Decision: fail them closed. Owner action O-31 gives `base_url_yify` a conditional value for `app.version` below 1.8.17 of `https://yify.expo.app/api/v1-retired`, a path with no route, so every request answers 404 and those builds show their error state instead of swarm data. The TV feed of those builds cannot be switched off from here. The owner may instead accept the cohort until it ages out; O-31 records the choice.
- **Rollback.** Before release step (c) the integrator records the id of the deployment serving v1 in production (EAS dashboard, Hosting). If the v2 deploy breaks 1.8.x or the web, `eas deploy:alias --prod --id=<v1DeploymentId>` restores it at once (docs.expo.dev/eas/hosting/deployments-and-aliases).
- Timing: these changes take effect with the first v2 hosting deploy. They can be shipped earlier as a server-only change if the owner approves (decision 13).

### A3.8 Route adapters and handler wrapper

`src/server/http/respond.ts`:

```ts
export type RouteName = 'home' | 'discover' | 'search' | 'title' | 'season' | 'person' | 'genres' | 'regions'
  | 'providers' | 'availability' | 'find' | 'legacy-movie' | 'resolve' | 'geo' | 'health' | 'img';

export interface ApiContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  signal: AbortSignal;
  budget: FetchBudget;
  publicHost: string;
}

export interface ApiResult {
  body: unknown;
  policy: CachePolicyName;
  status?: 200 | 404;
}

export function withApi(route: RouteName, options: {deadlineMs: number; maxBytes: number; cost?: (context: ApiContext) => number},
  handler: (context: ApiContext) => Promise<ApiResult>): (request: Request, params: Record<string, string>) => Promise<Response>;

export function preflight(allow: 'GET' | 'POST'): Response;
```

`withApi` applies, in order: admission, the deadline (`AbortController` plus timer, port of `data/server/catalog/cancellation.ts`), a fresh `FetchBudget` of 40, the handler, the size cap, `UpstreamError` to envelope mapping (3.2), headers, the log line and, for `internal`, `reportServerEvent` (3.2). `publicHost` is `request.headers.get('x-forwarded-host') ?? new URL(SITE_ORIGIN).host` (A3.1).

`src/server/http/state.ts`:

```ts
export interface ServerState {
  cache: Map<string, unknown>;
  limiter: {active: number; waiting: Array<() => void>};
  admission: Map<string, unknown>;
  probes: Map<string, {checkedAt: number; ok: boolean}>;
  reported: Map<string, number>;
}

export function getServerState(): ServerState;
```

`getServerState()` returns `globalThis.__yifyServer`, creating it on first use, so every bundle in one isolate shares one cache, limiter, admission table, probe cache and alert throttle (A1.2). Spike S2 asserts one upstream TMDB call per cold title document, where `generateMetadata` and `loader` run in different bundles.

Example adapter, `app/api/v2/title/[type]/[id]+api.ts`:

```ts
import {preflight} from '@/server/http/respond';
import {titleRoute} from '@/server/endpoints/title';

export function GET(request: Request, params: Record<string, string>) {
  return titleRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
```

Server route files (all thin adapters like the example):

```
app/api/v2/home+api.ts
app/api/v2/discover+api.ts
app/api/v2/search+api.ts
app/api/v2/title/[type]/[id]+api.ts
app/api/v2/title/[type]/[id]/season/[season]+api.ts
app/api/v2/person/[id]+api.ts
app/api/v2/genres+api.ts
app/api/v2/regions+api.ts
app/api/v2/providers+api.ts
app/api/v2/availability+api.ts
app/api/v2/find/[imdbId]+api.ts
app/api/v2/legacy/movie/[v1Id]+api.ts
app/api/v2/resolve+api.ts
app/api/v2/geo+api.ts
app/api/v2/health+api.ts
app/api/v2/img/[size]/[file]+api.ts
app/api/catalog/[operation]+api.ts
app/__/auth/[...path]+api.ts
app/__/firebase/[...path]+api.ts
app/+middleware.ts
```

F0-B writes every module these adapters import, so the route files typecheck from F0-D on (execution review, item 4): the `/api/v2` endpoint functions answer from fixtures (F0.7); `src/server/legacy/catalog/handler.ts` answers `501 {"error":"rebuilding"}`; `src/server/auth/firebaseProxy.ts` answers 501; `src/server/middleware/legacyRedirects.ts` returns `undefined`; `src/server/seo/sitemaps.ts` returns an empty `<sitemapindex>`. P1 and P8 replace the bodies.

The season route rejects `type !== 'tv'` with 404. `/__/*` is not in the reserved-path list (docs.expo.dev/router/reference/reserved-paths) and the route-file regex in `node_modules/expo-router/_ctx-shared.js` does not exclude underscore folders.

---

## A4. Client data layer

### A4.1 API client (`src/core/api/*`)

Base URL:

| File | Value |
|---|---|
| `baseUrl.ts` (native) | `export const API_ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN \|\| 'https://yify.expo.app';`, `apiUrl(path) = API_ORIGIN + '/api/v2' + path` and `export const CLIENT_HEADER = 'android/' + APP_VERSION;` |
| `baseUrl.web.ts` | `export const API_ORIGIN = '';`, `apiUrl(path) = '/api/v2' + path` (same origin: production, EAS preview aliases and `expo start` all serve their own API) and `export const CLIENT_HEADER = 'web/' + APP_VERSION;` |

Both files import only `APP_VERSION` from `src/core/config/app.ts`, so `client.ts` loads in Node tests without React Native (feasibility review, item 1). `APP_VERSION` is a string constant that `tests/plugins/app-config.test.cjs` keeps equal to `package.json` `version`.

Native development builds set `EXPO_PUBLIC_API_ORIGIN=http://<LAN IP>:8081` in `.env.local` to use the local dev server; preview builds may point at an EAS Hosting alias. Production native builds always call `https://yify.expo.app`: the `production` EAS environment must not define `EXPO_PUBLIC_API_ORIGIN` (the value is inlined at build time). The expo-router `origin` option and `EXPO_UNSTABLE_DEPLOY_SERVER` (alpha, docs.expo.dev/router/web/api-routes) are not used.

`src/core/api/errors.ts` holds the error classes. It imports only `core/domain` types; `client.ts`, `decode.ts`, `retry.ts` and `health.ts` import the classes from it. Fields are declared explicitly because Node's type stripping rejects parameter properties (A1.2):

```ts
import type {ApiErrorCode} from '@/core/domain/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterMs: number | null;

  constructor(status: number, code: ApiErrorCode, retryAfterMs: number | null) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('network');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

export class ApiDecodeError extends Error {
  readonly route: string;

  constructor(route: string) {
    super('decode');
    this.name = 'ApiDecodeError';
    this.route = route;
  }
}
```

`client.ts`:

```ts
export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function apiGet<T>(path: string, query: Record<string, string | number | undefined>,
  decode: (body: unknown) => T, options?: RequestOptions): Promise<T>;

export function apiPost<T>(path: string, body: unknown, decode: (body: unknown) => T,
  options?: RequestOptions): Promise<T>;
```

Behaviour:

- Query keys sorted; `undefined` and empty values dropped. POST bodies serialized with sorted keys and sorted arrays where order is not meaningful (`keys`, `imdb`, and `v1` sorted by `id`).
- `fetch(url, {method, headers: {Accept: 'application/json', 'X-Yify-Client': CLIENT_HEADER}, credentials: 'omit', redirect: 'error', signal})`. `X-Yify-Client` (`android/2.0.0`, `web/2.0.0`) is logged by the server; it is not part of any cache key.
- Timeouts: 15 s for GET, 25 s for POST, implemented with a local `AbortController` and `setTimeout` linked to the caller's signal (Hermes has no guaranteed `AbortSignal.any`).
- Error classification, ported from `data/datasources/JsonRequest.ts:3-8,55-77`: transport failures (`TypeError` with the known messages, Expo `fetch failed: …` network messages) → `NetworkError`; caller abort → the original `AbortError` (TanStack treats it as cancellation); local timer → `TimeoutError`; non-2xx → `ApiError` with `code` from the envelope (`internal` if unreadable) and `retryAfterMs` from `Retry-After` seconds (else `retryAfterSeconds`, capped at 60 000).
- Every outcome is recorded in `health.ts` (4.2) and passed to an optional observer `setApiObserver((result: {route: string; status: number | 'network' | 'timeout'; ms: number}) => void)` that `startTelemetry()` registers (C5.4). Expected failures are metrics, not error events (decision 9).
- `decode.ts` holds one decoder per response type. A wrong top-level shape throws `ApiDecodeError`; invalid array items are dropped individually. Decoders put every `TitleSummary` they see into `summaryCache` (4.5).
- `endpoints.ts` exposes one typed function per route: `fetchHome(region, signal)`, `fetchDiscover(params, page, signal)`, `fetchSearch(q, type, page, signal)`, `fetchTitle(key, region, signal)`, `fetchSeason(key, season, signal)`, `fetchPerson(key, signal)`, `fetchGenres(signal)`, `fetchRegions(signal)`, `fetchProviders(region, signal)`, `fetchAvailability(region, keys, signal)`, `fetchFind(imdbId, signal)`, `fetchLegacyMovie(v1Id, signal)`, `postResolve(request, signal)`, `fetchGeo(signal)`, `fetchHealth(signal)` (Part 0, I-47). Detail functions resolve the unwrapped payload (`fetchTitle` → `TitleDetails`, `fetchSeason` → `SeasonDetails`, `fetchPerson` → `PersonDetails`, `fetchGenres` → `Genre[]`, `fetchRegions` → `Region[]`, `fetchProviders` → `CatalogProvider[]`, `fetchFind` and `fetchLegacyMovie` → their response types); list functions (`fetchHome`, `fetchDiscover`, `fetchSearch`, `fetchAvailability`, `postResolve`, `fetchGeo`, `fetchHealth`) resolve the full response type.
- `batch.ts`: `createBatcher<K, V>({maxBatch: 40, windowMs: 16, load: (keys: K[]) => Promise<Map<K, V>>})` (40 is the `/availability` limit, A3.4.10) returns `load(key): Promise<V>`; keys requested in the same window share one call. Used for availability: each title has its own query (own cache entry) but all titles visible in one frame cost one POST.

### A4.2 TanStack Query (`src/core/query/*`)

Dependency: `"@tanstack/react-query": "5.107.1"` (exact pin; it depends on `@tanstack/query-core` 5.107.1; peer `react ^18 || ^19` is satisfied by react 19.3.1). Verified against the published tarballs: `query-core/build/modern/focusManager.d.ts` (`setEventListener(setup)`), `onlineManager.d.ts`, `hydration-9_kOYxJM.d.ts` (`RetryValue`, `RetryDelayFunction` lines 2196-2202, `NetworkMode` 2437, `initialDataUpdatedAt` 2527, `refetchOnWindowFocus`/`refetchOnReconnect` 2620/2629, `QueryClientConfig` 4003), and `react-query/build/modern/index.d.ts` (exports `QueryClientProvider`, `useQuery`, `useInfiniteQuery`, `queryOptions`, `infiniteQueryOptions`, `useQueryClient`, and re-exports query-core including `focusManager`, `onlineManager`, `keepPreviousData` and the boolean `isServer`, `hydration-9_kOYxJM.d.ts:1152`; React Native defines `window`, so `isServer` is false in the app). F0 adds the pin (C6.6); `yarn.lock` records the transitive version.

`client.ts`:

```ts
import {isServer, QueryClient} from '@tanstack/react-query';
import {apiHealth} from '@/core/api/health';
import {retryDelay, shouldRetry} from './retry';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: shouldRetry,
        retryDelay,
        refetchOnMount: true,
        refetchOnWindowFocus: () => !apiHealth.degraded(),
        refetchOnReconnect: () => !apiHealth.degraded(),
        networkMode: 'online',
        throwOnError: false,
      },
      mutations: {retry: false, networkMode: 'online'},
    },
  });
}

let browserClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (isServer) return createQueryClient();
  browserClient ??= createQueryClient();
  return browserClient;
}
```

Retry policy (`retry.ts`), which never hammers our own 5xx:

```ts
import {ApiError, NetworkError, TimeoutError} from '@/core/api/errors';
import {apiHealth} from '@/core/api/health';

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status === 503) return failureCount < 1 && (error.retryAfterMs ?? 0) <= 60_000;
    if (error.status >= 500) return failureCount < 1 && !apiHealth.degraded();
    return false;
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) return failureCount < 2;
  return false;
}

export function retryDelay(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs != null) return error.retryAfterMs;
  const base = Math.min(30_000, 2_000 * 2 ** failureCount);
  return Math.round(base * (0.5 + Math.random()));
}
```

`health.ts` (the client circuit breaker): `apiHealth.record('ok' | 'server-error' | 'network-error')`; `degraded()` is true after 3 server errors (status 500–504) within 60 s, until 60 s pass without a new server error or any request succeeds. While degraded there are no 5xx retries and no focus/reconnect refetches, so an outage like 2026-11-03 costs each client one request per screen visit instead of a retry storm.

Lifecycle wiring (`lifecycle.ts`, native):

```ts
import {focusManager, onlineManager} from '@tanstack/react-query';
import {subscribeForeground} from '@/core/platform/appState';
import {subscribeOnline} from '@/core/platform/network';

export function startQueryLifecycle(): void {
  focusManager.setEventListener(setFocused => subscribeForeground(active => setFocused(active)));
  onlineManager.setEventListener(setOnline => subscribeOnline(setOnline));
}
```

`lifecycle.web.ts` exports a no-op `startQueryLifecycle`: TanStack's defaults already use `visibilitychange` and the window `online`/`offline` events on web.

`src/core/platform/appState.ts` keeps exactly one `AppState.addEventListener('change', …)` subscription for the app and fans it out (`subscribeForeground(listener): () => void`, `isForeground(): boolean`); `appState.web.ts` does the same with `document.visibilityState`. `network.ts` is the port of `data/services/ExpoNetworkMonitor.ts` (single `Network.addNetworkStateListener`, revision guard against out-of-order Android callbacks, 3 s snapshot timeout; online means `isConnected !== false && isInternetReachable !== false`; verified `node_modules/expo-network/build/Network.d.ts:66`, `Network.types.d.ts`). `network.web.ts` uses `navigator.onLine` and the window events. These two modules replace the 13 separate foreground handlers found in v1 (architecture research §6).

`QueryProvider.tsx` keeps the client in state, `const [client] = useState(getQueryClient)`, and renders `<QueryClientProvider client={client}>`. On the server that is one client per render that survives streaming re-renders (calling `getQueryClient()` during render would create a new one on every pass, because `isServer` is true in the Worker); in the app it is the singleton.

### A4.3 Query keys (`src/core/query/keys.ts`)

```ts
export const queryKeys = {
  home: (region: RegionCode) => ['v2', 'home', region] as const,
  discover: (params: DiscoverParams) => ['v2', 'discover', canonicalDiscover(params)] as const,
  search: (q: string, type: SearchType) => ['v2', 'search', type, q] as const,
  title: (key: TitleKey, region: RegionCode) => ['v2', 'title', key, region] as const,
  season: (key: TitleKey, season: number) => ['v2', 'season', key, season] as const,
  person: (key: PersonKey) => ['v2', 'person', key] as const,
  genres: () => ['v2', 'genres'] as const,
  regions: () => ['v2', 'regions'] as const,
  providers: (region: RegionCode) => ['v2', 'providers', region] as const,
  availability: (region: RegionCode, key: TitleKey) => ['v2', 'availability', region, key] as const,
  find: (imdbId: string) => ['v2', 'find', imdbId] as const,
  legacyMovie: (v1Id: number) => ['v2', 'legacy-movie', v1Id] as const,
  geo: () => ['v2', 'geo'] as const,
};
```

`canonicalDiscover` sorts the arrays and drops defaults. Search `q` is normalized with `q.trim().replace(/\s+/g, ' ').toLowerCase()` before it enters a key or URL.

| Query | `staleTime` | `gcTime` | Notes |
|---|---|---|---|
| home | 15 min | 24 h | `initialData`/`initialDataUpdatedAt` from the Home snapshot (4.5) |
| discover | 10 min | 30 min | `useInfiniteQuery`, `getNextPageParam: last => last.page < last.totalPages ? last.page + 1 : undefined`, `placeholderData: keepPreviousData` |
| search | 10 min | 30 min | infinite, `enabled: q.length >= 2`, `placeholderData: keepPreviousData`; input debounced 300 ms in the handler |
| title | 30 min | 60 min | header renders from `summaryCache` while loading |
| season | 30 min | 60 min | |
| person | 60 min | 60 min | |
| genres, regions | 24 h | `Infinity` | `initialData` from `v2.cache.reference` |
| providers | 24 h | 24 h | |
| availability | 6 h | 6 h | `queryFn` goes through the batcher |
| find, legacyMovie | `Infinity` | 24 h | |
| geo | 7 days | `Infinity` | web only |

### A4.4 Hooks and public functions per feature

Exact signatures of every cross-feature module are in Part W, F0.5; this table maps each hook to its data source and file.

| Hook or function | Source | Location |
|---|---|---|
| `useHome()` | home query for the effective region | `features/home/hooks/useHome.ts` |
| `useServicesRail()` | discover with the user's services for the region (`providers`, `monetization=stream,free,ads`, `sort=popular`); disabled when no services | `features/home/hooks/useServicesRail.ts` |
| `useWatchlistOnServices()` | watchlist keys (first 50 by `addedAt`) + availability; returns entries with a `stream`, `free` or `ads` offer from my services (any provider when none chosen) | `features/home/hooks/useWatchlistOnServices.ts` |
| `useSearchResults(q, type)` | search infinite query | `features/search/hooks/useSearchResults.ts` |
| `useDiscoverResults(params)` | discover infinite query | `features/search/hooks/useDiscoverResults.ts` |
| `useGenres()` | genres query (reference snapshot as `initialData`) | `features/search/public/useGenres.ts` |
| `useRecentSearches()`, `rememberSearch(term)`, `forgetSearch(term)`, `clearRecentSearches()` | `v2.search.recent` store | `features/search/recentSearches.ts` |
| `registerSearchCommit(commit)`, `HeaderSearch` | expanded-web header field (Part 0, I-26) | `features/search/headerQuery.ts`, `features/search/public/HeaderSearch.tsx` |
| `useTitle(key)` | title query + `summaryCache` | `features/title/hooks/useTitle.ts` |
| `useSeason(key, n)` | season query | `features/title/hooks/useSeason.ts` |
| `titleQueryOptions(key, region)` | `queryOptions` for the title query (prefetch while an interstitial shows) | `features/title/public/titleQuery.ts` |
| `useOpenMedia(surface)` | the only way UI opens a title or a legacy entry (prefetch + `openTitle`, Part 0, I-16) | `features/title/public/useOpenMedia.ts` |
| `useAvailability(key, region?)` | availability query through the batcher | `features/title/public/useAvailability.ts` |
| `usePerson(key)` | person query | `features/person/hooks/usePerson.ts` |
| `TrailerFrame` | trailer UX (B5) | `features/player/public/TrailerFrame.tsx` |
| `useWatchlist(select)`, `useInWatchlist(key)`, `toggleWatchlist(key, snapshot)`, `removeFromWatchlist(key)`, `restoreWatchlistEntry(entry)` | watchlist store | `features/library/public/watchlist.ts` |
| `useDiary(select)`, `useWatched(key)`, `logWatch(input)`, `updateEntry(id, patch)`, `removeEntry(id)`, `restoreEntry(entry)` | diary store | `features/library/public/diary.ts` |
| `useLists(select)`, `useList(id)`, `useCustomListCount()`, `createList(name)`, `renameList(id, name)`, `removeList(id)`, `restoreList(list)`, `setListItem(id, key, snapshot, included)` | lists store | `features/library/public/lists.ts` |
| `useRecent(select)`, `recordView(key, snapshot)`, `removeRecent(key)`, `restoreRecent(key, entry)`, `clearRecent()`, `restoreRecentState(state)` | recent store | `features/library/public/recent.ts` |
| `DiarySheet`, `AddToListSheet` | shared sheets used by Title and Library | `features/library/public/DiarySheet.tsx`, `features/library/public/AddToListSheet.tsx` |
| `migrateLocalV1()`, `startLegacyResolution()`, `retryLegacyResolution()`, `useLegacyMigrationStatus()` | `v2.migration` | `features/library/public/migration.ts` |
| `useDiaryInsights(period)` | `core/domain/insights.ts` over the diary | `features/library/hooks/useDiaryInsights.ts` |
| `useSyncStatus()`, `syncNow()`, `startSync()`, `prepareSignOut(uid)`, `pauseSync()`, `resumeSync()`, `deleteRemoteAccountData(uid)`, `clearLocalAccountData(uid)`, `useV1ImportStatus()`, `importV1Again()` | sync engine | `features/sync/public/sync.ts` |
| `usePreferences(select)`, `getPreferences()`, `setPreference(key, value)`, `preferencesSyncAccess` | preferences store | `features/settings/public/preferences.ts` |
| `useEffectiveRegion()`, `getEffectiveRegion()`, `useRegionSource()`, `startRegionDetection()` | `prefs.region ?? detected ?? 'US'` | `features/settings/public/region.ts` |
| `useRegions()`, `useProviderCatalog(region)`, `useMyServices(region)`, `setMyServices(region, ids)` | queries + preferences | `features/settings/public/streaming.ts` |
| `useConsent()`, `getConsent()`, `setConsent(patch)`, `isConsentPromptResolved()`, `subscribeConsent(listener)`, `startConsent()` | consent store | `features/settings/public/consent.ts` |
| `ConsentPrompt`, `ServicesPickerSheet`, `CountryPickerSheet` | shared settings UI | `features/settings/public/*.tsx` |
| `useSession()`, `getSession()`, `subscribeUid(listener)`, `isNewUser()`, `signIn()`, `onAccountDeleted(listener)`, `startSession()` | session store + auth adapter | `features/account/public/session.ts` |
| `signOut()` | A6.7 sign-out sequence | `features/account/public/signOut.ts` |
| `deleteAccount()` | A6.7 deletion sequence | `features/account/public/deletion.ts` |
| `usePlus()`, `getPlusStatus()`, `openPaywall(placement)`, `canCreateCustomList()`, `effectiveAccent()`, `insightsAccess()`, `startPlus()` | C1.11 | `features/monetization/public/plus.ts` |
| `openTitle(navigate, input)` | C2.6 (twins in `monetization/platform/`) | `features/monetization/public/openTitle.ts` |
| `startAds()`, `reportTrailerState(state)`, `useAdPrivacyOptions()` | C2 | `features/monetization/public/ads.ts` |
| `PlusSheetHost`, `AdTransitionHost` | hosts mounted by `AppRoot` | `features/monetization/public/*.tsx` |
| `useImageHostMode()` | image host store | `core/ui/imageHost.ts` |

Region detection (`features/settings/regionDetection.ts`, started once by the shell): if `v2.region.detected` is missing or older than 7 days, native stores `deviceRegion()` (port of `presentation/movies/components/watchRegion.ts:22-50`: locale `regionCode`, then `Intl` locale, then the time-zone table, then `US`); web first calls `GET /geo` and stores its country, falling back to `deviceRegion()`. Web prefers the server hint because desktop browsers commonly report `en-US` regardless of country (India is the top web country in the research). The user's explicit choice (`prefs.region`) always wins. No location permission (decision 8; Part 0, I-20).

### A4.5 Offline and outage behaviour

- **Home snapshot.** After every successful home fetch the `queryFn` writes `v2.cache.home.<REGION>` (`{savedAt, data}`), keeping at most the two most recent regions. The home query reads it through `initialData` and `initialDataUpdatedAt`, so a cold start during an outage or offline renders the last good Home instantly and refetches in the background when possible. When the visible data came from the snapshot and the latest fetch failed or is paused, Home shows:
  - Copy (offline): "You're offline. Showing picks from {relative time}."
  - Copy (online, API failing): "Yify can't reach its catalog right now. Showing picks from {relative time}."
- **Reference snapshot.** `v2.cache.reference` stores genres and regions the same way so filters and the region picker work offline.
- **summaryCache** (`core/api/summaryCache.ts`): in-memory LRU of 500 `TitleSummary` objects filled by decoders. The title screen renders backdrop, poster, title, year and rating from it while details load, instead of a bare spinner (UXL-17).
- **Library** is local-first and fully usable offline; sync catches up later (section 6.5).

### A4.6 Local stores, startup and URL state

`src/core/store/createStore.ts`:

```ts
export interface Store<S> {
  get(): S;
  set(update: (previous: S) => S): void;
  subscribe(listener: () => void): () => void;
  readonly serverState: S;
}

export function createStore<S>(options: {
  load: () => S;
  save?: (state: S) => void;
  equals?: (a: S, b: S) => boolean;
  serverState: S;
}): Store<S>;

export function useStore<S, T>(store: Store<S>, select: (state: S) => T, equals?: (a: T, b: T) => boolean): T;
```

- `load` runs on the first `get()`, never at import, so web static rendering never touches storage.
- `set` notifies only when `equals(previous, next)` is false (v1 notified on every set, `data/repositories/support/observable.ts:17-20`).
- `useStore` calls `useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot)` with a stable `subscribe`, memoizes the selection per state object, and uses `select(store.serverState)` as the server snapshot so static HTML is deterministic and hydration re-renders with the stored data. This replaces the inline subscribe closures that resubscribed on every render (architecture research §6, items 1-3).

Stores: `preferencesStore`, `consentStore`, `detectedRegionStore`, `recentSearchesStore` (settings/search), `watchlistStore`, `diaryStore`, `listsStore`, `recentStore` (library), `sessionStore`, `syncStatusStore` (account), `imageHostStore` (core/ui), and Part C's entitlement store (C1.7).

Startup (`src/features/shell/start.ts`):

```ts
export function prepareLocalState(): true;
export function startApp(): void;
```

- `AppRoot` calls `prepareLocalState` in a `useState` initializer, before any child renders. It runs the synchronous v1 migration (section 5.4, phase A) and settles the image host mode.
- `AppRoot` calls `startApp()` from one mount effect. It is idempotent and calls the starters in the order fixed in Part W, F0.5. Nothing else in the app subscribes to `AppState`, network changes or auth directly.

URL as state (`src/core/navigation/urlState.ts`), the structural fix for YIFY-36:

```ts
import {useCallback, useMemo} from 'react';
import {useLocalSearchParams, useNavigation} from 'expo-router';

export interface UrlCodec<S> {
  keys: readonly string[];
  parse(params: Record<string, string | string[] | undefined>): S;
  serialize(state: S): Record<string, string | undefined>;
}

export interface UrlState<S> {
  state: S;
  commit(next: S): void;
}

export function useUrlState<S>(codec: UrlCodec<S>): UrlState<S> {
  const params = useLocalSearchParams();
  const navigation = useNavigation<{setParams(params: Record<string, string | undefined>): void}>();
  const state = useMemo(() => codec.parse(params), [codec, params]);
  const commit = useCallback((next: S) => {
    const serialized = codec.serialize(next);
    const update: Record<string, string | undefined> = {};
    for (const key of codec.keys) update[key] = serialized[key];
    navigation.setParams(update);
  }, [codec, navigation]);
  return {state, commit};
}
```

- The URL is the only source of truth for screen query state; screens derive everything from `state` each render. There is no "mirror local state into the URL" effect anywhere.
- Naming convention (the lint selector in 1.4 depends on it): the hook result is named `url` or `<thing>Url`, for example `const url = useUrlState(searchUrlCodec);` and, in a chip handler, `onPress={() => url.commit({...url.state, type: 'tv'})}`.
- `commit` is called only from event handlers (submit, chip press, filter apply). Live search starts a 300 ms timer inside `onChangeText` and commits when it fires; the timer is cleared by an effect cleanup, which is not a URL write.
- `navigation.setParams` comes from the screen's own navigation object (`useNavigation`, `node_modules/expo-router/build/useNavigation.d.ts`; the generic narrows the type the same way the v1 hotfix does). It does not go through the global `setParams`, which calls `assertIsMounted()` on the global navigation ref and threw YIFY-36 (`node_modules/expo-router/build/global-state/router.js:151-153,252-257`). The v1 hotfix `d00ad7d` (#1110, on `main` since 2026-11-26) switched the Browse route to the same scoped `navigation.setParams` but kept the echo effect; v2 keeps the mechanism and removes the effect, so the write can no longer run during an effect reconnect at all.
- Render-time redirects use `<Redirect href>` from expo-router, which calls `router.replace` inside `useFocusEffect` and catches errors (`node_modules/expo-router/build/link/Redirect.js`).
- Lint enforces the rest (section 1.4: no global `router`, no navigation calls inside effects).

Search codec (`src/core/navigation/searchUrl.ts`, Part 0, I-25): params `q`, `type` (`all` default; `movie`, `tv`, `person`), `genres`, `providers`, `monetization`, `sort` (`popular` default), `year_from`, `year_to`, `rating_min`, `lang`. Defaults are omitted from the URL; invalid values parse to defaults (parse never throws). With a non-empty `q` the screen shows search results (TMDB search takes no filters, so only `type` applies); with an empty `q` it shows the discover grid using the filters.

---

## A5. Storage and the v1 to v2 migration

### A5.1 KV abstraction (`src/core/storage/*`)

```ts
export interface KeyValueStore {
  getString(key: string): string | undefined;
  setString(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

export const kv: KeyValueStore;
```

- `kv.ts` (native) wraps the default `Storage` export of `expo-sqlite/kv-store` (`getItemSync`, `setItemSync`, `removeItemSync`, `getAllKeysSync`; verified `node_modules/expo-sqlite/build/Storage.d.ts:51-64`). It is the same database v1 uses (`data/datasources/storage/PersistentCache.ts:1`), so v1 keys are readable for migration. Errors return `false`/`[]`.
- `kv.web.ts` wraps `window.localStorage` inside try/catch (private modes can throw). On a failed `setItem` it removes every `v2.cache.*` key and retries once (v1 had no quota handling, `PersistentCache.web.ts:20-21`). Without `window` (static rendering in Node) every call is a no-op.
- `PersistentCache`'s `<namespace>:` prefixing is not reused: v2 uses full keys with the `v2.` prefix.

Versioned values (`json.ts`): every value is `{"v": <codec version>, "d": <data>}`.

```ts
export interface Codec<T> {
  version: number;
  decode(data: unknown): T | null;
  encode(value: T): unknown;
  upgrade?(fromVersion: number, data: unknown): T | null;
}

export function readValue<T>(store: KeyValueStore, key: string, codec: Codec<T>): T | null;
export function writeValue<T>(store: KeyValueStore, key: string, codec: Codec<T>, value: T): boolean;
```

Missing, unparseable or newer-version values read as `null` (the caller starts from defaults; the next write replaces the value). Older versions go through `upgrade`.

### A5.2 v2 key catalogue

All keys and codecs are declared in `src/core/storage/keys.ts`; no other file builds a storage key.

| Key | Codec v | Data | Owner | Synced section |
|---|---|---|---|---|
| `v2.prefs` | 1 | `{values: Preferences; stamps: PreferenceStamps}` | settings | `preferences` |
| `v2.consent` | 1 | `Consent` | settings | never |
| `v2.region.detected` | 1 | `{code: RegionCode; source: 'locale' \| 'geo'; at: number}` | settings | never |
| `v2.search.recent` | 1 | `{terms: string[]}` (max 10, newest first, case-insensitive dedupe) | search | never |
| `v2.library.watchlist` | 1 | `{rev: number; state: WatchlistState}` | library | `watchlist` |
| `v2.library.diary` | 1 | `{rev: number; state: DiaryState}` | library | `diary` |
| `v2.library.lists` | 1 | `{rev: number; state: ListsState}` | library | `lists` |
| `v2.library.recent` | 1 | `{rev: number; state: RecentState}` | library | `recent` |
| `v2.library.owner` | 1 | `{uid: string \| null; settled: boolean}` | account | never |
| `v2.sync.<uid>` | 1 | `{sections: Record<SectionName, {remoteUpdateTime: string \| null; syncedRev: number}>; lastSyncedAt: number \| null; deleted: boolean; importPending: {attempts: number; nextAttemptAt: number} \| null; v1CheckedAt: number \| null}` | account | never |
| `v2.stash.<uid>` | 1 | `{savedAt: number; prefs?: …; watchlist?: …; diary?: …; lists?: …; recent?: …}` (unsynced data of a signed-out account) | account | never |
| `v2.migration` | 1 | `{localV1: 'pending' \| 'done' \| 'none'; completedAt: number \| null; resolutions: Record<LegacyKey, ResolvedTitle \| {unresolved: true; attempts: number; nextAttemptAt: number; final: boolean}>; v1CleanupAt: number \| null; noticeShown: boolean}` | library | never |
| `v2.cache.home.<REGION>` | 1 | `{savedAt: number; data: HomeResponse}` | home | never (evictable) |
| `v2.cache.reference` | 1 | `{savedAt: number; genres: Genre[]; regions: Region[]}` | search/settings | never (evictable) |
| `v2.image.host` | 1 | `{mode: 'direct' \| 'proxy'; until: number}` | core/ui | never |
| `v2.ui.home` | 1 | `{popular: 'movie' \| 'tv'}` | home | never |
| `v2.ui.title` | 1 | `{signInHintShown: boolean}` | title | never |
| `v2.ui.library` | 1 | `{signInRowHidden: boolean}` | library | never |
| `plus.entitlement.v1` (Android and web, Part 0 I-19) | — | raw JSON `PlusEntitlement` (C1.7) | monetization | never; kept on sign-out |
| `ads.lastShownAt` | — | epoch ms (section C §2.3) | monetization | never |
| `updates.prompted.<storeVersion>` | — | epoch ms (section C §4.5) | core/platform/updates | never |
| `updates.downloaded.<storeVersion>` | — | epoch ms, written when a flexible update finished downloading (section C §4.5) | core/platform/updates | never |

The last four rows use section C's names and formats; they are declared in `keys.ts` like every other key but bypass the codec envelope, and sign-out (6.7) and the v1 cleanup (5.4) never touch them.

`rev` is a per-section mutation counter incremented by every local write. The sync engine compares it with `syncedRev` (section 6.5). The web theme script in `+html.tsx` (B2.11) reads `v2.prefs` for the theme and `plus.entitlement.v1` for the accent, instead of v1 `settings:theme` (`presentation/components/web-startup-placeholder.web.tsx:13`).

Local limits enforced by the stores before writing (copy shown in a snackbar):

| Limit | Copy |
|---|---|
| watchlist 2000 entries | "Your watchlist is full (2,000 titles). Remove some titles to add more." |
| diary 2,500 entries or 800 000 encoded bytes | "Your diary is full. Remove some entries to add more." |
| recent 500 entries | no copy: `recordView` trims the oldest entries (rolling history, A2.6) |
| free user at section C's `FREE_CUSTOM_LIST_LIMIT` (3 live lists) creates another | no snackbar: `canCreateCustomList` refuses and the caller calls `openPaywall('list_limit')` (section C §1.11) |
| 100 live lists, 200 list records or 2000 list items | "You've reached the list limit." |
| note over 1000 characters | input blocked at 1000; counter shows "1000/1000" |

### A5.3 v1 key inventory (every key the current app writes)

Native keys live in the `expo-sqlite/kv-store` default database; web keys in `localStorage` of `https://yify.expo.app` (data on the retired `kunal26das.github.io` origin cannot be read and is not migrated).

| v1 key | Format (source) | v2 action |
|---|---|---|
| `privacy:choices` | JSON `PrivacyChoices` `{adultConfirmed, analytics, youtube, updatedAt, noticeVersion}` (`data/services/PrivacyPreferencesImpl.ts:9-28`) | → `v2.consent` `{analytics, youtube, noticeVersion, decidedAt: updatedAt}` when the record passes the v1 validity check; `adultConfirmed` dropped |
| `settings:theme` | `system`/`light`/`dark` (`PreferencesRepositoryImpl.ts:24,290-293`) | → `prefs.theme` |
| `settings:watchRegion` | `^[A-Z]{2}$` or empty | → `prefs.region` (empty → `null`) |
| `settings:streamingServices` | JSON `Record<country, "tmdb:<id>"[]>` (`StreamingRepositoryImpl.ts:22-25`) | → `prefs.services` with the `tmdb:` prefix stripped; invalid entries dropped |
| `settings:historyPaused` | `"true"`/`"false"` | → `prefs.recentPaused` |
| `settings:playback` | JSON `PlaybackPreferences` | `trailerCaptions` → `prefs.trailerCaptions`; the rest dropped |
| `settings:notifications`, `settings:confirmWatchlistRemoval`, `settings:browseDefaults`, `settings:notify` | removed features | deleted |
| `watchlist:items` | JSON `Movie[]` (YTS `id`, `imdbCode`, `title`, `year`, YTS image URLs) (`WatchlistRepositoryImpl.ts:4,99-123`) | → watchlist entries (5.4) |
| `watchlist:funnel_saved_milestones_v1` | analytics state | deleted |
| `sync:watchlistMarks` | `{version:2, items:[], marks:{<v1 id>:{at, deleted}}}` (`AccountSyncImpl.ts:63,278-280`) | add times and tombstones for the watchlist |
| `library:state` | `{version:1, watched, collections, memberships, clearedAt}` (`domain/policies/libraryMerge.ts:128-133`) | watched marks → diary; collections and memberships → lists |
| `library:mutationBlocked` | `"true"` | deleted |
| `history:state` | `{version:1, entries: HistoryEntry[], removed, clearedAt}`; keys `movie:<v1 id>`, `show:<imdbDigits>` (`historyMerge.ts:218-225`, `historyView.ts:45-51`) | → recent |
| `journal:account:<uid>` | `{version:1, clearedAt, entries:{id: JournalEntry}}` (`journal.ts:95-101`; the movie id is a v1 id, no IMDb id) | owner uid's journal → diary; other uids' journals → that uid's `v2.stash.<uid>` (diary), merged when that account signs in (A6.7). They can hold unsynced offline edits, so they are converted, not deleted |
| `journal:deleted:<uid>` | `"true"` | owner uid → `v2.sync.<uid>.deleted = true`; others deleted |
| `search:search.recents` | JSON `string[]` max 8 (`SearchHistoryRepositoryImpl.ts:3-4`) | → `v2.search.recent` |
| `purchases:ads_removed:v2:<uid>` | `{adsRemoved, expiresAt}` (`RevenueCatPurchaseRepositoryImpl.ts:37,489-511`; web `.web.ts:417-428`) | offered to section C as a provisional grant through `readV1EntitlementCache(uid)` in `core/storage/legacyV1.ts` (its boot may seed `plus.entitlement.v1` from it once); removed by the 30-day v1 cleanup |
| `purchases:app_user_id` (web) | RevenueCat anonymous id | deleted |
| `sync:linkedUid` | uid owning the local data | owner when neither `sync:libraryTransition` nor `sync:libraryUid` names one (5.4 step 5) → `v2.library.owner.uid`, `settled: false` |
| `sync:preferencesUpdatedAt` | ms string | stamp for every migrated preference field (1 when absent) |
| `sync:deletedAccount:<uid>` | `"true"` | owner uid → `v2.sync.<uid>.deleted = true`; others deleted |
| `sync:libraryUid` | uid whose library is on screen (v1 read `sync:libraryUid ?? sync:linkedUid`, `AccountSyncImpl.ts:440,470`) | names the owner (5.4 step 5); removed by the 30-day cleanup |
| `sync:libraryTransition` | `{uid, state}`: an account switch that was interrupted after `state` (an encoded `library:state` for `uid`) was saved (`AccountSyncImpl.ts:463-486`) | when present, `uid` is the owner and `state` is the owner's library (5.4 step 5); removed by the 30-day cleanup |
| `sync:libraryAccount:<uid>` | per-account library copies (`AccountSyncImpl.ts:62,474-502`) | non-owner copies → `v2.stash.<uid>` (lists and diary); removed by the 30-day cleanup |
| `sync:lastSyncedAt` | bookkeeping | removed by the 30-day cleanup |
| `nudge:state`, `nudge:discovery_dismissed`, `nudge:first_home_visit` | removed nudges | deleted |
| `streaming:tmdb-availability-v1`, `streaming:tmdb-catalog-v1`, `streaming:tmdb-regions-v1` | caches | deleted |
| `availability-alerts:device`, `:owner`, `:country`, `:consent` | never-enabled pilot | deleted |
| `new-movies:daily-pick-ledger`, `:daily-pick-history`, `:daily-last-active-date`, `:last-run-date`, `:cached-ids`, `:query-signature`, `:notification-catalog:<quality>` | removed notifications (`MovieNotificationCoordinator.ts:66-73`, `SeenMoviesRepositoryImpl.ts:3-5`) | deleted |
| `notification-delivery:last-daily-date`, `:last-arrival-id` (web) | removed notifications | deleted |
| `availability-opened` (web `sessionStorage`) | removed feature | ignored (session-scoped) |

### A5.4 Migration

Code: `src/core/domain/legacy/v1Formats.ts` (v1 types and parsers ported verbatim from `parseWatchlistState`, `parseLibraryState`/`normalizeLibraryState`, `parseHistoryState`, `parseJournalData`, `parseSyncedPreferences`, `readChoices`), `src/core/domain/legacy/convert.ts` (pure conversions), `src/core/domain/legacy/rekey.ts` (pure), `src/core/storage/legacyV1.ts` (reads v1 keys and enumerates `journal:account:*` etc. with `kv.keys()`), `src/features/library/legacy/migrateLocal.ts` (phase A), `src/features/library/legacy/resolveLegacy.ts` (phase B), `src/features/sync/importV1.ts` (remote import, 6.6).

#### Legacy keys

A **v1 id** is the numeric movie id Yify 1.x stored everywhere (it came from the retired catalog source). `legacyKeyFor(v1Id)`: `imdb:<code>` when any v1 source links that v1 id to an IMDb code matching `^tt\d{7,10}$` (watchlist `Movie.imdbCode`), else `v1:<id>`. v1 history `show:<digits>` becomes `imdb:tt<digits left-padded with zeros to 7>` (the v1 show feed stored the digits of the IMDb id without `tt`, `data/server/catalog/projections.ts:170-171`; IMDb ids have at least 7 digits). All sources referring to the same v1 id therefore collapse to one key on a device.

`LegacyIndex`: `Map<v1Id, {imdbCode?: string; title?: string; year?: number}>` built from watchlist items, journal movies and history entries, with title precedence watchlist, then journal, then history. It supplies snapshots for sources that only have ids (library marks).

Snapshots of legacy entries: `{title, year, posterPath: null, slug: ''}`. v1 image URLs are never carried over: the ported parsers in `v1Formats.ts` do not read image or torrent fields at all. An id with no title anywhere gets the title "Title unavailable".

#### Phase A: local conversion (synchronous, before first render)

1. If `v2.migration.localV1` is `done` or `none`, stop.
2. If `kv.keys()` contains no key matching `^(privacy|settings|library|watchlist|history|journal|purchases|sync|nudge|streaming|search|availability-alerts|new-movies|notification-delivery):`, write `localV1: 'none'` and stop.
3. **Free space first.** Delete the v1 keys that 5.3 marks "deleted" (removed features and caches only). On web this frees `localStorage` quota before the v2 copies are written. Account-scoped keys are never deleted here.
4. Parse every source with the ported v1 parsers; a source that fails to parse is skipped (it stays on disk until the 30-day cleanup).
5. **Owner.** The owner is `sync:libraryTransition.uid` when that key parses as `{uid: string, state: string}`, else `sync:libraryUid`, else `sync:linkedUid`, else `null`. The owner's library is `transition.state` when a transition exists, else `library:state` (v1's own recovery order, `AccountSyncImpl.ts:437-490`).
6. Build the `LegacyIndex`, then convert the owner's data:

| Source | Conversion |
|---|---|
| watchlist items + marks | entry per item: key `legacyKeyFor(item.id)`, `addedAt = marks[id].at` when above 0, else `1000 + (items.length - index)` (keeps v1 order, newest first); tombstone per mark with `deleted: true` |
| library watched marks | `value: true` and newer than `clearedAt` → diary entry id `w1_<v1 id>`, `watchedOn: null`, `rating: null`, `note: ''`, `rewatch: false`, `createdAt = updatedAt = at`; skipped when a journal entry exists for the same v1 id |
| library collections + memberships | list per collection, same id (`c_…`), `createdAt = updatedAt`; item per membership mark (key via `legacyKeyFor`, snapshot from the index); removed collections become removed lists; `clearedAt` copied |
| history | recent entry per v1 entry (`viewedAt = watchedAt`), tombstones and `clearedAt` copied; every entry kept (v1 kept at most 500, the v2 limit) |
| owner's journal | diary entry per v1 entry, same id, `key = legacyKeyFor(movie.id)`, `watchedOn`, `rating`, `note`, `createdAt = updatedAt = entry.updatedAt`, `deletedAt`; entries after the earliest live entry of the same key get `rewatch: true` |
| settings, privacy, search | as in 5.3; preference stamps = `sync:preferencesUpdatedAt` or 1 |

7. **Other accounts.** For every other uid that has `journal:account:<uid>` or `sync:libraryAccount:<uid>`, convert the same way and merge the result into `v2.stash.<uid>` (diary and lists). A6.7 merges a stash into the sections when that account signs in.
8. Merge each converted section into the existing v2 value with the section's merge policy (6.4), then write it with `rev + 1` when the result differs.
9. Write `v2.library.owner = {uid: owner, settled: false}` unless an owner is already set.
10. If every write in steps 7 to 9 returned `true`, write `v2.migration = {localV1: 'done', completedAt: now, v1CleanupAt: now + 30 days, …}` last. If any write returned `false` (`kv` reports errors that way: a web `QuotaExceededError`, `SQLITE_FULL` on native), stop without the marker; the next start runs phase A again.

Idempotency and crash safety: conversions are deterministic (same ids, same stamps, same keys) and steps 7 and 8 merge instead of overwriting, so a re-run after a crash or a failed write between steps 3 and 10 produces the same state as an uninterrupted run. Phase A deletes only the removed-feature and cache keys of step 3; every account and library key stays until the 30-day cleanup (execution review, item 10).

Owner settling (sync feature, on the first auth-ready event after migration): if the session uid equals `owner.uid`, keep it; if there is no session, set `owner.uid = null` (the user had signed out in v1 but kept their list, so it stays visible as guest data); if the session uid differs, apply the account-switch rule (6.7). Then set `settled: true`.

#### Phase B: resolution to TMDB (asynchronous)

`startLegacyResolution()` runs after the first render, then on every foreground while work remains:

1. Collect `LegacyKey`s present in the four library sections whose resolution record is missing, or unresolved with `final: false` and `nextAttemptAt <= now`.
2. Wait until online. Send `POST /api/v2/resolve` in batches of at most 12 ids (`imdb:` keys in `imdb`; `v1:` keys in `v1` with the title and year from the `LegacyIndex` or the entry's snapshot), one batch at a time. Twelve keeps a worst-case batch inside the server's 40-fetch budget (three upstream calls per `v1` id, A3.4.13).
3. For each `ResolvedTitle`: record it, then apply `rekey` to all four sections (below) and bump their `rev`.
4. For each `null`: record `{unresolved: true, final: true}`; the entries stay visible under their stored title.
5. For each id in `failed` (or the whole batch on a network or 5xx error): `attempts + 1`, `nextAttemptAt = now + [1 h, 6 h, 24 h, 72 h, 7 days][min(attempts, 5) - 1]`, so later attempts stay 7 days apart. Transient failures never become final; only a definitive `null` does (execution review, item 21: a legacy-source outage longer than four days must not strand entries).
6. `retryLegacyResolution()` (library public) sets every unresolved record to `final: false` and `nextAttemptAt = now`, then starts a run. The Watchlist migration banner offers it as "Try again" (B4.7).
7. When nothing remains and at least one key is final-unresolved and `noticeShown` is false, the Watchlist shows the dismissible banner of B4.7 (Part 0, I-29):
   - Copy: "Your library moved to the new catalog. {n} titles couldn't be matched; they're kept under their old names."
   - Dismissing the banner sets `noticeShown: true`.

`rekey` rules (`core/domain/legacy/rekey.ts`), for a legacy key `L` resolved to title key `T` with snapshot `S` built from the `ResolvedTitle`:

| Section | Rule |
|---|---|
| watchlist | Tombstone `T` becomes `max(removed[T], removed[L])`. Entries of `L` and `T` merge to `addedAt = min` of the live ones, snapshot `S`. If the merged entry's `addedAt` is not newer than the merged tombstone, there is no entry. `L` disappears. |
| diary | Every entry with `key = L` gets `key = T` and snapshot `S` (ids unchanged). |
| lists | In every list, items of `L` and `T` merge last-writer-wins by `at` (tie: `value: false` wins), snapshot `S`; `L` disappears. |
| recent | Same as watchlist with `viewedAt = max`. |

The sync engine also applies the known resolutions to incoming remote data on every merge (6.5 step 4), so two devices that migrated the same v1 data converge even if only one of them has resolved a key so far; unknown legacy keys found in remote data join the phase B queue.

Unresolved entries in the UI: title from the snapshot, no artwork, secondary line Copy: "Saved in an older version of Yify". Tapping one opens `/search?q=<title>` instead of a title page. They can be removed like any entry.

#### Cleanup

- During phase A (step 3): only the v1 keys marked "deleted" in 5.3 (removed features and caches).
- At `v1CleanupAt` (30 days after phase A, checked at startup): delete all remaining v1 keys (`privacy:*`, `settings:*`, `watchlist:*`, `library:*`, `history:*`, `journal:*`, `search:*`, `sync:*`). Until then they are an untouched backup that a fixed build could re-read by resetting `localV1` to `pending`.
- `purchases:*` keys are deleted by the monetization adapter after its first successful CustomerInfo.

Native background work left by v1: the WorkManager job `yify-new-movies-check` and scheduled local notifications belong to modules that v2 removes (decision 8). P9 must verify on an upgraded device (Q5 step 6) (1.8.33 → 2.0.0) that the orphaned job neither crashes nor shows a notification; if it does, the first v2 binary must keep `expo-background-task` for one release to call `BackgroundTask.unregisterTaskAsync('yify-new-movies-check')` and `Notifications.cancelAllScheduledNotificationsAsync()`.

#### Tests (fixtures are synthetic; no real user data)

`src/core/domain/legacy/convert.test.ts`, `rekey.test.ts`, and `src/features/library/legacy/migrateLocal.test.cjs` (`.cjs` because `migrateLocal.ts` reaches `expo-sqlite` through `kv.ts`; it runs through `loadTs.cjs` with an in-memory KV mock):

1. Every v1 key in 5.3 is read; every "deleted" key is gone after phase A.
2. Running phase A twice yields byte-identical v2 values; killing it after each step and re-running yields the same final state.
3. A watchlist item with `imdbCode` and a journal entry for the same v1 id end up under one `imdb:` key.
4. v1 image URLs never appear in any v2 value.
5. A library watched mark plus a journal entry for the same movie produce exactly the journal-derived diary entries.
6. Rekey merges a legacy and a resolved entry, respects tombstones, and is idempotent.
7. A `failed` resolution retries on the backoff schedule (7 days apart after the fourth attempt) and never becomes final; only a definitive `null` is final; final-unresolved entries remain visible; `retryLegacyResolution()` makes every unresolved key due at once.
8. Corrupt JSON in any one v1 key does not stop the others from migrating.
9. A `kv` write that returns `false` at any step leaves `localV1` unset, and the next run completes with the same final state as an uninterrupted run.
10. A device with `journal:account:A`, `journal:account:B`, `sync:libraryAccount:B` and owner A: A's data lands in the sections, B's in `v2.stash.B`, and no account-scoped key is deleted before the 30-day cleanup.
11. A pending `sync:libraryTransition {uid, state}` makes `uid` the owner and `state` its library.
12. The same v1 watched mark migrated on two devices gets the id `w1_<v1 id>` on both; after `rekey`, a journal entry for the same title drops the mark through the diary `normalize` (A2.6).

---

## A6. Auth and sync

### A6.1 Auth (Firebase, Google only)

`src/core/platform/auth/firebaseAuth.ts` (native) and `firebaseAuth.web.ts` (web) implement one adapter:

```ts
import type {AuthSession} from '@/core/domain/account';

export type DeleteUserResult = 'deleted' | 'requires-recent-login' | 'failed';

export interface AuthAdapter {
  start(): void;
  getSession(): AuthSession;
  subscribe(listener: () => void): () => void;
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;
  reauthenticate(): Promise<boolean>;
  deleteUser(): Promise<DeleteUserResult>;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

export const auth: AuthAdapter;
```

**Native**: port `data/repositories/FirebaseAuthRepositoryImpl.ts` (RN Firebase modular API + `@react-native-google-signin/google-signin` 17.0.0, `FALLBACK_WEB_CLIENT_ID` and diagnostic code mapping unchanged) and `data/repositories/support/readFirebaseIdToken.ts` (to `auth/idToken.ts`). Changes: `reauthenticate()` becomes public (v1 lines 218-243 were private) and `deleteUser()` no longer reauthenticates internally, so deletion can reauthenticate before any data is destroyed (6.7). `revokeAccess` and `GoogleSignin.signOut` still run after a successful delete (v1 lines 199-213).

**Web**: port `data/repositories/FirebaseAuthRepositoryImpl.web.ts` and `data/datasources/firebase/FirebaseWebApp.ts` (to `firebase/webApp.web.ts`; `firebase/webApp.ts` is a native stub returning `null`) with these fixes:

1. **Same-origin auth domain.** `authDomain` is `window.location.host` when that host is in `AUTH_PROXY_HOSTS` (`src/core/config/app.ts`: `yify.expo.app` and the preview alias `yify--v2.expo.app`, authorized by O-3 and O-3b), else `process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'yify-2da67.firebaseapp.com'` (v1 used `yify-2da67.firebaseapp.com`, `FirebaseWebApp.ts:5`). Local development and unauthorized preview deployments therefore use popup sign-in cross-site, and a preview build never sends sign-in traffic to the production deployment (execution review, item 13).
2. **Transparent proxy** for Firebase's handler (Firebase "Best practices for using signInWithRedirect", option 3: proxy `/__/auth/` GET and POST to `<project>.firebaseapp.com`, no 302, add `https://<app domain>/__/auth/handler` as an authorized redirect URI): `app/__/auth/[...path]+api.ts` (GET, POST) and `app/__/firebase/[...path]+api.ts` (GET) call `src/server/auth/firebaseProxy.ts`. The proxy forwards to `https://${FIREBASE_AUTH_HOST}/__/auth/<path>` (or `/__/firebase/<path>`), with path `^[A-Za-z0-9._/-]{1,200}$`, query string and method preserved, POST body up to 64 KiB, request headers forwarded except `host`, `cf-*`, `x-forwarded-*` and `x-real-ip`, `redirect: 'manual'`, and returns the status, the body and the upstream headers except the hop-by-hop and body-encoding ones (`connection`, `keep-alive`, `transfer-encoding`, `content-encoding`, `content-length`, `upgrade`, `proxy-*`), which the runtime recomputes for the re-wrapped body; `Location` and `Set-Cookie` pass unchanged; it adds `Cache-Control: no-store`. Google returns to the handler with `GET`; expo-server blocks cross-site form `POST`s to API routes (`checkOrigin`, `node_modules/expo-server/build/cjs/utils/checkOrigin.js`), so the proxied `POST` path serves same-origin SDK calls only. The P1 proxy test includes a gzip-encoded upstream response. It also sets `Content-Security-Policy: frame-ancestors 'self'` and the same `Content-Security-Policy-Report-Only` value on every proxied response. Global router headers never replace a header a response already has (`node_modules/expo-server/build/cjs/vendor/abstract.js:180-183`), so this keeps section C's day-1 `frame-ancestors 'none'` from blocking the SDK's hidden `/__/auth/iframe`, and keeps the app CSP off Google's handler page. `config/webHeaders.cjs` (C4.1) therefore lists `'self'` in `frame-src` and no firebaseapp host (Part 0, I-35).
3. **Lazy SDK.** `firebase/auth` is loaded with `import()`. If `localStorage` holds `firebase:authUser:<apiKey>:[DEFAULT]` (a persisted session; key format from `_persistenceKeyName` in `node_modules/@firebase/auth/dist/esm/index-DYWDbVEA.js`), it loads after first render (`requestIdleCallback`, else a 1500 ms timer) and the session reports `ready: false` until then. Otherwise the session is `{ready: true, available: true, account: null}` and the SDK loads only when the user taps sign-in.
4. **Initialization** with `initializeAuth(app, {persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver})` instead of `getAuth` plus `setPersistence` (verified `node_modules/@firebase/auth/dist/auth-public.d.ts:758,769,1627`). `browserLocalPersistence` keeps existing v1 web sessions, which v1 stored the same way (`FirebaseAuthRepositoryImpl.web.ts:89`).
5. **Redirect only when needed.** Popup first; on `auth/popup-blocked`, `auth/operation-not-supported-in-this-environment` or `auth/cancelled-popup-request` set `sessionStorage['v2.auth.redirect'] = '1'` and call `signInWithRedirect`. `getRedirectResult` runs at load only when that flag is set, and the flag is then removed (v1 called it on every load, `FirebaseAuthRepositoryImpl.web.ts:95`).
6. `reauthenticate()` uses `reauthenticateWithPopup`, falling back to `reauthenticateWithRedirect` with the same flag (verified `auth-public.d.ts:2835,2872`).

`src/features/account/auth/session.ts` replaces `data/services/AccountLink.ts`: it starts the adapter and mirrors the session into `sessionStore`. It never imports sync or monetization: both subscribe with `subscribeUid` (below), so there is no import cycle (Part 0, I-27). The analytics `login` event fires only after an interactive sign-in, not on cold starts with a restored session (DB-14).

Public API for other features (`features/account/public/session.ts`), matching the contract section C asked for:

```ts
export function useSession(): AuthSession;
export function subscribeUid(listener: (uid: string | null) => void): () => void;
export function isNewUser(): boolean;
export function signIn(): Promise<boolean>;
export function onAccountDeleted(listener: (uid: string) => Promise<void> | void): () => void;
```

`onAccountDeleted` listeners run at step 7 of account deletion (6.7) and are awaited for at most 5 s; section C registers `logOut()` plus clearing its entitlement cache there (its §1.4). `subscribeUid` emits once when the restored session is known (`ready`), then on every change. `isNewUser()` is true after an interactive sign-in that created the Firebase account: native reads `additionalUserInfo?.isNewUser` from the `UserCredential` (`node_modules/@react-native-firebase/auth/lib/types/auth.ts:270-336`), web reads `getAdditionalUserInfo(credential)?.isNewUser` (`node_modules/@firebase/auth/dist/auth-public.d.ts:1289`).

`signOut()` lives in `features/account/public/signOut.ts` and `deleteAccount()` in `features/account/public/deletion.ts`; the full list of signatures is Part W, F0.5.

Owner actions for web sign-in: add `https://yify.expo.app/__/auth/handler` to the authorized redirect URIs of the Google OAuth web client used by Firebase Auth (Google Cloud console, APIs and Services, Credentials); keep `yify.expo.app` in Firebase Auth authorized domains (O-3). Do the same for the fixed preview alias `yify--v2.expo.app` (O-3b), so Q4 can test sign-in before release step (c).

### A6.2 Firestore model v2

```
users/{uid}                        v1 document: watchlist, history, library, preferences, *UpdatedAt, availabilityAlerts
                                   v2 reads it once per account (6.6), never writes it, deletes it on account deletion
users/{uid}/sections/{section}     v2 documents, section ∈ watchlist | diary | lists | recent | preferences | meta
                                   fields: payload (string, canonical JSON), schema (int, always 1)
journals/{uid}                     v1 journal; v2 reads it once for import and writes it only as the deletion barrier
```

Why a subcollection: the v1 rule validates the whole post-write document with `keys().hasOnly([...])` (`firestore.rules:14-25,44`). Any v2 field on `users/{uid}` would make every later v1 write from an old device fail, and rewriting the v1 fields with TMDB keys would corrupt old devices' data. A subcollection is invisible to v1 code and rules, so old devices keep syncing YTS-keyed data among themselves untouched. After the one-time import, v1 and v2 devices no longer exchange changes; the user can re-run the import from Settings (6.6).

Payloads (canonical JSON: object keys sorted, no whitespace):

| Section | Payload | Budget (UTF-8 bytes) |
|---|---|---|
| `watchlist` | `{"entries":{EntryKey: WatchlistEntry},"removed":{EntryKey: ms},"v":1}` | 400 000 |
| `diary` | `{"clearedAt":ms,"entries":{id: DiaryEntry},"v":1}` | 800 000 |
| `lists` | `{"clearedAt":ms,"lists":{id: UserList},"v":1}` | 300 000 |
| `recent` | `{"clearedAt":ms,"entries":{EntryKey: RecentEntry},"removed":{EntryKey: ms},"v":1}` | 150 000 |
| `preferences` | `{"stamps":PreferenceStamps,"v":1,"values":Preferences}` | 8 000 |
| `meta` | `{"v":1,"v1Import":{"at":ms,"journalUpdateTime":string \| null,"usersUpdateTime":string \| null}}` | 4 000 |

Stores enforce these byte budgets as well as the count limits in 5.2, so a section can never become unsyncable. A payload `v` newer than the client understands makes that section read-only for the client (status `newer-schema`); the others keep syncing.

### A6.3 `firestore.rules` diff

```diff
@@ rules_version = '2';
     function isSyncPayload(data) {
       …unchanged…
     }
 
+    function withinSectionBudget(section, payload) {
+      return (section == 'watchlist' && payload.toUtf8().size() <= 400000)
+        || (section == 'diary' && payload.toUtf8().size() <= 800000)
+        || (section == 'lists' && payload.toUtf8().size() <= 300000)
+        || (section == 'recent' && payload.toUtf8().size() <= 150000)
+        || (section == 'preferences' && payload.toUtf8().size() <= 8000)
+        || (section == 'meta' && payload.toUtf8().size() <= 4000);
+    }
+
+    function isSectionPayload(section, data) {
+      return data.keys().hasOnly(['payload', 'schema'])
+        && data.keys().hasAll(['payload', 'schema'])
+        && data.schema == 1
+        && data.payload is string
+        && withinSectionBudget(section, data.payload);
+    }
+
     match /users/{uid} {
       allow read: if isOwner(uid) && !accountDeletionRequested(uid);
       allow create, update: if isOwner(uid) && !accountDeletionRequested(uid) && isSyncPayload(request.resource.data);
       allow delete: if isOwner(uid);
+
+      match /sections/{section} {
+        allow read: if isOwner(uid) && !accountDeletionRequested(uid);
+        allow create, update: if isOwner(uid) && !accountDeletionRequested(uid)
+          && isSectionPayload(section, request.resource.data);
+        allow delete: if isOwner(uid);
+      }
     }
```

Everything else stays (the v1 `users` and `journals` rules, the deletion barrier, default deny). **Release blocker:** the new rules must be deployed and verified live before any v2 build or web deploy reaches users (owner rule after the 2026-09-04 outage). The change is additive, so v1 clients are unaffected.

Emulator tests (the `Firestore rules` CI job runs them, C6.1; the suite moves to `tests/firestore/rules.integration.cjs`, which `yarn test` does not match):

1. The owner can create, update, read, list and delete every section with a valid payload.
2. Another uid is denied every operation.
3. An unknown section name, an extra field, `schema != 1`, a non-string payload and a payload one byte over budget are denied.
4. With `journals/{uid}.deleting == true`, read, create and update are denied and delete is allowed.
5. A v1 write to `users/{uid}` still succeeds when section documents exist (regression test for call A9).

### A6.4 Section codecs and merge policies (`src/core/domain/sync/*`)

| Module | Merge | Tie | Pruning and caps | Ported from (with tests) |
|---|---|---|---|---|
| `watchlist.ts` | per key: newest of entry `addedAt` and tombstone wins | tombstone wins | tombstones older than 90 days dropped; 2000 entries (new additions only) | `domain/policies/syncMerge.ts:113-165` |
| `diary.ts` | per id: newest `max(updatedAt, deletedAt)` wins | deleted wins, then the canonically greater JSON | `clearedAt` drops older entries; 2,500 entries and 800 000 bytes (new additions only); `normalize` drops a migrated watched mark duplicated by another entry (A2.6) | `domain/policies/journal.ts:84-123` (validation, merge, UTF-8 size) |
| `lists.ts` | lists by `updatedAt`/`removedAt`, items last-writer-wins by `at` | `value: false` wins | 100 live lists, 200 list records, 2000 items | `domain/policies/libraryMerge.ts:35-126` |
| `recent.ts` | newest `viewedAt` per key, tombstones, `clearedAt` | tombstone wins | tombstones 90 days; 500 entries (local views trim with tombstones, merges never trim) | `domain/policies/historyMerge.ts:96-199` |
| `preferences.ts` | per field: higher stamp wins; a field missing remotely is "no opinion" | local wins | none | replaces `preferencesMerge.ts` (v1 stamped the whole blob) |
| `clamp.ts` | lowers every stamp above a ceiling to the ceiling | — | — | new |

Merges never evict to meet a cap; a merged section above its byte budget gets the `oversized` status (6.5) instead (Part 0, I-59).

Clamping (bounds the damage of a device clock set ahead, BE-7): before merging a remote section, every stamp in it above the document's `updateTime` (server time) is lowered to that `updateTime`. After a successful push, local stamps above the commit's `commitTime` are lowered to it.

Every module exports `empty()`, `decode(payload): S | null` (tolerant, drops invalid records like the v1 normalizers), `encode(state): string` (canonical), `merge(local, remote)`, `clamp(state, ceilingMs)` and `normalize(state, resolutions)` (applies `rekey` for every known legacy resolution, 5.4).

### A6.5 Sync engine (`src/features/sync/engine.ts`)

```ts
export type SectionName = 'watchlist' | 'diary' | 'lists' | 'recent' | 'preferences';

export interface SectionAdapter<S> {
  name: SectionName;
  budgetBytes: number;
  read(): {rev: number; state: S};
  apply(state: S, options: {dirty: boolean}): void;
  encode(state: S): string;
  decode(payload: string): S | null;
  merge(local: S, remote: S): S;
  clamp(state: S, ceilingMs: number): S;
  normalize(state: S): S;
  empty(): S;
}

export type SyncFailure = 'offline' | 'denied' | 'server' | 'oversized' | 'newer-schema';

export type SyncStatus =
  | {state: 'signed-out'}
  | {state: 'idle' | 'syncing'; lastSyncedAt: number | null; pending: boolean}
  | {state: 'error'; failure: SyncFailure; sections: SectionName[]; lastSyncedAt: number | null; pending: boolean}
  | {state: 'deleted'};
```

`SectionName`, `SyncFailure` and `SyncStatus` are exported from `src/core/domain/sync/types.ts` (Part W, F0.5); `SectionAdapter` stays in the engine. The four library sections and the preferences section implement `SyncedStoreAccess` (`features/library` internally, `preferencesSyncAccess` from settings).

`apply(state, {dirty: true})` bumps the store's `rev`; `{dirty: false}` replaces the state without bumping it. A section needs a push when `rev > syncedRev` (`v2.sync.<uid>`).

Transport: `src/core/platform/firestore/rest.ts`, a port of `data/datasources/sync/FirestoreSyncDataSource.ts` and the request wrapper of `JournalDataSource.ts:59-70` (15 s timeout, a response cap per request from the table below, `credentials: 'omit'`, `redirect: 'error'`, `Authorization: Bearer <ID token>`). v1's single 850,000-character cap was sized for a 400,000-byte journal; a v2 diary may hold 800,000 bytes, and the REST response escapes every `"` inside `stringValue`, so the cap is per request and per budget (Part 0, I-53). Base `https://firestore.googleapis.com/v1/projects/${EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'yify-2da67'}/databases/(default)/documents`.

| Operation | Request |
|---|---|
| list sections | `GET {base}/users/{uid}/sections?pageSize=10&mask.fieldPaths=schema` (returns names and `updateTime` only); cap 65,536 characters |
| read one changed section | `GET {base}/users/{uid}/sections/{section}`; cap `2 × budgetBytes + 65,536` characters |
| read the v1 documents (import) | `GET {base}/users/{uid}` and `GET {base}/journals/{uid}`; cap 2,162,688 characters (twice Firestore's 1 MiB document limit plus 64 KiB) |
| v1 change check | `GET {base}/users/{uid}?mask.fieldPaths=preferencesUpdatedAt` and `GET {base}/journals/{uid}?mask.fieldPaths=deleting`; only `updateTime` is used (6.6) |
| write one section | `POST {base}:commit` with one `update` write (`fields.payload.stringValue`, `fields.schema.integerValue: "1"`) and `currentDocument: {updateTime}` or `{exists: false}` |
| barrier check | `GET {base}/journals/{uid}?mask.fieldPaths=deleting` |
| delete | `DELETE {base}/users/{uid}/sections/{section}`, `DELETE {base}/users/{uid}` |

A precondition failure is HTTP 409/412, or a body status `FAILED_PRECONDITION`, `ABORTED` or `ALREADY_EXISTS` (mapping ported from `FirestoreSyncDataSource.ts:203-204`).

**Run** (single flight; one run token per signed-in uid replaces v1's per-field revision counters):

1. Skip if signed out, deleted or paused. A trigger during a run sets `rerun` and returns.
2. Get the ID token; `null` gives status `error/denied`.
3. Read `meta` once per uid. When `v1Import` is missing, or when the hourly v1 change check finds newer v1 documents (6.6), run the import. An import failure records `importPending` with backoff (1 h, 6 h, 24 h, then daily) in `v2.sync.<uid>`, and the run continues with step 4: the import never blocks section sync.
4. List sections. For each section whose listed `updateTime` differs from the stored `remoteUpdateTime`, fetch it with its own `GET`, one section at a time, then for each one:
   - `remote = normalize(clamp(decode(payload), updateTime))`; a `null` decode marks the section `newer-schema` and skips it.
   - `merged = normalize(merge(local, remote))`.
   - When `encode(merged) === encode(remote)`, apply it with `dirty: false` and set `syncedRev = rev`; otherwise apply it with `dirty: true`.
   - Store `remoteUpdateTime`. A section missing remotely gets `remoteUpdateTime = null`.
   - `read()`, `merge` and `apply` run synchronously after the network await, in one tick, so a local edit can never be overwritten by a merge that did not include it.
5. Push every section with `rev > syncedRev`, one commit each, so one bad section never blocks the others (BE-18):
   - Encode; over budget gives `oversized` for that section only.
   - Commit with the precondition.
   - Success: `syncedRev` = the `rev` that was encoded; `remoteUpdateTime = writeResults[0].updateTime`; clamp local stamps to `commitTime`.
   - Precondition failure: read that section, merge as in step 4, retry; at most 3 attempts per section per run.
   - 401: force-refresh the token once and retry, then `denied`.
   - 403: barrier check; `deleting == true` gives `deleted`, otherwise `denied`.
   - 5xx or network: stop the run and schedule a retry.
6. Status `idle` with `lastSyncedAt = now`; if `rerun` is set, run again.

Retry schedule: 2 s × 2^n with ±50 % jitter, capped at 60 s, at most 6 attempts per trigger; afterwards the engine waits for the next trigger.

`engine.test.ts` round-trips a diary at its full 800,000-byte budget, with notes full of `"` and `\`, through the REST JSON encoding and the per-section cap, and checks that a failing import does not stop the section steps.

**Triggers** (no polling, unlike v1's 30 s pull loop in `AccountSyncImpl.ts:71,147-154` and the 5 min journal loop in `JournalRepositoryImpl.ts:59`):

| Trigger | Action |
|---|---|
| uid change | account rules (6.7), then run |
| app start with a restored session | run |
| app to foreground | run when the last successful run was more than 60 s ago |
| back online | run when something is pending or the last run failed |
| local change in a synced store | run after a 2 s debounce |
| app to background | run immediately when something is pending (best effort) |

**Status copy** (Settings › Account and the You tab):

| Status | Copy |
|---|---|
| idle, nothing pending | "Synced {relative time}" ("Synced just now" under one minute) |
| syncing | "Syncing…" |
| idle or syncing with pending changes | "Changes will sync shortly" |
| error offline | "Waiting for a connection to sync" |
| error denied | "Sign in again to sync" with the action "Sign in" |
| error server | "Sync is having trouble. Yify will keep trying." |
| error oversized | "Your {section} is too large to sync. Remove some items to continue." |
| error newer-schema | "Update Yify to sync your {section}." |
| deleted | "Account deletion is in progress. Finish deleting your account or sign out." |

Section names in copy: watchlist "watchlist", diary "diary", lists "lists", recent "recently viewed", preferences "settings".

### A6.6 One-time import of v1 account data (`src/features/sync/importV1.ts`)

1. `GET {base}/users/{uid}` and `GET {base}/journals/{uid}` with the 2,162,688-character cap (6.5); 404 means no data. A failure of any step records `importPending` (6.5 step 3) and is retried on a later run.
2. If `journals/{uid}.deleting` is true, the account is being deleted: status `deleted`, stop.
3. Convert with the phase A conversions (5.4): `watchlist` (v1 `{version:2, items: Movie[], marks}`), `history`, `library`, `preferences` (stamped with `preferencesUpdatedAt`), journal `payload`. Legacy keys come from a `LegacyIndex` built from these documents plus local data; known resolutions apply immediately.
4. Merge into the local sections (union by each section's policy), bumping `rev` where anything changed.
5. Commit `meta` with `{"v1Import":{"at":now,"usersUpdateTime":…,"journalUpdateTime":…}}` and `currentDocument: {exists: false}`. If it already exists (another device imported first), read it and continue; the merge is idempotent.
6. New legacy keys join the phase B queue.

**Re-import while v1 devices are active.** At most once an hour per uid (`v1CheckedAt`), the run compares the `updateTime` of `users/{uid}` and `journals/{uid}` (masked `GET`s, 6.5) with `meta.v1Import.usersUpdateTime` and `journalUpdateTime`. When either is newer, steps 1 to 4 run again and `meta.v1Import` is updated. The stamped merges make the repeat safe, and v2 still never writes v1 documents. Web goes to v2 at release step (c) while Android rolls out over weeks, so without this a signed-in user's v1 edits would stop reaching v2 devices (execution review, item 22). The check stops after the legacy sunset (O-21).

Settings › Account offers the action "Import data from Yify 1.x" with the description "Copies your watchlist, lists, diary and history from the older Yify app on this account. Items already here are kept." It re-runs steps 1-4 and updates `meta.v1Import.at`. v2 never writes `users/{uid}` or `journals/{uid}` except for the deletion steps in 6.7.

### A6.7 Account switch, sign-out and deletion

`v2.library.owner.uid` names the account whose data the device's library sections and synced preferences hold (`null` = guest data).

| Event | Behaviour |
|---|---|
| sign in as U, owner `null` | the first run merges the guest data into U's sections (union); owner becomes U |
| sign in as U, owner U | normal run |
| sign in as U, owner X | if any section has `rev > syncedRev` for X, write the sections and preferences to `v2.stash.X`; reset sections to `empty()` and preferences to `DEFAULT_PREFERENCES` with stamps 0; owner becomes U; if `v2.stash.U` exists, merge it in (dirty) and delete it after the next successful push; run |
| sign out | run a push with a 5 s deadline; if anything is still pending, write `v2.stash.U`; reset sections and synced preferences; owner becomes `null`; then `auth.signOut()`; section C sees the change through `subscribeUid` and keeps the RevenueCat identity on Android (its T9) |

Sign-out confirmation: the copy is in B4.11 (Part 0, I-18). Device-only data stays: consent, detected region, recent searches, caches.

**Account deletion** (`src/features/account/public/deletion.ts`, using `features/sync/public/sync.ts`), ordered so a cancelled step never strands the account (BE-13):

1. Confirmation dialog (copy in B4.11; Part 0, I-18).
2. `auth.reauthenticate()`. Cancel or failure stops here with nothing changed.
3. `pauseSync()`: cancel timers and wait for the in-flight run.
4. Barrier: commit `journals/{uid}` as `{payload: '{"version":1,"clearedAt":0,"entries":{}}', updatedAt: now, deleting: true}` with a precondition from a fresh read, up to 3 attempts (port of `JournalDataSource.remove`, `data/datasources/sync/JournalDataSource.ts:38-56`; the v1 rule requires exactly this empty payload, `firestore.rules:57-58`). If `deleting` is already true, continue.
5. Delete the six section documents and `users/{uid}`; 404 counts as success. Rules still allow owner deletes after the barrier.
6. `auth.deleteUser()`. On `requires-recent-login`, reauthenticate once and retry. On failure the status becomes `deleted` and Settings shows the action "Finish deleting account", which retries this step only.
7. Clear local data for the uid: sections, synced preferences, `v2.sync.<uid>`, `v2.stash.<uid>`; owner becomes `null`; run the `onAccountDeleted` listeners (section C: `logOut()`, then clear the entitlement cache).
8. Toast (Copy): "Your account was deleted."

Steps 4 and 5 are `deleteRemoteAccountData(uid)` and step 7's data removal is `clearLocalAccountData(uid)` (sync public, P5); `deleteAccount()` (account public, P6) runs the sequence and the `onAccountDeleted` listeners.

What remains, as documented today in `public/delete-account.html`: the empty `journals/{uid}` barrier (immutable by rule) and the RevenueCat customer record (deleted only on request; owner action).

---

## A7. Routes

### A7.1 File tree (`app/`)

This list is authoritative: the architecture test (A1.5, check 2) fails on any file that is missing or not listed. Navigation follows Part 0, I-1 and B1.4: a root Stack holds the `(tabs)` group and the legacy resolvers; four tab stacks share the detail routes through the array group `(home,search,library,you)`.

| File | URL | Renders | Owner after F0 |
|---|---|---|---|
| `app/_layout.tsx` | — | root `Stack` inside `AppRoot` (`features/shell/public/AppRoot.tsx`); exports `ErrorBoundary` → `RootErrorBoundary` | F0 |
| `app/+html.tsx` | — | renders `WebDocument` (`src/core/ui/document/WebDocument.tsx`), which spreads `useServerDocumentContext()` (C3.2, B1.4.5, B2.11) | P8 |
| `app/+not-found.tsx` | any unmatched path | `NotFoundScreen` (`features/shell/screens/NotFoundScreen.tsx`) | F0 |
| `app/+middleware.ts` | `/movies`, `/shows`, `/movie/[id]`, `/show/[imdbId]` | legacy 301s (A7.3) | P1 |
| `app/(tabs)/_layout.tsx` | — | `expo-router/js-tabs` `Tabs` with `AppTabBar` (`features/shell/public/AppTabBar.tsx`) | F0 |
| `app/(tabs)/(home)/index.tsx` | `/` | `HomeScreen` (`features/home/screens/HomeScreen.tsx`) | F0 |
| `app/(tabs)/(search)/search.tsx` | `/search` | `SearchScreen` (`features/search/screens/SearchScreen.tsx`) | F0 |
| `app/(tabs)/(library)/library/_layout.tsx` | — | `LibraryLayout` (`features/library/screens/LibraryLayout.tsx`, headless tabs) | F0 |
| `app/(tabs)/(library)/library/index.tsx` | `/library` | `WatchlistScreen` | F0 |
| `app/(tabs)/(library)/library/watched.tsx` | `/library/watched` | `DiaryScreen` | F0 |
| `app/(tabs)/(library)/library/lists.tsx` | `/library/lists` | `ListsScreen` | F0 |
| `app/(tabs)/(library)/library/recent.tsx` | `/library/recent` | `RecentScreen` | F0 |
| `app/(tabs)/(library)/list/[id].tsx` | `/list/[id]` | `ListScreen` | F0 |
| `app/(tabs)/(you)/you.tsx` | `/you` | `YouScreen` (`features/you/screens/YouScreen.tsx`) | F0 |
| `app/(tabs)/(you)/plus.tsx` | `/plus` | `PlusScreen` (`features/monetization/screens/PlusScreen.tsx`) | F0 |
| `app/(tabs)/(you)/settings/index.tsx` | `/settings` | `SettingsScreen` (`features/settings/screens/SettingsScreen.tsx`) | F0 |
| `app/(tabs)/(you)/settings/appearance.tsx` | `/settings/appearance` | `AppearanceScreen` | F0 |
| `app/(tabs)/(you)/settings/streaming.tsx` | `/settings/streaming` | `StreamingSettingsScreen` | F0 |
| `app/(tabs)/(you)/settings/privacy.tsx` | `/settings/privacy` | `PrivacySettingsScreen` | F0 |
| `app/(tabs)/(you)/settings/account.tsx` | `/settings/account` | `AccountSettingsScreen` (`features/account/screens/AccountSettingsScreen.tsx`) | F0 |
| `app/(tabs)/(you)/settings/about.tsx` | `/settings/about` | `AboutScreen` | F0 |
| `app/(tabs)/(home,search,library,you)/_layout.tsx` | — | shared tab `Stack` with group anchors (B1.4.3) | F0 |
| `app/(tabs)/(home,search,library,you)/title/movie/[id].tsx` | `/title/movie/[id]` | `<TitleRoute type="movie"/>` | F0 |
| `app/(tabs)/(home,search,library,you)/title/movie/[id].web.tsx` | same, web | `loader` + `generateMetadata` + `<TitleRoute type="movie" initialData={…}/>` (C3.2) | P8 |
| `app/(tabs)/(home,search,library,you)/title/tv/[id]/index.tsx` | `/title/tv/[id]` | `<TitleRoute type="tv"/>` | F0 |
| `app/(tabs)/(home,search,library,you)/title/tv/[id]/index.web.tsx` | same, web | as the movie twin | P8 |
| `app/(tabs)/(home,search,library,you)/title/tv/[id]/season/[season].tsx` | `/title/tv/[id]/season/[season]` | `SeasonRoute` | F0 |
| `app/(tabs)/(home,search,library,you)/person/[id].tsx` | `/person/[id]` | `PersonRoute` | F0 |
| `app/(tabs)/(home,search,library,you)/person/[id].web.tsx` | same, web | `loader` + `generateMetadata` + `PersonRoute` | P8 |
| `app/movies.tsx` | `/movies` | `LegacyMoviesRedirect` (`features/legacy/screens/`) | F0 |
| `app/shows.tsx` | `/shows` | `LegacyShowsRedirect` | F0 |
| `app/movie/[id].tsx` | `/movie/[id]` | `LegacyMovieRedirect` | F0 |
| `app/show/[imdbId].tsx` | `/show/[imdbId]` | `LegacyShowRedirect` | F0 |
| `app/sitemap.xml+api.ts` | `/sitemap.xml` | sitemap index (C3.4) | P8 |
| `app/sitemaps/[name]+api.ts` | `/sitemaps/{name}.xml` | sitemap files (C3.4) | P8 |
| `app/api/v2/home+api.ts` … `app/api/v2/img/[size]/[file]+api.ts` | `/api/v2/*` | the sixteen adapters listed in A3.8 | P1 |
| `app/api/catalog/[operation]+api.ts` | `/api/catalog/*` | legacy catalog (A3.7) | P1 |
| `app/__/auth/[...path]+api.ts` | `/__/auth/*` | Firebase auth handler proxy (A6.1) | P1 |
| `app/__/firebase/[...path]+api.ts` | `/__/firebase/*` | Firebase init proxy (A6.1) | P1 |

Route files are adapters of at most 30 lines, for example:

```tsx
import {TitleRoute} from '@/features/title/screens/TitleRoute';

export default function MovieRoute() {
  return <TitleRoute type="movie"/>;
}
```

`TitleRoute` reads `id` with `useLocalSearchParams`, parses it (A7.2) and renders `TitleScreen` or the not-found state. The web twins render the same `TitleRoute` and pass `useLoaderData()` as `initialData` only when it is not `null`. Loader-data requests from in-app navigation return `null` (C3.2), so client navigation uses the prefetched TanStack query and renders the header from `summaryCache` on the first frame. The static route files that C3.2 lists also export a synchronous `generateMetadata` that returns `staticMetadata(page, host)` from `src/core/config/seo.ts` (A1.5 check 6).

Web twins declare `loader` and `generateMetadata` in the route file itself (`export async function loader(...)`, `export async function generateMetadata(...)`), each body one `await import('@/server/seo/titlePage')` (or `personPage`) followed by one call. The Babel plugins that strip them from client bundles return early on `export {…}` specifiers (`node_modules/babel-preset-expo/build/plugins/server-data-loaders-plugin.js:50-51`, `server-metadata-plugin.js:35-36`), so a re-export would ship server code to the browser; and a static import would survive the stripping. A `loader` in a native route file never runs on web and must not exist (docs.expo.dev/router/web/data-loaders, "Known limitations"), so the native `[id].tsx` files have no loader.

Cold links (URL bar, App Link, shared link) to a shared route render in the first group alphabetically, `(home)`, above Home's anchor (docs.expo.dev/router/advanced/shared-routes). In-app navigation keeps the current tab.

### A7.2 URL scheme

| Content | Path | Parameter rule |
|---|---|---|
| Movie | `/title/movie/{tmdbId}-{slug}`, or `/title/movie/{tmdbId}` when the slug is empty | `^(\d{1,9})(?:-[a-z0-9-]*)?$` with id above 0 (same pattern as section C) |
| TV | `/title/tv/{tmdbId}-{slug}` | same |
| Season | `/title/tv/{tmdbId}-{slug}/season/{n}` | `n` matches `^(0\|[1-9]\d{0,2})$` |
| Person | `/person/{tmdbId}-{slug}` | same as movie |
| List | `/list/{id}` | `^[A-Za-z0-9_-]{1,100}$`; only the owner's device can show it |
| Search | `/search?q=…&type=…` | codec in 4.6 |
| Library | `/library`, `/library/watched?view=insights&year=2026`, `/library/lists`, `/library/recent` | `view` `diary` (default) or `insights`; `year` `^\d{4}$`; `tab=insights` (from the v1 `/journal` redirect) is read as `view=insights` |
| Plus | `/plus?source={placement}` | `source` `^[a-z_]{1,40}$`, analytics only |

`src/core/navigation/hrefs.ts`:

```ts
export function titleHref(key: TitleKey, slug: string): string;
export function seasonHref(key: TitleKey, slug: string, season: number): string;
export function personHref(key: PersonKey, slug: string): string;
export function listHref(id: string): string;
export function searchHref(state: Partial<SearchUrlState>): string;
export function shareUrl(href: string): string;
export function mediaHref(item: MediaCardItem): string;
export function mediaTarget(item: MediaCardItem):
  | {kind: 'title'; key: TitleKey; type: MediaType; id: number; slug: string; title: string; posterPath: string | null}
  | {kind: 'legacy'; title: string};
```

`titleHref('movie:603', 'the-matrix')` is `/title/movie/603-the-matrix`; an empty slug gives `/title/movie/603`. v2 never emits `/movie/…` or `/show/…`. `shareUrl` prefixes `SITE_ORIGIN` (`https://yify.expo.app`, `core/config/app.ts`). The id is authoritative: on native and during in-app navigation on web, a stale or wrong slug still renders the title; on web a document request answers 301 to the canonical slug with a relative `Location` (section C, C3.2). UI code opens titles only through `useOpenMedia(surface)` (`features/title/public/useOpenMedia.ts`, Part W F0.5), which prefetches `titleQueryOptions(key, region)` and calls `openTitle` (C2.6).

### A7.3 Legacy URLs (every v1 URL)

| v1 URL | v2 | Implemented by |
|---|---|---|
| `/movies?query&genre&quality&minimum_rating&sort_by&order_by&focus` | 301 to `/search` with mapped params | `app/movies.tsx` (`<Redirect>`) and `+middleware.ts` |
| `/shows` | 301 to `/search?type=tv` | `app/shows.tsx` and middleware |
| `/movie/{v1Id}` | resolve with `/legacy/movie`, 301 to `/title/movie/{id}-{slug}` (or `/title/tv/…`); unknown ids, non-numeric paths and every id after the legacy sunset show the old-link screen | `app/movie/[id].tsx` and middleware |
| `/show/{imdbDigits}` | `find tt{digits zero-padded to 7}`, 301 to `/title/tv/{id}-{slug}`; unknown shows the old-link screen | `app/show/[imdbId].tsx` and middleware |
| `/anime` | 301 to `/` | config redirect |
| `/watchlist` | 301 to `/library` | config redirect |
| `/history` | 301 to `/library/recent` | config redirect |
| `/journal` (`?tab=insights`) | 301 to `/library/watched` (query kept) | config redirect |
| `/preferences` | 301 to `/settings` | config redirect |
| `/upgrade` (`?source=website`) | 301 to `/plus` (query kept) | config redirect |
| `/browse` | 301 to `/search` | config redirect |
| `/privacy`, `/terms`, `/delete-account`, `/support` | 301 to `https://yify.expo.app/{page}.html` (unchanged) | config redirect |
| `/guide` | 301 to `/` (the v1 guide page is deleted, Part 0 I-11) | config redirect |
| `kunal26das.github.io/yify/*` | not served: the Pages site is unpublished (C3.1, O-16) | — |

Config redirects: `config/legacy-redirects.json` (C4.1) holds the four legal pages and the app redirects of this table; `app.config.js` passes it to the expo-router plugin for every build, not only when `EXPO_WEB_OUTPUT=server` as v1 did (`app.config.js:21`), because the app applies redirects to initial URLs, deep links and every navigation (docs.expo.dev/router/reference/redirects). `convertRedirect` preserves the query suffix (`node_modules/expo-router/build/getRoutesRedirects.js`), so destinations carry no query string.

`/movies` mapping (`src/core/domain/legacyUrls.ts`, unit-tested; shared by the middleware and the client resolvers):

| v1 parameter | v2 |
|---|---|
| `query` | `q` |
| `genre` (YTS name) | `genres` with the TMDB movie genre id: action 28, adventure 12, animation 16, comedy 35, crime 80, documentary 99, drama 18, fantasy 14, horror 27, mystery 9648, romance 10749, sci-fi 878, thriller 53, war 10752, western 37 |
| `minimum_rating` | `rating_min`, rounded down to a multiple of 0.5 |
| `sort_by` | `date_added`, `year` → `release`; `title` → `title`; `rating` → `rating`; `like_count`, `download_count`, `seeds`, `peers` → `popular` |
| `quality`, `order_by`, `focus` | dropped |
| (always) | `type=movie` |

Middleware (`app/+middleware.ts`, delegating to `src/server/middleware/legacyRedirects.ts`):

```ts
import type {MiddlewareFunction} from 'expo-router/server';
import {legacyRedirect} from '@/server/middleware/legacyRedirects';

export const unstable_settings = {
  matcher: {methods: ['GET', 'HEAD'], patterns: ['/movies', '/shows', '/movie/[id]', '/show/[imdbId]']},
};

const middleware: MiddlewareFunction = request => legacyRedirect(request);

export default middleware;
```

(The matcher shape is `MiddlewareSettings`/`MiddlewareMatcher` in `node_modules/expo-server/build/cjs/types.d.ts`; `expo-router/server` re-exports `MiddlewareFunction` but not `MiddlewareSettings`, so the settings object is left untyped rather than adding `expo-server`, a transitive dependency of expo-router, as a direct one.) `/movies` and `/shows` answer 301 with the mapped URL. `/movie/{digits}` calls the same `legacyMovieLookup` as `/api/v2/legacy/movie` (isolate cache, 5 s budget) and answers 301 with the relative `Location` `path`; `/show/{digits}` does the same through `findLookup`. Every middleware redirect uses a relative `Location` (or one built from `SITE_ORIGIN`), never one built from `request.url`, which on EAS is the deployment URL (A3.1). Any failure or timeout returns nothing, so the page renders and the client route takes over. Section C's SSR fallback (F1) adds `/title/*` and `/person/*` patterns to the same file if it is ever needed; expo-router allows one `+middleware.ts`. v2 uses `server` output, which runs middleware; fallback F1 (`static` plus `apiRoutes: true`) supports it too (docs.expo.dev/router/web/middleware).

Client legacy screens (`features/legacy/screens/LegacyMovieRedirect.tsx`, `LegacyShowRedirect.tsx`; `/movies` and `/shows` render `LegacyMoviesRedirect` and `LegacyShowsRedirect`, which map parameters with `legacyUrls.ts` and render `<Redirect>`) query `legacyMovie` or `find`, render `<Redirect href={path}/>` on success, the standard retry state on network or server errors, and on 404 the old-link screen:

- Copy title: "This link is from an older version of Yify"
- Copy body: "We couldn't find this title in the new catalog."
- Actions: "Search for it" (`/search`) and "Go to Home" (`/`).

### A7.4 Android App Links

`app.json` `expo.android.intentFilters` (needs a native build):

```json
[
  {
    "action": "VIEW",
    "autoVerify": true,
    "data": [
      {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/title"},
      {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/person"},
      {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/search"},
      {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/plus"},
      {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/movie"},
      {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/show"}
    ],
    "category": ["BROWSABLE", "DEFAULT"]
  }
]
```

- `/movie` and `/show` stay for links shared by v1; `/movie` also matches `/movies` (prefix match). The app redirects all three (7.3).
- Devices still on v1 claim only `/movie` and `/show`, so v2 `/title/…` links open in the browser there instead of breaking inside the old app.
- `/plus` and `/search` links shared from the web open in the installed app.
- C4.1's `app.json` lists all six prefixes (Part 0, I-10).
- The custom scheme `yify` is unchanged. `ios.associatedDomains` is left as is (decision 5).
- `public/.well-known/assetlinks.json` lists two SHA-256 fingerprints today. P9 confirms which is which. The Play App Signing certificate is proved by the Play-installed 1.8.33, which claims the same host: `adb shell pm get-app-links io.github.kunal26das.yify` must report `yify.expo.app: verified`. The upload-key fingerprint is checked with `keytool -list -v` on the upload keystore. With both listed, the bundletool APKs of release step (d), which are signed with the upload key, verify too.

---

## A8. Port and delete map

Legend: **port** = move the logic (and its colocated test) with the named changes; **rewrite** = new implementation per the owning section, the old file is reference only; **delete** = removed with no replacement. "UI" rows are owned by Part B; the target path is fixed here so imports line up.

### A8.1 `app/`

| File | Action | Target |
|---|---|---|
| `_layout.tsx` | rewrite | `app/_layout.tsx` renders `AppRoot` (`features/shell/public/AppRoot.tsx`); it exports `ErrorBoundary`, which renders `RootErrorBoundary` (Part W, F0.5) |
| `+html.tsx` | rewrite | same path (C3, P8): no iPhone claims, no AdSense meta, startup script reads `v2.prefs` |
| `index.tsx` | rewrite | `app/(tabs)/(home)/index.tsx` → `features/home/screens/HomeScreen.tsx` |
| `movies.tsx` | rewrite | legacy redirect route (7.3) |
| `shows.tsx` | rewrite | legacy redirect route (7.3) |
| `movie/[id].tsx` | rewrite | legacy redirect route, same path → `features/legacy/screens/LegacyMovieRedirect.tsx`; titles move to `app/(tabs)/(home,search,library,you)/title/movie/[id].tsx` and `…/title/tv/[id]/index.tsx` → `features/title/screens/TitleRoute.tsx` |
| `show/[imdbId].tsx` | rewrite | legacy redirect route → `features/legacy/screens/LegacyShowRedirect.tsx` |
| `watchlist.tsx`, `history.tsx`, `journal.tsx`, `preferences.tsx`, `upgrade.tsx`, `anime.tsx` | delete | config redirects (7.3) |
| `api/catalog/[operation]+api.ts` | port | same path → `src/server/legacy/catalog/handler.ts` |
| `api/subscriber-catalog/[operation]+api.ts`, `api/native-subscriber-catalog/[operation]+api.ts`, `api/availability-alerts/status+api.ts` | delete | — (3.7) |

### A8.2 `domain/`

| File | Action | Target |
|---|---|---|
| `Dependencies.ts`, `index.ts` | delete | no DI bag, no barrels |
| `availability/pilot.ts` (+test) | delete | — |
| `entities/Account.ts`, `entities/AuthTokenError.ts` | port | `src/core/domain/account.ts` |
| `entities/Entitlement.ts` | rewrite | section C (`features/monetization/plus/plusMachine.ts`, `benefits.ts`; 2.8) |
| `entities/Preferences.ts`, `entities/PrivacyChoices.ts` | rewrite | `src/core/domain/preferences.ts`; v1 shapes copied into `core/domain/legacy/v1Formats.ts` |
| `entities/Movie.ts`, `entities/HistoryEntry.ts`, `entities/Journal.ts`, `entities/LibraryState.ts` | port (v1 shapes only) | `src/core/domain/legacy/v1Formats.ts` |
| `entities/MovieDetails.ts`, `entities/MovieQuery.ts`, `entities/ParentalGuide.ts` | port (legacy server only) | `src/server/legacy/catalog/types.ts` |
| `entities/CastMember.ts`, `entities/Show.ts`, `entities/Torrent.ts`, `entities/AnimeRelease.ts`, `entities/CountryLocationResult.ts`, `entities/NotificationPreferences.ts`, `entities/PlaybackPreferences.ts` | delete | replaced by `title.ts` or removed features |
| `entities/Streaming.ts`, `StreamingAvailability.ts`, `StreamingCatalog.ts`, `StreamingCountry.ts`, `StreamingOffer.ts`, `StreamingService.ts`, `StreamingSelections.ts`, `WatchProvider.ts`, `WatchService.ts` | rewrite | `src/core/domain/providers.ts` |
| `entities/SyncStatus.ts` | rewrite | `SyncStatus` in `src/core/domain/sync/types.ts` (6.5) |
| `entities/UpdateStatus.ts` | move | C4.5 (`src/core/platform/updates/`, P9) |
| `policies/syncMerge.ts` (+test) | port | `src/core/domain/sync/watchlist.ts` (+test), keys become `EntryKey` |
| `policies/historyMerge.ts` (+test) | port | `src/core/domain/sync/recent.ts` (+test), cap 500 (A2.6) |
| `policies/libraryMerge.ts` (+test) | port | `src/core/domain/sync/lists.ts` (+test), item snapshots added |
| `policies/journal.ts` (+test) | port | `src/core/domain/sync/diary.ts` and `src/core/domain/dates.ts` (+tests) |
| `policies/journalInsights.ts` (+test) | port | `src/core/domain/insights.ts` (+test), input `DiaryEntry[]`, entries with `watchedOn: null` excluded |
| `policies/preferencesMerge.ts` (+test) | rewrite | `src/core/domain/sync/preferences.ts` (per-field stamps) |
| `policies/historyView.ts` (+test) | port | `src/features/library/recentView.ts` (+test): `historyGroupLabel`, `groupHistory`, `filterHistory`; key helpers dropped |
| `policies/watchlistView.ts` (+test) | port | `src/features/library/watchlistView.ts` (+test) |
| `policies/streaming.ts` | port `safeStreamingUrl` only | `src/core/platform/openUrl.ts` (`safeExternalUrl`) |
| `policies/adGating.ts` (+test) | rewrite | C2.2 (`adPolicy.ts`, decision 6 pacing) |
| `policies/subscriptionFunnel.ts` | delete | no funnel tooling in v2 (C1.13) |
| `policies/supporterNudge.ts` (+test), `dailyMoviePicks.ts` (+test), `newMoviesNotification.ts` (+test), `movieNotificationTarget.ts` (+test), `availabilityNotificationOpen.ts` (+test) | delete | removed features |
| `repositories/AnimeRepository.ts`, `AuthRepository.ts`, `JournalRepository.ts`, `KeyValueStore.ts`, `LibraryRepository.ts`, `MovieRepository.ts`, `PreferencesRepository.ts`, `PurchaseRepository.ts`, `SearchHistoryRepository.ts`, `SeenMoviesRepository.ts`, `ShowRepository.ts`, `StreamingRepository.ts`, `TmdbRepository.ts`, `WatchHistoryRepository.ts`, `WatchlistRepository.ts` | delete | module APIs replace ports; the `KeyValueStore` interface moves to `src/core/storage/kv.ts`; `AuthRepository` becomes `AuthAdapter` (6.1); `PurchaseRepository` goes to the monetization section |
| `services/AccountSync.ts`, `AdGateway.ts`, `AdRevenueSink.ts`, `AnalyticsSink.ts`, `AppConfig.ts`, `AppUpdates.ts`, `AvailabilityAlerts.ts`, `CountryLocation.ts`, `Diagnostics.ts`, `DisplayAdState.ts`, `DisplayAds.ts`, `NetworkMonitor.ts`, `NewMoviesNotifier.ts`, `PrivacyPreferences.ts`, `StoreServices.ts`, `SubscriberAccess.ts`, `SupporterNudge.ts` | delete | `NetworkMonitor` → `src/core/platform/network.ts`; `AccountSync` → `SyncEngine` (6.5); `PrivacyPreferences` → consent store; `Diagnostics`, `AnalyticsSink` → telemetry; `AdGateway`, `AdRevenueSink` → monetization; `AppUpdates`, `StoreServices` → Android section; the rest belong to removed features |

### A8.3 `data/`

| File | Action | Target |
|---|---|---|
| `index.ts`, `di/container.ts`, `di/bootstrap.ts`, `di/catalogRepositories.ts`, `di/catalogRepositories.web.ts`, `di/catalogServer.ts`, `di/subscriberCatalogServer.ts`, `di/nativeSubscriberCatalogServer.ts`, `di/availabilityAlertsServer.ts` | delete | startup moves to `features/shell/start.ts`; the catalog adapter is `app/api/catalog/[operation]+api.ts` |
| `datasources/JsonRequest.ts` | port (classification only) | `src/core/api/errors.ts`; minimal server fetch in `src/server/http/fetchJson.ts` |
| `datasources/TmdbApiDataSource.ts` | port | `src/server/tmdb/dto.ts` and `client.ts` (server only) |
| `datasources/YtsApiDataSource.ts`, `YtsEndpoint.ts` | port subset | `src/server/legacy/yts/client.ts` (list, details, suggestions, parental guides; no module cache) |
| `datasources/WebCatalogClient.ts` | delete | `src/core/api/*` |
| `datasources/EztvApiDataSource.ts`, `AvailabilityEnrollment.ts` | delete | — |
| `datasources/analytics/FirebaseAnalyticsSink.ts`, `.web.ts` | move | C5 (`src/core/platform/telemetry/`) |
| `datasources/config/remoteConfigKeys.ts` | delete | the TMDB fallback literal moves to `src/server/env.ts` |
| `datasources/firebase/FirebaseWebApp.ts` | port | `src/core/platform/firebase/webApp.web.ts` (+ native stub), `authDomain` fix (6.1) |
| `datasources/platform/ForegroundWatcher.ts`, `.web.ts` | port | `src/core/platform/appState.ts`, `.web.ts` (single fan-out listener) |
| `datasources/storage/PersistentCache.ts`, `.web.ts` | port | `src/core/storage/kv.ts`, `.web.ts` (no prefixing; quota handling on web) |
| `datasources/storage/ResponseCache.ts`, `SessionCache.ts` | delete | TanStack Query; `SessionCache` is dead code |
| `datasources/sync/FirestoreSyncDataSource.ts` | port | `src/core/platform/firestore/rest.ts` (list, per-section get with caps, commit, delete, barrier check, error mapping; A6.5) |
| `datasources/sync/JournalDataSource.ts` | port | barrier write and read in `src/features/sync/deletion.ts` (`deleteRemoteAccountData`) via `rest.ts` |
| `models/YtsApiResponse.ts`, `YtsCastMemberDto.ts`, `YtsListMoviesResponse.ts`, `YtsMetaDto.ts`, `YtsMovieDetailsResponse.ts`, `YtsMovieDto.ts`, `YtsMovieParentalGuidesResponse.ts`, `YtsMovieSuggestionsResponse.ts`, `YtsParentalGuideDto.ts`, `YtsTorrentDto.ts`, `models/index.ts` | port | `src/server/legacy/yts/dto.ts` (one module; `YtsTorrentDto` kept only to parse and discard upstream torrents) |
| `models/EztvTorrentDto.ts` | delete | — |
| `repositories/FirebaseAuthRepositoryImpl.ts`, `.web.ts` | port | `src/core/platform/auth/firebaseAuth.ts`, `.web.ts` (6.1 changes) |
| `repositories/support/readFirebaseIdToken.ts` | port | `src/core/platform/auth/idToken.ts` |
| `repositories/support/observable.ts` | rewrite | `src/core/store/createStore.ts` (equality-checked) |
| `repositories/support/artwork.ts` | delete | v2 never stores legacy proxy URLs |
| `repositories/WatchlistRepositoryImpl.ts` (+test) | port | `src/features/library/stores/watchlistStore.ts` (+test) |
| `repositories/LibraryRepositoryImpl.ts` (+test) | port | `src/features/library/stores/listsStore.ts` (+test); watched marks become diary entries |
| `repositories/WatchHistoryRepositoryImpl.ts` (+test) | port | `src/features/library/stores/recentStore.ts` (+test) |
| `repositories/JournalRepositoryImpl.ts` | rewrite | `src/features/library/stores/diaryStore.ts` (local first) + sync engine |
| `repositories/PreferencesRepositoryImpl.ts` | port validators | `src/features/settings/stores/preferencesStore.ts`; `parseStreamingSelections` and `parseSyncedPreferences` to `v1Formats.ts` |
| `repositories/SearchHistoryRepositoryImpl.ts` | port | `src/features/search/recentSearches.ts` (limit 10) |
| `repositories/MovieRepositoryImpl.ts` (+test) | port | `src/server/legacy/catalog/mapYts.ts` (+test) |
| `repositories/StreamingRepositoryImpl.ts` | port `optionsUrl` only | `src/server/tmdb/project.ts` |
| `repositories/TmdbRepositoryImpl.ts`, `ShowRepositoryImpl.ts`, `SeenMoviesRepositoryImpl.ts` (+test), `WebMovieRepositoryImpl.ts`, `WebShowRepositoryImpl.ts`, `WebAnimeRepositoryImpl.ts` | delete | — |
| `repositories/RevenueCatPurchaseRepositoryImpl.ts`, `.web.ts` | move | C1, C2 (`src/features/monetization/`) |
| `server/catalog/admission.ts` (+test) | port | `src/server/http/admission.ts` (+test), new limits (3.2) |
| `server/catalog/cancellation.ts` (+test) | port | `src/server/http/deadline.ts` (+test) |
| `server/catalog/handler.ts`, `parameters.ts`, `projections.ts`, `repositories.ts`, `catalog.test.ts` | port | `src/server/legacy/catalog/*` without subscriber, Nyaa, EZTV and raw paths (3.7) |
| `server/catalog/nyaa.ts` (+test), `subscriber.test.ts`, `native-subscriber.test.ts` | delete | — |
| `server/subscribers/errors.ts`, `firebase.ts`, `http.ts`, `index.ts`, `revenuecat.ts`, `subscribers.test.ts`, `server/availability/access.ts` | delete | — |
| `services/AccountLink.ts` | rewrite | `src/features/account/auth/session.ts` |
| `services/AccountSyncImpl.ts` | rewrite | `src/features/sync/engine.ts` (debounce, precondition loop, barrier handling and account switch carried over) |
| `services/ExpoNetworkMonitor.ts`, `.web.ts` | port | `src/core/platform/network.ts`, `.web.ts` |
| `services/PrivacyPreferencesImpl.ts` | port | `src/features/settings/stores/consentStore.ts` |
| `services/AdMobAdGateway.ts`, `.web.ts`, `AdMobFailure.ts`, `RevenueCatAdRevenueSink.ts`, `.web.ts` | move | C1, C2 (`src/features/monetization/`) |
| `services/SentryDiagnostics.ts`, `NoopDiagnostics.ts`, `optionalAnalytics.ts` | delete | replaced by `reportOperation` (C5.4) |
| `services/ExpoAppUpdates.ts`, `.web.ts`, `ExpoUpdateFailureDetails.ts`, `PlayStoreServices.ts`, `.web.ts` | rewrite | C4.5 (`src/core/platform/updates/`, P9) |
| `services/RemoteAppConfig.ts`, `.web.ts` | delete | no runtime config: the TMDB key is server-side (3.3.1), the coffee link is deleted, there is no ads flag (3.4.15) |
| `services/AdSenseDisplayAds.ts`, `.web.ts`, `AvailabilityAlertsImpl.ts`, `AvailabilityPush.ts`, `.web.ts`, `availabilityAccess.ts`, `CountryLocationImpl.ts`, `.web.ts`, `countryLocationRequest.ts`, `MovieNotificationCoordinator.ts`, `NewMoviesNotifierImpl.ts`, `.web.ts`, `SubscriberCatalogAccess.ts`, `SupporterNudgeImpl.ts` | delete | removed features (decision 8) |

### A8.4 `instrumentation/`

| File | Action | Target |
|---|---|---|
| `sentry.ts`, `sentry-config.ts`, `sentry-consent.ts`, `sentry-environment.ts`, `sentry-privacy.ts`, `optional-telemetry.ts`, `ScreenDisplay.tsx` | move | C5 (`src/core/platform/telemetry/`) |
| `crashlytics.ts`, `crashlytics.web.ts` | delete | decision 9 |

### A8.5 `presentation/`

B7 is the authoritative fate table for every `presentation/` file (Part 0, I-31). Hooks and non-UI modules it delegates to "Sections A / C" map to the public modules of A4.4.

---

## A9. Fixed by design

| Problem (research) | v2 mechanism |
|---|---|
| YIFY-36: `router.setParams` inside a passive effect throws during effect reconnect (`app/movies.tsx:138` at `0f7a9ab`) | URL is the source of truth; writes only in handlers through `useUrlState().commit` using scoped `navigation.setParams`; lint bans navigation calls in effects and the global `router`; `<Redirect>` for render-time redirects (4.6, 1.4) |
| YIFY-2R class (global router unbound) | `no-restricted-imports` for `router` from `expo-router` (1.4) |
| Home fan-out: 21 serial list requests, 58 calls in 64 s, a second full reload after auth | one `/home` aggregate (edge-cached per region) + at most one personalized discover + one availability batch; no reload on entitlement changes because the catalog is public (3.4.1, 4.4) |
| 429 bursts and retry amplification (client and server each retry 5xx once) | no server retry on HTTP errors; one client retry honoring `Retry-After`; breaker stops retries and focus refetches after 3 server errors per minute (3.3.2, 4.2) |
| 14 h catalog outage, no stale fallback | TMDB replaces the single YTS mirror; edge `stale-while-revalidate` and `stale-if-error`; isolate last-good; persisted Home snapshot (3.2, 3.3.3, 4.5) |
| TMDB blocked in India (web) and Russia (native) | clients never call `api.themoviedb.org`; image proxy fallback per device (3.5) |
| 20 files with revision or generation counters, 19 `AbortController`s, 7 hand-made retry loops | TanStack Query owns fetching, cancellation and retries; the sync engine holds the only run token; stores are synchronous (4.2, 4.6, 6.5) |
| 13 independent foreground handlers | one `AppState` subscription and one network subscription feeding TanStack and the sync engine (4.2) |
| Sync polls every 30 s and blind-overwrites watchlist, history and preferences | trigger-based sync, masked list to detect changes, precondition commit for every section, per-section documents, clock clamping (6.5) |
| Theme writes re-render every themed node; resubscribe on every render | `createStore` with selectors and equality; stable subscribe (4.6) |
| Web `getRedirectResult` on every load; redirect sign-in broken by cross-site `authDomain` | lazy auth SDK; redirect flag; same-origin `authDomain` with a transparent proxy (6.1) |
| Account deletion could strand an account after a cancelled reauthentication | reauthenticate before destroying data (6.7) |

---

## A10. Acceptance criteria

Architecture

1. `yarn lint` passes with the config in 1.4; a deliberate violation of each zone (core importing a feature, feature importing another feature's `stores/`, a `.tsx` route importing `src/server/endpoints`, `Platform.OS` in a feature outside its `platform/` folder, a `.web.ts` twin in a feature outside `platform/`, `router.setParams` inside `useEffect`, an `index.ts` in `src/`) fails it.
2. `src/core/architecture.test.ts` passes (1.5).
3. `yarn typecheck` passes with `@/*` mapped to `./src/*`.

API

4. Every endpoint has a unit test with recorded TMDB fixtures covering: projection caps, adult filtering, slug, trailer pick, certification fallback, availability mapping, error envelope, `Retry-After` and `Cache-Control` per status.
5. With TMDB mocked to fail after one success, a repeated request returns 200 with `X-Yify-Source: last-good` and the `lastGood` policy; with no prior success it returns 502 with `Retry-After: 30`.
6. `curl -sI https://yify--v2.expo.app/api/v2/home?region=IN` (spike S2) shows the `list` policy, and a second request within 15 minutes shows an EAS cache hit.
7. No response body, log line or cache key contains the TMDB credential (test greps responses and logs in the handler tests).
8. A cross-origin browser `fetch` to `/api/v2/home` from another origin fails CORS; the same-origin web app and native app work.
9. Legacy: `GET /api/catalog/movie?id=8462&v=2` returns `"torrents":[]` and no `downloadCount`; `/api/catalog/shows?v=2` returns an empty list; subscriber and availability routes return 404; `tests/contracts/legacy-v1-client.test.ts` passes, and `scripts/check-legacy-contract.mjs` passes against the preview alias (S2) and production (step c); an installed 1.8.33 build browses without errors after step (c) (1.8.x hard-codes `yify.expo.app`, so it cannot be pointed at a preview).

Client data

10. Home cold start in airplane mode after one successful online launch shows the saved Home within 1 s with the offline copy.
11. With the API forced to 502, a client issues at most 2 requests per screen visit and no focus refetches until the breaker clears.
12. Opening a title from a rail renders the header from `summaryCache` on the first frame, on native and during in-app navigation on web (the loader returns `null` for loader-data requests, C3.2).
13. The availability batcher sends one POST for all titles visible in one frame.

Storage and migration

14. The fixture tests in 5.4 pass, including double runs and crash-after-each-step runs.
15. On a device upgraded from 1.8.33 with a watchlist, history, journal, collections, a manual region and selected services, v2 shows the same items (resolved titles with TMDB artwork; unresolved ones under their old titles), the same region and the same services, without network on first render.
16. No v2 key or rendered image URL contains a YTS or wsrv host.

Auth and sync

17. Two devices signed in to the same account converge after concurrent edits to the same section (precondition conflict path exercised in a test with a mocked 409).
18. A device with its clock set one day ahead cannot make its edits win over a later edit from another device (clamp test).
19. A v1 device and a v2 device on the same account: v1 keeps syncing its own fields; v2 never writes `users/{uid}`; rules test 5 passes.
20. Sign-out removes library and synced settings from the device; signing back in restores them; unsynced edits made offline before sign-out reappear after the next sign-in (stash).
21. Account deletion with a cancelled reauthentication changes nothing; a completed deletion leaves no `users/{uid}` document or sections and signs the user out.
22. Web redirect sign-in completes on a browser with third-party storage blocked, without a cross-site request to `firebaseapp.com` from the page.

Routes

23. Every v1 URL in 7.3 reaches the documented destination on web (301 from the middleware or config) and in the Android app (App Link or `adb shell am start -a android.intent.action.VIEW -d <url>`).
24. `adb shell pm get-app-links io.github.kunal26das.yify` reports `yify.expo.app: verified` on the Play-installed 1.8.33 (Play App Signing certificate) and on the upload-key bundletool APK of release step (d).
25. No route file exceeds 30 lines; every `titleHref` result starts with `/title/`; no v2 code builds `/movie/…` or `/show/…` links.

---

## A11. Owner actions, dependencies on other parts, open conflicts

All conflicts this part raised are resolved in Part 0, §0.3 (I-1, I-3, I-9, I-10, I-11, I-12, I-20, I-21, I-22, I-27). Owner actions are consolidated in Part O; the ones that originate here are O-1 (Firestore rules), O-2 (`TMDB_API_KEY` as a sensitive variable), O-3 and O-3b (OAuth redirect URIs for production and the preview alias), O-4 (remove subscriber variables), O-5 (TMDB licence), O-21 (legacy catalog sunset) and O-31 (builds 1.8.16 and older).

# Part B — Design system, information architecture, screens, copy and accessibility

Scope: Android and web. Baseline: Expo SDK 58, React Native 0.88.1, expo-router 58.0.32, Reanimated 4.8.0, react-native-web 0.21.4, TypeScript 7.

Inputs: `scratchpad/decisions.md`, `research/design.md` (DES-*), `research/ux-live.md` (UXL-*), `research/android.md` (AND-*), `research/web.md` (WEB-*), `research/monetization.md` (MON-*), `research/scope.md`, `research/dependencies.md`, `research/data-browser.md`.

Conventions used in this part:

- "dp" = density-independent pixels on Android and CSS px on web.
- Every library API this part relies on cites the installed `.d.ts` (path under `node_modules/`) or the official doc read on 2026-11-26.
- Code blocks are normative shapes without comments.
- `{APP_NAME}` in copy is the constant in `src/core/config/app.ts` (decision 3). Its value is `Yify`. Copy that Parts A or C wrote with a literal "Yify" also uses `{APP_NAME}`.
- Copy is US English, sentence case, no exclamation marks.

## B0. Decisions in this section (summary)

1. **Navigation.** Four destinations: Home, Search, Library, You. Built with `Tabs` from `expo-router/js-tabs` and a custom `tabBar` (`AdaptiveNavigation`). It renders a bottom navigation bar (compact), a navigation rail (medium, and expanded Android) or a web header with a centred search field (expanded web).
2. **Detail routes inside tabs.** Detail routes are shared by the four tab stacks through the documented array group `(home,search,library,you)`, so the bar, rail or header stays visible on title pages. (Part 0, I-1; A13). `NativeTabs` is rejected: no rail, no web header (§1.4).
3. **One app bar per screen.** Every screen renders its own `TopAppBar` (64 dp). Title pages use an overlay variant on the backdrop. Expanded web uses the 64 px `WebHeader` instead.
4. **Deleted.** The global `TopBar` and `TopBarSlot`, the blur and glass wrappers, the scroll-progress pill, the rotating hero, the mini-player, the queue, document PiP and the 18+ gate (§7).
5. **Predictive back.** `predictiveBackGestureEnabled: true` (same as section C §4.4). In-app back pops stacks and closes overlays. The system back-to-home preview animation is not achievable without native work (§1.6).
6. **Colour.** Colour is a set of Material 3 colour roles whose values come from `config/brand.json`. Today's values are v1-palette placeholders (Part 0, §0.4) that the Identity step replaces. Every text pair is at least 4.5:1 and every UI boundary at least 3:1 (§2.2, recomputed by the Identity step). The four Plus accents occupy the neutral slots `accent1` to `accent4` (A2.7). The theme default stays `dark`, as in section A. On web, colour roles are CSS variables, so server-rendered HTML has no theme flash.
7. **Type and icons.** Three font faces (display, body and body strong; placeholders Lora 600 and Hanken Grotesk 400 and 600 until the Identity step) instead of 7 plus Ionicons. Icons are Material Symbols Rounded, 54 glyphs: a subset font on Android and inline SVG on web, which matches section C's web budget of at most 3 font faces and SVG icons.
8. **Sheets.** Sheets are built on React Native `Modal`, and `@gorhom/bottom-sheet` is removed. Every sheet has a visible Close button and closes on back and Escape (fixes UXL-10).
9. **Undo.** One `SnackbarHost` with Undo replaces three overlapping snackbars and every confirm dialog except account deletion, sign-out and discarding unsaved diary edits (B3.7).
10. **Search URL.** Search state lives in the URL (section A's `useUrlState` and search codec) and never inherits saved defaults (fixes UXL-6). With a text query, only Type applies. Without one, the full filter set drives discover.
11. **Title page order.** Header, actions, then **Where to watch** with "Your services" first, then overview, cast, seasons (TV), more like this, images, details. On a 360×800 phone, the Where-to-watch heading is at or above 560 dp (fixes DES-3, UXL-8).
12. **Trailers and ads.** Trailers are tap-to-play only, full-screen on compact and a dialog on larger screens, and nothing overlaps the player. The Android interstitial runs only inside section C's `openTitle` flow, before navigation, and never between a trailer tap and playback (§5).
13. **Responsive layout.** Layouts are intrinsically responsive (flex-wrap, CSS grid `auto-fill`, `clamp()`), so section C's server-rendered HTML is right at any width. The only media-query CSS is the navigation chrome (§1.4.5). CSS-only style values go through `webStyle()` and `dataSet` through a `ViewProps` augmentation, so they typecheck (§1.4.5).

## B0.1 How this section plugs into A and C

| Topic | Owner | What this section uses |
| --- | --- | --- |
| Source tree, `@/*` → `./src/*`, routes in root `app/` | A §1.1, A1 | All paths below |
| Platform twins only in `src/core/platform/**` and `src/core/ui/**` | A §1.2, A3 | `AdaptiveNavigation`, `ThemeProvider`, `a11y`, `Icon`, `PosterGrid` twins live in `src/core/ui/` |
| Domain types: `TitleSummary`, `TitleSnapshot`, `EntryKey`, `Provider`, `RegionAvailability`, `OfferType`, `SearchType`, `DiscoverSort`, `HalfStars`, `LIMITS`, `Preferences`, `Consent` | A §2 | Component props (§3) and screens (§4) |
| Hooks (`useHome`, `useServicesRail`, `useTitle`, `useAvailability`, `useSeason`, `usePerson`, library and settings hooks) | A §4.4 | Screens (§4) |
| URL state (`useUrlState`, search codec, 300 ms live-search timer) and hrefs (`src/core/navigation/hrefs.ts`) | A §4.6 | Search, chips, links |
| Images (`imageUrl(path, size)`, sizes by use) | A §3.5, `src/core/ui/images.ts` | `Artwork` |
| Attribution strings and the TMDB logo asset | A §3.6 | Where to watch, About, footer |
| `usePlus`, `usePaywall(placement)`, `openPaywall`, `canCreateCustomList`, `effectiveAccent`, paywall copy | C §1.9–1.11 | Plus page, Plus sheet, Lists, Accent |
| `useOpenMedia(surface)` wrapping `openTitle(navigate, input)` (ads placement) | A4.4, C §2.6 | Every title link (§4.0.1, §5.4) |
| Web trailer player on the YouTube IFrame API | C §3.7 | `TrailerFrame` (§5) |
| GA4 event catalog (24 events) and `track()` | C §5.5 | Per-screen analytics (§4) |
| Route map and route files | A7.1, A7.2 | §1.2 |
| Store-update snackbars, `app.json` splash and icon values | C §4.1, C §4.5 | Copy in `SnackbarHost`; values in §2.12 |

## B1. Information architecture and adaptive navigation

### B1.1 Destinations

| Destination | Job | Root URL | Replaces |
| --- | --- | --- | --- |
| Home | Discover something to watch | `/` | `/`, the `/movies` rails, `/shows`, the hero and the footer |
| Search | Find a title or a person, or browse with filters | `/search` | The search overlay, the `/movies` grid and filter modal, `/shows`, `/browse` |
| Library | What you saved, watched, listed and opened | `/library` | `/watchlist`, `/journal`, `/history`, collections |
| You | Account, Plus, settings, about | `/you` | `/preferences`, `/upgrade` |

Movies and TV share one content model, with `type` either `movie` or `tv`. There is no Shows tab and no Anime (decision 2).

Why Search is a destination: in GA4's 90-day screens, `/movies` (2,825 views) and `/movie/*` (2,241) come right after Home (`research/data-browser.md` §2.3), and `search` is the 5th most frequent engagement event (647 events, 297 users).

Why Journal and History are not: `/journal` had 7 views and `/history` 55. They are folded into Library.

### B1.2 Route map

Route files live in root `app/` (A1). URLs are A7.2's and the authoritative file list is A7.1. Detail routes are shared by the four tab stacks so the navigation chrome stays visible.

"Shared" means the file lives in `app/(tabs)/(home,search,library,you)/` and so exists once per tab stack. This uses the documented array-group syntax (docs.expo.dev/router/advanced/shared-routes; docs.expo.dev/router/basics/common-navigation-patterns, "One screen, two tabs").

| URL | File (under `app/`) | Screen (§4) | Stack |
| --- | --- | --- | --- |
| `/` | `(tabs)/(home)/index.tsx` | Home | Home |
| `/search?q&type&genres&providers&monetization&sort&year_from&year_to&rating_min&lang` | `(tabs)/(search)/search.tsx` | Search (params per A §4.6) | Search |
| `/library` | `(tabs)/(library)/library/index.tsx` | Library › Watchlist | Library |
| `/library/watched?view=diary\|insights&year=YYYY` | `(tabs)/(library)/library/watched.tsx` | Library › Watched (Diary or Insights view) | Library |
| `/library/lists` | `(tabs)/(library)/library/lists.tsx` | Library › Lists | Library |
| `/library/recent` | `(tabs)/(library)/library/recent.tsx` | Library › Recent | Library |
| `/list/[id]` | `(tabs)/(library)/list/[id].tsx` | List detail | Library |
| `/you` | `(tabs)/(you)/you.tsx` | You | You |
| `/settings` | `(tabs)/(you)/settings/index.tsx` | Settings list (target of the v1 `/preferences` redirect) | You |
| `/settings/appearance` | `(tabs)/(you)/settings/appearance.tsx` | Theme, accent, trailer captions | You |
| `/settings/streaming` | `(tabs)/(you)/settings/streaming.tsx` | Region and services | You |
| `/settings/privacy` | `(tabs)/(you)/settings/privacy.tsx` | Privacy and data request | You |
| `/settings/account` | `(tabs)/(you)/settings/account.tsx` | Sync status, sign out, delete account | You |
| `/settings/about` | `(tabs)/(you)/settings/about.tsx` | About and legal | You |
| `/plus?source={placement}` | `(tabs)/(you)/plus.tsx` | Plus | You |
| `/title/movie/[id]` | shared `title/movie/[id].tsx` | Title (movie) | current tab |
| `/title/tv/[id]` | shared `title/tv/[id]/index.tsx` | Title (TV) | current tab |
| `/title/tv/[id]/season/[season]` | shared `title/tv/[id]/season/[season].tsx` | Season | current tab |
| `/person/[id]` | shared `person/[id].tsx` | Person | current tab |
| `/movie/[id]` (v1 movie id) | `movie/[id].tsx` (root stack) | Legacy movie resolver (§4.16) | root |
| `/show/[imdbId]` (v1) | `show/[imdbId].tsx` (root stack) | Legacy TV resolver (§4.16) | root |
| anything else | `+not-found.tsx` | Not found | root |

`[id]` is `<tmdbId>` or `<tmdbId>-<slug>`, adopted from section C §0. The `/title/` prefix removes the YTS/TMDB integer ambiguity of `/movie/<int>`. Slugs come from the server (`slugify`; an empty slug gives `/title/movie/{id}`, section A §7.2). Links are built only by `src/core/navigation/hrefs.ts` (section A): `titleHref`, `personHref`, `seasonHref`, `listHref`, `searchHref`, `shareUrl`.

There is no separate browse route. A rail's "See all" opens Search with the equivalent discover parameters, where one exists (§4.1). Rails without a discover equivalent (Trending, In theaters, New episodes) have no "See all".

### B1.3 Window classes and chrome

`src/core/ui/layout/windowClass.ts`:

```ts
export type WindowClass = 'compact' | 'medium' | 'expanded';

export const BREAKPOINTS = {medium: 600, expanded: 840, large: 1200, extraLarge: 1600} as const;

export function windowClassFor(width: number): WindowClass {
    if (width >= BREAKPOINTS.expanded) return 'expanded';
    if (width >= BREAKPOINTS.medium) return 'medium';
    return 'compact';
}
```

`useWindowClass()` reads `useWindowDimensions().width`. On web it returns `null` until hydration, using the `useSyncExternalStore` server-snapshot pattern from `presentation/hooks/use-responsive.ts:9-38`. Components may use it for behaviour (for example, sheet versus dialog). They must not use it for layout before hydration (§1.4.5).

| Class | Android | Web |
| --- | --- | --- |
| Compact (< 600) | `NavigationBar` at the bottom (64 dp + bottom inset), plus a `TopAppBar` per screen | Same; the bar is fixed to the viewport bottom |
| Medium (600–839) | `NavigationRail` on the left (80 dp), plus a `TopAppBar` per screen | Same; the rail is fixed on the left |
| Expanded (≥ 840) | `NavigationRail` (tablets, Chromebooks, unfolded foldables), plus a `TopAppBar` per screen | `WebHeader` (64 px, sticky), described below |

The `WebHeader` holds the wordmark, Home and Library links, a centred `SearchField`, a Plus link for non-members and an avatar link to You. There is no per-screen `TopAppBar`; each page renders its own H1.

Content width:

- Gutters are 16 / 24 / 32 dp by class.
- Grids and rails cap at 1,280 dp.
- Reading layouts (settings, forms, Plus, About, Season, Person biography) cap at 720 dp. Today the desktop settings rows stretch to 1,680 px (UXL-14, `PreferencesScreen.tsx:322-332`).

### B1.4 Building it with expo-router 58

#### B1.4.1 What exists in `node_modules/expo-router` (58.0.32)

| API | Path | Verdict |
| --- | --- | --- |
| JS tabs `Tabs` | `expo-router/js-tabs`; options in `build/react-navigation/bottom-tabs/types.d.ts` | **Used.** See the option list below. |
| `NativeTabs` | `expo-router/native-tabs`, `build/native-tabs/` | **Not used.** On Android it is a fixed Material bottom bar with no rail mode. On web it renders Radix tabs (`role="tablist"`, force-mounted panels, no links; `build/native-tabs/NativeTabsView.web.js`). |
| Headless tabs | `expo-router/ui` (`Tabs`, `TabList`, `TabTrigger`, `TabSlot`; `build/ui/TabTrigger.d.ts`) | **Used for Library sections only** (§1.4.4) |
| Shared routes / array groups | `build/layoutAnchor.js:127-139` reads `unstable_settings[groupName].anchor`; the group name has no parentheses (`build/matchers.js:104-106`) | **Used** |
| `Stack` with per-screen `dangerouslySingular` and `getId` | `expo-router` (`build/layouts/StackClient.d.ts`, `build/useScreens.d.ts:15-36`) | **Used** for each tab stack |
| `unstable-split-view` | `build/split-view/` | Not used (iOS-oriented) |

`Tabs` options this spec uses:

- `tabBar`, a custom render function (`types.d.ts:298`);
- `tabBarPosition: 'bottom' | 'left' | 'right' | 'top'` (`:204`);
- `backBehavior` (`build/react-navigation/routers/TabRouter.d.ts:31-42`);
- `lazy`, `popToTopOnBlur`, and `animation: 'none' | 'fade' | 'shift'`.

`import {Tabs} from 'expo-router'` is deprecated in favour of `expo-router/js-tabs` (`build/exports.d.ts:53-55`).

#### B1.4.2 Root and tabs layouts

`app/_layout.tsx` is the root stack. It holds providers only, no chrome:

```tsx
import {Stack} from 'expo-router';
import {AppRoot} from '@/features/shell/public/AppRoot';

export default function RootLayout() {
    return (
        <AppRoot>
            <Stack screenOptions={{headerShown: false}}>
                <Stack.Screen name="(tabs)"/>
                <Stack.Screen name="movie/[id]"/>
                <Stack.Screen name="show/[imdbId]"/>
                <Stack.Screen name="+not-found"/>
            </Stack>
        </AppRoot>
    );
}
```

`AppRoot` (section A §4.6) nests the design-system providers in this order, outside to inside:

1. `GestureHandlerRootView`
2. `SafeAreaProvider`
3. `QueryProvider` (A)
4. `ThemeProvider` (§2.11)
5. `SnackbarHost`
6. `ConfirmProvider`
7. `PlusSheetHost` (`features/monetization/public/PlusSheetHost.tsx`, opened by `openPaywall`)

`ConsentPrompt` (`features/settings/public/ConsentPrompt.tsx`) and `AdTransitionHost` (`features/monetization/public/AdTransitionHost.tsx`) are siblings inside the providers, and `<ReducedMotionConfig mode={ReduceMotion.System}/>` is kept from `app/_layout.tsx:138`.

There is no `OverlayProvider` or `BottomSheetModalProvider`, no `PlayerProvider` and no `PrivacyGate`.

`app/(tabs)/_layout.tsx`:

```tsx
import {Tabs} from 'expo-router/js-tabs';
import {AppTabBar} from '@/features/shell/public/AppTabBar';
import {useChromePosition} from '@/core/ui/navigation/useChromePosition';
import {DESTINATIONS} from '@/core/ui/navigation/destinations';

export default function TabsLayout() {
    const position = useChromePosition();
    return (
        <Tabs
            backBehavior="firstRoute"
            tabBar={(props) => <AppTabBar {...props}/>}
            screenOptions={{headerShown: false, tabBarPosition: position, lazy: true, animation: 'none'}}
        >
            {DESTINATIONS.map((destination) => (
                <Tabs.Screen key={destination.route} name={destination.route} options={{title: destination.label}}/>
            ))}
        </Tabs>
    );
}
```

`useChromePosition` is a platform twin in `src/core/ui/navigation/`:

- `useChromePosition.ts` (Android): `'bottom'` when `windowClassFor(width) === 'compact'`, otherwise `'left'`.
- `useChromePosition.web.ts`: always `'top'`. The web chrome positions itself with CSS (§1.4.5).

`BottomTabView` renders a `'top'` or `'left'` bar before the screens in the DOM (`build/react-navigation/bottom-tabs/views/BottomTabView.js:236,299`). On every web class the navigation therefore comes before the content for keyboard users. Today the header comes after 400 tab stops (UXL-7).

`backBehavior="firstRoute"`: Android back at the root of Search, Library or You goes to Home. At Home's root it leaves the app.

`src/core/ui/navigation/destinations.ts`:

```ts
import type {IconName} from '@/core/ui/icons/glyphs';

export interface Destination {
    route: '(home)' | '(search)' | '(library)' | '(you)';
    href: '/' | '/search' | '/library' | '/you';
    label: 'Home' | 'Search' | 'Library' | 'You';
    icon: IconName;
}

export const DESTINATIONS: readonly Destination[] = [
    {route: '(home)', href: '/', label: 'Home', icon: 'home'},
    {route: '(search)', href: '/search', label: 'Search', icon: 'search'},
    {route: '(library)', href: '/library', label: 'Library', icon: 'video_library'},
    {route: '(you)', href: '/you', label: 'You', icon: 'account_circle'},
];
```

#### B1.4.3 Shared tab stacks

`app/(tabs)/(home,search,library,you)/_layout.tsx`:

```tsx
import {Stack} from 'expo-router';
import {useReducedMotion} from 'react-native-reanimated';
import {singularById} from '@/core/navigation/singular';

export const unstable_settings = {
    anchor: 'index',
    search: {anchor: 'search'},
    library: {anchor: 'library'},
    you: {anchor: 'you'},
};

export default function TabStackLayout() {
    const reduceMotion = useReducedMotion();
    return (
        <Stack screenOptions={{headerShown: false, animation: reduceMotion ? 'none' : 'default'}}>
            <Stack.Screen name="title/movie/[id]" dangerouslySingular={singularById}/>
            <Stack.Screen name="title/tv/[id]/index" dangerouslySingular={singularById}/>
            <Stack.Screen name="person/[id]" dangerouslySingular={singularById}/>
        </Stack>
    );
}
```

- Day-1 check: open `/_sitemap` (expo-router's development sitemap) and confirm the four anchors resolve. A wrong anchor throws "The initial route name … was not found" (`build/layoutAnchor.js:137`).
- `singularById(name, params)` returns `` `${name}:${String(params.id).split('-')[0]}` ``. Opening A, then B, then A again removes the first A from history instead of stacking a second copy. UXL-9 found three mounted copies of one movie page.
- Cold links (URL bar, App Link, shared link) to a shared route open in the first group alphabetically, `(home)`, with Home's anchor below. Back therefore always has somewhere to go (documented behaviour of shared routes).
- In-app navigation keeps the current tab. A title opened from Library stays in Library, and Back returns to Library.
- Re-pressing the active destination emits `tabPress`. The nested stack pops to its anchor, and the anchor screen's main scroller scrolls to the top through `useScrollToTop(ref)` from `expo-router` (`build/exports.d.ts:31`; the `expo-router/react-navigation` export is deprecated).

Why not a root stack that pushes details above the tabs:

- On medium and expanded classes the rail and the web header would disappear on every title, season and person page.
- Keeping them would mean drawing chrome in the root layout again, which is the global-TopBar pattern this redesign deletes.

The expo-router docs list both patterns. They note that stacks inside tabs "scale well to desktop web apps, where the primary tabs are often always visible". The YIFY-36 fix is unaffected: URL writes still go only through `useUrlState().commit()` in event handlers.

#### B1.4.4 Library sections

`app/(tabs)/(library)/library/_layout.tsx` renders `LibraryLayout` from `src/features/library/screens/LibraryLayout.tsx` (A7.1), which uses the headless tabs from `expo-router/ui`:

```tsx
import {Tabs, TabList, TabSlot, TabTrigger} from 'expo-router/ui';
import {LibraryShell} from '@/features/library/components/LibraryShell';
import {SectionTab} from '@/features/library/components/SectionTab';

export function LibraryLayout() {
    return (
        <Tabs>
            <LibraryShell
                tabs={
                    <TabList>
                        <TabTrigger name="watchlist" href="/library" asChild><SectionTab label="Watchlist"/></TabTrigger>
                        <TabTrigger name="watched" href="/library/watched" asChild><SectionTab label="Watched"/></TabTrigger>
                        <TabTrigger name="lists" href="/library/lists" asChild><SectionTab label="Lists"/></TabTrigger>
                        <TabTrigger name="recent" href="/library/recent" asChild><SectionTab label="Recent"/></TabTrigger>
                    </TabList>
                }
            >
                <TabSlot/>
            </LibraryShell>
        </Tabs>
    );
}
```

- `TabTrigger asChild` passes `isFocused`, `href` and `onPress` to `SectionTab` (`build/ui/TabTrigger.d.ts:37-41`, `build/ui/TabTrigger.js:65-87`).
- Switching sections swaps the slot, so the stack does not grow.
- On web, section tabs are links with `aria-current="page"`. On Android they are `role="tab"` with `aria-selected` (§6).

#### B1.4.5 Web chrome without a known width

`AdaptiveNavigation.web.tsx` renders all three web variants: `WebHeader`, `NavigationRail` and `NavigationBar`. Each root carries `dataSet={{nav: 'header' | 'rail' | 'bar'}}`, which react-native-web turns into `data-nav` (`node_modules/react-native-web/dist/modules/createDOMProps/index.js:348-353`).

`dataSet` is not part of React Native 0.88's `ViewProps` type (`node_modules/react-native/types_generated/Libraries/Components/View/ViewPropTypes.d.ts:494`), and RN's `ViewStyle` rejects `display: 'grid'`, `gridTemplateColumns` and `clamp()` widths, so F0-C commits two small files:

```ts
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    dataSet?: Readonly<Record<string, string>>;
  }
}
```

(`src/core/ui/webProps.d.ts`) and

```ts
import type {ViewStyle} from 'react-native';

export interface WebOnlyStyle {
  display?: 'grid' | 'flex' | 'none' | 'contents';
  gridTemplateColumns?: string;
  gap?: number | string;
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
}

export function webStyle(style: WebOnlyStyle): ViewStyle {
  return style as unknown as ViewStyle;
}
```

(`src/core/ui/layout/webStyle.ts`, used only in `.web.tsx` files). The integrator typechecked both with TypeScript 7.0.2 against the installed React Native types on 2026-11-26; without the augmentation, `dataSet` fails with TS2322 (`spec/integrator-lab/types/`).

`app/+html.tsx` adds one `<style>` block, generated from tokens:

```css
[data-nav="rail"],[data-nav="bar"]{position:fixed;z-index:20}
[data-nav="rail"]{top:0;bottom:0;left:0;width:80px}
[data-nav="bar"]{left:0;right:0;bottom:0;height:calc(64px + env(safe-area-inset-bottom))}
@media (max-width:599.98px){[data-nav="header"],[data-nav="rail"]{display:none}[data-screen]{padding-bottom:calc(64px + env(safe-area-inset-bottom))}}
@media (min-width:600px) and (max-width:839.98px){[data-nav="header"],[data-nav="bar"]{display:none}[data-screen]{padding-left:80px}}
@media (min-width:840px){[data-nav="rail"],[data-nav="bar"]{display:none}}
html{scroll-padding-bottom:var(--overlay-height,0px)}
@media (max-width:599.98px){html{scroll-padding-bottom:calc(64px + env(safe-area-inset-bottom) + var(--overlay-height,0px))}}
```

- `ConsentPrompt` and `SnackbarHost` set `--overlay-height` on `document.documentElement` to their measured height while they are visible (web only), so the browser scrolls a focused element clear of them (WCAG 2.2 SC 2.4.11, coverage review issue 26).

- `ScreenScaffold` (§3.27) sets `dataSet={{screen: ''}}` on every screen root.
- `display:none` removes the hidden variants from the accessibility tree and the tab order.
- The header variant stays in normal flow, because `tabBarPosition: 'top'` already places it above the scenes.
- After hydration, JavaScript uses `useWindowClass()` only for behaviour: sheet versus dialog, and the target of the `/` shortcut.

Every other layout must be intrinsically responsive, so the same HTML is correct at any width:

- Poster grids use CSS grid `repeat(auto-fill, minmax(clamp(100px, 13vw, 168px), 1fr))` on web, through `webStyle()`, and `FlatList numColumns` on Android (§3.12). react-native-web supports the grid properties at runtime (`node_modules/react-native-web/dist/types/styles.js.flow:193-204`, a Flow file; TypeScript needs `webStyle()`).
- Two-column layouts use `flexDirection: 'row', flexWrap: 'wrap'` with `flexBasis`, `flexGrow` and `minWidth`, so the second column wraps below on narrow widths.
- Rail card widths use `clamp()` strings on web and a JS width on Android (§3.13).

Acceptance: the server HTML for `/`, `/search` and `/title/movie/<id>-<slug>`, loaded with JavaScript disabled at 360, 700 and 1,280 px wide, shows exactly one navigation variant, has no horizontal scrollbar, and has no content under the chrome.

### B1.5 Top app bars

| Screen | Compact and medium (`TopAppBar`) | Expanded web |
| --- | --- | --- |
| Home | `small`: wordmark `{APP_NAME}` (`headlineSmall`). No actions. | WebHeader only |
| Search | `search`: `SearchField` fills the bar. Trailing `sort` `IconButton` in browse mode (§4.3). | The WebHeader search field is the input. The page shows chips and results. |
| Library | `small`: "Library". Trailing `search` ("Search your library") toggles an inline filter field. | Page H1 "Library", with the same filter field |
| You | `small`: "You" | Page H1 "You" |
| Title | `overlay`: transparent over the backdrop, then solid with the title once the backdrop scrolls out. Back, plus `share` and `more_vert` ("Open on TMDB", "Copy link"). | No bar. Back is the browser's. Page H1 is the title. |
| Season, Person, List detail, Settings pages, Plus | `small` with back and the page title | Page H1 |

Rules:

- **One H1 per page.** On compact and medium, the `TopAppBar` title is the H1. On expanded web, `PageTitle` (§3.27) renders the H1 in content.
- **Back.** Calls `router.back()` from `useRouter()` when `useCanGoBack()` is true (both exported by `expo-router`, `build/exports.d.ts:2`). Otherwise it calls `router.replace(tabRootHref)`. Its accessible name is "Navigate up". There is no global `router` import (section A §1.2).
- **Height.** The bar is 64 dp plus the status-bar inset and is the only chrome above content. It replaces the 108–164 dp two-row global bar (DES-1).
- **Scroll.** After 4 dp of scroll, `small` changes from `surface` to `surfaceContainer` (tonal, no shadow) over 150 ms with standard easing, or 0 ms when reduced motion is on.

### B1.6 Back and predictive back on Android

1. **Enable the flag.** `android.predictiveBackGestureEnabled: true` (section C §4.4). The Expo plugin writes `android:enableOnBackInvokedCallback="true"` (`node_modules/@expo/config-plugins/build/android/PredictiveBackGesture.js:42`), replacing the deprecated `false` opt-out (`app.json:32`, AND-11).
2. **Overlays close on back.**
   - `Sheet`, `TrailerFrame` and `ImageViewer` are React Native `Modal`s, and back reaches `onRequestClose` (React Native 0.88 handles back in `ReactModalHostView.kt`).
   - Stacks pop through React Navigation.
   - No screen registers its own `BackHandler`. Delete `presentation/hooks/use-android-back.ts`.
3. **Known limit.** On targetSdk 36, `ReactActivity` registers an `OnBackPressedCallback(true)` that is always enabled (`node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivity.java:29-64`), and react-native-screens 4.30 has no production predictive stack transition.
   - Back works on Android 13–17 with the flag on, but the system cannot show the back-to-home peek animation.
   - A native follow-up would be a config plugin that disables the callback while JavaScript reports `!canGoBack()` at a tab root. It is out of scope (B9).
4. **Acceptance.** On Android 14 and 16, with both gesture navigation and 3-button navigation:
   - back closes an open sheet first, then the trailer, then pops the stack;
   - at the root of Search, Library or You, back goes to Home;
   - at Home, back leaves the app;
   - during an interstitial, back closes the ad and the title opens (section C §2.6).

### B1.7 Legacy URLs (destination map)

A7.3 owns the destinations and the implementation (`config/legacy-redirects.json`, `app/+middleware.ts`, `src/core/domain/legacyUrls.ts`, the resolver screens). B4.16 owns the resolver screens' visuals. App Links are in C4.1.

### B1.8 Removed navigation code

- `presentation/movies/components/TopBar.tsx` (434 lines) and `TopBarSlot.tsx`
- `presentation/movies/constants/destinations.ts`
- `presentation/components/navigation-link.tsx`
- `BlurTargetProvider`, `BlurTargetSurface` and `blur-target.tsx`
- `PlayerHost` and `PlayerProvider`
- `SearchOverlay.tsx`
- `app/_layout.tsx:150-155` (the `TopBar` rendered outside the stack)

### B1.9 Acceptance criteria (navigation)

1. Android 360×800 dp: four destinations in a bottom bar 64 dp tall plus the gesture inset. Each item is at least 48×48 dp. Labels are always visible.
2. Android 700×1000 dp and 1,280×800 dp: an 80 dp rail on the left and no bottom bar.
3. Web 1,280 px: the header comes first in the DOM after the skip link.
   - Pressing Tab from page load reaches "Skip to content", the wordmark, Home, Library, the search field, "Get Plus" (non-members) and You, in that order, within 7 presses.
   - The current link has `aria-current="page"`.
4. Web 390 px: the bottom bar is fixed and never covers the last row of content.
5. A title opened from any tab keeps that tab selected. Back returns to the previous screen in the same tab.
6. Re-pressing the active destination pops to its root, then scrolls to the top.
7. In the Home stack, Home → title A → title B → title A leaves the stack as [Home, B, A]: 2 mounted title screens, not 3 (`dangerouslySingular`).

## B2. Tokens

All tokens live in `src/core/ui/theme/`. Outside that folder, a lint rule forbids:

- literal colours (`/#[0-9a-f]{3,8}\b/i`, `rgb(`, `rgba(`, `hsl(`);
- `fontSize`, `lineHeight`, `letterSpacing` and `fontFamily` keys;
- `borderRadius` numbers other than tokens.

**Placeholder values.** Every hex value, font family and accent name in B2.1 to B2.4 and B2.12 is a v1-palette placeholder (Part 0, §0.4). The values live in `config/brand.json`, which the Identity step replaces; they are banned for release. The roles, scales, contrast rules and the token module shape are final.

The `TOKENS` selectors of A1.4 enforce this in `src/core`, `src/features` and `app`, except `src/core/ui/theme/**` and `app/+html.tsx`. Today there are 122 literal font sizes, 78 literal colours and 38 literal radii outside the theme (DES-7); the rule stops that from coming back.

### B2.1 Colour roles

**Placeholders** (Part 0, §0.4): the table carries v1's cream, ink and rust values (`presentation/constants/theme.ts`, with the contrast fixes listed in §2.2) only so the structure can be built and tested. The Identity step replaces every value in `config/brand.json` and recomputes §2.2.

| Role | Light | Dark | Used for |
| --- | --- | --- | --- |
| `surface` | `#F3F0E9` | `#1B1916` | Page background |
| `surfaceContainerLowest` | `#FBFAF6` | `#151310` | Text fields |
| `surfaceContainerLow` | `#EFEBE3` | `#211E1A` | Cards, bottom sheets |
| `surfaceContainer` | `#EBE5DA` | `#25221E` | Navigation bar and rail, scrolled top app bar, web header on scroll |
| `surfaceContainerHigh` | `#E5DED1` | `#2F2B26` | Dialogs, menus, skeletons |
| `surfaceContainerHighest` | `#E2DACC` | `#3A352F` | Pressed state of chips, slider track |
| `onSurface` | `#241F19` | `#EDE7DB` | Primary text and icons |
| `onSurfaceVariant` | `#5F5649` | `#BDB3A2` | Secondary text, meta, inactive icons. Replaces `textMuted` and `textFaint` |
| `outline` | `#7F7462` | `#958A78` | Chip, field, outlined-button and checkbox boundaries |
| `outlineVariant` | `#D4CAB9` | `#48413A` | Dividers only (decorative; no contrast requirement) |
| `primary` | `#9C452B` | `#E39A74` | Filled buttons, links, selected indicators, focus ring. One accent per mode: dark no longer fills with rust `#9C452B` |
| `onPrimary` | `#FFFFFF` | `#2B160C` | Content on `primary` |
| `primaryContainer` | `#F7DCCF` | `#7A3520` | Plus card, "Your services" highlight |
| `onPrimaryContainer` | `#5C2514` | `#FFDBCD` | Content on `primaryContainer` |
| `secondaryContainer` | `#E9DDCB` | `#4A4034` | Tonal buttons, selected chips, nav active indicator, selected segment |
| `onSecondaryContainer` | `#3B2F22` | `#F2E4D1` | Content on `secondaryContainer` |
| `error` | `#B3261E` | `#F28B7D` | Error text and icons |
| `onError` | `#FFFFFF` | `#4D0E07` | Content on `error` (destructive filled button) |
| `errorContainer` | `#F9DEDC` | `#8C1D18` | Error banners |
| `onErrorContainer` | `#410E0B` | `#FFDAD6` | Content on `errorContainer` |
| `inverseSurface` | `#2F2A24` | `#EDE7DB` | Snackbars |
| `inverseOnSurface` | `#F3F0E9` | `#2F2A24` | Snackbar text |
| `inversePrimary` | `#E39A74` | `#9C452B` | Snackbar action |
| `ratingStar` | `#9A6B12` | `#E6B450` | Star glyphs (TMDB rating and the diary rating) |
| `scrim` | `#000000` at 0.5 | `#000000` at 0.6 | Behind sheets and dialogs |
| `mediaScrim` | `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)` | same | Bottom of backdrops behind overlaid icons |
| `onMedia` | `#FFFFFF` | `#FFFFFF` | Icons over imagery, always on a 40 dp `rgba(0,0,0,0.6)` circle |
| `focusRing` | = `primary` | = `primary` | 2 dp ring, 2 dp offset |

State layers (Material 3): overlay the content colour at hover 0.08, focus 0.10 and pressed 0.10. Dragged is 0.16. Disabled content uses `onSurface` at 0.38 and disabled containers use `onSurface` at 0.12. The disabled state is never the only cue: disabled controls also set `aria-disabled`.

### B2.2 Contrast (WCAG 2.2, computed 2026-11-26)

Method: the WCAG relative-luminance formula, by `spec/B-design-ux-tools/contrast.py` and `matrix.py` (run `cd spec/B-design-ux-tools && python3 matrix.py`). "min" is the lowest ratio across all six surface roles. In both modes the minimum is on `surfaceContainerHighest`.

Text roles (need ≥ 4.5:1 on every surface they can sit on):

| Role | Light min | Light on `surface` | Dark min | Dark on `surface` |
| --- | --- | --- | --- | --- |
| `onSurface` | 11.78 | 14.36 | 9.86 | 14.24 |
| `onSurfaceVariant` | 5.19 | 6.33 | 5.86 | 8.46 |
| `primary` (links, text buttons) | 4.59 | 5.59 | 5.28 | 7.63 |
| `error` | 4.71 | 5.74 | 5.07 | 7.32 |

UI components and states (need ≥ 3:1 against adjacent colours):

| Role | Light min | Dark min |
| --- | --- | --- |
| `outline` | 3.31 | 3.57 |
| `primary` / `focusRing` | 4.59 | 5.28 |
| `ratingStar` | 3.37 | 6.36 |

On-colour pairs:

| Pair | Light | Dark |
| --- | --- | --- |
| `onPrimary` / `primary` | 6.36 | 7.48 |
| `onPrimaryContainer` / `primaryContainer` | 9.30 | 6.90 |
| `onSecondaryContainer` / `secondaryContainer` | 9.70 | 8.10 |
| `onSurfaceVariant` / `secondaryContainer` | 5.38 | 4.89 |
| `onError` / `error` | 6.54 | 6.34 |
| `onErrorContainer` / `errorContainer` | 12.77 | 7.05 |
| `inverseOnSurface` / `inverseSurface` | 12.49 | 11.54 |
| `inversePrimary` / `inverseSurface` | 6.19 | 5.17 |
| `onMedia` over a white image under the 0.6 `mediaScrim` stop (worst case `#666666`) | 5.74 | 5.74 |

Defects fixed, before → after:

| Defect | Before | After |
| --- | --- | --- |
| Dark error text `#C24234` (DES-10) | 3.44 | 7.32 (`#F28B7D`) |
| Light `textFaint` on sunken (DES-10) | 4.17 | 5.75 (`onSurfaceVariant` on `surfaceContainer`) |
| Light star (DES-10) | 2.68 | 4.11 |
| Light / dark border as a component boundary (DES-10) | 1.43 / 1.64 | 4.03 / 5.17 (`outline`; `outlineVariant` is decorative only) |
| Dark rust fill against the page (DES-1 §4.1) | 2.76 | 7.63 (dark fills use `primary` `#E39A74`) |

Non-colour state cues (WCAG 1.4.1 and 1.4.11):

- A selected chip shows a leading check icon. Its fill against the page is about 1.2:1, so the fill alone does not carry the state.
- The selected destination uses a filled icon glyph and semibold label.
- The selected segment shows a check icon.

Usage rules (enforced in review; see the matrix above):

1. `primary` text may sit on any surface role.
2. Body text never sits on imagery. Text over a backdrop (Title overlay bar title, featured card) is not allowed; only `onMedia` icons on 40 dp dark circles are.
3. `outlineVariant` is never the only boundary of an interactive control.

### B2.3 Plus accent themes

Accents replace only the primary family. Slot `default` is free; `accent1` to `accent4` are Plus benefits (decision 6). The names and values below are placeholders (Part 0, §0.4): the first column gives the slot id with its placeholder name. The minima below are on `surfaceContainerHighest`, the worst case.

| Accent | Light `primary` / `onPrimary` | Light min / on-primary | Light `primaryContainer` / `onPrimaryContainer` | Dark `primary` / `onPrimary` | Dark min / on-primary | Dark `primaryContainer` / `onPrimaryContainer` | `inversePrimary` (L / D) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default` "Rust" (free) | `#9C452B` / `#FFFFFF` | 4.59 / 6.36 | `#F7DCCF` / `#5C2514` (9.30) | `#E39A74` / `#2B160C` | 5.28 / 7.48 | `#7A3520` / `#FFDBCD` (6.90) | `#E39A74` (6.19) / `#9C452B` (5.17) |
| `accent1` "Teal" | `#00696B` / `#FFFFFF` | 4.68 / 6.50 | `#CDEDEB` / `#00403F` (9.37) | `#6FD5D3` / `#00373A` | 7.01 / 7.55 | `#005153` / `#C9F1EF` (7.52) | `#6FD5D3` (8.21) / `#00696B` (5.28) |
| `accent2` "Plum" | `#8A3F7A` / `#FFFFFF` | 4.93 / 6.83 | `#F9D8EE` / `#3E0B35` (12.33) | `#F2A7E0` / `#4A1240` | 6.58 / 7.84 | `#6D2A60` / `#FFD7F2` (7.56) | `#F2A7E0` (7.70) / `#8A3F7A` (5.55) |
| `accent3` "Forest" | `#3D6B2E` / `#FFFFFF` | 4.53 / 6.29 | `#D6EDC9` / `#0F2E07` (11.89) | `#A3D48E` / `#10380A` | 7.15 / 7.77 | `#255219` / `#C8EFB6` (7.17) | `#A3D48E` (8.37) / `#3D6B2E` (5.10) |
| `accent4` "Cobalt" | `#2F5FA8` / `#FFFFFF` | 4.55 / 6.32 | `#D9E3FA` / `#0B2552` (11.65) | `#A9C7FF` / `#0A2F66` | 7.11 / 7.63 | `#1F4785` / `#D8E2FF` (7.07) | `#A9C7FF` (8.32) / `#2F5FA8` (5.13) |

When Plus lapses, the stored accent is kept but `default` renders (section C `effectiveAccent`). If the member resubscribes, their accent returns.

A2.7's `Accent` union is `'default' | 'accent1' | 'accent2' | 'accent3' | 'accent4'`. Unknown stored values decode to `default`. The ids never change when the identity does, because preferences sync (Part 0, I-13); `config/brand.json` `accents[].name` holds the display names.

### B2.4 Typography

Font files: 3, down from 7 plus Ionicons on web. The three families below are placeholders (Part 0, §0.4): `config/brand.json` `fonts` names each face (`family`, the TTF `file` in `node_modules`, the WOFF2 `web` name), and the Android `expo-font` list (C4.1), `scripts/fonts/build-fonts.mjs` and `TypeStyle.fontFamily` all read it.

| Family | File (package path) | Weight |
| --- | --- | --- |
| `Lora_600SemiBold` | `@expo-google-fonts/lora/600SemiBold/Lora_600SemiBold.ttf` | 600 |
| `HankenGrotesk_400Regular` | `@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf` | 400 |
| `HankenGrotesk_600SemiBold` | `@expo-google-fonts/hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf` | 600 |

Dropped: Hanken 500, 700 and 800, and Lora 700 (`app/_layout.tsx:12-18`). The packages stay; only the imports go.

Loading:

- **Android:** embed with the `expo-font` config plugin `fonts: [...]` (docs.expo.dev/versions/latest/sdk/font: "On Android, the file name becomes the font family name"). Remove the `useFonts` gate that returns `null` (`app/_layout.tsx:71-72`; AND-6).
- **Web:** three WOFF2 files in `public/fonts/` built by `scripts/fonts/build-fonts.mjs` (Part W, F0.4), declared with `@font-face` and `font-display: swap` in the document CSS, with `<link rel="preload" as="font" type="font/woff2" crossorigin>` for `HankenGrotesk-400.woff2` and `Lora-600.woff2` in `+html.tsx`. Web never calls `useFonts` (Part 0, I-23). The CSS fallback stacks are `"HankenGrotesk_400Regular", system-ui, sans-serif` and `"Lora_600SemiBold", Georgia, serif`.

Never use `fontWeight`; the role picks the family.

| Role | Family | Size / line height (sp) | Letter spacing | Use |
| --- | --- | --- | --- | --- |
| `displaySmall` | Lora 600 | 36 / 44 | -0.25 | Featured title (expanded), Plus page title (expanded) |
| `headlineLarge` | Lora 600 | 32 / 40 | -0.25 | Title page H1 (expanded) |
| `headlineMedium` | Lora 600 | 28 / 36 | -0.2 | Title page H1 (compact, medium), page H1 on expanded web |
| `headlineSmall` | Lora 600 | 24 / 32 | 0 | Wordmark, featured title (compact), Plus page title, empty-state titles on large screens |
| `titleLarge` | Lora 600 | 22 / 28 | 0 | Section headers (H2), top app bar titles, dialog and sheet titles |
| `titleMedium` | Hanken 600 | 16 / 24 | 0.15 | List item headlines, card titles in lists, provider group labels |
| `titleSmall` | Hanken 600 | 14 / 20 | 0.1 | Poster card titles, tab labels |
| `bodyLarge` | Hanken 400 | 16 / 24 | 0.5 | Overview, biography, paragraphs |
| `bodyMedium` | Hanken 400 | 14 / 20 | 0.25 | Supporting text, list item supporting lines |
| `bodySmall` | Hanken 400 | 12 / 16 | 0.4 | Meta lines (year · runtime · rating), captions, attribution |
| `labelLarge` | Hanken 600 | 14 / 20 | 0.1 | Buttons, chips, segmented buttons, rail labels |
| `labelMedium` | Hanken 600 | 12 / 16 | 0.5 | Navigation bar labels (selected), ranked-rail captions |
| `labelMediumRegular` | Hanken 400 | 12 / 16 | 0.5 | Navigation bar labels (unselected) |
| `labelSmall` | Hanken 600 | 11 / 16 | 0.5 | Badges. 11 sp is the floor (removes 8–9 px badges, DES-22) |

Ratings: a TMDB score is written `★ 7.8` (one `ratingStar` glyph, a number on a 10-point scale). A diary rating is written as five star glyphs with halves (`★★★½☆`). The two scales never share a format (fixes UXL-15).

### B2.5 Spacing, layout and breakpoints

```ts
export const space = {none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64} as const;
export const layout = {
    gutter: {compact: 16, medium: 24, expanded: 32},
    maxContentWidth: {grid: 1280, reading: 720, titleMain: 760, titleAside: 320},
    navigationBarHeight: 64,
    navigationRailWidth: 80,
    topAppBarHeight: 64,
    webHeaderHeight: 64,
    minTouchTarget: 48,
    posterMinWidth: {compact: 100, medium: 120, expanded: 144},
    railPosterWidth: {compact: 112, medium: 128, expanded: 160},
    gridGap: {compact: 12, medium: 16, expanded: 16},
} as const;
```

The breakpoints are the Material 3 window size classes. The 600 and 840 values replace today's 10 ad hoc breakpoints (DES-16).

### B2.6 Shape

```ts
export const shape = {none: 0, extraSmall: 4, small: 8, medium: 12, large: 16, extraLarge: 28, full: 9999} as const;
```

| Element | Token |
| --- | --- |
| Badges | `extraSmall` |
| Chips, provider logos in badges | `small` |
| Posters, backdrops, cards, provider tiles, list thumbnails (unified; today posters are 16 and cards 12) | `medium` |
| Search field (expanded web), menus | `large` |
| Dialogs, bottom-sheet top corners | `extraLarge` |
| Buttons, icon buttons, segmented button ends, nav indicator, compact search field, avatars | `full` |

### B2.7 Elevation

Surfaces are tonal (`surfaceContainer*`). Shadows appear only on floating layers:

- level 0: flat content.
- level 2: snackbar, menus, `boxShadow: '0 2px 6px rgba(0,0,0,0.24)'`.
- level 3: dialogs and sheets, `boxShadow: '0 4px 16px rgba(0,0,0,0.28)'`.

`boxShadow` is supported by React Native 0.88 (`node_modules/react-native/types_generated/Libraries/StyleSheet/StyleSheetTypes.d.ts:772`) and react-native-web (`dist/exports/StyleSheet/preprocess.js:57-59`). There is no glass and no blur.

### B2.8 Motion

```ts
export const motion = {
    duration: {short1: 50, short2: 100, short3: 150, short4: 200, medium1: 250, medium2: 300, medium4: 400, long2: 500},
    easing: {
        standard: [0.2, 0, 0, 1],
        standardDecelerate: [0, 0, 0, 1],
        standardAccelerate: [0.3, 0, 1, 1],
        emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
        emphasizedAccelerate: [0.3, 0, 0.8, 0.15],
    },
} as const;
```

Easings are applied with Reanimated `Easing.bezier(...)`.

| Transition | Duration | Easing |
| --- | --- | --- |
| State layers, colour changes | `short3` | `standard` |
| Sheet / dialog enter | `medium2` | `emphasizedDecelerate` |
| Sheet / dialog exit | `short4` | `emphasizedAccelerate` |
| Snackbar in / out | `short4` / `short3` | `standardDecelerate` / `standardAccelerate` |
| Stack push / pop (Android) | native `animation: 'default'` | platform |
| Tab switch | none | — |
| Skeleton pulse (opacity 0.55 ↔ 1) | 1,200 ms loop | ease-in-out |

Removed: per-item stagger and pop entrances (`enterRise`, `enterPop`, `staggerDelay`), the hero auto-rotation and trailer autoplay (DES-4), and scale-on-press.

Reduced motion:

- keep `<ReducedMotionConfig mode={ReduceMotion.System}/>` at the root;
- every component that animates reads `useReducedMotion()` (Reanimated) and uses duration 0;
- the skeleton pulse becomes static;
- stacks use `animation: 'none'`.

### B2.9 Icons

Icons are **Material Symbols Rounded**: weight 400, grade 0, optical size 24, two fills (outline `FILL 0` and filled `FILL 1`). They replace Ionicons, which are iOS-style outlines on Android (DES-1 §4.2) and a 390 KB TTF on every web load (WEB-7).

- Android uses a subset icon font.
- Web uses inline SVG, so no icon font loads at all. This matches section C §8.5: at most 3 WOFF2 text faces and SVG icons on web.

Glyph list (`src/core/ui/icons/glyphs.ts`, `export type IconName = ...`). All 54 names were verified in the pinned codepoints file:

`home search video_library account_circle arrow_back close more_vert share play_arrow bookmark bookmark_add bookmark_added check_circle playlist_add playlist_add_check star star_half arrow_drop_down expand_more expand_less check tune sort history cloud_off error refresh open_in_new delete edit add chevron_right chevron_left public movie tv person lock workspace_premium palette logout info policy calendar_month replay image photo_library schedule trending_up link notes dark_mode light_mode brightness_auto`

Filled variants are used for: `home`, `search`, `video_library`, `account_circle` (selected destination), `bookmark` (on watchlist), `check_circle` (watched), `star` (rating).

Build: `scripts/icons/build-icons.mjs` (written in F0; the glyph list below is owned by this part). All sources are pinned to `google/material-design-icons` at commit `10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7` (2026-10-23), Apache-2.0.

- **Android font.**
  - Download `variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf` and `.codepoints`.
  - Verify the git blob SHA-1s: `ff99804f914a1db645bcf066dafa9449d9196f8d` (ttf) and `00d0111f220582144a76a352fd62d62b7e421e70` (codepoints).
  - Instance with `subset-font` `variationAxes: {FILL: 0 | 1, GRAD: 0, opsz: 24, wght: 400}`, keeping only the listed codepoints.
  - Write `src/core/ui/icons/YifyIcons.ttf`, `YifyIconsFilled.ttf` and `glyphMap.json` (name → codepoint).
- **Web SVG.**
  - Download `symbols/web/<name>/materialsymbolsrounded/<name>_24px.svg`, plus `<name>_fill1_24px.svg` for the filled set. Each file is one `<path>` in `viewBox="0 -960 960 960"`; verified for `bookmark` at the pinned commit.
  - Write `src/core/ui/icons/glyphPaths.web.ts` as `Record<IconName, {outline: string; filled?: string}>`.
- The generated files are committed.
- New devDependency: `subset-font` **2.9.0**, used only by this script (`npm view subset-font version` → 2.9.0, published 2026-09-20; `targetFormat` and `variationAxes` options documented in its README).
- Fallback for Android if the script is not ready by the first build: `@expo/vector-icons/MaterialIcons` with an explicit name map onto the same `IconName` union. It costs about the same as today's Ionicons.

Rendering:

- `Icon.tsx` (Android): `createIconSet(glyphMap, 'YifyIcons', require('./YifyIcons.ttf'))` from `@expo/vector-icons/createIconSet` (`node_modules/@expo/vector-icons/createIconSet.d.ts`; signature `build/createIconSet.d.ts:84`). The filled set comes from a second icon set.
- `Icon.web.tsx`: `<svg viewBox="0 -960 960 960" width={size} height={size} aria-hidden="true" focusable="false"><path d={path} fill="currentColor"/></svg>`, with `color` from the theme.

Sizes: 24 dp by default, 20 dp in chips and dense rows, 18 dp in chip check marks, 48 dp in empty states. Icons are decorative (`aria-hidden`) unless they stand alone, and then the surrounding control carries the label.

### B2.10 Imagery

`Artwork` (§3.0.4) builds every URL with section A's `imageUrl(path, size)` (`src/core/ui/images.ts`, A §3.5). That function covers the direct `image.tmdb.org` URL, the automatic per-device proxy fallback and host-health reporting. `Artwork` reports `onLoad` and `onError` to `imageHost.ts`.

Sizes by use follow A §3.5. They are TMDB `/configuration` rungs (developer.themoviedb.org/reference/configuration-details, read 2026-11-26):

| Use | Size |
| --- | --- |
| Posters in rails and grids; Title poster | `w342` |
| Row thumbnails (≤ 64 dp) | `w154` |
| Backdrops | `w780` on compact, `w1280` from 840 dp |
| Stills | `w300` |
| Profiles | `w185` |
| Provider logos | `w92` |

- Posters 2:3, backdrops 16:9, stills 16:9, profiles 2:3 (circle-cropped in avatars), logos 1:1.
- Placeholder: a `surfaceContainerHigh` block. After an error, the block shows the title text in `titleSmall`, `onSurfaceVariant`, centred, max 3 lines.
- `transition={motion.duration.short4}`, or 0 when reduced motion is on.
- `recyclingKey` = TMDB path.
- Props verified in `node_modules/expo-image/build/Image.types.d.ts:121-400`.

### B2.11 Token module shape

`src/core/ui/theme/tokens.ts`:

```ts
import type {Accent} from '@/core/domain/preferences';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';
export type AccentName = Accent;

export interface ColorRoles {
    surface: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    onSurface: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
    ratingStar: string;
    scrim: string;
    mediaScrim: string;
    onMedia: string;
    focusRing: string;
}

export type AccentRoles = Pick<ColorRoles, 'primary' | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer' | 'inversePrimary' | 'focusRing'>;

export type TypeRole =
    | 'displaySmall' | 'headlineLarge' | 'headlineMedium' | 'headlineSmall'
    | 'titleLarge' | 'titleMedium' | 'titleSmall'
    | 'bodyLarge' | 'bodyMedium' | 'bodySmall'
    | 'labelLarge' | 'labelMedium' | 'labelMediumRegular' | 'labelSmall';

export interface TypeStyle {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
}

export interface Tokens {
    colors: Record<ColorScheme, ColorRoles>;
    accents: Record<AccentName, Record<ColorScheme, AccentRoles>>;
    accentNames: Record<AccentName, string>;
    plusAccents: readonly AccentName[];
    type: Record<TypeRole, TypeStyle>;
    space: typeof space;
    shape: typeof shape;
    layout: typeof layout;
    motion: typeof motion;
    stateLayer: {hover: 0.08; focus: 0.1; pressed: 0.1; dragged: 0.16; disabledContent: 0.38; disabledContainer: 0.12};
}

export declare const tokens: Tokens;
```

`tokens.ts` builds `colors`, `accents`, `accentNames` and the type families from `brand` (`src/core/config/brand.ts`, Part 0 §0.4); no hex literal appears in `src/core/ui/theme/**` outside what `brand` supplies, and `ColorRoles` has exactly the keys of `BrandColorRole`. `src/core/ui/theme/ThemeProvider.tsx` takes `preference: ThemePreference` and `accent: AccentName` props and resolves the OS scheme (`useColorScheme` from react-native). `AppRoot` passes `usePreferences((p) => p.theme)` and `effectiveAccent({stored: usePreferences((p) => p.accent), status: usePlus().status, fallback: 'default'})`, because `core/ui` cannot import features. It exposes:

```ts
export interface Theme {
    scheme: ColorScheme;
    accent: AccentName;
    colors: ColorRoles;
    type: Tokens['type'];
    space: Tokens['space'];
    shape: Tokens['shape'];
    layout: Tokens['layout'];
    motion: Tokens['motion'];
}
export declare function useTheme(): Theme;
```

Platform behaviour:

- **Android:** `colors` are hex values from `tokens.colors[scheme]`, merged with `tokens.accents[accent][scheme]`.
- **Web** (`ThemeProvider.web.tsx`): `colors` are CSS variable references (`'var(--c-surface)'`), and react-native-web passes such strings through unchanged. `+html.tsx` emits, all generated from `tokens` at render time:
  - `:root` and `[data-theme="dark"]` with the dark values (the default);
  - `[data-theme="light"]` with the light values;
  - `@media (prefers-color-scheme: light) {[data-theme="system"] {…light…}}`;
  - `[data-accent="accent1" | …]` overrides of the accent roles.
- **Theme changes on web:** the provider sets `document.documentElement.dataset.theme` and `.dataset.accent`. Server HTML renders dark, the default, and theme changes do not re-render the tree.
- Components that need a literal colour on web (for example `expo-image` placeholder, `<meta name="theme-color">`) read `tokens.colors[scheme]` directly.
- The default theme stays `dark` (section A §2.7 `DEFAULT_PREFERENCES`; brand continuity, design research §10.4). `system` and `light` are options.
- On web, an inline script in the document (`WebDocument`, C3.2) reads `localStorage['v2.prefs']` (envelope `{v, d: {values, stamps}}`) before first paint and sets `data-theme`; it sets `data-accent` only when `localStorage['plus.entitlement.v1']` holds an active, unexpired entitlement, so a user who chose light sees no dark flash.

### B2.12 Brand surfaces outside the React tree

All derived from `config/brand.json`, ending today's colour drift (DES-18) and replacing `#D97757` everywhere (AND-11):

| Surface | Value |
| --- | --- |
| Splash (`expo-splash-screen` plugin, colours set by `app.config.js`) | `colors.light.surface`; `dark.backgroundColor` = `colors.dark.surface` |
| Adaptive icon | foreground and monochrome layers from `scratchpad/icons-v2/final/` (Identity step, or F0-A when it already exists); `backgroundColor` = `androidIconBackground`; no background image (decision 13) |
| Android `primaryColor` | the `default` accent's light `primary` (replaces template `#023c69`) |
| `<meta name="theme-color">` | `colors.dark.surface` in server HTML (dark default); the theme script switches it to `colors.light.surface` when the resolved scheme is light |
| PWA manifest `background_color` / `theme_color` | `colors.dark.surface`, written by `yarn brand:stamp` |
| Static legal pages | `public/brand.css` (`--c-*` variables) written by `yarn brand:stamp`; `public/legal.css` (stream C) uses only those variables |
| System bars | `expo-navigation-bar` `setStyle` follows `scheme`. `expo-system-ui` background = `surface` (port `presentation/components/system-bars.tsx`). |

## B3. Component kit

Location: `src/core/ui/components/<Name>.tsx`, one component per file; navigation chrome in `src/core/ui/navigation/`. Feature code imports them directly (decision 10: no barrels). Exceptions (Part 0, I-33): `ProviderRow` and `ImageViewer` live in `src/features/title/components/`, `StarRating` and `DatePickerSheet` in `src/features/library/components/`, and `TrailerFrame` in `src/features/player/public/`; their contracts below are unchanged.

Rules for every component:

- **Targets.** Interactive targets are at least 48×48 dp on Android. Where the visual is smaller (40 dp buttons, 32 dp chips), `hitSlop` extends it. On web the minimum is 40×40 px (WCAG 2.5.8 asks for 24).
- **Android feedback.** `android_ripple` (bounded, colour = content colour at 0.10) on every pressable; there is none in the repo today (DES-1 §4.2).
- **Web feedback.**
  - Hover state layer at 0.08.
  - A `:focus-visible` ring from one global rule in `+html.tsx`: `[data-focusable]:focus-visible{outline:2px solid var(--c-focusRing);outline-offset:2px}`.
  - Every `Touchable` sets `dataSet={{focusable: ''}}`.
- **Android keyboard and D-pad focus.** `outlineWidth: 2`, `outlineColor: focusRing`, `outlineOffset: 2`, `outlineStyle: 'solid'` while focused (`StyleSheetTypes.d.ts:754-757`).
- **Semantics.** Use `role` and `aria-*` props, not `accessibilityState`. react-native-web 0.21 drops `accessibilityState` (UXL-7: the selected chip exposed no state), but maps `aria-checked`, `aria-selected`, `aria-expanded`, `aria-current`, `aria-level`, `aria-pressed` and `aria-haspopup` (`node_modules/react-native-web/dist/modules/createDOMProps/index.js:3,186-281`). React Native 0.88 types `role` and most `aria-*` props (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:15,100-281`).
- **Web-only ARIA.** Props React Native does not type (`aria-current`, `aria-level`, `aria-pressed`, `aria-haspopup`) come from twin helpers in `src/core/ui/a11y.ts` / `a11y.web.ts`:

```ts
export declare function headingProps(level: 1 | 2 | 3): TextProps;
export declare function currentPageProps(current: boolean): ViewProps;
export declare function toggleProps(pressed: boolean): ViewProps;
export declare function popupProps(expanded: boolean): ViewProps;
```

Native: `headingProps` → `{role: 'heading'}`; `currentPageProps` → `{role: 'tab', 'aria-selected': current}`; `toggleProps` → `{accessibilityRole: 'togglebutton', 'aria-checked': pressed}`; `popupProps` → `{'aria-expanded': expanded}`. Web: `{role: 'heading', 'aria-level': level}`, `{'aria-current': current ? 'page' : undefined}`, `{role: 'button', 'aria-pressed': pressed}`, `{'aria-haspopup': 'dialog', 'aria-expanded': expanded}`.

### B3.0 Primitives

#### B3.0.1 `Text`

```ts
interface TextProps extends Omit<RNTextProps, 'style'> {
    variant: TypeRole;
    color?: keyof ColorRoles;
    align?: 'auto' | 'left' | 'center' | 'right';
    style?: StyleProp<Omit<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontWeight' | 'color'>>;
}
```

- The default `color` is `onSurface`.
- `allowFontScaling` stays true. `maxFontSizeMultiplier` is set only by `NavigationBar` labels (1.5) and `Badge` (1.3) (§6.4).
- `Heading` = `Text` + `headingProps(level)`.
- Replaces: `ThemedText` (10 types, 595 uses), `Typography`, `FontFamily`, `use-theme-color.ts`.

#### B3.0.2 `Icon`

```ts
interface IconProps {
    name: IconName;
    size?: 18 | 20 | 24 | 48;
    filled?: boolean;
    color?: keyof ColorRoles;
}
```

The default `color` is `onSurfaceVariant`. Always `aria-hidden`. Replaces: `Ionicons` imports (44 sites) and `IconSymbol`.

#### B3.0.3 `Touchable`

```ts
interface TouchableProps extends Omit<PressableProps, 'style' | 'children' | 'onPress'> {
    onPress?: () => void;
    href?: string;
    contentColor?: keyof ColorRoles;
    shape?: keyof Tokens['shape'];
    ripple?: 'bounded' | 'borderless' | 'none';
    style?: StyleProp<ViewStyle>;
    children: ReactNode;
}
```

- Wraps `PlatformPressable` from `expo-router/react-navigation` (`build/react-navigation/elements/PlatformPressable.d.ts`). That already gives:
  - `href` anchors on web, which react-native-web renders as `<a>` with `role="link"`;
  - modifier-key and middle-click passthrough (`PlatformPressable.js:96-114`);
  - Android ripple (`:133-136`);
  - a hover overlay through `hoverEffect` (`:160-190`).
- Adds the focus ring, `shape` clipping and state-layer colours.
- Navigation: with `href` and no `onPress`, a press calls `useRouter().push(href)`; on web a plain click is intercepted and modifier or middle clicks keep the browser default. With `onPress`, the caller navigates.
- Replaces: `PressableScale` (305 uses). Scale-on-press is dropped.

#### B3.0.4 `Artwork`

```ts
interface ArtworkProps {
    kind: 'poster' | 'backdrop' | 'profile' | 'logo' | 'still';
    path: string | null;
    size: ImageSize;
    width: number | string;
    alt: string;
    decorative?: boolean;
    fallbackLabel?: string;
    rounded?: keyof Tokens['shape'];
    fit?: 'cover' | 'contain';
    priority?: 'low' | 'normal' | 'high';
}
```

- Built on `expo-image` with `imageUrl(path, size)` and the sizes by use in §2.10. `ImageSize` comes from `src/core/ui/images.ts` (section A §3.5).
- When `decorative`, `alt=""` and `aria-hidden`. Card images are decorative because the card's link carries the name.
- Replaces: `Thumbnail.tsx`, `thumbFor`/`thumbCandidates` (YTS URL logic) and `moviePosterLayout.ts`.

#### B3.0.5 `Scrim`

```ts
interface ScrimProps {
    direction: 'toBottom' | 'toTop' | 'toRight';
    from?: string;
    to?: string;
    style?: StyleProp<ViewStyle>;
}
```

Uses `backgroundImage: 'linear-gradient(...)'`, supported natively in React Native 0.88 (`StyleSheetTypes.d.ts:775`) and by react-native-web. Port and simplify `presentation/components/linear-gradient.tsx`; the `experimental_backgroundImage` switch is no longer needed.

### B3.1 `Button`

Replaces: `PaywallButton`, `ControlButton`, `WatchlistControlButton`, `Pill` (`WatchActions.tsx`), `Action` (journal), `HeroIconButton`, the text CTAs in `PlayStoreButton`, and 49 ad hoc button style blocks in 36 files (DES-7).

```ts
type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'destructive';

interface ButtonProps {
    label: string;
    onPress?: () => void;
    href?: string;
    variant?: ButtonVariant;
    size?: 'medium' | 'large';
    icon?: IconName;
    iconFilled?: boolean;
    pressed?: boolean;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    accessibilityLabel?: string;
    testID?: string;
}
```

Visual:

- Height 40 dp (`medium`) or 48 dp (`large`); radius `full`.
- Horizontal padding 24 dp, or 16 dp on the icon side.
- Icon 18 dp, gap 8 dp, label `labelLarge`.

Colours:

| Variant | Container | Content | Border |
| --- | --- | --- | --- |
| filled | `primary` | `onPrimary` | none |
| tonal | `secondaryContainer` | `onSecondaryContainer` | none |
| outlined | transparent | `primary` | 1 dp `outline` |
| text | transparent | `primary` | none |
| destructive | `error` | `onError` | none |

States:

- **Toggle** (`pressed` defined): uses `toggleProps(pressed)`. The icon switches to its filled glyph when pressed, and callers change the label ("Watchlist" → "On watchlist").
- **Loading:** a 18 dp spinner replaces the icon, the label stays, and `aria-busy`.
- **Disabled:** 0.38 content and 0.12 container, plus `aria-disabled`.

`medium` adds `hitSlop={{top: 4, bottom: 4}}` on Android. With `href`, the button renders an anchor on web.

### B3.2 `IconButton`

```ts
interface IconButtonProps {
    icon: IconName;
    label: string;
    onPress?: () => void;
    href?: string;
    variant?: 'standard' | 'filled' | 'tonal' | 'outlined' | 'media';
    selected?: boolean;
    disabled?: boolean;
}
```

- Visual 40 dp circle; target 48 dp (`hitSlop` 4).
- The `media` variant is a 40 dp circle filled `rgba(0,0,0,0.6)` with an `onMedia` icon. It is the only control allowed over imagery.
- `label` is required (TypeScript) and becomes `aria-label`.
- `selected` uses `toggleProps` and the filled glyph.
- Replaces: `IconButton` in `MiniBar`, player overlay buttons (36 dp, UXL "player overlay buttons 36x36"), the search clear button and the 36 dp poster overlay ✓/⋯ buttons.

### B3.3 `Chip`

```ts
interface ChipProps {
    kind: 'assist' | 'filter' | 'dropdown' | 'input';
    label: string;
    selected?: boolean;
    value?: string | null;
    icon?: IconName;
    expanded?: boolean;
    onPress?: () => void;
    href?: string;
    onRemove?: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
}
```

Visual: height 32 dp (`hitSlop` 8 vertically → 48 dp target), radius `small`, horizontal padding 16 dp (12 dp next to an icon), label `labelLarge`.

| Kind | Look | Semantics |
| --- | --- | --- |
| assist | 1 dp `outline`, `onSurfaceVariant` label, optional leading icon. Used for genres on a title and genre links on Home | `role="link"` (with `href`) or `button` |
| filter | Unselected: `outline` border. Selected: `secondaryContainer` fill, leading 18 dp `check` | `role="checkbox"`, `aria-checked` |
| dropdown | Trailing `arrow_drop_down`. With `value`: selected styling and label `value` (e.g. "Drama") | `role="button"`, `popupProps(expanded)`, name "{label}: {value or 'any'}" |
| input | Selected styling plus a trailing 32 dp remove `IconButton` ("Remove {label}") as a separate focusable | chip `role="button"` |

Replaces four chip styles (DES-7: `ChipBar`, `MovieFilterModal`, `AnimeScreen`, `WatchlistControls`). The UXL-7 defect (selection not exposed) is fixed by `aria-checked`.

### B3.4 `SegmentedButton`

```ts
interface SegmentedButtonProps<T extends string> {
    value: T;
    options: readonly {value: T; label: string; icon?: IconName}[];
    onChange: (value: T) => void;
    accessibilityLabel: string;
}
```

- 2–5 segments; height 40 dp (48 dp target); 1 dp `outline` borders.
- Selected segment: `secondaryContainer` fill with a leading `check`.
- `role="radiogroup"` with child `role="radio"` and `aria-checked`. Web uses a roving `tabIndex`: Arrow keys move and select, Home and End jump.

Used by:

- Home "Popular" toggle (Movies / TV);
- Theme (System / Light / Dark);
- Person filmography department;
- Insights year.

Replaces: Journal/Insights pills and the Monthly/All-time control (UXL-15: two different selected styles).

### B3.5 `SearchField`

```ts
interface SearchFieldProps {
    value: string;
    onChangeText: (text: string) => void;
    onSubmit?: (text: string) => void;
    onFocus?: () => void;
    variant: 'appBar' | 'header';
    autoFocus?: boolean;
    inputRef?: Ref<TextInput>;
    placeholder?: string;
}
```

- `appBar` is 56 dp tall with radius `full`. `header` is 44 px tall and max 560 px wide, with radius `large`. Both use a `surfaceContainerHigh` fill.
- Leading `search` icon. A trailing "Clear search" `IconButton` appears only when `value` is set.
- The placeholder is `onSurfaceVariant` (≥ 5.19:1). Today it is `textFaint` on sunken at 4.17:1.
- `TextInput` props:
  - `role="searchbox"`;
  - `aria-label="Search movies, TV shows and people"`;
  - `inputMode="search"`, `enterKeyHint="search"`, `returnKeyType="search"`;
  - `autoCapitalize="none"`, `autoCorrect={false}`.
- The wrapper has `role="search"` (a landmark).
- Default placeholder: "Search movies, TV shows and people".
- Replaces four search UIs (DES-9): the `TopBar` pill, `SearchOverlay`, the Watchlist field and the Anime field.

### B3.6 `TextField`

```ts
interface TextFieldProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    multiline?: boolean;
    maxLength?: number;
    showCounter?: boolean;
    helper?: string;
    error?: string | null;
    placeholder?: string;
    autoFocus?: boolean;
    inputRef?: Ref<TextInput>;
}
```

- Persistent label above the field (`labelLarge`, `onSurfaceVariant`). Field min height 56 dp, `surfaceContainerLowest` fill, 1 dp `outline` border (2 dp `primary` when focused). Multiline min height 120 dp.
- Helper or error text below (`bodySmall`). The counter "12/60" is right-aligned.
- The error uses `error` colour and is announced: `aria-live="polite"` on web, `AccessibilityInfo.announceForAccessibility` on Android.
- Used for: diary note, list name, "Custom year" range.

### B3.7 `Sheet`, `ActionSheet`, `ConfirmDialog`

Decision: build on React Native `Modal` and **remove `@gorhom/bottom-sheet`** (5.2.14; 147 KB raw / 31 KB gzip of web JS, WEB-7; plus `BottomSheetModalProvider`).

Why:

- On web, react-native-web's `Modal` already provides `aria-modal`, `role="dialog"`, a focus trap, Escape → `onRequestClose` and focus restore to the opener. It spreads other props, so `aria-labelledby` works (`node_modules/react-native-web/dist/exports/Modal/ModalContent.js:18-49`, `ModalFocusTrap.js:66-121`).
- On Android, `onRequestClose` handles back.
- React Native 0.88 `Modal` supports `statusBarTranslucent`, `navigationBarTranslucent` and `backdropColor` (`node_modules/react-native/Libraries/Modal/Modal.js:51-184`).
- One implementation serves both presentations. Today there are five copies with snap points of 100%, 80%, 72% and dynamic, and the 100% filter sheet cannot be closed on phones (UXL-10).

```ts
interface SheetProps {
    open: boolean;
    onClose: () => void;
    title: string;
    presentation?: 'auto' | 'sheet' | 'dialog' | 'fullscreen';
    dismissible?: boolean;
    footer?: ReactNode;
    width?: 'standard' | 'wide';
    children: ReactNode;
    testID?: string;
}
```

Presentation:

- `auto` is a bottom sheet on compact and a centred dialog on medium and expanded.
- **Bottom sheet:**
  - `surfaceContainerLow`, top radius `extraLarge`, max height 90% of the window;
  - a 4×32 dp drag handle on a 48 dp tall touch zone;
  - a header row: `titleLarge` title (`nativeID` used for `aria-labelledby`) plus a Close `IconButton`, always visible;
  - a scrolling body and a sticky footer with the bottom safe-area inset.
- **Dialog:**
  - `surfaceContainerHigh`, radius `extraLarge`;
  - width 560 dp (`standard`) or 720 dp (`wide`), max height 85%;
  - the same header and footer.
- **Fullscreen** (trailer and image viewer on compact): black background and edge-to-edge, with the Close button outside the media.

Dismissal when `dismissible` (the default):

- Close button, scrim tap, Android back, Escape (web);
- dragging the handle down more than 25% of the sheet height, or with velocity above 800 dp/s.

Drag uses `usePanGesture` + `GestureDetector` from react-native-gesture-handler 3.5.0 (`lib/typescript/v3/hooks/gestures/pan/usePanGesture.d.ts`). On Android the sheet content is wrapped in `GestureHandlerRootView`, as gestures inside `Modal` require.

Other behaviour:

- Motion per §2.8: `animationType="none"`, and Reanimated runs enter and exit so the exit plays before `visible=false`.
- Keyboard: the body is wrapped in `KeyboardAvoidingView behavior="padding"`. Acceptance: with the IME open at font scale 2.0 on 360×640 dp, the focused field and the primary action stay visible.
- A focus trap keeps focus inside. On close, focus returns to the opener (react-native-web).

`ActionSheet`:

```ts
interface ActionSheetProps {
    open: boolean;
    onClose: () => void;
    title: string;
    actions: readonly {icon: IconName; label: string; onPress: () => void; destructive?: boolean}[];
}
```

- Renders `ListItem`s in a `Sheet`.
- It replaces overflow menus: `more_vert` on Title, MediaCard quick actions, list detail and Recent.

`ConfirmDialog`:

- Keeps today's API: `useConfirm()(request: {title, message, confirmLabel, cancelLabel?, destructive?, onConfirm, onCancel?})` from `presentation/components/confirm-dialog.tsx:44-66`.
- It now renders `Sheet presentation="dialog"` on every width.
- The "no system dialogs" rule (`Alert.alert` and `window.confirm` are banned) stays.
- It is used only for: delete account, sign out (it removes synced data from the device; section A, A11), and leaving a diary sheet with unsaved changes.

Replaces: `MovieFilterModal.tsx`, `PickerSheet.tsx`, `WatchlistSheet.tsx`, `TorrentNoticeSheet.tsx`, `confirm-dialog.tsx` and the paywall `Modal` in `supporter-paywall.tsx`.

### B3.8 `SnackbarHost`

```ts
interface SnackbarRequest {
    message: string;
    action?: {label: string; onPress: () => void};
    tone?: 'neutral' | 'error';
    duration?: 'short' | 'long' | 'indefinite';
    key?: string;
}
export declare function useSnackbar(): {show(request: SnackbarRequest): void; dismiss(key?: string): void};
export declare function useUndoSnackbar(): (message: string, undo: () => void) => void;
```

Queue and timing:

- One snackbar is visible at a time. A new one replaces the current one. When an Undo snackbar is replaced, its undo window closes, and the earlier action stays committed.
- Durations:
  - `short`: 4 s, no action;
  - `long`: 8 s, the default with an action;
  - `indefinite`: until dismissed.
- The timer pauses while the snackbar is hovered or holds focus (web) and while a screen reader is running (`AccessibilityInfo.isScreenReaderEnabled()`), which extends it to 12 s.
- While a trailer is open (`usePlayerOpen()` from `src/core/ui/overlays.ts`), the host queues new snackbars and shows them after the trailer closes: YouTube forbids overlays on the player (B5.1). `TrailerFrame` calls `setPlayerOpen(true | false)`; `ConsentPrompt` and `PlusSheetHost` read the same flag and wait.
- On web the host sets `--overlay-height` while visible (§1.4.5).

Look:

- `inverseSurface` container, `inverseOnSurface` text (`bodyMedium`, max 2 lines), action in `inversePrimary` `labelLarge`; radius `extraSmall`; level-2 shadow.
- Position, compact: full width minus 16 dp gutters, max 560 dp, 8 dp above the `NavigationBar`. Medium and expanded: bottom-left of the content area (offset by rail width + 24 dp, or 24 px on web expanded), max 480 dp.
- The OfflineBanner is inline (§3.27), so nothing else shares the anchor. Today three snackbars share one anchor and overlap (DES-7).

Announcements:

- Web: `role="status"` with `aria-live="polite"`, or `role="alert"` for `error`.
- Android: `AccessibilityInfo.announceForAccessibility(message + (action ? ', ' + action.label + ' available' : ''))`.

Replaces: `toast.tsx`, `offline-banner.tsx` (overlay part) and `update-snackbar.tsx`.

### B3.9 `ListItem`

```ts
type ListLeading =
    | {kind: 'icon'; icon: IconName}
    | {kind: 'avatar'; name: string; photoUrl?: string | null}
    | {kind: 'artwork'; artworkKind: 'poster' | 'profile' | 'still' | 'logo'; path: string | null; alt: string}
    | {kind: 'none'};
type ListTrailing =
    | {kind: 'chevron'}
    | {kind: 'text'; text: string}
    | {kind: 'switch'; value: boolean; onValueChange: (value: boolean) => void}
    | {kind: 'check'; checked: boolean}
    | {kind: 'iconButton'; icon: IconName; label: string; onPress: () => void}
    | {kind: 'none'};

interface ListItemProps {
    headline: string;
    supporting?: string;
    overline?: string;
    leading?: ListLeading;
    trailing?: ListTrailing;
    onPress?: () => void;
    href?: string;
    destructive?: boolean;
    disabled?: boolean;
}
```

- Min height 56 dp (1 line), 72 dp (2 lines) or 88 dp (3 lines); 16 dp horizontal padding.
- Headline `bodyLarge` (`onSurface`, or `error` when `destructive`); supporting `bodyMedium` `onSurfaceVariant`.
- Switch and check rows toggle on a press anywhere in the row. The row carries `role="switch"` or `role="checkbox"` with `aria-checked`, and the inner control is `aria-hidden`. Today the switch and label are separate targets.
- Height grows with font scale (min heights only).
- Replaces: Preferences rows (two visual systems, UXL-14), `HistoryRow`, `SearchResultRow` and picker rows.

### B3.10 `SectionHeader`

```ts
interface SectionHeaderProps {
    title: string;
    level?: 2 | 3;
    subtitle?: string;
    action?: {label: string; accessibilityLabel: string; href?: string; onPress?: () => void};
    trailing?: ReactNode;
    nativeID?: string;
}
```

- Title `titleLarge` (H2) or `titleMedium` (H3), via `headingProps`. Subtitle `bodyMedium` `onSurfaceVariant`.
- The action is a text `Button` "See all" with accessible name "See all {title}".
- Fixes UXL-7: "Where to watch" was a `div` while the page had five `<h1>` elements.

### B3.11 `MediaCard`

```ts
import type {EntryKey} from '@/core/domain/keys';
import type {TitleSnapshot} from '@/core/domain/library';
import type {Provider} from '@/core/domain/providers';
import type {TitleSummary} from '@/core/domain/title';

export type MediaCardItem =
    | {kind: 'title'; title: TitleSummary}
    | {kind: 'entry'; key: EntryKey; snapshot: TitleSnapshot};

export type CardSurface = 'home' | 'search' | 'library' | 'person' | 'similar' | 'other';

interface MediaCardProps {
    item: MediaCardItem;
    variant?: 'poster' | 'ranked' | 'row';
    rank?: number;
    width: number | string;
    surface: CardSurface;
    watched?: boolean;
    provider?: Provider | null;
    onOpen: (item: MediaCardItem) => void;
    onQuickActions?: () => void;
    showType?: boolean;
}
```

`kind: 'title'` comes from catalog responses (section A `TitleSummary`). `kind: 'entry'` comes from the library stores (`EntryKey` + `TitleSnapshot`). An entry whose key is a `LegacyKey` (v1 item not yet matched, section A §5.4) renders:

- its stored title, with no artwork (the fallback block);
- the meta line "Saved in an older version of {APP_NAME}";
- a press that `useOpenMedia` routes to `searchHref({q: snapshot.title})` instead of a title page (A5.4).

Variants:

- **`poster`:**
  - 2:3 `Artwork` (radius `medium`, decorative);
  - title `titleSmall`, max 2 lines;
  - meta `bodySmall` `onSurfaceVariant`: "2024" or "2019–2023" (TV), then `· ★ 7.8` when `voteCount ≥ 10`, then `· Movie` / `· TV` when `showType`.
  - Titles are always under the poster (DES-9 and UXL: grids showed no titles).
- **`ranked`:** the display-face numeral (64/64, `onSurfaceVariant`, `aria-hidden`) sits left of the poster. It is the one signature treatment (Trending). It replaces the Top-10 flag (`HoverCard.web.tsx:425` red `#E11D2E` and `accentStrong` variants).
- **`row`:** 56×84 dp poster, title `titleMedium`, meta `bodyMedium`. Used in search results and Library rows.

Badges, on solid backgrounds only:

- watched: a 28 dp `secondaryContainer` circle at top-right with a filled 18 dp `check_circle`;
- provider: a 24 dp `ProviderLogo` at bottom-left with a 1 dp `surface` ring.

There is no NEW badge and no magenta (`NewBadge.tsx:17`).

Interaction:

- Press → `onOpen(item)`. Features pass `useOpenMedia(surface)` (A4.4), which prefetches and calls C's `openTitle` (§5.4). On web the card is an anchor with `href = mediaHref(item)` (A7.2), so middle-click and copying the link work; `PlatformPressable` lets modifier-clicks through to the browser.
- `onQuickActions`:
  - Android: long-press, plus TalkBack custom actions (`accessibilityActions` "Add to watchlist" / "Remove from watchlist", "Mark watched", "More actions").
  - Web: a visible 40 px `more_vert` `IconButton` ("More actions for {title}"), a sibling of the anchor, never nested in it.

Accessible name: "{title}, {year}, {Movie|TV show}{, rated 7.8 out of 10}{, watched}{, on {provider}}". This keeps today's good poster labels (UXL "Rogue One, 2016, rated 7.8 out of 10").

Replaces: `MoviePosterItem`, `MovieLandscapeItem`, `VideoCard`, `VideoRow`, `HoverCard(.web)`, `NewBadge`, `DurationBadge`, `WatchlistStreamingBadge`, `TopTenContext`.

### B3.12 `PosterGrid`

```ts
interface PosterGridProps {
    items: readonly MediaCardItem[];
    surface: CardSurface;
    status: 'loading' | 'ready' | 'error';
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    onRetry: () => void;
    onOpen: (item: MediaCardItem) => void;
    header?: ReactNode;
    empty: ReactNode;
    watchedKeys?: ReadonlySet<string>;
    providerFor?: (item: MediaCardItem) => Provider | null;
    onQuickActions?: (item: MediaCardItem) => void;
    scrollRef?: Ref<FlatList<MediaCardItem>>;
}
```

Android (`PosterGrid.tsx`):

- `FlatList` with `numColumns = max(3, floor((contentWidth + gap) / (posterMinWidth[class] + gap)))` and `key={numColumns}`.
- On 360 dp this gives 3 columns of 101 dp; on 412 dp, 3 of 117 dp. Today phones get 2 columns and about 4 posters per screen (DES-16).
- `initialNumToRender = numColumns * 4`, `onEndReachedThreshold = 0.6`.

Web (`PosterGrid.web.tsx`):

- `ScrollView` with an inner `View` styled with `webStyle({display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(100px, 13vw, 168px), 1fr))', gap: 'clamp(12px, 1.5vw, 16px)'})` (§1.4.5).
- A sentinel triggers `onLoadMore` near the end. A visible "Load more" `Button` (outlined, full width) always follows the last row, so keyboard users can load more without scrolling past.
- Rendered items cap at 400. After that, the button reads "Refine your search to see more".

Footer and states:

- Loading more: a skeleton row. Error while loading more: an inline `ErrorState` "Couldn't load more titles." with "Try again".
- Full states: skeleton grid (2 screens), the `empty` node, or a page `ErrorState`.

Replaces: the `MoviesScreen` grid, `WatchlistScreen` grid, `getPosterContainerStyle`, `ScrollProgress` (the "24 / 5,021" pill that read like a result count, UXL "position pill") and the extra back-to-top button. Re-pressing the tab scrolls to top (§1.4.3).

### B3.13 `Rail`

```ts
interface RailProps {
    title: string;
    subtitle?: string;
    variant?: 'poster' | 'ranked' | 'still' | 'person';
    items: readonly RailItem[];
    status: 'loading' | 'ready' | 'error';
    onRetry?: () => void;
    seeAll?: {href: string};
    surface: CardSurface;
    onOpen?: (item: MediaCardItem) => void;
    emptyText?: string;
}
type RailItem =
    | {kind: 'media'; media: MediaCardItem; watched?: boolean; provider?: Provider | null}
    | {kind: 'person'; personId: number; slug: string; name: string; role: string; profilePath: string | null}
    | {kind: 'still'; path: string; index: number};
```

- Layout: `SectionHeader` plus a horizontal `FlatList` with 12 dp gap and gutter padding.
- Card width: Android uses `railPosterWidth[class]` (112/128/160 dp, so 2.9 posters show on 360 dp and hint at overflow). Web uses `webStyle({width: 'clamp(112px, 12vw, 168px)'})`. Person cards are 96 dp wide with a 72 dp circular avatar, name (`titleSmall`) and role (`bodySmall`). Still cards are 240×135 dp.
- Expanded web adds two `IconButton`s in the header trailing slot, `chevron_left` "Scroll {title} back" and `chevron_right` "Scroll {title} forward". Each scrolls 80% of the visible width. On other sizes the rail scrolls by swipe, and on web by keyboard: focus moves card to card and the browser scrolls the focused card into view.
- States:
  - loading: 6 skeleton cards;
  - error: one inline row, "Couldn't load {title}." plus "Try again";
  - empty: the rail is not rendered unless `emptyText` is given.
- Semantics: `role="region"` with `aria-labelledby` the header `nativeID`; items `role="list"` / `role="listitem"`.
- Rails render lazily: a `Rail` mounts its `FlatList` when its header is within one screen of the viewport. Home no longer fetches all 22 shelves eagerly and twice (UXL-5).
- Replaces: `MovieRail.tsx` (440 lines), `ShowStrip.tsx` and the "View all" / "View All" inconsistency (one string: "See all").

### B3.14 `ProviderLogo` and `ProviderRow`

```ts
import type {OfferType, Provider} from '@/core/domain/providers';

interface ProviderOffer {
    provider: Provider;
    type: OfferType;
}
interface ProviderLogoProps {
    provider: Provider;
    size: 24 | 40 | 48;
    decorative?: boolean;
}
interface ProviderRowProps {
    label: string;
    offers: readonly ProviderOffer[];
    watchLink: string | null;
    onOpen: (offer: ProviderOffer) => void;
}
```

`ProviderLogo` is a kit component (`src/core/ui/components/ProviderLogo.tsx`); `ProviderRow` lives in `src/features/title/components/ProviderRow.tsx` (Part 0, I-33). `Provider` and `OfferType` are A2.4 types. Rows are built from `RegionAvailability.offers`.

`ProviderLogo`:

- An `Artwork kind="logo"` square at `w92` (section A sizes).
- Radius `medium` (48), `small` (40) or `extraSmall` (24).
- Fallback: a monogram (first letter) on `surfaceContainerHigh`.

`ProviderRow`:

- Row label (`titleMedium`) above a horizontal list of 72 dp wide tiles: a 48 dp logo, then the name (`bodySmall`, 2 lines).
- In the "Your services" row the name line reads "{Name} · {Stream|Free|With ads|Rent|Buy}".
- Each tile links to `watchLink` (`RegionAvailability.link`), the TMDB watch page for the title and region. TMDB returns that page, not provider deep links (developer.themoviedb.org/reference/movie-watch-providers: "This is *not* going to return full deep links ... link to the provided TMDB URL"). When `link` is null, tiles are not interactive.
- `onOpen` sends `track(watch_provider_open)` (section C §5.5) and opens the link through `src/core/platform/openUrl.ts` (section A): a Custom Tab on Android, a new tab on web.
- Accessible name: "{Name}, {offer label}. Opens viewing options in your browser."
- Replaces: `StreamingOffers.tsx` (text-only cards 172–280 dp wide, no logos) and `WatchlistStreamingBadge`.

### B3.15 `RatingBadge`

```ts
interface RatingBadgeProps {
    value: number | null;
    votes?: number;
    size?: 'small' | 'medium';
}
```

- Renders `★ 7.8`: a `ratingStar` glyph, then the number in `onSurface` `labelLarge` (medium) or `bodySmall` (small). The number is the TMDB `vote_average` to one decimal.
- Hidden when `value` is null or `votes < 10`.
- Accessible name: "Rated 7.8 out of 10 on TMDB".

### B3.16 `StarRating` (input; `src/features/library/components/StarRating.tsx`)

```ts
import type {HalfStars} from '@/core/domain/library';

interface StarRatingProps {
    value: HalfStars | null;
    onChange: (value: HalfStars | null) => void;
    label: string;
}
```

- `value` is in half-star units, 1–10 for 0.5–5 stars (section A `HalfStars`, same encoding as v1 `JournalEntry.rating`). ARIA values are in stars: `aria-valuenow = value / 2`.
- Visual: 5 stars, each a 40 dp glyph in a 48 dp target. Tapping the left half sets `n - 0.5`; the right half sets `n`. Glyphs are `star` (filled), `star_half` and `star` outline, in `ratingStar`. Empty outline stars use `outline` (≥ 3:1).
- Below the stars: "Clear rating" (text button) and `aria-live` text "3½ stars" or "No rating".
- Semantics: one adjustable control.
  - Android: `accessibilityRole="adjustable"` with `accessibilityActions` `increment` / `decrement` (±0.5).
  - Web: `role="slider"`.
  - Both: `aria-valuemin 0`, `aria-valuemax 5`, `aria-valuenow`, `aria-valuetext "3½ stars"`.
  - Web keys: ArrowRight/ArrowUp +0.5, ArrowLeft/ArrowDown −0.5, End 5, Home 0.5, Delete/Backspace clears.
- Replaces: the 10 radio buttons "0.5 ★" … "5 ★" in `JournalEditor.tsx`.

### B3.17 `Skeleton`

```ts
interface SkeletonProps {
    shape: 'rect' | 'circle' | 'text';
    width: number | string;
    height?: number;
    lines?: number;
    radius?: keyof Tokens['shape'];
}
```

- `surfaceContainerHigh` fill, with a pulse per §2.8 (static when reduced motion is on). Always `aria-hidden`.
- Loading containers set `aria-busy` and a visually hidden label "Loading {thing}".
- Replaces: `PosterSkeleton`, `HeroSkeleton`, the inline `HomeSkeleton` (`HomeScreen.tsx:384-444`), the dead `Skeleton.tsx` and `Shimmer`.

### B3.18 `EmptyState` and `ErrorState`

```ts
interface EmptyStateProps {
    icon: IconName;
    title: string;
    body?: string;
    primary?: {label: string; onPress?: () => void; href?: string};
    secondary?: {label: string; onPress?: () => void; href?: string};
    size?: 'page' | 'section';
}
interface ErrorStateProps {
    title?: string;
    body?: string;
    onRetry: () => void;
    size?: 'page' | 'section' | 'inline';
}
```

- `page`: icon 48 dp, title `headlineSmall`, body `bodyLarge`, buttons. `section`: icon 24 dp, title `titleMedium`.
- `ErrorState` defaults: title "Couldn't load this", body "Check your connection and try again.", button "Try again". The title has `role="alert"`.
- `inline` is one line of `bodyMedium` text plus a text button.
- Replaces: the per-screen empty, error and unavailable blocks.

### B3.19 `TopAppBar`

```ts
interface TopAppBarAction {
    icon: IconName;
    label: string;
    onPress: () => void;
    selected?: boolean;
}
interface TopAppBarProps {
    variant: 'small' | 'overlay' | 'search';
    title?: string;
    wordmark?: boolean;
    back?: boolean;
    actions?: readonly TopAppBarAction[];
    overflow?: readonly {icon: IconName; label: string; onPress: () => void}[];
    search?: ReactNode;
    scrollY?: SharedValue<number>;
    revealAfter?: number;
}
```

- **`small`:** 64 dp plus the top inset; `surface` background, `surfaceContainer` after scrolling. `titleLarge` title, which is the page H1 (§1.5). Up to 2 actions plus overflow (`more_vert` → `ActionSheet`).
- **`overlay`** (Title page):
  - transparent at first; back, share and more are `media` `IconButton`s;
  - once `scrollY > revealAfter` (backdrop height − 64), it cross-fades to `surfaceContainer` with standard icons and the title;
  - the status bar is light while transparent and follows the theme after;
  - no title text is drawn over the image.
- **`search`:** the `search` slot fills the bar width.
- Replaces: `TopBar.tsx`, `TopBarSlot.tsx` and the player's chevron-down "collapse and leave".

### B3.20 `NavigationBar` (compact)

Props: `BottomTabBarProps` from `expo-router/js-tabs` (`{state, descriptors, emitter, navigateToTab, insets}`, `bottom-tabs/types.d.ts:334-340`).

Visual:

- `surfaceContainer` background, 64 dp plus `insets.bottom`; 4 equal items.
- Item: 24 dp icon centred in a 56×32 dp indicator pill (`secondaryContainer` when selected), then the label 4 dp below. Selected label is `labelMedium` `onSurface`; unselected is `labelMediumRegular` `onSurfaceVariant`.
- The selected item uses the filled glyph, so selection is shown by glyph, weight and pill.

Behaviour:

- Mirrors the default `BottomTabBar`: `emitter.emit({type: 'tabPress', target: route.key, canPreventDefault: true})`, then `navigateToTab(route.key)` unless prevented or already focused (`build/react-navigation/bottom-tabs/views/BottomTabBar.js:319-326`).
- Reports its height through `BottomTabBarHeightCallbackContext` (exported by `expo-router/js-tabs`) so `useBottomTabBarHeight()` works.

Semantics:

- Android: container `role="tablist"`, items `role="tab"` with `aria-selected` and name "{label}, tab, {n} of 4".
- Web: the twin renders `<nav aria-label="Main">` with anchor items (`href` from `useLinkBuilder().buildHref`, `expo-router/react-navigation`) and `aria-current="page"`.

Labels set `maxFontSizeMultiplier={1.5}`. The "You" item shows an error `Badge` dot when Plus has a billing issue; the accessible name becomes "You, payment issue".

### B3.21 `NavigationRail` (medium; Android expanded)

- 80 dp wide, `surfaceContainer` background, top padding 24 dp plus the inset.
- Destinations stack from the top with 12 dp gaps. Each is a 56×32 indicator plus label, the same as the bar, 56 dp tall minimum.
- No FAB and no menu button.
- Same events, semantics and badge as the bar. On web it renders `<nav aria-label="Main">` with anchors.

### B3.22 `WebHeader` (expanded web)

Layout, 64 px tall, sticky inside the column:

- 32 px gutter, then the wordmark `{APP_NAME}` (`headlineSmall`, display face, anchor to `/`, `aria-label="{APP_NAME} home"`);
- 24 px gap, then the links "Home" and "Library" (`labelLarge`, 40 px tall, `aria-current="page"` when active);
- a flexible spacer, then a centred `SearchField variant="header"` (max 560 px);
- a flexible spacer, then an `Avatar` 32 px link to `/you` (`aria-label="You: account and settings"`), or a `person` `IconButton` "You" when signed out. There is no "Get Plus" link in the header (Part 0, I-15).

Behaviour:

- The background is `surface`, changing to `surfaceContainer` with a bottom `outlineVariant` divider after scrolling.
- The search field is the Search destination on expanded web. It is `HeaderSearch` (`features/search/public/HeaderSearch.tsx`), passed in by `AppTabBar` (Part 0, I-26):
  - focusing it on any page does nothing until the user types;
  - `onChangeText` starts a 300 ms timer; when it fires and a Search screen has registered its `url.commit` with `registerSearchCommit()`, the header calls that commit (the screen's scoped `navigation.setParams`); otherwise it calls `router.navigate(searchHref({q}))`. Neither path runs inside an effect (YIFY-36);
  - Enter submits immediately and records a recent search.
- Root element `role="banner"` containing `<nav aria-label="Main">`.

Replaces: the desktop `TopBar` row, which had no Home item and no current-page state (UXL §3.2).

### B3.23 `AdaptiveNavigation`

`src/core/ui/navigation/AdaptiveNavigation.tsx` (Android) renders `NavigationBar` or `NavigationRail` from `windowClassFor(width)`. Props: `BottomTabBarProps & {headerSearch: ReactNode; account: {name: string; photoUrl: string | null} | null; youBadge: 'none' | 'billing'}`; `AppTabBar` (`features/shell/public/AppTabBar.tsx`) supplies them. `AdaptiveNavigation.web.tsx` renders the skip link plus all three web variants with `data-nav` attributes (§1.4.5).

Skip link (web, first focusable in the document):

- an anchor "Skip to content", visually hidden until focused;
- it then shows as a `primary` filled pill at top-left;
- `href="#main"` focuses `ScreenScaffold`'s `nativeID="main"` element, which has `tabIndex={-1}`.

### B3.24 `TrailerFrame`

Behaviour is in §5. Contract:

```ts
import type {Video} from '@/core/domain/title';
import type {TitleKey} from '@/core/domain/keys';

interface TrailerFrameProps {
    open: boolean;
    onClose: () => void;
    video: Video;
    title: string;
    titleKey: TitleKey;
    surface: 'title' | 'home';
    backdropPath?: string | null;
}
```

Parts:

- **`TrailerFrame`** (`src/features/player/public/TrailerFrame.tsx`) is the design part: presentation, consent panel and error panel.
- **`TrailerPlayer`** is the player, with twins in `src/features/player/platform/` (Part 0, I-3):
  - Web: section C §3.7, the YouTube IFrame API.
  - Android: the port in §5.2, `react-native-youtube-iframe` 2.4.1. Props verified in `node_modules/react-native-youtube-iframe/index.d.ts:33-158`: `videoId`, `play`, `height`, `width`, `onReady`, `onChangeState`, `onError`, `initialPlayerParams`, `webViewProps`, `forceAndroidAutoplay`, `onFullScreenChange`.

### B3.25 `Avatar`

```ts
interface AvatarProps {
    name: string;
    photoUrl?: string | null;
    size: 24 | 32 | 40 | 56 | 72;
    decorative?: boolean;
}
```

- A circle. The image uses `expo-image`; the fallback is up to two initials in `primaryContainer` / `onPrimaryContainer`.
- `aria-label` is the name unless `decorative`.
- Used for the Google account, the cast rail and the Person header (72 dp; 120 dp profile on Person uses `Artwork kind="profile"`).

### B3.26 `Badge`

```ts
interface BadgeProps {
    size: 'dot' | 'small' | 'large';
    tone?: 'neutral' | 'primary' | 'error' | 'plus';
    label?: string;
    icon?: IconName;
}
```

- `dot`: 6 dp, `error`.
- `small`: 16 dp tall, `labelSmall`.
- `large`: 20 dp with an icon. `plus` = `workspace_premium` + "Plus" on `primaryContainer`.
- `maxFontSizeMultiplier={1.3}`. A badge never carries meaning alone; the parent's accessible name repeats it.
- Used for: the You billing dot, the Plus tag on accent swatches and the Insights card, and the "Rewatch" tag on diary rows.

### B3.27 `ScreenScaffold`, `PageTitle`, `OfflineBanner`

```ts
interface ScreenScaffoldProps {
    topBar?: ReactNode;
    title: string;
    documentTitle?: string;
    width?: 'grid' | 'reading' | 'full';
    children: ReactNode;
}
```

- Document title: after mount, `ScreenScaffold` renders `<Head><title>{documentTitle ?? pageTitle(title)}</title></Head>` from `expo-router/head` (`node_modules/expo-router/build/head/index.d.ts`); `pageTitle` comes from `src/core/config/seo.ts`. `Head` sets the title only for the focused screen (`ExpoHead.js` checks `useIsFocused`), and `ExpoHead.android.js` renders `null`, so Android ignores it. Rendering it only after mount keeps the server HTML at one `<title>`, the one `generateMetadata` wrote (C3.2), and every in-app navigation still updates the title (B6.5). Title and Person pages pass `documentTitle` from `titleDocumentTitle()` and `personDocumentTitle()` (same file).

- Root: `dataSet={{screen: ''}}`, `role="main"`, `nativeID="main"`, `tabIndex={-1}` on web.
- It renders `topBar` (hidden on expanded web), then `OfflineBanner`, then children constrained to `maxContentWidth[width]` and centred.
- `title` feeds `PageTitle`:
  - On compact and medium, the `TopAppBar` title is the H1.
  - On expanded web, `PageTitle` renders `headlineMedium` H1 at the top of content, except on Title and Person pages, which render their own H1 in the header.

`OfflineBanner`:

- An inline strip below the bar: `errorContainer` background, `cloud_off` icon, `bodyMedium` text "You're offline. Showing what's saved on this device.", `role="status"`.
- It appears 2 s after connectivity drops (to absorb blips) and hides on reconnect. When the connection returns, a `short` snackbar says "Back online".
- It never covers content.

### B3.28 `DatePickerSheet` (`src/features/library/components/DatePickerSheet.tsx`)

```ts
interface DatePickerSheetProps {
    open: boolean;
    value: string;
    onChange: (isoDate: string) => void;
    onClose: () => void;
    max: string;
    min: string;
}
```

- A `Sheet` titled "Date watched".
- Month header: `chevron_left` "Previous month", "November 2026" (`titleMedium`, `aria-live="polite"`), `chevron_right` "Next month" (disabled after `max`).
- A 7-column grid of 48 dp day buttons with short weekday headers from `Intl.DateTimeFormat(locale, {weekday: 'narrow'})`. Each day's name is "Tuesday, 12 November 2026". The selected day uses `primary` / `onPrimary` with `aria-selected` (web `aria-pressed`). Today has a 1 dp `primary` ring. Future days are disabled.
- Footer: "Cancel" (text) and "Done" (filled).
- Web arrow keys move by day and week; PageUp and PageDown change the month.
- No new dependency. Replaces the free-text "Watched on, YYYY-MM-DD" field (UXL-15).

### B3.29 `ImageViewer` (`src/features/title/components/ImageViewer.tsx`)

```ts
interface ImageViewerProps {
    open: boolean;
    onClose: () => void;
    images: readonly {path: string; kind: 'still' | 'poster' | 'backdrop'}[];
    initialIndex: number;
    title: string;
}
```

- `Sheet presentation="fullscreen"` (every class).
- A horizontal paging `FlatList` with one `Artwork fit="contain"` per page (`w780`, or `w1280` from 840 dp).
- Top row (outside the image): Close, then the counter "3 of 12" (`aria-live="polite"`).
- Web: ArrowLeft and ArrowRight page. Android: swipe.
- No zoom and no infinite loop.
- Each image's alt is "Image {n} of {total} from {title}".
- Replaces: `ScreenshotLightbox.tsx` (394 lines, looping copies and pinch zoom).

## B4. Screens

### B4.0 Shared contracts

#### B4.0.1 Opening titles

Every title link goes through `useOpenMedia(surface)` (A4.4; Part W, F0.5), which calls C's `openTitle(navigate, input)` (C2.6; C owns the ads logic) with `{source: 'tap', surface, contentType, contentId, title, posterPath}` and `navigate = () => router.push(titleHref(...))`.

- Before calling it, the card primes the query cache. Section A's `summaryCache` (A §4.5) already holds the `TitleSummary`, so the Title page paints the backdrop, poster, title, year and rating at once. Today a bare spinner shows for 0.8–3 s (UXL-17).
- `useOpenMedia` performs C's caller duty with `prefetchQuery(titleQueryOptions(...))` on press.
- Person, season and list links navigate directly. They never show ads (C §2.3).

#### B4.0.2 Analytics

Section C §5.5 owns the GA4 catalog (24 events) and `track()`. This section only says which event each screen fires, using C's names and params:

- `select_content` (title and person opens);
- `search`;
- `trailer_start`;
- `watchlist_add` / `watchlist_remove`;
- `watched_add`;
- `list_create` / `list_item_add`;
- `watch_provider_open`;
- `share`;
- `login` / `sign_up`;
- `paywall_view`, `purchase_*`, `restore_result`;
- `play_store_open`;
- `insights_view`;
- `setting_change` (region, theme, accent, services, analytics consent, trailer captions);
- `screen_view` with C's `screen_name` values.

Design-specific events from earlier drafts are dropped (`section_see_all`, `home_type`, `genre_open`, `undo`, `filter_change`), so the catalog stays small (decision 9). Search filter use is captured by C's `search.has_filters`.

#### B4.0.3 States used everywhere

| State | Rendering |
| --- | --- |
| Loading (no cache) | Skeletons shaped like the content, per section |
| Loading (cache or `summaryCache` placeholder) | Content, plus skeletons only for the missing parts |
| Error (no cache) | Page `ErrorState` with "Try again" |
| Error (stale cache shown) | Content, plus a `short` snackbar "Couldn't refresh. Showing saved results." |
| Offline | `OfflineBanner` plus cached content. With no cache: `EmptyState` `cloud_off`, "You're offline" / "Connect to the internet to browse. Your library is available offline." / "Open Library" → `/library`. |
| Empty | Per-screen copy below |

### B4.1 Home (`/`)

Data:

- `useHome()` (section A §4.4) wraps `GET /api/v2/home` and returns `hero[]` plus `rails[]` with the ids `trending`, `popular-movies`, `in-theaters`, `streaming-now`, `popular-tv`, `acclaimed`, `new-episodes` (A §3.4.1).
- `useServicesRail()` gives "On your services".
- `useGenres()` gives genre chips.

Offline and outage copy comes from A §4.5 and shows as an inline banner above the content, using `{APP_NAME}`:

- "You're offline. Showing picks from {relative time}."
- "{APP_NAME} can't reach its catalog right now. Showing picks from {relative time}."

Sections, eight at most, in this order:

| # | Section | Source | Title (copy) | See all |
| --- | --- | --- | --- | --- |
| 1 | Featured | `hero[0]` only (no carousel) | Eyebrow "Featured today" | — |
| 2 | On your services | `useServicesRail()`, when services are chosen for the region | "On your services". Subtitle "From {Service A}, {Service B} and {n} more" | `searchHref({type: 'movie', providers: mine, monetization: ['stream', 'free', 'ads']})` |
| 2b | New on streaming, plus a prompt | rail `streaming-now`, when no services are chosen | "New on streaming". Above it, an inline `ListItem` "Pick your streaming services to personalize this" with trailing chevron → `/settings/streaming` | `searchHref({type: 'movie', monetization: ['stream'], sort: 'release'})` |
| 3 | Trending | rail `trending` (ranked, 10) | "Trending this week" | none |
| 4 | Popular | rails `popular-movies` and `popular-tv` | Section header "Popular" with an inline `SegmentedButton` "Movies" / "TV" (`accessibilityLabel` "Show popular movies or TV"). The choice is kept per device in `v2.ui.home.popular` (A5.2). | `searchHref({type, sort: 'popular'})` |
| 5 | In theaters | rail `in-theaters` (omitted by the server if it has fewer than 8 items) | "In theaters" | none |
| 6 | New episodes | rail `new-episodes` | "New episodes" | none |
| 7 | Top rated | rail `acclaimed` | "Critically acclaimed" | `searchHref({type: 'movie', sort: 'rating'})` |
| 8 | Genres | `useGenres()` | "Browse by genre": a wrap of `Chip kind="assist"`, each linking to `searchHref({type, genres: [id]})` (`type` = `movie` if the genre has movie in `types`, else `tv`) | — |

These rail titles are section A's default copy for each `RailId` (A §3.4.1).

The brief asked for "Upcoming" and "Now playing / On the air". "Now playing" is In theaters and "On the air" is New episodes. "Upcoming" is not in v2 Home: section A's home endpoint has no upcoming rail, and the 8-section cap holds. It stays out of v2.0 (Part 0, I-14).

This replaces `presentation/movies/constants/homeShelves.ts` (20 rails, 15 genre rails, download-count sorting) with `src/features/home/homeSections.ts`, a typed const of the table above. There is no footer on Android; web gets `SiteFooter` (§4.17).

**Featured card, compact.**

- `Artwork kind="backdrop"` (`w780`), full content width, 16:9, radius `medium`.
- Then the eyebrow `labelMedium` `onSurfaceVariant` "Featured today", the title `headlineSmall` (max 2 lines), and the meta line `bodySmall` (`2024 · 2h 46m · PG-13 · ★ 8.2`; TV `2019– · TV`).
- Then the actions:
  - `Button filled icon=play_arrow` "Play trailer", only when `hero[0].trailer` is set;
  - `Button tonal` toggle "Watchlist" / "On watchlist" (`bookmark_add` / filled `bookmark`).
- The image and title form one link to the title. The buttons are siblings, not nested inside it.
- No overview on compact.

**Featured card, medium and expanded.** A row wrap:

- a text column (`flexBasis` 360) on `surface`: `displaySmall` title and a 3-line `bodyLarge` overview;
- the image (`flexBasis` 480, `flexGrow` 1) with a `Scrim direction="toRight"` fading its left edge.

Text never sits on the image (§2.2 rule 2). There is no carousel, no auto-advance and no autoplay (fixes DES-4 and WCAG 2.2.2).

**Layout targets.**

- Android 360×800 dp at font scale 1.0: the top of the first rail's posters is at or above 600 dp from the top of the screen. Today the first poster is at 843 px (UXL §2.2).
- Web 1,280 px: the featured block and the first rail fit within the first 800 px.

**States.**

- Per section: skeleton rails, an inline `ErrorState` per rail with "Try again", and empty rails hidden.
- A missing hero collapses the featured section.
- Total failure with no snapshot: page `ErrorState` "Couldn't load Home" / "Check your connection and try again." / "Try again".

**Analytics:**

- `screen_view {screen_name: 'home'}`;
- `select_content` (surface `home`) through `openTitle`;
- `trailer_start` (from the featured card);
- `watchlist_add` / `watchlist_remove`.

### B4.2 "See all"

There is no browse route (§1.2). "See all" opens Search in browse mode with the discover parameters listed in §4.1, so the Search grid, chips and sort handle it.

### B4.3 Search (`/search`)

URL is the only state, through section A's search codec and `useUrlState().commit()` (A §4.6). The params are `q`, `type` (`all` | `movie` | `tv` | `person`), `genres`, `providers`, `monetization`, `sort` (`popular` | `rating` | `release` | `title`), `year_from`, `year_to`, `rating_min` and `lang`.

- Nothing is read from saved preferences. v1's "Browse defaults" are deleted. Today a 2160p default silently filtered "dune" down to 4 results (UXL-6).
- Live search commits 300 ms after the last keystroke (A's timer).

Modes:

| Mode | When | Chips shown | Results | Data |
| --- | --- | --- | --- | --- |
| Start | `q` empty, no filters, `type` `all` | none | "Recent searches" (up to 10 `input` chips plus "Clear all"), then "Trending this week" (10 `MediaCard row`s from the home `trending` rail) | `useRecentSearches()`, `useHome()` |
| Search | `q` is 1 character or more | Type only (dropdown) | `type=all`: one mixed list of rows (movies, TV, people). `movie` / `tv`: `PosterGrid`. `person`: person rows. | `useSearchResults(q, type)` |
| Browse | `q` empty and (`type` is `movie` or `tv`, or any filter is set) | Type, Genre, Year, Rating, "On my services" (filter chip). Sort: `IconButton` in the app bar (compact, medium) or `Chip dropdown` "Sort: Most popular" (expanded) | `PosterGrid` | `useDiscoverResults(params)` |

Search mode offers only Type because TMDB search endpoints take no filters (A §4.6). The codec's `lang` param has no chip in v2.

Sheets, one per chip (`Sheet presentation="auto"`):

| Sheet | Title | Options | Writes |
| --- | --- | --- | --- |
| Type | "Type" | All, Movies, TV shows, People (radio `ListItem`s). Selecting closes the sheet. | `type` |
| Genre | "Genre" | "Any genre", then the type's genres (radio; v2 sets at most one) | `genres` |
| Year | "Year" | Any year, 2020s, 2010s, 2000s, 1990s, 1980s, "Before 1980", then "Custom range…" (two 4-digit `TextField`s "From" / "To" and an "Apply" button) | `year_from`, `year_to` |
| Rating | "Rating" | Any rating, 5+, 6+, 7+, 8+ | `rating_min` |
| Sort | "Sort by" | Most popular, Highest rated, Newest first, Title A–Z | `sort` = `popular` / `rating` / `release` / `title` |

Chip rules:

- **On my services** writes `providers = myServices[region]` and `monetization = stream,free,ads` (A's discover mapping).
- With no services chosen, tapping it opens the services picker sheet (§4.11), then applies.
- Switching Type to People clears the other filters and shows a `short` snackbar: "Filters cleared for people search".
- Active filters show as selected dropdown chips. When 2 or more are active, a trailing text button "Clear filters" appears.

Live results:

- Results update in place; the previous results stay while the next request runs (no flash).
- The query reaches the server lower-cased (A §3.4.3).
- The result count is announced politely, at most once per settled query: "{n} results" or "1 result".

Focus:

- The field is auto-focused when the user enters Search by a tab press (compact and medium).
- It is not focused on a cold URL load or on back navigation.
- On web, ArrowDown from the field moves to the first result.

Recent searches:

- Enter, or selecting a result, calls `rememberSearch(term)`.
- "Clear all" removes them with an Undo snackbar: "Search history cleared" / "Undo".

Empty states:

- Search: "No results for “{q}”" / "Check the spelling or try fewer words."
- Browse: "No titles match these filters" / "Clear filters".
- People: "No people found for “{q}”".

Error: page `ErrorState` "Couldn't load results".

Copy:

| Key | String |
| --- | --- |
| placeholder | "Search movies, TV shows and people" |
| recent | "Recent searches"; "Clear all"; remove label "Remove {term} from recent searches" |
| chips | "Type" ("All", "Movies", "TV shows", "People"); "Genre" ("Any genre"); "Year" ("Any year"); "Rating" ("5+" … "8+"); "On my services"; "Sort" (accessible name "Sort results, currently {option}") |
| row meta | movie "{year} · Movie"; TV "{year} · TV"; person "{department} · {known for title}" |

Analytics:

- `screen_view {screen_name: 'search'}`;
- `search` when results settle for a query of 2 or more characters (`scope`, `has_filters`);
- `select_content` (surface `search`).

Replaces:

- `SearchOverlay`;
- `MoviesScreen` (560 lines) and `MovieFilterModal` (429 lines);
- `ChipBar`, `feedChips.ts`;
- `movieFilterLabels.ts`. Its Seeds, Peers, x265 and 3D options are gone (DES-15).

### B4.4 Title (`/title/movie/[id]`, `/title/tv/[id]`)

One screen for movies and TV: `src/features/title/screens/TitleScreen.tsx`. It replaces `WatchScreen.tsx` (964 lines) and `ShowDetailsScreen.tsx` (522 lines).

Data (section A §4.4):

- `useTitle(key)`;
- `useAvailability(key)` → `RegionAvailability` for the effective region;
- `useInWatchlist(key)` and `toggleWatchlist(key, snapshot)`;
- `useWatched(key)` and `logWatch(input)`;
- `useLists(...)` and `setListItem(...)`;
- `recordView(key, snapshot)`, once per open (skipped while Recent is paused).

Content order:

1. **Header.**
   - The backdrop is 16:9 and full-bleed under the `overlay` `TopAppBar`, with a `Scrim toBottom` over its bottom 40%.
   - The poster is 2:3 (`w342`): 96 dp compact, 140 dp medium, 220 px expanded. It overlaps the backdrop bottom by 48 dp.
   - Beside the poster:
     - the H1 title (`headlineMedium`; `headlineLarge` on expanded);
     - the meta line `bodyMedium` `onSurfaceVariant`. Movie: `2024 · 2h 46m · PG-13`. TV: `2019–2023 · 4 seasons · TV-MA`, plus "Next: S2 E3 · 12 Dec" when a next episode is known;
     - `RatingBadge medium`.
   - Genres: a row of assist chips (horizontal scroll on compact), each linking to `searchHref({type, genres: [id]})`.
   - Metadata appears once. DES-3 found it three times.

2. **Actions.**
   - Compact: a full-width `Button filled large` "Play trailer" (`play_arrow`), only when a trailer exists. Below it, a row of 4 labelled icon buttons, each 25% wide and 64 dp tall, with a 24 dp icon over a `labelMedium` label:
     - "Watchlist" / "On watchlist": `bookmark_add` / filled `bookmark`, `toggleProps`;
     - "Mark watched" / "Watched": `check_circle`, filled when watched, `toggleProps`;
     - "Add to list": `playlist_add`;
     - "Share": `share`.
   - Medium and expanded: one wrapped row. Play trailer (filled), Watchlist (tonal toggle), Watched (tonal toggle), Add to list (outlined), Share (`IconButton outlined`).
   - Removed: the ♡ likes counter (an inert element styled as a button), the downloads counter, the Download pill and tap-title-to-expand (DES-3, UXL-1).

3. **Where to watch** (H2), directly under the actions.
   - Header trailing slot: a `Chip dropdown` showing the country name, e.g. "India", with accessible name "Country: India. Change country". It opens `CountryPickerSheet`.
   - Rows, in order: "Your services" (the user's providers for this region, any offer type), "Stream", "Free", "With ads", "Rent", "Buy".
     - Providers already listed under "Your services" are left out of later rows.
     - Empty rows are omitted.
   - Attribution below the rows, always visible (also in empty and error states): `bodySmall` "Streaming data from JustWatch". It links to `availability.link`, or to `https://www.justwatch.com` when that is null (A §3.6; TMDB terms require attributing JustWatch).
   - States:
     - Loading: 2 skeleton rows of 4 tiles.
     - Empty: "Not available to stream, rent or buy in {country} right now." plus text button "Change country".
     - Error: inline `ErrorState` "Couldn't load streaming options." / "Try again".
   - With no services chosen, a text link "Pick your services to see them first" follows the rows and opens the services picker sheet.

4. **Overview** (H2): `bodyLarge`, 4 lines with a "More" / "Less" text button (`aria-expanded`). Hidden when empty.

5. **Cast** (H2):
   - Above the rail, `bodyMedium` links: "Director" / "Directors" / "Created by: {names}".
   - A person `Rail` of the top 20 billed cast, each linking to `personHref`.

6. **Seasons** (TV only, H2):
   - A rail of season cards: poster, "Season 2", "8 episodes · 2022".
   - Each links to `seasonHref(key, 2)`. Specials (season 0) come last, as "Specials".

7. **More like this** (H2): a poster `Rail` (surface `similar`).

8. **Images** (H2): a still `Rail` of up to 20 backdrops (`w300`), opening `ImageViewer`.

9. **Details** (H2): definition rows, label `bodyMedium` `onSurfaceVariant` then value:
   - "Original title" (only if different);
   - "Original language";
   - "Release date ({country})" or "First aired";
   - "Runtime" or "Episodes";
   - "Status";
   - "Production countries".

**Expanded layout.**

- The body is a row wrap.
  - Main column: `flexBasis` 560, `flexGrow` 1, max 760. It holds sections 2–8.
  - Aside: `flexBasis` 300, max 320. It holds Details and the first 6 "More like this" items as `row` cards.
  - At narrower widths the aside wraps below the main column, with no media query.
- The backdrop is a 21:9 band, at most 480 px tall, fading into `surface` at the bottom.

**Placement target.** On a 360×800 dp Android screen at font scale 1.0, with a trailer and providers, the "Where to watch" heading starts at or above 560 dp and at least one provider tile is fully visible. Today it is about 760 dp in code and 679 px measured (DES-3, UXL §2.2).

**Interactions.**

- **Watchlist toggle** (optimistic):
  - Adding shows a `short` snackbar "Added to Watchlist".
  - Removing shows an Undo snackbar "Removed from Watchlist" / "Undo".
  - The first add by a signed-out user also shows, once per device, a `long` snackbar "Saved on this device. Sign in to sync." with action "Sign in" → `/you` (tracked in `v2.ui.title.signInHintShown`).
- **Mark watched:**
  - When not yet watched, `logWatch({key, watchedOn: today, rating: null, note: '', rewatch: false})` runs, followed by a `long` snackbar "Marked as watched" / "Add details", which opens the Diary sheet on that entry.
  - Long-press (Android) and the accessibility action "Log with details" open the sheet first.
  - When already watched, a tap opens the Diary sheet on the latest entry. That sheet offers "Log another watch" and "Delete entry".
  - Sign-in is not required (A12; today `JournalScreen.tsx:53-76` requires it).
- **Add to list:** opens `AddToListSheet` (§4.9).
- **Share:** `src/core/platform/share.ts` (section A) with message `{title} ({year}) on {APP_NAME}` and `shareUrl(titleHref(key, slug))`.
  - Android opens the system share sheet.
  - Web uses `navigator.share`, falling back to copying the link, with the snackbar "Link copied".
- **Overflow:** "Open on TMDB" (`https://www.themoviedb.org/{type}/{id}`) and "Copy link" (web only).
- **Provider tile:** `openUrl(link)` (Custom Tab on Android, new tab on web).
- **Trailer:** see §5.

**Page states.**

| State | Rendering |
| --- | --- |
| Loading with a placeholder (`summaryCache` hit) | Header from the cache, skeleton actions, skeletons for the other sections |
| Loading cold | A full skeleton with the same geometry, so nothing shifts |
| Not found (`404 not_found`, including adult titles, A §3.4.4) | `EmptyState` `movie` "Title not found" / "It may have been removed from TMDB." / "Go to Home" |
| Error | Page `ErrorState` "Couldn't load this title" |

**Copy.**

| Key | String |
| --- | --- |
| play | "Play trailer" |
| watchlist off / on | "Watchlist" / "On watchlist" |
| watched off / on | "Mark watched" / "Watched" |
| list, share | "Add to list"; "Share" |
| where | "Where to watch"; rows "Your services", "Stream", "Free", "With ads", "Rent", "Buy" |
| attribution | "Streaming data from JustWatch" |
| empty | "Not available to stream, rent or buy in {country} right now."; "Change country" |
| pick services | "Pick your services to see them first" |
| overview | "Overview"; "More" / "Less" |
| cast | "Cast"; "Director" / "Directors" / "Created by" |
| seasons | "Seasons"; "Season {n}"; "Specials"; "{n} episodes" |
| more | "More like this"; "Images"; "Details" |
| details | "Original title", "Original language", "Release date ({country})", "First aired", "Runtime", "Episodes", "Status", "Production countries" |
| overflow | "Open on TMDB", "Copy link" |

**Analytics:**

- `screen_view` (`title_movie` / `title_tv`);
- `trailer_start`;
- `watchlist_add` / `watchlist_remove` (surface `title`);
- `watched_add`;
- `list_item_add`;
- `watch_provider_open`;
- `setting_change {setting: 'region'}`;
- `share`;
- `select_content` (surface `similar`, through `openTitle`).

### B4.5 Season (`/title/tv/[id]/season/[season]`)

- **Bar.** `TopAppBar small` with back and the title "Season {n}" (or "Specials"). Under the bar, a supporting line links the show name back to the show.
- **Header.** Season poster (96 dp) and `bodyMedium` "{year} · {n} episodes", with a 4-line overview and "More". A `Chip dropdown` "Season {n}" opens a sheet listing all seasons; choosing one does `router.replace(seasonHref(key, n))`.
- **Episode list** (`useSeason(key, n)`). Each row has:
  - a still (`Artwork still w300`, 120×68 dp);
  - "{n}. {episode name}" (`titleMedium`);
  - meta `bodySmall`: "12 Nov 2022 · 58m · ★ 8.1", or "Airs 12 Dec 2026";
  - a 3-line overview. The row is a button with `aria-expanded` that expands it.
- **Unaired episodes** show no rating and the overview "Not yet aired."
- **Empty:** "No episodes listed yet." **Error:** page `ErrorState` "Couldn't load this season".
- **Replaces** the EZTV release rows with size, seeds and peers (`ShowDetailsScreen.tsx:386-436`).
- **Analytics:** `screen_view {screen_name: 'title_tv'}`.

### B4.6 Person (`/person/[id]`)

Data: `usePerson(key)` (section A §3.4.6, credits merged and sorted by the server).

- **Header.** Profile `Artwork profile w185` (compact 120 dp, expanded 200 px), H1 name, `bodyMedium` "Known for {department}", "Born 12 Mar 1974 in {place}", and "Died …" when present. `IconButton share` in the bar.
- **Biography** (H2 "Biography"): 5 lines with "More". If empty: "No biography available."
- **Known for** (H2): a poster `Rail` of the server's `knownFor` (8 items).
- **Filmography** (H2):
  - A `SegmentedButton` of the departments present: "Acting", "Directing", "Writing", "Production", "Crew". It scrolls horizontally when there are more than 3.
  - Below it, a list grouped by year, descending. An "Upcoming" group comes first for credits with no date.
  - Each row is a `MediaCard row` (40×60 poster) with meta "{year} · as {character}" or "{year} · {jobs}", plus a `movie` or `tv` icon labelled "Movie" or "TV show".
- **States:** a skeleton header and list; "Person not found"; `ErrorState` "Couldn't load this person".
- **Analytics:** `screen_view {screen_name: 'person'}`, `select_content` (surface `person`, through `openTitle`), `share`.

Cast was not tappable in v1 (DES-3). People can now be reached from Search and from every Title.

### B4.7 Library (`/library`, `/library/watched`, `/library/lists`, `/library/recent`)

`LibraryShell` (`src/features/library/components/LibraryShell.tsx`):

- `TopAppBar small` "Library", with action `search` "Search your library". It toggles an inline `SearchField` under the bar that filters the current section by title on the client.
- A row of 4 section tabs (`SectionTab`): `titleSmall` labels, a 3 dp `primary` underline on the active tab, 48 dp tall. The row scrolls horizontally at font scale 2.0.
- `TabSlot` content.

The library is local-first and needs no sign-in (section A, A12). Signed-out users see, once at the top of Watchlist, a dismissible `ListItem` "Sign in to sync your library across devices" with a trailing chevron → `/you` (dismissal stored in `v2.ui.library.signInRowHidden`). Today the journal requires sign-in and shows cannot be saved (DES-8).

Migration (section A §5.4):

- After the v1 → v2 migration with unmatched titles, the Watchlist shows a dismissible banner row (`surfaceContainerLow`, `info` icon): "Your library moved to the new catalog. {n} titles couldn't be matched; they're kept under their old names." It has a text button "Try again", which calls `retryLegacyResolution()` (A5.4 phase B, step 6), and a close button that sets `noticeShown`.
- Unmatched entries render per §3.11: the meta line "Saved in an older version of {APP_NAME}", and a tap opens Search for the title.

#### B4.7.1 Watchlist (`/library`)

Data: `useWatchlist(select)` and section A's `useWatchlistOnServices()` for the provider badges and the "On my services" filter.

- **Header row:**
  - `bodyMedium` count "23 titles";
  - filter chips "Movies", "TV shows", "On my services" and "Not watched";
  - a sort `Chip dropdown` with "Recently added", "Title A–Z", "Release year" and "TMDB rating".
- **Body:** a `PosterGrid` (surface `library`).
  - Watched cards show a check badge.
  - Cards available on the user's services show the first such provider's logo. Availability is refreshed by the data layer, not by the user. This replaces "Check availability" and "Check next N" (DES-11).
  - A caption `bodySmall` "Streaming info updated {relative time}" appears when known.
- **Quick actions** (`ActionSheet` titled with the title name):
  - "Mark watched" or "Remove from watched";
  - "Add to list…";
  - "Remove from Watchlist" (destructive);
  - "Share".
- **Removal** is optimistic and shows an Undo snackbar "Removed from Watchlist" / "Undo". There is no confirm, and the "Confirm removals" setting is deleted.
- **Empty:** `EmptyState` `bookmark`, "Your watchlist is empty" / "Save movies and shows you want to watch. You'll see where to stream them here." / "Browse popular titles" → `searchHref({type: 'movie', sort: 'popular'})`.
- **Empty with filters:** "Nothing matches these filters" / "Clear filters".
- **Placement target:** at 360×800 dp, the first poster starts within 200 dp of the bar's bottom edge. Today it is at about 700 px (UXL §3.8).

Removed from the header stack (DES-11):

- the cover image with "Play trailers";
- "Pick for me";
- "Manage collections" (now the Lists tab);
- "Movie journal" (now the Watched tab);
- the availability batch controls;
- the "1 / 1" position pill.

#### B4.7.2 Watched (`/library/watched`)

Data: `useDiary(select)`, `useDiaryInsights('year')` and section C's `insightsAccess(status)`.

**Top card: `InsightsCard`** (hidden when the diary is empty).

- Plus members (`full`): `surfaceContainerLow` with "Your {year} so far" and 3 stats ("Titles", "Hours", "Avg rating"; `titleLarge` numbers over `bodySmall` labels), then "See insights" → `/library/watched?view=insights`.
- Others (`teaser`, per C §1.2: "the total number of titles logged this year, plus locked cards"):
  - "You've logged {n} titles in {year}" (`titleMedium`);
  - a locked row "Unlock your year in review with Plus" (C copy `insights.locked`) with `Badge plus`;
  - button "See Plus" → `openPaywall('insights')`.

**Diary list.**

- Entries are grouped by month, with `titleMedium` headers such as "November 2026".
- Each row:
  - poster 56×84;
  - title (`titleMedium`);
  - "Watched 12 Nov" (`bodySmall`), or "Watched, date unknown" when `watchedOn` is null (migrated v1 marks, section A §2.6);
  - read-only stars (5 glyphs, `aria-label="Rated 3½ out of 5"`), or nothing when unrated;
  - `Badge small` "Rewatch" when set;
  - the note's first line (`bodyMedium`, `onSurfaceVariant`).
- Press opens the Diary sheet (§4.8).
- Quick actions: "Edit entry", "Open title", and "Delete entry", which removes with an Undo snackbar ("Entry deleted" / "Undo").

**Empty:** "No watches logged yet" / "Mark titles as watched to build your diary." / "Find something to watch" → `/`.

"Watched" means the title has at least one live diary entry (section A, A12). Insights therefore count every watched mark; today they ignore them (DES-8, `journalInsights.ts:133`).

#### B4.7.3 Lists (`/library/lists`)

Data: `useLists(select)` and C's `canCreateCustomList({customListCount, status})`.

- Each list is a `ListItem`:
  - leading: a 56 dp 2×2 poster mosaic (decorative);
  - headline: the list name;
  - supporting: "{n} titles";
  - trailing: a chevron → `listHref(id)`.
- The header has `Button tonal icon=add` "New list". Non-members also see `bodySmall` "{used} of 3 free lists".
- **Limit** (decision 6, C §1.11):
  - When `allowed: false`, "New list" calls `openPaywall('list_limit')`. The Plus sheet then leads with "Unlimited lists".
  - Lists above the limit stay fully usable; only creating a new one is blocked.
  - At `LIMITS.listsMax` (100, A2.6), "New list" shows the snackbar "You've reached the maximum of 100 lists."
- **Empty:** `EmptyState` `playlist_add`, "No lists yet" / "Group titles your way: date night, comfort shows, best of 2026." / "New list".

#### B4.7.4 Recent (`/library/recent`)

Data: `useRecent(select)`, `removeRecent`, `clearRecent` and the `recentPaused` preference.

- Recently opened titles, grouped by day: "Today", "Yesterday", then "Mon 24 Nov". At most 200 (`LIMITS.recent`).
- Rows are `MediaCard row` with a trailing `IconButton close` "Remove {title} from Recent", which removes with Undo.
- Bar overflow:
  - "Pause history" / "Resume history", which sets `setPreference('recentPaused', …)`;
  - "Clear history", which clears with the Undo snackbar "History cleared" / "Undo".
- **Paused:** a banner row `bodyMedium` "History is paused. New titles you open won't be added." with the text button "Resume".
- **Empty:** "Nothing here yet" / "Titles you open will show up here."
- TV entries get artwork and a type label like movies. Today show rows have no art (UXL §3.8).

Library analytics:

- `screen_view {screen_name: 'library'}`;
- `select_content` (surface `library`);
- `watchlist_remove`;
- `list_create`;
- `paywall_view` (fired by C on `openPaywall`).

### B4.8 Diary entry sheet

`src/features/library/components/DiarySheet.tsx`, a `Sheet presentation="auto"`.

- Title: "Log a watch" (new) or "Edit diary entry" (existing).
- Header: poster 48×72, title (`titleMedium`), year (`bodySmall`).

Fields, in order:

1. **Date watched.**
   - Chips "Today", "Yesterday", and "Pick a date…", which opens `DatePickerSheet` (max today, min 1900-01-01).
   - The chosen date replaces the third chip's label in locale format, e.g. "12 Nov 2026" (`Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric'})`).
2. **Your rating.** `StarRating` (half stars, `HalfStars` encoding) with label "Your rating", helper `bodySmall` "Tap a star. Tap its left half for a half star.", and a "Clear rating" button.
3. **Rewatch.** A switch `ListItem`: "I've watched this before" / "Marks this entry as a rewatch".
4. **Note.** `TextField multiline` labelled "Note", placeholder "What did you think? (optional)", `maxLength` 1000 (`LIMITS.note`), counter "{n}/1000".

Footer:

- Buttons: `Button text` "Cancel" and `Button filled` "Save".
- Existing entries also get "Delete entry" on the left, in a text button with `error` colour.
- If the title already has entries, the header offers "Log another watch", which starts a new entry with rewatch on.

Behaviour:

- **Save:** `logWatch` or `updateEntry`, close the sheet, then the snackbar "Saved to your diary".
- **Cancel with changes:** `ConfirmDialog` "Discard changes?" / "Your rating and note won't be saved." / "Discard" / "Keep editing".
- **Delete:** `removeEntry`, close the sheet, then the Undo snackbar "Entry deleted" / "Undo".
- **Errors:** the snackbar "Couldn't save. Try again." The safe messages from `presentation/journal/journal-copy.ts` are ported, except "Sign in to save your journal."

Analytics: `watched_add` on save (with `has_rating`, `has_note`, `rewatch`).

### B4.9 Lists: detail, create, rename, delete, add to list

**List detail** (`/list/[id]`, `listHref(id)`, `useList(id)`):

- `TopAppBar small`: back, the list name as title, and overflow "Rename list" / "Delete list".
- Body: `bodyMedium` "{n} titles" and a `PosterGrid`.
- Quick actions:
  - "Remove from {list}" (`setListItem(id, key, snapshot, false)`, then the Undo snackbar "Removed from {list}" / "Undo");
  - "Open title";
  - "Share".
- Empty: "This list is empty" / "Add titles from any title page with Add to list."

**Create and rename** (`ListNameSheet`):

- A `Sheet` titled "New list" or "Rename list", with a `TextField` "List name" (`maxLength` 60, autofocus).
- Footer: "Cancel" and "Create" / "Save". The primary button stays disabled while the trimmed name is empty.
- A duplicate name (compared case-insensitively) shows the error: "You already have a list called “{name}”."

**Delete:** `removeList(id)` runs optimistically, then the screen goes back and shows the Undo snackbar "List deleted" / "Undo". The titles stay in your library.

**`AddToListSheet`** (from Title and from quick actions):

- A `Sheet` titled "Add to list".
- The first row is `ListItem` `add` "New list", which follows the §4.7.3 limit. Then there is one checkbox `ListItem` per list, applied immediately.
- The footer has "Done". On close, the snackbar says "Added to {list}" when one list was added, otherwise "Lists updated".

Analytics: `list_item_add`, `list_create`.

Replaces: `WatchlistSheet.tsx`, `WatchlistActionsSheet.tsx`, the "Manage collections" flow.

### B4.10 Diary insights (`/library/watched?view=insights&year=YYYY`)

Insights is a view of the Watched section (section A §7.2). The Watched screen shows a `SegmentedButton` "Diary" / "Insights" under the section tabs. The v1 `/journal?tab=insights` redirect lands here.

Data: `useDiaryInsights(period)` and C's `insightsAccess(status)`.

Full (Plus):

- `TopAppBar small` "Insights".
- A year `SegmentedButton`, or a `Chip dropdown` when there are more than 3 years.
- Stat tiles in a wrap: "Titles watched", "Hours watched", "Average rating" (★ out of 5), "Movies", "TV shows".
- "By month": 12 bars built from `View`s, with `primary` fill on `surfaceContainerHigh` tracks. A visually hidden table carries the same numbers, and each bar's label reads like "March: 4 titles".
- "Top genres": the top 5, with counts.
- "Your highest rated": up to 10 posters.

Teaser (others):

- The "Titles watched" tile is real.
- The other tiles are locked cards (`lock` icon, `surfaceContainerHigh`) captioned "Plus".
- `Button filled` "See Plus" → `openPaywall('insights')`. Copy: "Unlock your year in review with Plus".

Empty year: "No watches logged in {year}".

Analytics: `insights_view {plus, period}` (C §5.5).

### B4.11 You (`/you`) and settings (`/settings/*`)

`TopAppBar small` "You". Body width `reading` (720 dp). Order: account card, Plus card, then the settings list (`SettingsList`, also rendered alone at `/settings`).

**Account card** (`surfaceContainerLow`, radius `medium`).

Signed out:

- title "Sign in to sync" (`titleMedium`);
- body "Keep your watchlist, diary and lists in sync across your devices.";
- an outlined `Button` "Continue with Google" with the Google "G" mark (`assets/brand/google-g.png`, 18 dp, per Google's sign-in branding guidelines; the owner supplies the asset).

Signing in (`signIn()`):

- while it runs, the button shows `loading` with "Signing in…";
- on error, the snackbar says "Couldn't sign in. Try again.";
- a cancel is silent.

Signed in:

- `Avatar 56`, name (`titleMedium`), email (`bodyMedium`);
- a sync line in `bodySmall` from `useSyncStatus()`: "Synced {relative time}", "Syncing…", "Offline. Changes will sync when you're back online.", or "Couldn't sync." with the text button "Try again" (`syncNow()`);
- the whole card links to `/settings/account`.

**Plus card.** Strings are section C §1.9 keys, with `{APP_NAME}` substituted.

| State | Content |
| --- | --- |
| Non-member, Android | Title "{APP_NAME} Plus" with `Badge plus`. Bullets: "No {APP_NAME} ads", "Unlimited lists", "Your year in review", "Accent themes". Button "See Plus" → `/plus?source=you_card` |
| Non-member, web | Title "{APP_NAME} Plus" with `Badge plus`. Bullets: "Unlimited lists", "Your year in review", "Accent themes" (no ads claim: the web has no ads). Button "See Plus" → `/plus?source=you_card` |
| Member | `status.renews` "Plus is active. Renews on {date}." or `status.until` "Plus is active until {date}.", then "Manage subscription" |
| Billing issue | `errorContainer` card with `status.billing` "There's a payment problem with your subscription. Update your payment method in Google Play to keep Plus." and "Manage subscription". The navigation "You" dot is shown. |
| Web (`play_link`) | `web.cta.play` "Get {APP_NAME} Plus on Google Play" (Google Play badge; port `PlayStoreButton.tsx` and `assets/images/google-play-badge.png`). Signed out: `web.signIn` "Already a member? Sign in". Signed in: "Refresh status" |

**`SettingsList`** (`ListItem`s with chevrons, grouped by `SectionHeader level=3`):

| Group | Rows |
| --- | --- |
| Settings | "Appearance" → `/settings/appearance`; "Region and services" (value "{country} · {n} services") → `/settings/streaming`; "Privacy" → `/settings/privacy`; "Account" (signed in only) → `/settings/account` |
| Ads (Android, non-members only) | `row.ad_free` "Ad-free with Plus" → `openPaywall('ad_free_row')` |
| About | "About {APP_NAME}" → `/settings/about`; "Version {version} ({build})" (non-interactive) |

Removed from v1 Preferences (DES-14, UXL-14), taking about 40 rows down to 7 on You plus 5 short pages:

- Browse defaults;
- Playback (autoplay, mini player, autoplay next);
- Notifications (daily picks, quality, rating and genre filters, quiet hours);
- the Search and Watchlist settings, including "Confirm removals";
- Buy me a coffee (decision 6);
- "Rate on Google Play".

**`/settings/appearance`** (`TopAppBar` "Appearance"):

- "Theme": `SegmentedButton` with System, Light and Dark.
- "Accent": 5 swatches, each a 40 dp circle in a 48 dp target, `role="radio"`. Names come from `tokens.accentNames` (`config/brand.json`; placeholders "Default", "Teal", "Plum", "Forest", "Cobalt" until the Identity step).
  - For non-members, the Plus swatches show `lock`, and a tap calls `openPaywall('accent_theme')`.
- "Trailers" group: a switch "Show captions", supporting "Turn on captions when a trailer starts, if available." It sets `trailerCaptions` (section A §2.7).

**`/settings/streaming`** (`TopAppBar` "Region and services"):

- Country row:
  - "Country" with value "{name}", plus "Based on your device" as supporting text when automatic;
  - opens `CountryPickerSheet`.
- Services:
  - `SectionHeader` "Your streaming services", subtitle "Pick the services you pay for. We'll show them first.";
  - a filter field "Find a service";
  - a wrap grid of provider tiles for the region from `useProviderCatalog(region)`, sorted by priority;
  - each tile is a 48 dp logo plus the name, with `role="checkbox"`, `aria-checked` and a check `Badge` when selected;
  - changes save immediately, with a `short` "Services updated" snackbar debounced to 2 s;
  - under the grid: "Streaming data from JustWatch" (A §3.6);
  - empty filter: "No services match “{q}”".

`CountryPickerSheet`:

- A searchable list from `useRegions()`.
- The first row is "Use device country ({name})", then a divider, then A–Z.
- Selecting a country closes the sheet.
- No location permission (decision 8, AND-10).

The services picker sheet used by Search and Title is the same grid inside a `Sheet`.

**`/settings/privacy`** (`TopAppBar` "Privacy"):

- "Usage analytics" switch, supporting "Google Analytics measures how {APP_NAME} is used with a random app ID, never your name or email." It sets `setConsent` analytics.
- "YouTube trailers" switch, supporting "Trailers play from YouTube, which receives your IP address and what you watch, and may set cookies."
- "Ad privacy choices", Android only and only when UMP reports privacy options are required (`useAdPrivacyOptions()`, C §2.4). Supporting "Review how Google uses data for ads in {APP_NAME}." It calls `showPrivacyOptionsForm()`.
- "Request a copy of your data": opens an email to `SUPPORT_EMAIL` (`src/core/config/legal.ts`) with subject "{APP_NAME} data request".
- "Privacy policy": opens `PRIVACY_URL`.

**`/settings/account`** (`TopAppBar` "Account", signed in only; signed out it redirects to `/you`):

- Account header: avatar, name and email.
- The sync line with "Sync now".
- The v1 import status row, as section A defines it.
- "Sign out" (`logout`). Signing out removes account-synced data from the device (section A, A11), so it always confirms:
  - `ConfirmDialog` "Sign out?" / "Your watchlist, diary, lists and settings stay saved to your {APP_NAME} account and come back when you sign in again. They will be removed from this device." / "Sign out" / "Cancel";
  - then the snackbar "Signed out";
  - Plus stays on the device that paid (C §1.4).
- "Delete account" (destructive):
  - It opens a `Sheet presentation="dialog"` titled "Delete your account?" with two paragraphs:
    - "This permanently deletes your {APP_NAME} account and the watchlist, diary, lists, history and settings saved to it, on our servers and on this device."
    - "If you have {APP_NAME} Plus, deleting your account does not cancel it. Cancel it in Google Play first."
  - "Delete account" first asks Google to confirm the account (reauthentication, A6.7 step 2); cancelling it changes nothing.
  - Buttons: `Button destructive` "Delete account" and "Cancel".
  - While deleting (`deleteAccount()`), the button shows `loading` with "Deleting…".
  - Success: navigate to `/you` with the snackbar "Your account was deleted."
  - Failure: the snackbar "Couldn't delete your account. Try again."
  - Delete now lives on its own page, not next to everyday rows (UXL-14).

Analytics:

- `screen_view` (`you`, `settings`);
- `login` / `sign_up` (fired by C on interactive sign-in);
- `setting_change` for theme, accent, region, services, analytics consent and trailer captions.


### B4.12 Plus page and Plus sheet

`src/features/monetization/components/PlusOffer.tsx` renders section C's `usePaywall(placement)` model (C §1.9). It has two containers:

- the page `/plus` (`TopAppBar` "{APP_NAME} Plus", width `reading`);
- the Plus sheet (`Sheet presentation="auto"`), opened by C's `openPaywall(placement)`.

There are no automatic pop-ups (decision 6). The paywall opens only from these places (C §1.2):

- the You tab's Plus card (`you_card`), through `/plus?source=you_card`;
- the `/plus` route;
- creating a 4th list (`list_limit`);
- insights (`insights`);
- "Ad-free with Plus" (`ad_free_row`);
- accent swatches (`accent_theme`).

The page reads `source` (A7.2: `/plus?source={placement}`) for its `paywall_view` placement; values outside `PaywallPlacement` (Part 0, I-15) fall back to `plus_route`.

Structure. Strings are C §1.9 keys with `{APP_NAME}` substituted.

1. **Hero.**
   - `workspace_premium` icon, 48 dp, in `primary`.
   - Title (`headlineSmall`; `displaySmall` on expanded): `title` "{APP_NAME} Plus".
   - Subtitle `bodyLarge`: `subtitle` "Support an independent app and unlock a few extras."
2. **Benefits** (`ListItem`s, icon + headline + supporting):

| Icon | Key |
| --- | --- |
| `workspace_premium` | `benefit.no_ads` (Android only; hidden on web, where there are no ads) |
| `playlist_add_check` | `benefit.lists` |
| `trending_up` | `benefit.insights` |
| `palette` | `benefit.accents` |

   The `placement` decides which benefit leads: `list_limit` → lists, `insights` → insights, `accent_theme` → accents, `ad_free_row` → no ads.

3. **Plans** (Android `store` mode, non-members).
   - One `role="radio"` card per `PlusOffer`: `surfaceContainerLow` with a 1 dp `outline`, or a 2 dp `primary` border and a check icon when selected.
   - Labels: `offer.monthly` "Monthly · {price} / month"; `offer.annual` "Yearly · {price} / year ({perMonth} / month)" with `Badge primary` `savingsLabel`.
   - Monthly is listed first and preselected; yearly follows with the `Save {n}%` badge (C1.8 is authoritative; Part 0, I-63). Prices are never hard-coded (decision 6).
4. **Primary CTA.**
   - `Button filled large fullWidth` `cta.subscribe` "Subscribe for {price} / {month|year}". It is `loading` while `busy === 'purchasing'` and disabled while a purchase is pending.
   - Below it, `bodySmall` `disclosure`.
   - Signed-out Android users also see `android.signedOutNote`.
5. **Secondary.**
   - Text buttons: `restore` "Restore purchases" (with `restore.smallprint.signedIn` or `restore.smallprint.signedOut` under it) and, for members, `manage` "Manage subscription".
   - Links: "Terms" and "Privacy policy" (`bodySmall`).
6. **Messages.**
   - `message.*` strings render as an inline `bodyMedium` block above the CTA, with `role="alert"` for failures.
   - `message.thanks` shows as a snackbar.
7. **Member state.**
   - The hero subtitle becomes `statusLine`.
   - Benefits show check marks.
   - The plan cards are replaced by `ListItem` "Your plan" with `statusLine` and "Manage subscription".
8. **Web (`play_link`).**
   - Instead of plans: `web.cta.play` "Get {APP_NAME} Plus on Google Play" (`Button filled large`; `track(play_store_open)` is C's).
   - `web.signIn` when signed out.
   - `web.refreshHint` and `refresh` "Refresh status" when signed in.

Replaces: `supporter-paywall.tsx` (437 lines), `supporter-benefits.tsx`, `supporter-discovery-card.tsx`, `UpgradeScreen.tsx`. The old `/upgrade` route was unreachable in-app (DES-13).

### B4.13 Consent prompt (non-blocking)

`src/features/settings/public/ConsentPrompt.tsx`, mounted once by `AppRoot`.

When it shows:

- after the first screen has rendered, while `consentPromptDue(consent)` holds (`decidedAt === null || noticeVersion !== V2_NOTICE_VERSION`, A2.7): every fresh install and every migrated v1 record until they answer;
- never while a trailer is open (`usePlayerOpen()`, B3.8) and never over the Plus sheet;
- it never blocks content (decision 4), and server HTML contains content, not a gate (WEB-5).

Any answer stores `decidedAt` and `V2_NOTICE_VERSION` and hides the prompt for good: "Allow" sets `analytics: true`; "Not now" and "×" set `analytics: false` (Part 0, I-17). The switch remains in You › Privacy.

Deferral (coverage review, issue 4): when the card has been visible for 60 s of foreground time, or the user has opened three title pages while it was visible (counted from `usePathname()` changes to a `/title/` path), it hides for the rest of the session without recording an answer. `isConsentPromptResolved()` is `!consentPromptDue(consent) || deferredThisSession`, so an ignored card never holds UMP (and with it every ad) back; the prompt returns on the next cold start until answered. Analytics stay off throughout.

`consent.test.ts` (P6) covers: a fresh install shows the prompt; a migrated v1 record shows it once; an answer hides it for good; deferral after 60 s and after the third title page resolves the prompt without setting analytics, and the prompt returns on the next start.

Look:

- **Compact:** a card pinned above the navigation bar (full width minus 16 dp, `surfaceContainerHigh`, level-2 shadow).
- **Medium and expanded:** bottom-left, 400 dp wide.
- `role="region"`, `aria-label="Privacy choice"`. It is not modal: focus is not trapped.

Copy:

- Title (`titleMedium`): "Allow usage analytics?"
- Body (`bodyMedium`): "Google Analytics measures how {APP_NAME} is used with a random app ID, never your name or email. You can change this anytime in You › Privacy."
- Link: "Privacy policy".
- Buttons: `text` "Not now", `tonal` "Allow".

Analytics stays off by default. AdMob UMP is a separate Google form that section C shows only after this prompt is answered, dismissed or deferred (C §2.4). On web the card sets `--overlay-height` while visible (B1.4.5).

### B4.14 About and legal (`/settings/about`)

`TopAppBar` "About". Width `reading`.

1. The wordmark, `bodyMedium` "Version {version} ({build})", and `bodyMedium` "Find what to watch and where to stream it." In builds with `EXPO_PUBLIC_DIAGNOSTICS=1` (the preview profile), tapping the version line seven times reveals three buttons, "JS crash", "Native crash" and "NDK crash", which call `triggerDiagnostic` (C4.11); production builds compile them out.
2. "Data sources" (H2):
   - The TMDB logo `assets/attribution/tmdb.svg` (section A §3.6). It is rendered with `expo-image`, which supports SVG, and is less prominent than the app wordmark.
   - `bodyMedium` "This product uses the TMDB API but is not endorsed or certified by TMDB." This is required (developer.themoviedb.org/docs/faq, read 2026-11-26) and missing today (SCOPE-13).
   - "Streaming availability data by JustWatch." (link).
   - "Trailers play in the YouTube player. YouTube's Terms of Service and Google's Privacy Policy apply." Links: `https://www.youtube.com/t/terms` and `https://policies.google.com/privacy` (YouTube API Services Developer Policies III.A.1).
3. "{APP_NAME} does not host, stream or sell movies or TV shows. To watch a title, use one of the services listed under Where to watch." This sets the expectation behind the 2.8★ reviews (UXL-3).
4. Links (`ListItem` with `open_in_new`):
   - "Privacy policy", "Terms of use";
   - "Open-source licenses" (a static page generated at build);
   - "Report a problem" (email to `SUPPORT_EMAIL`);
   - "Copyright concerns" (email; SCOPE-17).

Analytics: `screen_view {screen_name: 'settings'}`.

### B4.15 Not found (`+not-found.tsx`)

- A root-level route with a minimal frame: `TopAppBar small` with the wordmark on compact and medium, or the `WebHeader` on expanded web.
- `EmptyState` `search`: "Page not found" / "The page you're looking for doesn't exist or has moved." / "Go to Home" (`/`) / "Search" (`/search`).
- Web returns HTTP 404 (section C §3.2).

### B4.16 Legacy resolvers (`/movie/[id]`, `/show/[imdbId]`)

These are section A's `LegacyMovieRedirect` and `LegacyShowRedirect` (A §7.3). Design adds the visuals:

- While resolving: a skeleton Title.
- On success: `<Redirect href={path}>`.
- On 404: `EmptyState` `history`, with section A's copy and `{APP_NAME}`: "This link is from an older version of {APP_NAME}" / "We couldn't find this title in the new catalog." / "Search for it" → `/search` / "Go to Home" → `/`.
- On a network or 502 error: `ErrorState` "Couldn't open this link right now" / "Try again".

### B4.17 Site footer (web)

`src/core/ui/components/SiteFooter.web.tsx`. The twin `SiteFooter.tsx` returns `null` on Android (the native `HomeFooter` is deleted, DES-22). It is rendered at the end of Home, Search start mode, You and About.

- `role="contentinfo"`.
- Line 1, links (`bodySmall`): "About", "Privacy", "Terms", "Get the Android app".
- Line 2: the TMDB logo (small), then "This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming data from JustWatch. {APP_NAME} does not host video."

## B5. Trailer UX

### B5.1 Rules

1. **Tap to play only.** There are two entry points: "Play trailer" on the Title page and on the Home featured card. Nothing autoplays: no hero autoplay, no "autoplay trailers" setting, no hover previews, no "Play trailers" playlist and no up-next queue.
2. **Visible and unobscured.**
   - Nothing is drawn over any part of the YouTube iframe or WebView. The Close button and the title sit outside the player's rectangle.
   - This follows YouTube RMF: "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player" and "an API Client must not initiate an automatic playback until the player is visible" (developers.google.com/youtube/terms/required-minimum-functionality, read 2026-11-26).
   - It fixes `HeroTrailerLayer.tsx:30-73` (crop, `opacity: 0` autoplay, overlay) and the 36 dp collapse and PiP buttons that sat over the player (UXL §2.2).
   - App-level overlays wait too: snackbars, the consent prompt and the Plus sheet never render while `TrailerFrame` is open (`usePlayerOpen()`, B3.8).
3. **Minimum size.** The viewport is at least 200×200 dp. Player height = `max(200, width × 9 / 16)`, letterboxed in black.
4. **No player outside the frame.** There is no mini-player, queue, autoplay-next, document PiP or drag-to-minimize (decision 8). The player exists only inside `TrailerFrame` and unmounts on close.
5. **No ad near playback.** No ad ever sits between a trailer tap and playback (§5.4; MON-3; YouTube Developer Policies III.F.3, cited in section C §2.9).

### B5.2 Flow

1. **Open.** The tap opens `TrailerFrame` and calls `reportTrailerState('requested')`, which C's 30 s `TRAILER_GUARD_MS` reads; the first `PLAYING` calls `reportTrailerState('playing')` and closing calls `reportTrailerState('stopped')` (Part 0, I-49).
2. **Consent** (first time only, while `Consent.youtube` is false):
   - The frame shows a consent panel on the title's backdrop. The player is not mounted yet, so nothing covers it.
   - Copy:
     - title `titleLarge` `onMedia`: "Trailers play from YouTube";
     - body `bodyMedium`: "YouTube receives your IP address and what you watch, and may set cookies. By playing, you agree to the {APP_NAME} Privacy Policy and the YouTube Terms of Service.";
     - buttons: `filled` "Play trailer", `text` "Not now";
     - links: "{APP_NAME} Privacy Policy" → `PRIVACY_URL`; "YouTube Terms of Service" → `https://www.youtube.com/t/terms`; "Google Privacy Policy" → `https://policies.google.com/privacy`.
   - This panel is the agreement point that YouTube API Services Developer Policies III.A.1 (display a link to the YouTube Terms of Service) and III.A.2 (users agree to a privacy policy that tells them the app uses YouTube API Services and links the Google Privacy Policy, before they use the API features) require now that the 18+ gate is gone (Part 0, I-62). `Consent.youtube = true` records the agreement; `privacy.html` carries the YouTube API Services section (C6.8).
   - "Play trailer" calls `setConsent({youtube: true})` and mounts the player within the same tap, so consent and intent cost one tap.
   - "Not now" closes the frame.
   - This replaces `youtube-consent.tsx`, whose prompt sat over an empty black player (UXL-16).
3. **Playback.**
   - Web: section C §3.7. It uses the YouTube IFrame API with the `youtube-nocookie` host and `playVideo()` on `onReady`. If `PLAYING` is not reached within 4 s, autoplay was blocked: YouTube's own play button stays visible and nothing is drawn over it. This replaces the handshake that failed in 16 of 23 web starts (WEB-8).
   - Android: `TrailerPlayer` renders `react-native-youtube-iframe` with:
     - `play` set to true after `onReady`;
     - `forceAndroidAutoplay`;
     - `initialPlayerParams {controls: true, rel: false, showClosedCaptions: trailerCaptions}`;
     - `webViewProps = YOUTUBE_WEB_VIEW_PROPS` (port `presentation/player/youtubeWebView.ts` and its test unchanged).
   - Captions follow the `trailerCaptions` preference (You › Trailers) on both platforms.
4. **End.** YouTube's end screen stays. Nothing auto-advances.
5. **Close.**
   - Triggers: the Close button ("Close trailer"), Android back, Escape (web), or a scrim click (dialog only).
   - Closing unmounts the player, which stops the audio and frees the WebView.
   - Focus returns to the button that opened the frame (react-native-web `Modal`).
6. **Errors** (one panel, which replaces the player):

| Case | Copy | Actions |
| --- | --- | --- |
| YouTube error `2`, `5`, `100`, `101`, `150` (web per C §3.7; Android maps the same codes, port the table in `presentation/player/PlaybackDiagnostics.ts:3-10`) | "This trailer can't play here." | "Watch on YouTube" (opens `https://www.youtube.com/watch?v={key}`), "Close" |
| Web `api_timeout` (the IFrame API did not load within 10 s, C §3.7) | "Couldn't load the trailer." | "Try again", "Watch on YouTube" |
| Android: no `onReady` within 15 s | "Couldn't load the trailer." | "Try again", "Watch on YouTube" |

Telemetry is section C's:

- `track(trailer_start)` on the first `PLAYING`;
- the Sentry metric `player.start` with outcome `playing`, `blocked`, `error_{code}` or `api_timeout`.

### B5.3 Presentation

| Class | Container | Layout |
| --- | --- | --- |
| Compact (Android, mobile web) | `Sheet presentation="fullscreen"`: black, edge-to-edge, status bar hidden while open | See below |
| Medium, expanded | `Sheet presentation="dialog"`, width `min(960, windowWidth − 2 × gutter)`, `scrim` 0.6 | See below |

Compact layout:

- A 56 dp top row: `IconButton media close` "Close trailer" on the left, then `titleMedium` `onMedia` "Trailer: {title}" on one line.
- The player is centred vertically at full width. In landscape it fits the height.
- YouTube's own fullscreen button works (WebView `allowsFullscreenVideo`).

Medium and expanded layout:

- A header row: `titleLarge` "Trailer: {title}" and Close.
- The player is 16:9 at the dialog's width, at least 480 dp wide where the window allows (the RMF recommendation), and flush with the dialog's bottom.

### B5.4 The Android interstitial (section C owns the logic)

Section C's `openTitle(navigate, input)` (C §2.6) and `decideAd` (C §2.2) implement the decision-6 pacing: no ad in the first 3 tap opens of a session, at most one per 4 opens, at least 180 s apart. Ads are also never shown:

- on deep links;
- to Plus users;
- while a trailer is playing, or within 30 s of a trailer request.

Design requirements on that flow:

1. **Placement.** The ad appears only on the tap that opens a title, before navigation. It never appears on:
   - app start;
   - a "Play trailer" tap, or closing a trailer;
   - back navigation or a tab switch;
   - a Search keystroke;
   - opening a person, season or list;
   - a notification or deep link.

   The Title page never starts playback by itself, so no ad can come between a tap on "Play trailer" and the player.
2. **Transition surface.** C shows a pre-ad screen for 400 ms (C §2.6 step 4). Design:
   - a full-screen `surface`, with the title's poster (`Artwork poster w342`, 120 dp) centred;
   - under it, `titleMedium` "Opening {title}…";
   - no spinner and no "Ad" wording; the ad SDK labels its own ad;
   - `role="status"`, announced as "Opening {title}".

   Under reduced motion it appears and disappears without fading.
3. **After the ad.** The title page appears at once, already prefetched by C's `prefetchQuery`. With a `summaryCache` hit, the header is visible on the first frame.
4. **No waiting state anywhere else.** If no ad is ready, navigation is immediate and shows nothing extra.
5. **Web.** `openTitle.web.ts` only navigates (C §2.6); web has no ads.

Acceptance:

- C §2.11.
- In addition, on Android with test ads: 20 consecutive "Play trailer" taps never present an ad.
- No ad is ever visible while `TrailerFrame` is open.

## B6. Accessibility and web keyboard behaviour

Target: WCAG 2.2 AA on web, plus the equivalent Android accessibility guidelines.

### B6.1 Targets, feedback and focus

- **Targets.**
  - Android: every control is at least 48×48 dp, including chips, stars, rail arrows and dialog close buttons. Today 57 sizing declarations are 44 dp, and poster overlay buttons and chips are 36 dp (DES-10).
  - Web: at least 40×40 px, and spacing never under 24 px (WCAG 2.5.8).
- **Feedback.** An Android ripple on every pressable, and a hover state layer on web (§3).
- **Focus visible.** A 2 px `focusRing` outline with a 2 px offset, through `:focus-visible` on web and the `outline*` style while focused on Android (keyboard and D-pad). This replaces the faint browser ring `rgb(16,16,16) auto 1px` on the dark page (UXL §3.2).

### B6.2 Contrast

Every token pair is in §2.2. Text over images is not allowed (rule 2). Icons on imagery use `media` `IconButton`s (40 dp, `rgba(0,0,0,0.6)` fill), so the glyph has at least 4.5:1.

### B6.3 Screen readers

**Structure.**

- One H1 per page (`PageTitle`, §1.5). Sections are H2 (`SectionHeader`) and sub-groups H3.
- Landmarks:
  - `banner` (WebHeader);
  - `navigation` "Main" (bar, rail and the header's nav);
  - `main` (`ScreenScaffold`);
  - `search` (the SearchField wrapper);
  - `contentinfo` (SiteFooter);
  - `region` for each rail, labelled by its header.
- This fixes five `<h1>`s on Title and the non-heading "Where to watch" (UXL-7).

**Names.**

- Every `IconButton` has a required `label`.
- Cards use the composed names in §3.11.
- Provider tiles say where they go (§3.14).
- Dialogs and sheets take their name from the title through `aria-labelledby`. Today dialogs have no accessible name (UXL-7).

**State.**

- `aria-checked`: filter chips, switches, checkbox rows, segmented radios.
- `aria-selected`: Android tabs.
- `aria-current="page"`: web navigation and section tabs.
- `aria-expanded`: dropdown chips and "More" toggles.
- `aria-pressed` / `togglebutton`: Watchlist and Watched.
- `aria-busy`: loading regions.

**Live regions.** Snackbars (`status` or `alert`), search result counts (polite), errors (`alert`), the `StarRating` value text and the `DatePickerSheet` month. On Android, `AccessibilityInfo.announceForAccessibility` covers snackbars and errors.

**Images.**

- Card artwork is decorative; the link names the card. Backdrops are decorative.
- Title and Person posters: `alt="Poster for {title}"` and `"Photo of {name}"`.
- `ImageViewer` images: "Image {n} of {total} from {title}".

**Android custom actions.**

- `MediaCard`: "Add to watchlist" / "Remove from watchlist", "Mark watched", "More actions".
- Diary rows: "Edit entry", "Delete entry".
- Recent rows: "Remove".

Long-press is never the only way to reach an action.

### B6.4 Text scaling to 200%

- Text scales everywhere (`allowFontScaling` default). The only caps are `maxFontSizeMultiplier` 1.5 on navigation labels and 1.3 on badges; their accessible names are unaffected.
- No fixed heights on anything that contains text. Components use `minHeight`:
  - buttons, chips and list items;
  - top app bars: the title wraps to 2 lines, then ellipsizes, with the full title as `aria-label`;
  - section tabs, which scroll horizontally;
  - snackbars, where the action wraps under the message.
- Rails keep their card widths. Card titles wrap to 2 lines and meta to 1, and card height grows.
- Acceptance:
  - Android 14+ at font scale 2.0 on 360×800 dp. On Home, Search, Title, Library, You, the Plus sheet and the Diary sheet: no clipped or overlapping text, every action reachable, and no horizontal page scroll outside rails and chip rows.
  - Web at 200% browser zoom in a 1,280 px window (which yields the compact or medium layout): same checks.
  - Web at 200% text-only zoom (Firefox): same checks.

### B6.5 Web keyboard

| Key | Behaviour |
| --- | --- |
| Tab (from load) | Skip link "Skip to content" → navigation → main content (§1.9 #3). Navigation is first in the DOM on every class (§1.4.2). |
| `/` | Expanded: focuses the header `SearchField` and selects its text. Compact and medium: navigates to `/search` and focuses its field. Ignored when focus is in an input, textarea or contenteditable, when a modifier key is held, or while a dialog is open. The header field has `aria-keyshortcuts="/"`. |
| Escape | Closes the top sheet, dialog, trailer or image viewer (react-native-web `Modal`). In a search field that has text, it first clears the text. |
| Enter / Space | Activate the focused control. Space is never captured globally. v1's `useKeyboardShortcuts.web.ts` blocks Space while a player is open (WEB-15) and is deleted. |
| Arrow keys | Move within segmented buttons, the star rating, the date grid, the image viewer, and search results (ArrowDown from the field). |
| Home / End | First or last segment; rating 0.5 or 5. |

- **No keyboard traps.** Focus is trapped only inside modal sheets and dialogs, and always returns to the opener.
- **After a route change on web,** focus moves to `main` (`ScreenScaffold`, `tabIndex -1`) and the document title updates through `ScreenScaffold`'s `<Head>` (B3.27); the server HTML title comes from `generateMetadata` (C3.2). Screen readers therefore get a page-change cue.
- **Focus not obscured** (WCAG 2.2 SC 2.4.11): `scroll-padding-bottom` keeps a focused element clear of the bottom bar, the consent card and snackbars (B1.4.5).
- **Real links.** Cards, navigation, "See all" and section tabs are `<a href>`, so open-in-new-tab works. Today show cards are `div role=link` with no href (UXL §3.5).

### B6.6 Motion and time

- Nothing auto-advances or autoplays, which satisfies WCAG 2.2.2.
- Reduced motion is honoured per §2.8.
- Snackbar timing follows §3.8: Undo stays available while focused, and for 12 s with a screen reader on.

### B6.7 Verification

- **Automated.** Each kit component has a test asserting its `role` and `aria-*` props in every state. It runs under `node --test` with the Babel fixture setup that sections A and tooling keep.
- **Manual, per release.**
  - A TalkBack pass over 6 flows: find a title; play a trailer; save to Watchlist and undo; log a watch with a rating; create a list at the free limit; change country.
  - A web keyboard-only pass over the same flows, checking that the focused element is never hidden behind the consent card or a snackbar and that no overlay appears while a trailer is open.
  - A contrast spot-check: regenerate the table with `spec/B-design-ux-tools/matrix.py` after copying values from `tokens.ts`.

## B7. Delete and port inventory (`presentation/`, 152 files, 20,370 lines)

Fates:

- **Delete**: gone, with no replacement.
- **Port**: move the file with the stated edits; the logic stays.
- **Rewrite**: replaced by the named v2 file. Read the old file only for behaviour and copy.

Section A's §1 tree is authoritative for paths outside `src/core/ui/` and the screens.

| Old path | Fate | v2 path / reason |
| --- | --- | --- |
| `analytics/events.ts` | Rewrite | Section C `src/core/platform/telemetry/events.ts` (24 events) |
| `anime/*` (3) | Delete | Decision 2 |
| `components/WebAdvertisement(.web).tsx` | Delete | No web ads (decision 6, C §2.10) |
| `components/blur-target.tsx`, `liquid-glass-view.tsx` | Delete | Glass and blur (decision 8, DES-21) |
| `components/confirm-dialog.tsx` | Rewrite | `src/core/ui/components/ConfirmDialog.tsx` on `Sheet`; `useConfirm` API kept |
| `components/linear-gradient.tsx` | Port | `src/core/ui/components/Scrim.tsx` (`backgroundImage` on both platforms) |
| `components/motion.tsx` | Delete | Durations → `tokens.motion`; `PressableScale` → `Touchable` (ripple and state layer, not scale); `Shimmer` → `Skeleton` |
| `components/navigation-link.tsx` | Delete | `Touchable href` |
| `components/offline-banner.tsx` | Rewrite | Inline `OfflineBanner` (§3.27) |
| `components/overlay-provider.tsx` | Delete | `@gorhom` provider |
| `components/privacy-gate.tsx`, `privacy-home-backdrop.tsx`, `assets/images/welcome/*.jpg` (4 files) | Delete | 18+ gate removed (decision 4); `ConsentPrompt` (§4.13) |
| `components/screen.tsx`, `themed-view.tsx` | Rewrite | `ScreenScaffold` |
| `components/system-bars(.web).tsx` | Port | `src/core/ui/systemBars(.web).ts`, colours from tokens |
| `components/themed-text.tsx` | Rewrite | `Text`, `Heading` |
| `components/toast.tsx`, `update-snackbar.tsx` | Rewrite | `SnackbarHost`. Store-update copy is C §4.5 |
| `components/ui/icon-symbol(.ios).tsx` | Delete | Dead code (DES-20) |
| `components/web-startup-placeholder(.web).tsx` | Delete | Server-rendered content replaces the hand-copied skeleton (DES-22; C §3.2) |
| `components/youtube-consent.tsx` | Rewrite | Consent panel in `TrailerFrame` (§5.2) |
| `constants/legal.ts`, `site.ts` | Port | `src/core/config/app.ts` and `legal.ts` (A1.1); `openLegalPage` → `src/core/platform/openUrl(.web).ts` (A) |
| `constants/theme.ts` | Rewrite | `src/core/ui/theme/tokens.ts`; values carried per §2 |
| `constants/web-page-meta.ts` | Section C | `generateMetadata` (C §3.2) |
| `di/DependenciesContext.tsx`, `index.ts` | Delete | No barrels and no DI bag (section A) |
| `hooks/use-android-back.ts` | Delete | `Modal onRequestClose` and the navigators cover it |
| `hooks/use-availability-alerts.ts`, `use-subscriber-access.ts`, `use-reload-on-catalog-access(.web).ts`, `use-reload-when-online.ts` | Delete | Features removed; TanStack Query handles refetching |
| `hooks/use-color-scheme(.web).ts`, `use-palette.ts`, `use-theme-color.ts` | Rewrite | `ThemeProvider` / `useTheme` |
| `hooks/use-device-corner-radius.ts`, `use-is-desktop.ts`, `use-preview-active.ts`, `use-visible-impression.ts` | Delete | Dead code, Electron, hero preview, shelf impressions |
| `hooks/use-haptics(.web).ts` | Port | `src/core/platform/haptics(.web).ts`. Used by the watchlist and watched toggles and by star steps |
| `hooks/use-reduce-motion.ts` | Delete | Reanimated `useReducedMotion` |
| `hooks/use-responsive.ts` | Rewrite | `useWindowClass` (§1.3) |
| `hooks/use-auth.ts`, `use-journal.ts`, `use-preferences.ts`, `use-privacy-choices.ts`, `use-purchases.ts`, `use-sync-status.ts`, `use-is-online.ts`, `use-page-meta(.web).ts` | Sections A / C | A §4.4 hooks; C `usePlus` / `usePaywall` |
| `journal/JournalScreen.tsx`, `JournalEditor.tsx` | Rewrite | Library › Watched (§4.7.2) and `DiarySheet` (§4.8) |
| `journal/JournalMoviePicker.tsx`, `JournalSavedNotice.tsx` | Delete | Log from the Title page; snackbar |
| `journal/journal-copy.ts` | Port | Diary copy, without the sign-in string |
| `movies/HomeScreen.tsx` | Rewrite | `src/features/home/screens/HomeScreen.tsx` (§4.1) |
| `movies/MoviesScreen.tsx` | Rewrite | `src/features/search/screens/SearchScreen.tsx`, browse mode |
| `movies/WatchScreen.tsx`, `ShowDetailsScreen.tsx` | Rewrite | `src/features/title/screens/TitleScreen.tsx` |
| `movies/ShowsScreen.tsx` | Delete | Decision 2; TV is a content type in Search |
| `movies/WatchlistScreen.tsx`, `HistoryScreen.tsx` | Rewrite | Library sections |
| `movies/PreferencesScreen.tsx` (1,410 lines) | Rewrite | You plus `/settings/*` (§4.11) |
| `movies/components/ChipBar.tsx`, `MovieFilterModal.tsx`, `PickerSheet.tsx` | Delete | `Chip` plus filter sheets |
| `movies/components/DescriptionCard.tsx`, `DurationBadge.tsx`, `NewBadge.tsx`, `TopTenContext.tsx`, `ScrollProgress.tsx`, `SearchOverlay.tsx`, `SearchResultRow.tsx`, `Skeleton.tsx`, `VideoCard.tsx`, `VideoRow.tsx`, `ShowStrip.tsx`, `HomeFooter.tsx`, `TopBar.tsx`, `TopBarSlot.tsx`, `TorrentNoticeSheet.tsx`, `WatchActions.tsx`, `WatchlistControls.tsx`, `WatchlistStreamingControls.tsx`, `WatchlistStreamingBadge.tsx`, `providerLinks.ts`, `moviePosterLayout.ts` | Delete | Duplicates, dead code, torrent UI or replaced chrome |
| `movies/components/HeroBillboard.tsx` (791), `HeroSkeleton.tsx`, `HeroTrailerLayer.tsx`, `YoutubePlayer(.web).tsx` | Delete | Rotating hero and hero autoplay (decision 8). Replaced by `FeaturedTitle` in `src/features/home/components/` |
| `movies/components/HoverCard(.web).tsx` (488) | Delete | Quick actions do this job. `poster_hover_card` came from 38 web users in 90 days (`research/data-browser.md` §2.4) |
| `movies/components/MoviePosterItem.tsx`, `MovieLandscapeItem.tsx`, `Thumbnail.tsx` | Rewrite | `MediaCard`, `Artwork`; port the accessible-name format |
| `movies/components/MovieRail.tsx` | Rewrite | `Rail` |
| `movies/components/HistoryRow.tsx` | Rewrite | Recent rows (`MediaCard row`) |
| `movies/components/WatchProviders.tsx`, `StreamingOffers.tsx` | Rewrite | `WhereToWatch` section plus `ProviderRow` (§4.4) |
| `movies/components/WatchRegionPicker.tsx`, `StreamingServicesPicker.tsx`, `MyStreamingServices.tsx` | Rewrite | `CountryPickerSheet`, `/settings/streaming`, the services picker sheet |
| `movies/components/WatchlistSheet.tsx`, `WatchlistActionsSheet.tsx` | Rewrite | `AddToListSheet`, `ActionSheet` |
| `movies/components/ScreenshotLightbox.tsx` | Rewrite | `ImageViewer` |
| `movies/components/PlayStoreButton.tsx` plus `assets/images/google-play-badge.png` | Port | `src/core/ui/components/GetItOnGooglePlay(.web).tsx`; the web Plus page and footer use it |
| `movies/components/format.ts` | Port (partial) | `src/core/ui/format.ts`: one `formatRuntime`. Drop the YTS thumbnail helpers and `ytThumb` |
| `movies/components/openStreamingLink(.web).ts` | Port | Section A `src/core/platform/openUrl(.web).ts`; Custom Tab `toolbarColor = surface` (`expo-web-browser` `WebBrowser.types.d.ts:9-67`) |
| `movies/components/shareLink(.web).ts` | Port | Section A `src/core/platform/share(.web).ts` |
| `movies/components/watchRegion.ts` | Port | Section A `src/core/platform/locale(.web).ts` |
| `movies/constants/destinations.ts`, `homeShelves.ts` | Rewrite | `src/core/ui/navigation/destinations.ts` (§1.4.2), `src/features/home/homeSections.ts` (§4.1) |
| `movies/constants/feedChips.ts`, `movieFilterLabels.ts`, `quietHours.ts` | Delete | Torrent filters and dropped settings |
| `movies/homeShelfSelection.ts`, `useFeedViewModel.ts`, `useHomeScrollVisibility.ts`, `useHomeViewModel.ts`, `useMoviesViewModel.ts`, `useMovieDetailsViewModel.ts`, `useShowsViewModel.ts`, `usePreferencesViewModel.ts` | Delete | Section A hooks |
| `movies/useLibrary.ts`, `useWatchHistory.ts`, `useWatchlist.ts`, `useWatchlistStreaming.ts` | Section A | Library stores and hooks |
| `movies/posterPrefetch.ts` | Port | `src/core/ui/media/prefetch.ts` (strip comment lines 20-21) |
| `player/MiniBar.tsx`, `PlayerContext.tsx`, `PlayerHost.tsx`, `PlayerScrollBridge(.web).tsx`, `playerScrollRelay.ts`, `useDocumentPip(.web).ts`, `useKeyboardShortcuts(.web).ts`, `use-ad-break.ts`, `index.ts` | Delete | Mini-player, queue, PiP, shortcuts and ad-gated playback (decision 8, MON-3, WEB-15) |
| `player/PlayerSurface.tsx`, `youtubeWebView.ts`, `youtubeWebView.test.ts` | Port | Android `TrailerPlayer`: no imperative handle, `play` after `onReady`. Path `src/features/player/platform/TrailerPlayer.tsx` |
| `player/PlayerSurface.web.tsx` | Delete | Replaced by C §3.7 |
| `player/PlaybackDiagnostics.ts` | Port (map only) | The YouTube error-code map moves next to `TrailerPlayer`. `player.ad_wait` is dropped; `player.start` is C's metric |
| `purchases/offer-copy.ts` | Section C | C `src/features/monetization/plus/copy.ts` |
| `purchases/supporter-paywall.tsx`, `supporter-benefits.tsx`, `supporter-discovery-card.tsx`, `UpgradeScreen.tsx` | Rewrite | `PlusOffer`, the Plus sheet and the Plus card on C's `usePaywall` (§4.12) |

Dependency changes: C6.6 is the complete list. It includes this part's removals (`@gorhom/bottom-sheet`, `expo-blur`, the direct `expo-glass-effect` entry, `@expo/ui`, `expo-symbols`, `expo-device-corner-radius`, `react-native-web-webview`), keeps `@expo/vector-icons`, the two font packages, `expo-haptics`, `expo-image`, `expo-web-browser`, `expo-localization`, `react-native-youtube-iframe` and `react-native-webview`, and adds the `subset-font` 2.9.0 devDependency.

## B8. Store listing (one validated Play edit at release step f)

Everything in this section reaches Play in the single edit of release step (f) (`scripts/play-release.mjs`, I.5; Part 0, I-51). The owner approves the texts, translations and images (O-7) and the run itself (O-25).

### B8.1 Text

- **Title** (30 characters max): "Yify: Where to Watch & Track" (28). It drops "Movies" so it does not read as a movie source.
- **Short description** (80 characters max): "Find where to stream movies and TV, watch trailers and keep a film diary." (73)
- **Long description** (4,000 characters max). Never use these words: "download", "free movies", "watch movies", "HD", "4K", "YTS", "torrent", "Watch Now".

Long description outline:

1. **Opening, 2 sentences:** "Yify helps you decide what to watch and where to stream it. Browse movies and TV shows, watch official trailers, see which services carry a title in your country, and keep track of what you've watched."
2. **"What you can do"**, 6 bullets:
   - Discover trending, popular and critically acclaimed titles, what's in theaters and new episodes.
   - Search movies, TV shows and people, with filters.
   - See where to watch in your country, with your services first.
   - Watch official trailers.
   - Keep a watchlist, a diary with ratings and notes, and your own lists.
   - Sign in with Google to sync (optional).
3. **"Yify Plus"**: the 4 benefits ("No Yify ads", "Unlimited lists", "Your year in review", "Accent themes"; §4.12), then "Subscriptions renew until you cancel them in Google Play. Plus also unlocks on the web when you sign in."
4. **"What Yify is not"**: "Yify does not host, stream or download movies or TV shows. Trailers play from YouTube. To watch a title, use one of the streaming services listed." This addresses the review mismatch (UXL-3, AND-5).
5. **"Privacy"**: analytics is optional and off until you allow it, and sign-in is optional.
6. **"Credits"**: "This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data by JustWatch."
7. **Contact**: the support email from the Play Console.

**Listing languages.** `store-listing/en-US.json` holds the text above as `{"title", "shortDescription", "fullDescription"}` (the fields of the Play `Listing` resource, developers.google.com/android-publisher/api-ref/rest/v3/edits.listings). Stream C lists the app's current listing languages with `node scripts/play-release.mjs --list-languages`, which opens an edit, calls `edits.listings.list` and deletes the edit, and adds one translated file per language, `store-listing/<BCP-47 code>.json`. It adds release notes as `store-listing/release-notes/<code>.txt` (at most 500 characters). `tests/scripts/store-listing.test.cjs` checks every file: title at most 30 characters, short description at most 80, full description at most 4,000; no banned word above in that language (the per-language banned list, `store-listing/banned-words.json`, is reviewed by the owner with the translations, O-7). `scripts/play-release.mjs` refuses to run when Play lists a language that has no file.

Remove from today's description:

- "Signing in … syncs your list" next to "There is no account to create" (they contradict each other);
- "Support Yify subscription" (now "Yify Plus");
- "Fifteen genre rows";
- "When a trailer ends, the next related movie's trailer rolls straight on".

### B8.2 Screenshots and graphics

Phone set:

- 8 screens, 1080×1920 (9:16), captured from the 2.0.0 release candidate (release step d, after the Identity step) in the dark theme with the `default` accent.
- Each image has a caption band on top: `surface` background, display-face caption in `onSurface`, at most 6 words. No device frame.
- The files stay outside the repository; `scripts/play-release.mjs --images <dir>` uploads them as `phoneScreenshots`.

Artwork policy:

- Prefer public-domain and classic titles with period poster art. Candidates: *Nosferatu* (1922), *The Kid* (1921), *Sherlock Jr.* (1924), *The General* (1926), *Metropolis* (1927), *His Girl Friday* (1940), *Charade* (1963), *Night of the Living Dead* (1968).
- Avoid recent studio key art. The current listing leans on Marvel, DC and Disney (AND-16).
- The owner confirms the rights position.

| # | Screen | State to stage | Caption |
| --- | --- | --- | --- |
| 1 | Title (movie) | Backdrop, poster, actions, and Where to watch with "Your services" showing 2 logos | "See where to stream it" |
| 2 | Home | Featured title, "On your services", Trending rail | "Find something to watch" |
| 3 | Search | Browse mode with Genre and Year chips; 3-column grid with titles | "Search movies, shows and people" |
| 4 | Trailer | Compact fullscreen frame, YouTube player visible, no overlays | "Watch official trailers" |
| 5 | Library › Watchlist | 12 or more items with provider badges; "On my services" selected | "Your watchlist, with where to stream" |
| 6 | Diary sheet | Date "Today", 4½ stars, a short note | "Log what you watched" |
| 7 | Title (TV) | Seasons rail and the "Next" meta line | "Follow TV shows" |
| 8 | Plus page | Benefits and plan cards with real prices | "Support Yify with Plus" |

Other assets:

- **Tablet sets** (7" 1920×1200 and 10" 2560×1600, landscape): Home with the rail, and Title in the two-column layout, in the light theme.
- **Feature graphic**, 1024×500: made in the Identity step with the final tokens (dark `surface`, the wordmark, "Where to watch, trailers and your film diary", 3 poster tiles from the public-domain set); `store-artifacts/v2/feature-graphic.png`.
- **Store icon**, 512×512: the store asset of `scratchpad/icons-v2/final/`, copied to `store-artifacts/v2/icon-512.png` by the Identity step (decision 13).
- **Deleted** by F0-A: every `store-artifacts/screenshots-*` file, including `05-movie.png` (it shows a Download button) and `03-watchlist.png` (an empty list) (DES-17).

## B9. Open conflicts and owner decisions

Every conflict this part raised is resolved in Part 0, §0.3: C1 (I-1), C2 (route scheme, as A7.2), C3 (I-14), C4 ("See all" opens Search, B4.2), C5 (I-15), C6 (I-13), C7 (the `screen_name` mapping in B4.0.2 stands), C8 (I-23), C9 (the Android back-to-home peek stays out of scope), C10 (I-3 and I-33), C11 (the data request stays an email; revisit in 2.1). The owner decision C12 (public-domain artwork for store screenshots) is Part O item O-18. C13 (adaptive icon background) is withdrawn: decision 13 fixes the icon (`scratchpad/icons-v2/final/`) and the identity override replaces the palette (Part 0, §0.4).

# Part C — Monetization, Android and web platform, telemetry, CI and process

Scope: Yify Plus and its purchase flows, Android ads, the web platform (server rendering, SEO, headers, budget, web trailer player), the Android platform (app config, permissions, updates, packaging, versioning, native telemetry, CNG), telemetry, and the engineering system.

Conventions used in this part:

- `src/...` paths follow A1.1. Twins live in `platform/` folders (Part 0, I-3).
- Code blocks show contracts that will be shipped, so they follow the owner's rules: no comments, exact pins, no agent attribution.
- "Port" means take the named v1 file (`git show main:<path>`), keep the logic described and delete the rest. "New" means write from scratch.
- Strings below write "Yify" where they interpolate `APP_NAME` (`src/core/config/app.ts`).

## C0. Contracts with other parts

The contracts this part needed are fixed elsewhere: the synchronous KV (A5.1), the session stream `subscribeUid` and `isNewUser()` (A6.1, `features/account/public/session.ts`), `titleQueryOptions` for prefetch (A4.4), the server TMDB helpers with `TMDB_API_BASE_URL` and adult filtering (A3.3.1, A3.3.2), the gating API used by library and settings (C1.11), and the route map (A7.1, A7.2). This part provides `usePlus()`, `openPaywall()`, `canCreateCustomList()`, `effectiveAccent()`, `insightsAccess()` (C1.11), `openTitle()` (C2.6), `track()` and `reportOperation()` (C5), and the CI, release, deploy and docs system (C6). Exact signatures are in Part W, F0.5.

---

## C1. Yify Plus

### C1.1 What exists in RevenueCat today (live read 2026-11-26, `research/monetization.md` §3–4, `scratchpad/rc-offerings.json`)

| Object | Identifier | Notes |
|---|---|---|
| Project | `proj8b6ff243` (dashboard shows `8b6ff243`) | v2 client code never contains either string (§1.12) |
| Entitlement | `remove_ads` (display "Supporter", `entl2b0b9c6396`) | The only RevenueCat identifier v2 code reads. All 7 products grant it. |
| Apps | Play `app92a1e3ba4c` (`io.github.kunal26das.yify`); RC Billing `app28ce2d8b73` (Stripe account with charges paused since 2023‑03‑01); Test Store `appb982f2aa15` | No Amazon app |
| Current offering | `default` (display "Yify Plus", `ofrng79abbf96a9`) | |
| └ package `$rc_monthly` (position 0) | Play `remove_ads_monthly:p1m` (`prod4a474db633`, eligibility `google_sdk_ge_6`) + web `remove_ads_monthly_web` (`prod3b9edb236c`) | Monthly base plan P1M, grace P7D, account hold P30D. US $1 · IN ₹99 · ZA R18.99 · PH ₱70 · GB £0.89 |
| └ package `$rc_annual` (position 1) | Play `yify_plus_yearly:p1y` (`prodd3197ad24a`) only | 10× monthly: $10 · ₹990 · R189.90 · ₱700 · £8.90 |
| Inactive offering | `yearly_validation_20261017` | Leave inactive |
| Products not in any offering | `remove_ads_lifetime` (Play one-time, 0 production sales), `remove_ads_web`, `remove_ads_lifetime_web`, `yify_plus_yearly_web` | Keep them attached to `remove_ads`, so any sandbox or test grant keeps working |

The v2 client relies only on: entitlement `remove_ads`, the **current** offering, and its `monthly` and `annual` packages. Prices and products are never hard-coded. Price changes stay a Play Console task (decision 6: no price changes in code).

### C1.2 Benefits and limits (`src/features/monetization/plus/benefits.ts`, new)

```ts
export type PlusFeature = 'no_ads' | 'unlimited_lists' | 'insights' | 'accent_themes';
```

| Benefit | Android | Web | Free tier |
|---|---|---|---|
| No ads | interstitial suppressed | n/a (web has no ads) | paced interstitial (§2) |
| Unlimited custom lists | yes | yes, when signed in | 3 custom lists. Watchlist and Watched are built-ins and do not count. |
| Diary insights / year in review | yes | yes, when signed in | teaser: the total number of titles logged this year, plus locked cards |
| Accent themes | yes | yes, when signed in | default accent only |

`PLUS_ENTITLEMENT = 'remove_ads'`, `FREE_CUSTOM_LIST_LIMIT = 3` and `PaywallPlacement = 'you_card' | 'plus_route' | 'list_limit' | 'insights' | 'ad_free_row' | 'accent_theme'` (Part 0, I-15) are exported from `src/features/monetization/public/types.ts` (Part W, F0.5). The storage safeguards of 100 lists and 2,000 listed titles apply to every account (A2.6; Part 0, I-12).

There are no automatic pop-ups (decision 6). The paywall opens only from the You tab's Plus card (to `/plus`), `/plus` itself, and these contextual moments: creating a 4th list, opening insights, the "Ad-free with Plus" row (Android only), and choosing an accent.

### C1.3 Platform modes

```ts
export type PlusMode = 'store' | 'play_link' | 'web_checkout';
export function plusMode(platform: 'android' | 'web', webCheckout: boolean): PlusMode {
  if (platform === 'android') return 'store';
  return webCheckout ? 'web_checkout' : 'play_link';
}
export const WEB_CHECKOUT = process.env.EXPO_PUBLIC_WEB_CHECKOUT === '1';
```

- **Android, `store` mode.** Shows Play monthly and yearly offers from the current offering, with Restore and Manage. Sign-in is never required.
- **Web, `play_link` mode (the default).**
  - Shows the benefits and a primary CTA, "Get Yify Plus on Google Play", linking to `https://play.google.com/store/apps/details?id=io.github.kunal26das.yify&referrer=utm_source%3Dyify_web%26utm_medium%3Dplus`.
  - Signed-out users also see "Already a member? Sign in".
  - Signed-in users see their entitlement status, "Refresh status", and a manage link when they are Plus.
  - **No purchase SDK code runs for signed-out web visitors.**
- **Web, `web_checkout` mode.** Only when the build was exported with `EXPO_PUBLIC_WEB_CHECKOUT=1`, which must not happen without the owner's go-ahead (§7). Requires sign-in, then shows web offers and calls `purchases.purchase({rcPackage})`.
  - `WEB_CHECKOUT` is inlined at export time. The checkout module is reached only through `if (WEB_CHECKOUT) await import('./webCheckout.web')`.

### C1.4 Identity model (anonymous purchase, logIn and logOut)

RevenueCat behaviour that v2 relies on (cited):
- `logIn()` from an anonymous user merges the two users when the provided id is **new**, or **exists without an anonymous alias**: "Anonymous ID and Provided ID have CustomerInfo merged."
- If the provided id **already has an anonymous alias**: "No merge or purchase transfer occurs."
- RevenueCat recommends not logging the SDK out, and calling login when switching accounts.
- Source for the three points above: https://www.revenuecat.com/docs/customers/identifying-customers, fetched 2026-11-26.
- Restore behaviour default "Transfer to new App User ID": "If an identified ID restores a receipt owned by an anonymous ID, the two IDs are merged"; "If an anonymous ID restores a receipt owned by an identified ID, the receipt transfers to the anonymous user". Source: https://www.revenuecat.com/docs/projects/restore-behavior. The owner confirms this project setting (§7).

v2 rules for Android:

| Situation | SDK calls (`node_modules/react-native-purchases/dist/purchases.d.ts`) | Result |
|---|---|---|
| First launch, signed out | `Purchases.configure({apiKey, automaticDeviceIdentifierCollectionEnabled: false, diagnosticsEnabled: false, shouldShowInAppMessagesAutomatically: true})` (`:355`, returns `void`). No `appUserID`, so the SDK reuses its cached id on later launches. | anonymous `$RCAnonymousID:…`; purchase allowed |
| Anonymous user buys | `purchasePackage(pkg)` (`:499`) | entitlement on the anonymous id |
| Sign-in, uid unknown to RevenueCat, or known without an anonymous alias | `getAppUserID()` (`:536`) ≠ uid → `logIn(uid)` (`:550`, `LogInResult {customerInfo, created}`) | merged: Plus follows the account and is recognised on web when signed in |
| Sign-in, uid already aliased to another device's anonymous id | `logIn(uid)`, then the **post-login reconcile**: the pre-login snapshot had `remove_ads` active and the post-login one does not, so call `restorePurchases()` (`:531`) once for this revision. It is silent on Android. | merged by the restore rule above |
| Sign-out | **no RevenueCat call** | the device keeps its last RevenueCat identity, so Plus stays on the device that paid (follows RevenueCat's "do not log out" advice) |
| Sign-in as a different account B | `logIn(B)` | identified → identified: no merge; the UI shows B's status |
| Account deletion (after `deleteAccount()` succeeds, A6.7) | `logOut()` (`:557`), then clear the entitlement cache | a new anonymous id. Erasing the RevenueCat customer stays a manual privacy-request step (§7). |
| Billing unavailable (e.g. RevenueCat error code 23) | `canMakePayments()` (`:1022`) is `false` | `sdk: 'unavailable'`, copy "Google Play billing isn't available on this device." |

Small print under the Restore button: signed in, "Restoring moves Plus to the account you're signed in with."; signed out, "Restoring moves Plus to this device." (the restore transfers the purchase to the device's anonymous id).

Web: `@revenuecat/purchases-js` is configured **only with a Firebase uid**. Anonymous web customers are never created; that is the likely source of the 1,333 polluted web customers in `research/data-browser.md` §3.

| Web situation | Call (`node_modules/@revenuecat/purchases-js/dist/Purchases.es.d.ts`) |
|---|---|
| First need while signed in | `const {Purchases} = await import('@revenuecat/purchases-js')`, then `Purchases.configure({apiKey: EXPO_PUBLIC_REVENUECAT_WEB_KEY, appUserId: uid})` (`:1732`) and `getCustomerInfo()` (`:1883`) |
| uid changes | `purchases.changeUser(uid)` (`:1905`) |
| Sign-out | no call; entitlement state becomes `free` and that user's web cache is removed |
| Status refresh | `getCustomerInfo()` |
| Checkout (flag on only) | `getOfferings()` (`:1770`), then `purchase({rcPackage})` (`:1859`, `PurchaseParams.rcPackage` `:1546`) |

### C1.5 The purchase state machine (pure)

Files:
- `src/features/monetization/plus/plusMachine.ts`: new, pure, no imports from SDKs.
- `plusMachine.test.ts`.
- `plusController.ts`: the effect interpreter.
- `src/features/monetization/platform/purchasesAdapter.ts` and `purchasesAdapter.web.ts`.

The machine **ports the semantics** of `data/repositories/RevenueCatPurchaseRepositoryImpl.ts`: revision guards (`:201-227`, `:479-487`), queued mutations (`:357-370`), customer listener (`:393-398`), backoff (`:38`, `:588-599`). It drops the mandatory sign-in (`:484-487`), placements, funnel tracking, ad-tracking links and paywall-impression calls.

```ts
export type PlusStatus = 'unknown' | 'free' | 'plus';
export type PlusStore = 'play_store' | 'rc_billing' | 'other';

export interface EntitlementSnapshot {
  active: boolean;
  productId: string | null;
  store: PlusStore | null;
  expiresAt: string | null;
  willRenew: boolean;
  billingIssue: boolean;
  managementUrl: string | null;
}

export interface CustomerSnapshot {
  appUserId: string;
  anonymous: boolean;
  entitlement: EntitlementSnapshot;
}

export interface PlusEntitlement extends EntitlementSnapshot {
  status: PlusStatus;
  source: 'none' | 'cache' | 'store';
  appUserId: string | null;
  checkedAt: number | null;
}

export interface PlusOffer {
  id: string;
  packageType: 'monthly' | 'annual';
  period: 'P1M' | 'P1Y';
  priceLabel: string;
  pricePerMonthLabel: string | null;
  priceMicros: number;
  currencyCode: string;
}

export type PurchaseErrorCode =
  | 'cancelled' | 'pending' | 'already_owned' | 'not_allowed' | 'product_unavailable'
  | 'network' | 'store' | 'configuration' | 'unknown';

export interface PurchaseError { code: PurchaseErrorCode; sdkCode: string | null }

export type PlusMessage =
  | 'pending' | 'already_owned' | 'not_granted' | 'offer_unavailable' | 'restore_none'
  | 'restore_failed' | 'purchase_failed' | 'billing_unavailable' | 'thanks' | null;

export type PlusFlow =
  | {kind: 'idle'}
  | {kind: 'purchasing'; offerId: string}
  | {kind: 'pending'; offerId: string}
  | {kind: 'restoring'};

export interface PlusState {
  mode: PlusMode;
  bootCache: PlusEntitlement | null;
  sdk: 'unconfigured' | 'configuring' | 'ready' | 'unavailable';
  identity: {desired: string | null | undefined; active: string | null; revision: number};
  entitlement: PlusEntitlement;
  offers: {status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'; items: PlusOffer[]; revision: number};
  flow: PlusFlow;
  message: PlusMessage;
  failures: number;
  reconciledRevision: number;
}

export type PlusEvent =
  | {type: 'BOOT'; now: number; cache: PlusEntitlement | null; support: 'supported' | 'no_key'}
  | {type: 'AUTH_CHANGED'; uid: string | null}
  | {type: 'ACCOUNT_DELETED'}
  | {type: 'CONFIGURED'; customer: CustomerSnapshot; now: number}
  | {type: 'CONFIGURE_FAILED'; error: PurchaseError}
  | {type: 'BILLING_UNAVAILABLE'}
  | {type: 'IDENTITY_SYNCED'; revision: number; previous: CustomerSnapshot | null; customer: CustomerSnapshot; now: number}
  | {type: 'IDENTITY_FAILED'; revision: number; error: PurchaseError}
  | {type: 'CUSTOMER_UPDATED'; customer: CustomerSnapshot; now: number}
  | {type: 'REFRESH_REQUESTED'}
  | {type: 'OFFERS_REQUESTED'}
  | {type: 'OFFERS_LOADED'; revision: number; offers: PlusOffer[]}
  | {type: 'OFFERS_FAILED'; revision: number; error: PurchaseError}
  | {type: 'PURCHASE_REQUESTED'; offerId: string; placement: PaywallPlacement}
  | {type: 'PURCHASE_SUCCEEDED'; revision: number; customer: CustomerSnapshot; now: number}
  | {type: 'PURCHASE_FAILED'; revision: number; error: PurchaseError}
  | {type: 'RESTORE_REQUESTED'; reason: 'user' | 'post_login_reconcile'}
  | {type: 'RESTORE_SUCCEEDED'; revision: number; customer: CustomerSnapshot; now: number}
  | {type: 'RESTORE_FAILED'; revision: number; error: PurchaseError}
  | {type: 'RETRY_DUE'}
  | {type: 'MESSAGE_DISMISSED'}
  | {type: 'WEB_IDENTIFY_REQUESTED'; reason: 'paywall' | 'gate' | 'stale_cache'};

export type PlusEffect =
  | {type: 'configure'}
  | {type: 'identify'; uid: string; revision: number}
  | {type: 'reset_identity'; revision: number}
  | {type: 'fetch_customer'; revision: number; fresh: boolean}
  | {type: 'fetch_offers'; revision: number}
  | {type: 'purchase'; offerId: string; revision: number}
  | {type: 'restore'; revision: number}
  | {type: 'persist'; entitlement: PlusEntitlement}
  | {type: 'clear_cache'}
  | {type: 'schedule_retry'; delayMs: number}
  | {type: 'track'; event: AnalyticsEvent};

export function reducePlus(state: PlusState, event: PlusEvent): {state: PlusState; effects: PlusEffect[]};
export function plusStatusAt(state: PlusState, now: number): PlusStatus;
export function adsEntitlement(state: PlusState, now: number): 'plus' | 'free' | 'unknown';
export function canPurchase(state: PlusState): boolean;
```

In code, `plusMachine.ts` imports `PlusStatus`, `PlusStore`, `EntitlementSnapshot` and `PlusEntitlement` from `public/types.ts` instead of declaring them; the block above restates them for reading. `AnalyticsEvent` is the union from §5.5. `RETRY_BACKOFF_MS = [5000, 15000, 60000, 300000]`, ported from `INIT_BACKOFF_MS`.

**Transition table.** Any event that carries a `revision` different from `state.identity.revision` is ignored: no state change, no effects.

| # | Event | Guard | State change | Effects |
|---|---|---|---|---|
| T1 | `BOOT` | `support = 'no_key'` | `sdk = 'unavailable'`; `entitlement.status = 'free'` | none |
| T2 | `BOOT` | `mode = 'store'` | `sdk = 'configuring'`; entitlement from the cache (§1.7): `plus`, `free`, or `unknown` when there is no cache | `configure` |
| T3 | `BOOT` | `mode` is web | `sdk = 'unconfigured'`; `bootCache = cache`; `entitlement.status = 'unknown'` | none (web waits for `AUTH_CHANGED`) |
| T4 | `CONFIGURED` | — | `sdk = 'ready'`; apply the customer; `failures = 0` | `persist`; if `identity.desired` is a string ≠ `customer.appUserId`: `identify` |
| T5 | `CONFIGURE_FAILED` | — | `failures + 1`; `sdk = 'configuring'` | `schedule_retry(backoff[failures])` |
| T6 | `BILLING_UNAVAILABLE` | — | `sdk = 'unavailable'`; `message = 'billing_unavailable'` | none |
| T7 | `AUTH_CHANGED` | uid equals `identity.desired` | none | none |
| T8 | `AUTH_CHANGED` | `mode = 'store'`, uid is a string | `desired = uid`; `revision + 1`; offers reset to `idle` | if `sdk = 'ready'`: `identify` |
| T9 | `AUTH_CHANGED` | `mode = 'store'`, uid `null` | `desired = null`; `revision + 1` | none (identity is kept on sign-out) |
| T10 | `AUTH_CHANGED` | web mode, uid is a string | `desired = uid`; `revision + 1`; `sdk` stays (`unconfigured` until a Plus surface needs it); entitlement from `bootCache` when `bootCache.appUserId === uid`, otherwise `unknown` | none: a signed-in page view loads no purchase SDK (coverage review, issue 9) |
| T11 | `AUTH_CHANGED` | web mode, uid `null` | `desired = null`; `revision + 1`; `entitlement = free` (source `none`) | `clear_cache` |
| T12 | `ACCOUNT_DELETED` | — | `revision + 1`; `entitlement = free` | `reset_identity`, `clear_cache` |
| T13 | `IDENTITY_SYNCED` | — | `active = customer.appUserId`; apply the customer; web mode: `sdk = 'ready'` | `persist`; if `previous?.anonymous && previous.entitlement.active && !customer.entitlement.active && reconciledRevision !== revision`: set `reconciledRevision = revision`, emit `restore` |
| T14 | `IDENTITY_FAILED` | — | `failures + 1` | `schedule_retry` |
| T15 | `CUSTOMER_UPDATED` | `sdk = 'ready'` | apply the customer; if `flow.kind = 'pending'` and now active: `flow = idle`, `message = 'thanks'` | `persist` |
| T16 | `REFRESH_REQUESTED` | `sdk = 'ready'` | none | `fetch_customer(fresh: true)` |
| T17 | `OFFERS_REQUESTED` | `sdk = 'ready'` and `offers.status` in `idle`/`error`, or `offers.revision ≠ revision` | `offers = loading` | `fetch_offers` |
| T18 | `OFFERS_LOADED` | — | `offers = ready` (or `empty` if there are no items) | none |
| T19 | `OFFERS_FAILED` | — | `offers = error` | none (the user retries from the UI) |
| T20 | `PURCHASE_REQUESTED` | `canPurchase(state)` and the offer id is in `offers.items` | `flow = purchasing`; `message = null` | `purchase`, `track(purchase_start)` |
| T21 | `PURCHASE_REQUESTED` | otherwise | `message = 'offer_unavailable'` | none |
| T22 | `PURCHASE_SUCCEEDED` | — | apply the customer; `flow = idle`; `message = active ? 'thanks' : 'not_granted'` | `persist`, `track(purchase_result granted\|not_granted)` |
| T23 | `PURCHASE_FAILED` | `code = 'pending'` | `flow = pending`; `message = 'pending'` | `track(purchase_result pending)` |
| T24 | `PURCHASE_FAILED` | `code = 'cancelled'` | `flow = idle`; `message = null` | `track(purchase_result cancelled)` |
| T25 | `PURCHASE_FAILED` | `code = 'already_owned'` | `flow = idle`; `message = 'already_owned'` | `track(...)` |
| T26 | `PURCHASE_FAILED` | other codes | `flow = idle`; `message = 'purchase_failed'` | `track(purchase_result failed, error_code)` |
| T27 | `RESTORE_REQUESTED` | `sdk = 'ready'`, `flow.kind` in `idle`/`pending` | `flow = restoring` | `restore` |
| T28 | `RESTORE_SUCCEEDED` | — | apply the customer; `flow = idle`; `message = active ? 'thanks' : 'restore_none'` (no message when the reason was `post_login_reconcile`) | `persist`, `track(restore_result)` |
| T29 | `RESTORE_FAILED` | — | `flow = idle`; `message = 'restore_failed'` (silent for reconcile) | `track(restore_result failed)` |
| T30 | `RETRY_DUE` | `sdk = 'configuring'` | none | `configure` (store mode) or `identify` (web) |
| T31 | `MESSAGE_DISMISSED` | — | `message = null` | none |
| T32 | `WEB_IDENTIFY_REQUESTED` | web mode, `identity.desired` is a string, `sdk = 'unconfigured'` | `sdk = 'configuring'` | `identify` (the adapter imports `@revenuecat/purchases-js` and configures it) |
| T33 | `WEB_IDENTIFY_REQUESTED` | web mode, `identity.desired` is a string, `sdk = 'ready'`, `identity.active !== identity.desired` (another account signed in since) | `sdk = 'configuring'` | `identify` (the adapter calls `changeUser`) |
| T34 | `WEB_IDENTIFY_REQUESTED` | web mode, `sdk = 'ready'`, `identity.active === identity.desired`, `reason = 'stale_cache'` | none | `fetch_customer(fresh: true)` |
| T35 | `WEB_IDENTIFY_REQUESTED` | any other state (signed out, `configuring`, store mode, or ready and current for `paywall`/`gate`) | none | none |

`WEB_IDENTIFY_REQUESTED` is dispatched by `openPaywall()` and the `/plus` screen (`paywall`), by `ensureKnown()` when the status is `unknown` (`gate`), and by the once-per-load idle check when the signed-in user's cached entitlement is older than 24 h (`stale_cache`, §1.7).

Selectors:
- `canPurchase` is `true` iff all of the following hold:
  - `sdk = 'ready'`
  - `flow.kind = 'idle'`
  - `offers.status = 'ready'`
  - `plusStatusAt(...) !== 'plus'`. Active members never see buy buttons; there is no in-app plan switch in v2.0, because monthly and yearly are different Play products.
  - `mode = 'store'`, or `mode = 'web_checkout'` with `identity.active` set.
- `plusStatusAt(state, now)` returns `'plus'` iff `entitlement.status = 'plus'` and either `expiresAt` is null or `Date.parse(expiresAt) > now`. If the status is `plus` but expired, it returns `'free'`; otherwise it returns `entitlement.status`.
- `adsEntitlement` returns `'unknown'` while `entitlement.status = 'unknown'`.

Required tests in `plusMachine.test.ts` (`node --test`). One `it` per row:
1. T1–T3 for each mode, with and without a cache.
2. T4 `identify` emitted only when the desired uid differs.
3. T8 and T9 revision bumps; stale `OFFERS_LOADED` and `PURCHASE_SUCCEEDED` from an old revision are ignored.
4. T9: no `reset_identity` on Android sign-out.
5. T12: `reset_identity` on account deletion.
6. T13 reconcile runs exactly once per revision, and only for the anonymous-active → identified-inactive case.
7. T15: pending → active clears the flow.
8. T20 vs T21 guards: no purchase while `plus`, while purchasing, in `play_link` mode, or in `web_checkout` without a uid.
9. T23–T26 messages and analytics payloads.
10. T27 is allowed from `pending`.
11. Expiry: `plusStatusAt` flips at `expiresAt`.
12. `adsEntitlement` is `'unknown'` before the first answer when there is no cache.
13. Backoff index caps at 300000 ms.
14. Web: `AUTH_CHANGED` with a uid emits no effects; `WEB_IDENTIFY_REQUESTED` emits `identify` once and nothing while `configuring`; after a switch to another account on a ready SDK it emits `identify` again (`changeUser`); `stale_cache` on a ready, current SDK emits one fresh `fetch_customer`.

### C1.6 Adapters

```ts
export interface PurchasesAdapter {
  readonly platform: 'android' | 'web';
  readonly hasKey: boolean;
  configure(): Promise<CustomerSnapshot>;
  canMakePayments(): Promise<boolean>;
  identify(uid: string): Promise<{previous: CustomerSnapshot | null; customer: CustomerSnapshot}>;
  resetIdentity(): Promise<CustomerSnapshot>;
  getCustomer(fresh: boolean): Promise<CustomerSnapshot>;
  getOffers(): Promise<PlusOffer[]>;
  purchase(offerId: string): Promise<CustomerSnapshot>;
  restore(): Promise<CustomerSnapshot>;
  onCustomerUpdate(listener: (customer: CustomerSnapshot) => void): () => void;
  setAnalyticsInstanceId(id: string | null): Promise<void>;
}
```

**`platform/purchasesAdapter.ts` (Android).** Port from `RevenueCatPurchaseRepositoryImpl.ts`.

| Method | Implementation |
|---|---|
| `configure` | `Purchases.setLogLevel(LOG_LEVEL.WARN)` (`:569`); `Purchases.configure({...})` (§1.4); `getCustomerInfo()` (`:584`) |
| `canMakePayments` | `Purchases.canMakePayments()` |
| `identify` | snapshot (`getAppUserID`, `isAnonymous` `:658`, `getCustomerInfo`). If `appUserId !== uid`: `logIn(uid)`. Returns `{previous, customer}`. |
| `resetIdentity` | `logOut()` |
| `getCustomer(true)` | `invalidateCustomerInfoCache()` (`:745`), then `getCustomerInfo()` |
| `getOffers` | `getOfferings()` (`:407`) → `current` → `[current.monthly, current.annual]` (`PurchasesOffering.monthly/annual`, `@revenuecat/purchases-typescript-internal/dist/offerings.d.ts:433/417`), non-null only |
| `purchase` | `purchasePackage(pkg)` → `MakePurchaseResult.customerInfo` |
| `restore` | `restorePurchases()` |
| `onCustomerUpdate` | `addCustomerInfoUpdateListener` (`:378`) / `removeCustomerInfoUpdateListener` (`:384`) |
| `setAnalyticsInstanceId` | `setFirebaseAppInstanceID(id)` (`:875`). The consent gate is ported from `linkFirebaseAnalytics` (`:617-637`): set only when analytics consent is granted, `null` otherwise. |

Offer mapping on Android, using `offerings.d.ts`:
- `priceLabel = pkg.product.defaultOption?.fullPricePhase?.price.formatted ?? pkg.product.priceString` (`:653`, `:823`, `:103`)
- `priceMicros = pkg.product.defaultOption?.fullPricePhase?.price.amountMicros ?? Math.round(pkg.product.price * 1e6)` (`:830`, `:95`)
- `currencyCode = pkg.product.currencyCode` (`:153`)
- `pricePerMonthLabel = pkg.packageType === PACKAGE_TYPE.ANNUAL ? pkg.product.pricePerMonthString : null` (`:140`)
- `id = ${offering.identifier}:${pkg.identifier}`

Entitlement mapping: `info.entitlements.active[PLUS_ENTITLEMENT]` (`customerInfo.d.ts:133`). Fields: `productIdentifier`, `expirationDate`, `willRenew`, `billingIssueDetectedAt`, `store` (`"PLAY_STORE"` → `play_store`, `"RC_BILLING"` → `rc_billing`, anything else → `other`, per `customerInfo.d.ts:6`). `managementUrl = info.managementURL` (`:207`).

**`platform/purchasesAdapter.web.ts`.**
- Lazy-imports `@revenuecat/purchases-js` (1.78.0) inside `identify`, `getCustomer` and `getOffers`.
- Keeps the module-level instance returned by `Purchases.configure`.
- `configure()` rejects with `{code: 'configuration'}` when no uid has been supplied yet. The controller never calls it on web.
- `resetIdentity` is a no-op.
- `purchase` exists only behind `WEB_CHECKOUT`.
- Offer mapping uses `pkg.webBillingProduct.currentPrice.formattedPrice/amountMicros/currency` (`Purchases.es.d.ts:818`, `:1355`, `:1274`, `:1263`, `:1270`) and `normalPeriodDuration` (`:1364`).
- Entitlement mapping uses `customerInfo.entitlements.active[PLUS_ENTITLEMENT]` (`:287`); `expirationDate` and `billingIssueDetectedAt` are `Date | null`, converted to ISO strings. Store values are lower-case `"play_store"` and `"rc_billing"` (`:2340`).

Error normalisation (`src/features/monetization/plus/purchaseErrors.ts`, new):

| v2 code | Android `PURCHASES_ERROR_CODE` (`@revenuecat/purchases-typescript-internal/dist/generated/error-codes.d.ts`) | Web `ErrorCode` (`Purchases.es.d.ts:297-325`) |
|---|---|---|
| `cancelled` | `"1"` or `userCancelled === true` | `1` UserCancelledError |
| `pending` | `"20"` PAYMENT_PENDING_ERROR | `20` PaymentPendingError |
| `already_owned` | `"6"`, `"7"`, `"13"` | `6`, `7` |
| `not_allowed` | `"3"` | `3` |
| `product_unavailable` | `"5"` | `5` |
| `network` | `"10"`, `"35"` OFFLINE_CONNECTION_ERROR | `10` |
| `store` | `"2"` | `2` |
| `configuration` | `"23"`, `"11"` | `23`, `11` |
| `unknown` | anything else | anything else |

`network`, `store`, `configuration`, `not_allowed`, `cancelled` and `pending` are **expected** and become Sentry metrics. Only `unknown` is captured as a Sentry error (§5.4).

### C1.7 Entitlement cache and refresh (`entitlementCache.ts`, new)

Key `plus.entitlement.v1` on both platforms (Part 0, I-19). The value is the JSON of `PlusEntitlement` with `source: 'cache'`, written on every `persist`. On web, the cache is read only when its `appUserId` equals the current uid.

Boot interpretation, used by T2 and T3:
- active, and `expiresAt` null or in the future → `plus`. This holds however old `checkedAt` is: be generous with supporters, and RevenueCat corrects it on the first fetch.
- inactive, or expired → `free`.
- no cache → `unknown`.

Refresh triggers:
1. RevenueCat SDK foreground refresh. The SDK refreshes stale CustomerInfo itself; the customer-update listener feeds T15.
2. Opening `/plus` or the paywall: `OFFERS_REQUESTED`, plus `REFRESH_REQUESTED` if `checkedAt` is older than 10 minutes.
3. The "Refresh status" button: `REFRESH_REQUESTED`.
4. Sign-in and sign-out (T8–T11). On web these change state only; they never load the SDK.
5. Web only: once per page load after first paint and idle, when signed in and the cached entitlement is older than 24 h, dispatch `WEB_IDENTIFY_REQUESTED {reason: 'stale_cache'}`.

On web, a gating check (§1.11) that meets `unknown` while signed in awaits `ensureKnown()`, which dispatches `WEB_IDENTIFY_REQUESTED {reason: 'gate'}`, loads the SDK and resolves within 5 s, or returns `free` on timeout.

RevenueCat is **not** on Android's startup critical path. The controller dispatches `BOOT` from an idle callback after the first content render; the cache already covers gating before then.

### C1.8 Package selection and pricing math (`offers.ts`, new)

- Order: monthly, then yearly. Monthly is preselected, because only monthly has ever sold (`research/monetization.md` §3).
- Savings label: `savingsPercent(monthly, annual) = round((1 - annualMicros / (12 * monthlyMicros)) * 100)`. Shown only when both offers exist in the same currency and the result is ≥ 5. Today's prices give "Save 17%".
- Per-month label for yearly: `pricePerMonthLabel` if present, otherwise `Intl.NumberFormat(locale, {style: 'currency', currency}).format(annualMicros / 12e6)`.
- If the offering or a package is missing, render only what exists. With no offers, `offers.status = 'empty'` and the copy reads "Plans aren't available right now. Try again later."

### C1.9 Paywall data contract and copy

```ts
export interface PaywallModel {
  mode: PlusMode;
  placement: PaywallPlacement;
  signedIn: boolean;
  status: PlusStatus;
  entitlement: PlusEntitlement;
  offers: PlusOffer[];
  offersStatus: PlusState['offers']['status'];
  selectedOfferId: string | null;
  savingsLabel: string | null;
  canPurchase: boolean;
  busy: 'purchasing' | 'restoring' | null;
  message: string | null;
  statusLine: string | null;
  disclosure: string | null;
  links: {terms: string; privacy: string; manage: string | null; playListing: string};
}
export function usePaywall(placement: PaywallPlacement): PaywallModel & {
  select(offerId: string): void;
  purchase(): void;
  restore(): void;
  refresh(): void;
  openManage(): void;
  openPlay(): void;
  signIn(): void;
};
```

`src/features/monetization/plus/copy.ts` is ported from `presentation/purchases/offer-copy.ts`: `billingPeriodLabel`, `safeManagementURL`, and the structure of `purchaseFailureMessage` and `supporterStatus`. Exact strings:

| Key | String |
|---|---|
| title | `{APP_NAME} Plus` |
| subtitle | `Support an independent app and unlock a few extras.` |
| benefit.no_ads | `No {APP_NAME} ads` / `{APP_NAME} shows an occasional full-screen ad on Android. Plus turns it off. YouTube and streaming services may still show their own ads.` (Android only) |
| benefit.lists | `Unlimited lists` / `Without Plus you can keep 3 custom lists. Plus lifts the limit (fair use: up to 100 lists).` |
| benefit.insights | `Your year in review` / `Diary insights: titles watched, hours, top genres and your ratings, by month and year.` |
| benefit.accents | `Accent themes` / `Choose an accent color for the app.` |
| offer.monthly | `Monthly · {price} / month` |
| offer.annual | `Yearly · {price} / year ({perMonth} / month)` + badge `Save {n}%` |
| cta.subscribe | `Subscribe for {price} / {month\|year}` |
| disclosure | `Renews automatically until you cancel. Cancel anytime in Google Play › Payments & subscriptions. Plus stays active until the end of the paid period.` |
| restore | `Restore purchases` |
| restore.smallprint.signedIn | `Restoring moves Plus to the account you're signed in with.` |
| restore.smallprint.signedOut | `Restoring moves Plus to this device.` |
| android.signedOutNote | `No account needed. Sign in later to use Plus on the web too.` |
| web.cta.play | `Get {APP_NAME} Plus on Google Play` |
| web.signIn | `Already a member? Sign in` |
| web.refreshHint | `Bought Plus on Android? Sign in with the same Google account you use in {APP_NAME}, then refresh.` |
| refresh | `Refresh status` |
| manage | `Manage subscription` |
| status.renews | `Plus is active. Renews on {date}.` |
| status.until | `Plus is active until {date}.` |
| status.billing | `There's a payment problem with your subscription. Update your payment method in Google Play to keep Plus.` |
| status.ended | `Plus ended on {date}.` |
| message.pending | `Payment pending. Plus unlocks when Google Play confirms it. You don't need to pay again.` |
| message.already_owned | `Google Play says you already own Plus. Tap Restore purchases.` |
| message.not_granted | `Your payment went through but Plus isn't active yet. Refresh in a minute. You don't need to pay again.` |
| message.offer_unavailable | `This plan isn't available right now. Reload and try again.` |
| message.restore_none | `No Plus purchase found for this Google Play account.` |
| message.restore_failed | `We couldn't restore purchases. Check your connection and try again.` |
| message.purchase_failed | `The payment didn't go through. If you were charged, refresh before trying again.` |
| message.billing_unavailable | `Google Play billing isn't available on this device.` |
| message.thanks | `Thank you. Plus is active.` |
| row.ad_free | `Ad-free with Plus` |
| insights.locked | `Unlock your year in review with Plus` |

Links:
- Terms: `https://yify.expo.app/terms.html`
- Privacy: `https://yify.expo.app/privacy.html`
- Manage: `safeManagementURL(entitlement.managementUrl)`. Fallback when the store is `play_store`: `https://play.google.com/store/account/subscriptions?sku={productId without ":basePlan"}&package=io.github.kunal26das.yify`. Opened with `Linking.openURL` on Android and as a new tab on web. On Android, `manage` opens only Play URLs: when `entitlement.store` is not `play_store`, the row shows the status text without a link (Play Payments policy).

Copy rule: every string says "{APP_NAME} ads" or "No {APP_NAME} ads", never a bare "No ads" (YouTube and streaming services still show their own), and web surfaces make no ads claim at all. `src/features/monetization/plus/copy.test.ts` fails if `"No ads"` appears in any file under `src/`.

### C1.10 Restore, pending, cancellation

- **Restore.** A user action on Android and on web in `web_checkout` mode (T27). In `play_link` mode the button is "Refresh status" (T16), because the web SDK has no Play receipts to restore.
- **Pending purchases.** Covers cash, carrier billing and slow payment methods, which matter for IN, PH and ZA.
  - Error code 20 sets `flow = pending` (T23).
  - Buy buttons are disabled while pending.
  - The customer listener (T15) unlocks Plus when Play confirms.
  - Restore stays available.
  - `pendingTransactionsForPrepaidPlansEnabled` stays at its default `false`: there are no prepaid base plans (`purchasesConfiguration.d.ts`).
- **Cancellation.** Always done in the store, through Manage. The app shows `status.until` once `willRenew` is false. Play in-app messages handle billing issues (`shouldShowInAppMessagesAutomatically: true`).

### C1.11 Gating API used by other features (`src/features/monetization/public/plus.ts`)

```ts
export function usePlus(): {
  status: PlusStatus;
  entitlement: PlusEntitlement;
  ensureKnown(): Promise<'free' | 'plus'>;
  openPaywall(placement: PaywallPlacement): void;
};
export function canCreateCustomList(input: {customListCount: number; status: PlusStatus}): {allowed: true} | {allowed: false; reason: 'limit'};
export function effectiveAccent<T extends string>(input: {stored: T; status: PlusStatus; fallback: T}): T;
export function insightsAccess(status: PlusStatus): 'full' | 'teaser';
```

Rules:
- Lists may be created while `customListCount < FREE_CUSTOM_LIST_LIMIT` or the status is `plus`.
- If the status is `unknown`, the caller awaits `ensureKnown()` before deciding.
- When blocked, the caller calls `openPaywall('list_limit')`.
- Lists above the limit (for example after Plus lapses) stay fully usable: view, edit, add and remove titles, delete. Only creating a new list is blocked.
- Sync merges never delete or refuse lists over the limit.
- The accent preference is stored as chosen; `effectiveAccent` returns the fallback while the status is not `plus`.

### C1.12 The RevenueCat project-id bug

v1 compares `entitlement.project_id === '8b6ff243'` while the API returns `proj8b6ff243`:
- `data/server/subscribers/revenuecat.ts:4,25`
- `scripts/availability-alerts/adapters.mjs:58,79`

**v2 has no code that compares project ids.** The only server-side entitlement check (subscriber catalog) and the availability alerts are deleted (decision 2 and decision 8). Acceptance: `rg -n "8b6ff243" src app scripts` returns nothing. If a server check ever comes back, it must compare `project_id === 'proj8b6ff243'`, match on the entitlement `lookup_key`, and carry a contract test against a recorded live payload.

### C1.13 Files and acceptance

Files to port or delete:
- Port: `presentation/purchases/offer-copy.ts` → `copy.ts`; the revision and queue logic from `RevenueCatPurchaseRepositoryImpl.ts`; the Firebase instance-id link.
- Delete:
  - `data/repositories/RevenueCatPurchaseRepositoryImpl.ts` and `.web.ts`
  - `presentation/purchases/*` (replaced by B4.12's Plus page and sheet on top of `usePaywall`)
  - `domain/policies/subscriptionFunnel.ts`
  - `domain/policies/supporterNudge.ts` and `data/services/SupporterNudgeImpl.ts`
  - `data/services/RevenueCatAdRevenueSink.ts`
  - `scripts/subscription-funnel-report.mjs`, `docs/subscription-funnel.md`, `tests/fixtures/subscription-funnel-report.json`, `tests/fixtures/journal-funnel-report.json`
  - the Buy-me-a-coffee row and copy, `buy_me_a_coffee_url` reads, `.github/FUNDING.yml`

Acceptance:
- [ ] On a fresh install, signed out, a Play license tester can buy monthly. Ads stop within the same session (`adsEntitlement` becomes `plus` from the purchase result). After an app restart offline, Plus is still on (from the cache).
- [ ] Signing in afterwards with a never-used Google account: the RevenueCat dashboard shows one customer with the anonymous id aliased. Web shows Plus after sign-in with the same account.
- [ ] Signing in on a second device with an account that already has an alias: the post-login reconcile runs once. Logcat shows exactly one `restorePurchases` call.
- [ ] Signing out keeps Plus on the device. Signing in as another account shows "free" and the buy buttons.
- [ ] Sandbox "slow card" pending flow: the pending message shows, buttons are disabled, and Plus unlocks without a restart when the test card confirms.
- [ ] Web `play_link`: the client bundle loads `@revenuecat/purchases-js` only after a signed-in user opens a Plus surface or a gate needs the status. The network panel shows no `api.revenuecat.com` request for signed-out visitors, nor for a signed-in page view without a Plus surface.
- [ ] `yarn test` covers every transition row and selector.

---

## C2. Ads on Android

### C2.1 Summary

There is one AdMob interstitial: app `ca-app-pub-2292299294214510~5237171305`, unit `ca-app-pub-2292299294214510/8726265265`.

When it can show:
- Only on Android.
- Only on the tap that opens a movie or TV title page, before navigating.
- Only from a lazily preloaded ad.
- Never on app start, deep links or shares.
- Never when a trailer is playing or was requested in the last 30 s.
- Never for Plus users, or while the entitlement is unknown.
- Pacing: no ad in the first 3 title opens of a session, at most one per 4 opens, and at least 180 s apart.

What it never does:
- No ad on or around the player.
- No hero or player overlays.
- No AdSense or any other ads on web.
- No remote kill switch. The owner's 2026‑09‑08 instruction was not to reintroduce a remote flag, and Remote Config is removed (decision 8). Emergency disable is a one-line OTA: `ADS_ENABLED = false`.

### C2.2 Pacing policy (`src/features/monetization/ads/adPolicy.ts`, new, pure)

This replaces `domain/policies/adGating.ts`, whose 3‑open/120 s rule threw away 89–96 % of filled ads (`research/data-browser.md` DB‑1).

```ts
export const ADS_ENABLED = true;
export const AD_UNIT_INTERSTITIAL = 'ca-app-pub-2292299294214510/8726265265';
export const SESSION_WARMUP_OPENS = 3;
export const OPENS_PER_AD = 4;
export const MIN_AD_INTERVAL_MS = 180_000;
export const TRAILER_GUARD_MS = 30_000;
export const SESSION_IDLE_RESET_MS = 1_800_000;
export const AD_MAX_AGE_MS = 3_300_000;
export const AD_PRESHOW_DELAY_MS = 400;
export const AD_OPEN_TIMEOUT_MS = 2_000;
export const AD_LOAD_BACKOFF_MS = [30_000, 60_000, 120_000];

export type TitleOpenSource = 'tap' | 'deep_link';
export type AdSkipReason =
  | 'disabled' | 'platform' | 'entitlement_unknown' | 'plus' | 'not_tap' | 'trailer'
  | 'session_warmup' | 'frequency' | 'cooldown' | 'consent' | 'offline' | 'not_loaded' | 'stale_ad';

export interface AdDecisionInput {
  enabled: boolean;
  platform: 'android' | 'web';
  entitlement: 'plus' | 'free' | 'unknown';
  source: TitleOpenSource;
  openOrdinal: number;
  lastAdOrdinal: number | null;
  lastAdShownAt: number | null;
  now: number;
  trailer: {playing: boolean; lastRequestedAt: number | null};
  consent: 'can_request' | 'denied' | 'unknown';
  online: boolean;
  adLoadedAt: number | null;
}

export type AdDecision = {action: 'show'} | {action: 'skip'; reason: AdSkipReason};

export function decideAd(input: AdDecisionInput): AdDecision;
export function nextEligibleOrdinal(lastAdOrdinal: number | null): number;
export function pacingAllows(input: Pick<AdDecisionInput, 'openOrdinal' | 'lastAdOrdinal' | 'lastAdShownAt' | 'now'>): boolean;
export function shouldPreload(input: Omit<AdDecisionInput, 'source'>): boolean;
export const LOGGED_SKIP_REASONS: ReadonlySet<AdSkipReason>;
```

`decideAd` evaluates in this order and returns the first match:

| Order | Check | Reason |
|---|---|---|
| 1 | `!enabled` | `disabled` |
| 2 | `platform !== 'android'` | `platform` |
| 3 | `entitlement === 'unknown'` | `entitlement_unknown` |
| 4 | `entitlement === 'plus'` | `plus` |
| 5 | `source !== 'tap'` | `not_tap` |
| 6 | `trailer.playing`, or `lastRequestedAt != null && now - lastRequestedAt < TRAILER_GUARD_MS` | `trailer` |
| 7 | `openOrdinal <= SESSION_WARMUP_OPENS` | `session_warmup` |
| 8 | `lastAdOrdinal != null && openOrdinal - lastAdOrdinal < OPENS_PER_AD` | `frequency` |
| 9 | `lastAdShownAt != null && now - lastAdShownAt < MIN_AD_INTERVAL_MS`. Negative deltas (clock moved back) count as inside the window. | `cooldown` |
| 10 | `consent !== 'can_request'` | `consent` |
| 11 | `!online` | `offline` |
| 12 | `adLoadedAt == null` | `not_loaded` |
| 13 | `now - adLoadedAt > AD_MAX_AGE_MS` (AdMob guidance treats a one-hour-old interstitial as stale, `node_modules/react-native-google-mobile-ads/lib/typescript/commonjs/types/AdExpiry.d.ts`) | `stale_ad` |
| 14 | otherwise | `show` |

Supporting definitions:
- `nextEligibleOrdinal(last) = max(SESSION_WARMUP_OPENS + 1, last == null ? 0 : last + OPENS_PER_AD)`.
- `shouldPreload` is true iff all of these hold:
  - `enabled`, `platform === 'android'`, `entitlement === 'free'`
  - `consent === 'can_request'`, `online`, `!trailer.playing`
  - `adLoadedAt == null || now - adLoadedAt > AD_MAX_AGE_MS`
  - `nextEligibleOrdinal(lastAdOrdinal) - openOrdinal <= 2`
- `pacingAllows` is true iff checks 7–9 pass (warmup, frequency, cooldown).
- `LOGGED_SKIP_REASONS = {entitlement_unknown, trailer, consent, offline, not_loaded, stale_ad}`.
- The controller emits `ad_skipped` only when `pacingAllows(input)` is true and the reason is in that set. GA4 then shows only lost opportunities, i.e. opens where pacing would have allowed an ad.
- Pacing skips (`session_warmup`, `frequency`, `cooldown`, `not_tap`) and `plus` are by design. They become Sentry metrics only.

Required test cases (`adPolicy.test.ts`):

| # | Input (defaults: android, free, tap, consent ok, online, loaded 10 s ago, no trailer, no prior ad, `enabled` true) | Expected |
|---|---|---|
| 1 | ordinals 1, 2, 3 | skip `session_warmup` |
| 2 | ordinal 4 | show |
| 3 | ordinal 4, `adLoadedAt` null | skip `not_loaded` |
| 4 | ordinal 4, loaded 56 min ago | skip `stale_ad` |
| 5 | ordinals 5, 6, 7 after an ad at 4 | skip `frequency` |
| 6 | ordinal 8 after an ad at 4, shown 179 s ago | skip `cooldown` |
| 7 | ordinal 8 after an ad at 4, shown 180 s ago | show |
| 8 | new session, ordinal 4, previous session's ad 100 s ago | skip `cooldown` |
| 9 | `lastAdShownAt` in the future (clock skew) | skip `cooldown` |
| 10 | entitlement `plus`, ordinal 4 | skip `plus` |
| 11 | entitlement `unknown` | skip `entitlement_unknown` |
| 12 | `source: 'deep_link'`, ordinal 4 | skip `not_tap` |
| 13 | trailer playing | skip `trailer` |
| 14 | trailer requested 29 s ago / 31 s ago | skip `trailer` / show |
| 15 | consent `denied` / `unknown` | skip `consent` |
| 16 | offline | skip `offline` |
| 17 | platform `web` | skip `platform` |
| 18 | `enabled: false` | skip `disabled` |
| 19 | `shouldPreload` after ordinal 1 / 2 / 3 | false / true / true |
| 20 | `shouldPreload` after an ad at ordinal 4, current ordinal 4 / 6 | false / true |
| 21 | `shouldPreload` with entitlement plus or unknown, consent unknown, or a fresh ad loaded | false |

### C2.3 Session and persistence (`adSession.ts`, new)

In-memory state `{openOrdinal, lastAdOrdinal}`:
- Resets on process start, and when the app returns to `active` after being in the background for at least `SESSION_IDLE_RESET_MS` (30 min, which matches GA4's session timeout).
- `recordTitleOpen(source)` increments `openOrdinal` only for `'tap'`.
- Person pages never count and never show ads.

Persisted key `ads.lastShownAt`: an epoch ms value written when `AdEventType.OPENED` fires, and clamped to `now` if it is ever in the future.

### C2.4 Consent: UMP (`platform/adConsent.ts` and `platform/adConsent.web.ts`, ported from `AdMobAdGateway.ts:177-249`)

API, from `node_modules/react-native-google-mobile-ads/lib/typescript/commonjs/specs/modules/NativeConsentModule.d.ts`:
- `AdsConsent.gatherConsent(options?)` (`:373`), `getConsentInfo()` (`:366`) and `showPrivacyOptionsForm()` (`:348`).
- `AdsConsentInfo.canRequestAds` (`:117`) and `privacyOptionsRequirementStatus` (`:121`).
- `AdsConsentPrivacyOptionsRequirementStatus.REQUIRED`.

Flow:
1. Runs only on Android, only once the entitlement is known to be `free`, once per cold start.
   - It waits until ≥ 2 s after the first content render and until the first-run privacy prompt (decision 4) is answered, dismissed or deferred (`isConsentPromptResolved()`, settings public; B4.13), so the Google form never covers the first screen, and an ignored prompt holds UMP back for at most 60 s or three title pages: UMP always runs before the first eligible ad opportunity (open 4).
   - Plus users never reach UMP.
2. `gatherConsent()` sets `consent = canRequestAds ? 'can_request' : 'denied'` and `privacyOptionsRequired = status === REQUIRED`. On error, fall back to `getConsentInfo()`. If that also fails, `consent = 'unknown'` and a `consent_error` metric is recorded.
3. You → Privacy shows "Ad privacy choices" only when `privacyOptionsRequired` (exposed as `useAdPrivacyOptions()` in `public/ads.ts`). It calls `showPrivacyOptionsForm()`, then re-reads `getConsentInfo()`.
4. In builds with `EXPO_PUBLIC_ADMOB_MODE=test`, pass `{debugGeography: AdsConsentDebugGeography.EEA, testDeviceIdentifiers}`. The identifiers come from `EXPO_PUBLIC_ADMOB_TEST_DEVICES` (comma list), so the EEA form can be QA'd.
5. Ads are requested only when `consent === 'can_request'`. The SDK reads the TCF and GPP strings itself, so no manual non-personalised flags are set.
6. **Users signalled as under 18 (2.0.x follow-up; O-29).** Play announced on 2026-11-19 that sharing age signals becomes mandatory for users in California (AB 1043) and Brazil from January 2027 (`research/android.md` §2.7). 2.0.0 ships without an age-signal module; P9 files the design as the first 2.0.x item, and the owner's legal determination (O-29) decides its scope. When the module lands, a user signalled as under 18 gets `mobileAds().setRequestConfiguration({maxAdContentRating: MaxAdContentRating.T, tagForUnderAgeOfConsent: true})` (`node_modules/react-native-google-mobile-ads/lib/typescript/commonjs/types/RequestConfiguration.d.ts:41`), every ad request carries `requestNonPersonalizedAdsOnly: true` (`types/RequestOptions.d.ts:28`), and analytics consent is forced off (C5.1).

### C2.5 Gateway (`platform/interstitialGateway.ts` and its no-op `platform/interstitialGateway.web.ts`), ported from `data/services/AdMobAdGateway.ts`

```ts
export interface InterstitialGateway {
  readonly supported: boolean;
  ensureInitialized(): Promise<boolean>;
  preload(): void;
  loadedAt(): number | null;
  present(): Promise<'closed' | 'failed' | 'timeout'>;
  discard(): void;
}
```

Keep from v1:
- `initializeAds`: `mobileAds().setRequestConfiguration({maxAdContentRating: MaxAdContentRating.T})` then `mobileAds().initialize()` (`types/MobileAdsModule.interface.d.ts:27,10`; `RequestConfiguration.d.ts`).
- The `loadNext` listener structure: `InterstitialAd.createForAdRequest(unit)` (`ads/InterstitialAd.d.ts:68`), `addAdEventListener(AdEventType.LOADED | ERROR | OPENED | CLOSED)` (`AdEventType.d.ts`), `load()` and `show()` (`ads/MobileAd.d.ts:65-66`).
- Load backoff `[30, 60, 120] s`.
- Failure classification `finishAdFailure` and `adErrorCode` (port `data/services/AdMobFailure.ts`).
- `TestIds.INTERSTITIAL` when `__DEV__` **or** `EXPO_PUBLIC_ADMOB_MODE === 'test'`. Preview builds set that env var, so testers never click live ads; this addresses the invalid-traffic risk in DB‑7.

Change from v1:
- No initialisation and no preload at app start (v1 `:206-229`, `:255-276`). `ensureInitialized` runs on the first `shouldPreload === true`.
- `loadedAt` is a timestamp, and stale ads are destroyed.
- There is no title-open counting inside the gateway: the policy and the session own it.
- `PAID` handling is removed together with the manual `ad_impression` and RevenueCat ad-sink calls (v1 `:386-391`, `:487-511`). AdMob linked to Firebase logs `ad_impression` with revenue automatically (https://firebase.google.com/docs/analytics/measure-ad-revenue), so the manual event double-counted.
- No foreground or network-change preload loops. Preload is evaluated only after each title open and on `CLOSED`.

### C2.6 Placement: show, then navigate (`platform/openTitle.ts` + `platform/openTitle.web.ts`, re-exported by `public/openTitle.ts`)

```ts
export interface OpenTitleInput {
  source: TitleOpenSource;
  surface: CardSurface | 'deep_link';
  contentType: MediaType;
  contentId: number;
  title: string;
  posterPath: string | null;
}
export function openTitle(navigate: () => void, input: OpenTitleInput): void;
```

Android sequence:
1. If an ad flow is already running, ignore the tap.
2. `session.recordTitleOpen(source)`, then `track(select_content)`.
3. Compute `decideAd(...)`. If the result is not `show`: navigate immediately. Record the `ads.decision` metric with the reason. If the reason is in `LOGGED_SKIP_REASONS` and `pacingAllows(input)`, also `track(ad_skipped)`. Then, if `shouldPreload`, call `gateway.preload()` and stop.
4. If `show`: the caller has already started `prefetchQuery(titleQuery)`.
   - Show the full-screen "Opening {title}…" transition surface (`AdTransitionHost`, B5.4, from `input.title` and `input.posterPath`) for `AD_PRESHOW_DELAY_MS = 400` ms. AdMob recommends a delay for frequent tappers so that a second tap cannot land on the ad.
   - Then call `gateway.present()`.
5. Navigate exactly once, on `CLOSED`, `ERROR`, a `show()` rejection, or `AD_OPEN_TIMEOUT_MS = 2000` without `OPENED`.
   - On a timeout, also `track(ad_skipped {reason: 'show_timeout'})` and discard the ad. A late `OPENED` after navigation is not possible for a loaded interstitial in practice. If it does happen, it is counted as the `ads.present` outcome `late_open` and investigated.
6. On `OPENED`: write `ads.lastShownAt`, set `session.lastAdOrdinal = openOrdinal`, and `track(ad_shown {placement: 'title_open', open_ordinal})`.
7. The Android back button during the ad closes it (`CLOSED`). The user lands on the title they asked for.

The web twin tracks `select_content`, navigates immediately and imports nothing from `react-native-google-mobile-ads`.

### C2.7 Lazy initialisation and preload

| Moment | Action |
|---|---|
| App start | Nothing ad-related. The GMA SDK stays uninitialised (`delayAppMeasurementInit: true` stays in the plugin). |
| ≥ 2 s after first render, entitlement `free` | UMP `gatherConsent` (§2.4) |
| After each title open, and on `CLOSED` | If `shouldPreload`: `ensureInitialized()`, then `preload()` |
| Load failure | Backoff 30/60/120 s while `shouldPreload` stays true |
| Entitlement becomes `plus` | `discard()`. Never load again in this process. |

### C2.8 Telemetry for ads

- **GA4.** `ad_shown`, `ad_skipped` (§5.5), and the automatic `ad_impression` from the AdMob–Firebase link.
- **Sentry metrics (consent-gated).**
  - `ads.decision` {reason}
  - `ads.load` {outcome: ok \| no_fill \| network \| error}
  - `ads.present` {outcome: closed \| failed \| timeout \| late_open}
  - `ads.consent` {outcome: can_request \| denied \| error}
- **No Sentry error events for ads.** v1's 98 `ads.load failed` events fragmented into 19 Crashlytics issues (`research/stability.md` §5.1).
- **KPI.** The AdMob show rate (impressions ÷ matched requests) should move from 4–11 % today to ≥ 50 %, and ad requests per daily user should be ≤ 1.5.

### C2.9 Why this complies

**YouTube API Services Developer Policies** (https://developers.google.com/youtube/terms/developer-policies, fetched 2026‑11‑26):
- III.F.3 (b): "must not otherwise gate access to a video by requiring a user to take an action other than clicking the play button". The ad runs on the tap that opens a title page. It never runs on the play button, and never between the play tap and playback. Trailers are tap-to-play only and never autoplay behind or after an ad.
- III.G.1 (c): you must not "sell advertising, sponsorships, or promotions that are placed on or within YouTube audiovisual content … or the YouTube player". The interstitial is a separate full-screen activity shown before the title page (and its player) mounts. There are no overlays.
- III.G.1 (d): you must not "sell advertising … on any page or screen that contains YouTube API Data unless other data … not obtained from YouTube appears on the same page". The ad screen contains no YouTube data. Pages with players carry no ads.
- III.F.3 (c), no incentives for engagement: there are no rewarded ads.
- v1 broke III.F.3: it gated playback until the ad closed (`PlayerContext.tsx:133-160`, `research/monetization.md` MON‑3). That code is deleted.
- III.A.1, display a link to the YouTube Terms of Service: the first-trailer panel (B5.2) and About (B4.14) link `https://www.youtube.com/t/terms`.
- III.A.2, "require users to agree to a privacy policy before users can access the API Client's features", a policy that says the app uses YouTube API Services and links the Google Privacy Policy: the first-trailer panel is the agreement point ("By playing, you agree to the {APP_NAME} Privacy Policy and the YouTube Terms of Service"; Part 0, I-62), and `privacy.html` has the YouTube API Services section with `https://policies.google.com/privacy` (C6.8).

**AdMob interstitial guidance:**
- Recommended (https://support.google.com/admob/answer/6201350): "consider placing an interstitial ad after a number of screens or actions taken". "It is recommended that interstitial ads appear before the break page rather than after." Insert "a delay … before the display of an interstitial ad". "Consider pre-loading your interstitial ads."
- Disallowed (https://support.google.com/admob/answer/6201362):
  - "App load or exit": never on app start, never a deep-link or cold-start open.
  - "Placing an interstitial ad after every user action": at most one per 4 title opens, ≥ 180 s apart. That is stricter than "no more than one interstitial ad after every two user actions".
  - "Interstitial launches after page load": shown before navigation, from a preloaded ad, with a 2 s abandon timer.
  - Ads interfering with navigation: closing the ad always continues to the requested page.

### C2.10 Web: no ads (deletions)

Delete:
- `data/services/AdSenseDisplayAds.web.ts`
- `presentation/components/WebAdvertisement.web.tsx`
- the `DisplayAds` port and its wiring at `HomeScreen.tsx:293`
- `public/ads.txt` (only AdSense reads it)
- `tests/adsense-display.test.cjs`, `tests/web-advertisement.test.cjs`
- AdSense consent-revocation code
- AdSense mentions in `public/privacy.html`

**Keep `public/app-ads.txt`** (`google.com, pub-2292299294214510, DIRECT, f08c47fec0942fa0`) for AdMob. AdMob reads `app-ads.txt` from the root of the developer website on the Play listing (today `kunal26das.github.io`, served by the owner's user-site repo). Keeping the copy on `yify.expo.app` covers a later change of the developer website.

### C2.11 Acceptance

- [ ] `adPolicy.test.ts`: all 21 cases pass.
- [ ] Logcat from a preview build with test ads: no `MobileAds` or `InterstitialAd` activity during the first two title opens. A load starts after the 2nd tap. The ad shows on the 4th tap, after a 400 ms transition, and the title page appears on close.
- [ ] An EEA debug-geography build shows the UMP form only after the first-run privacy prompt, never over a blank screen; with the prompt ignored, UMP runs after the deferral (60 s or the third title page) and the test ad can show from open 4.
- [ ] Deep-link opens (`adb shell am start -a android.intent.action.VIEW -d https://yify.expo.app/title/movie/603`) never show an ad.
- [ ] A Plus license tester never triggers `ensureInitialized` (no `MobileAds` init log).
- [ ] `rg -n "react-native-google-mobile-ads|adsbygoogle|googlesyndication" dist/client` finds nothing in the web export.

---

## C3. Web platform

### C3.1 One deployment: EAS Hosting at `yify.expo.app`

- `yify.expo.app` is canonical. It is the App Links host and serves the edge API.
- **Retire GitHub Pages:**
  - Delete `.github/workflows/deploy-pages.yml`, the Pages `export:web` variant (`EXPO_WEB_BASE_URL=/yify`), `check-web-export.mjs --static`, and the Pages Sentry release path.
  - The owner unpublishes the project Pages site at v2 web launch (§7). It had at most 7 users in 90 days and its deep links already return 404 (`research/web.md` §1).
  - The owner's root user site `kunal26das.github.io` (which serves `app-ads.txt`) is a different repo and is unaffected.
- `app.config.js` stops reading `EXPO_WEB_OUTPUT` and `EXPO_WEB_BASE_URL`, and drops the `experiments.baseUrl` override.

### C3.2 Decision: `web.output: 'server'` (SSR) with `generateMetadata` + `loader`

Verified support (SDK 58):
- `node_modules/expo-server/build/cjs/metadata.d.ts` defines `Metadata` (title, description, robots, `alternates.canonical`, `openGraph`, `twitter`, `verification`, `other`) and `GenerateMetadataFunction(request, params)`.
- `node_modules/expo-router/build/Route.d.ts:21-22` exposes `loader?: LoaderFunction` and `generateMetadata?: GenerateMetadataFunction` on routes.
- Expo docs, https://docs.expo.dev/router/web/server-rendering/: "Server rendering is stable in SDK 58". Metadata "runs on the server before rendering begins, and its result is injected into the `<head>`". `generateMetadata` and loaders are stripped from the client bundle.
- Expo docs, https://docs.expo.dev/router/web/data-loaders/: loaders run per request in SSR. They can return `Response.json(data, {headers})`, use `setResponseHeaders`, and throw `StatusError`.

**Document requests and loader-data requests** (Part 0, I-54). The same `loader` serves two kinds of request: the server render of a document, and the JSON fetch that client navigation makes to `/_expo/loaders/<path>` with `Accept: application/json` and default redirect handling (`node_modules/expo-router/build/loaders/utils.js:41-58`). `titlePage.ts` and `personPage.ts` branch on `isLoaderDataRequest(request)` (the `accept` header contains `application/json`):

- **Loader-data request:** return `Response.json(null, {headers: {'Cache-Control': 'no-store'}})` at once, with no TMDB call. The twin passes `initialData` only when the loader data is not `null`, so in-app navigation uses `useOpenMedia`'s prefetched title query and paints the header from `summaryCache` on the first frame (A10 item 12). A stale or missing slug renders by id, as on native.
- **Document request:** canonicalise and 404 as below.

A redirect or 404 thrown for a loader-data request would be followed to HTML ("Failed to parse loader data") or rejected ("Failed to fetch loader data: 404") and land in the route error boundary (feasibility review, item 5), so only document requests throw.

**404 mechanics (verified in source).** In SSR, `getHtml` runs `resolveMetadata` and then `executeLoader`, and rethrows any error (`node_modules/expo-server/build/cjs/vendor/environment/common.js:119-157`). The request scope then returns a thrown `Response` unchanged (`node_modules/expo-server/build/cjs/runtime/index.js:69-77`). A thrown `StatusError` becomes a JSON body (`runtime/error.js:82-90`). So a title loader for an unknown id, on a document request, does:

```ts
throw new Response(notFoundHtml(kind), {
  status: 404,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
    'X-Robots-Tag': 'noindex',
    'Content-Security-Policy': ENFORCED_CSP,
    'X-Content-Type-Options': 'nosniff',
  },
});
```

A thrown `Response` bypasses `respondHTML`, so the router's global headers are not merged into it. That is why the snippet sets the security headers itself. `ENFORCED_CSP` is exported from `src/server/seo/securityHeaders.ts`, and `tests/web/securityHeaders.test.ts` asserts it equals `ENFORCED_CSP` of `config/webHeaders.cjs` (C4.1).

`notFoundHtml` lives in `src/server/seo/notFoundHtml.ts`. It is a small static HTML page: title "Not found · Yify", a link home, `<meta name="robots" content="noindex">`, and the site CSS reset only. Unmatched paths go to `app/+not-found.tsx`, which already returns 404 through `respondNotFoundHTML` (`vendor/abstract.js:146-158`).

**Native must not run loaders.** On native, a route with a `loader` fetches its data from the server (data-loaders docs, "Native apps"). Put `loader` and `generateMetadata` in **`.web.tsx` route twins**: `app/(tabs)/(home,search,library,you)/title/movie/[id].web.tsx`, `…/title/tv/[id]/index.web.tsx` and `…/person/[id].web.tsx` (A7.1). Their bodies load `src/server/seo/*` with `await import(…)` (Part 0, I-28). The native route files (`[id].tsx`) have no loader. The docs cover this: "Put the `loader` in index.web.tsx if that file exists". Both twins render the same screen component from `src/features/title/...`. The web twin passes `useLoaderData()` to TanStack Query as `initialData`.

Route-level metadata (`src/server/seo/metadata.ts`, new):

| Route | `title` | `description` | Other |
|---|---|---|---|
| `/` | `Yify — find where to watch movies and TV` | `Watch trailers, see where movies and TV shows are streaming in your country, and keep a watch diary.` | canonical `https://yify.expo.app/`, OG image `/og-card.png` |
| `/title/movie/[id]` | `{title} ({year}) — trailer, cast & where to watch \| Yify` (no year: drop the parentheses) | TMDB `overview`, cut at a word boundary to ≤ 155 chars plus `…`. Fallback: `Watch the {title} trailer, see the cast and find where to stream it.` | canonical `https://yify.expo.app/title/movie/{id}-{slug}`, `og:type` `video.movie`, OG image TMDB `https://image.tmdb.org/t/p/w1280{backdrop_path}` (else `w780` poster, else `/og-card.png`), `twitter.card` `summary_large_image` |
| `/title/tv/[id]` | `{name} (TV series {firstYear}) — trailer & where to watch \| Yify` | as above | `og:type` `video.tv_show` |
| `/person/[id]` | `{name} — movies and TV shows \| Yify` | TMDB biography ≤ 155 chars. Fallback: `See {name}'s movies and TV shows, with trailers and where to watch.` | `og:type` `profile` |
| `/search`, `/library/*`, `/list/[id]`, `/you`, `/plus`, `/settings/*` | page name `\| Yify` | — | `robots: {index: false, follow: true}` |
| any route served to a host other than `yify.expo.app` | — | — | `robots: {index: false, follow: false}`, decided from `publicHost(request)` = `request.headers.get('x-forwarded-host')`, falling back to `yify.expo.app` (A3.1: `request.url` is the deployment URL on EAS, so deciding from it would mark every production page `noindex`) |

Where each row comes from (Part 0, I-55):

- `/title/*` and `/person/*`: the async `generateMetadata` of the three web twins (`src/server/seo/metadata.ts`).
- `/`, `/search`, `/library`, `/library/watched`, `/library/lists`, `/library/recent`, `/list/[id]`, `/you`, `/plus` and `/settings/*`: each static route file exports a synchronous `generateMetadata(request)` that returns `staticMetadata(page, request?.headers.get('x-forwarded-host') ?? null)` from `src/core/config/seo.ts`. That file is pure (no React, no Expo, no server imports) and also exports `pageTitle(name)`, `titleDocumentTitle(input)`, `personDocumentTitle(name)` and `isIndexableHost(host)`, which `ScreenScaffold` (B3.27) and `src/server/seo/metadata.ts` share, so the server and client titles match. `GenerateMetadataFunction` accepts a synchronous return and an `undefined` request (`node_modules/expo-server/build/cjs/metadata.d.ts:207-209`). The Babel plugin removes every `generateMetadata` export inside the app directory from client and native bundles (`node_modules/babel-preset-expo/build/plugins/server-metadata-plugin.js`).
- `seo.ts` returns its own `PageMetadata` shape (title, description, robots, `alternates.canonical`, `openGraph`, `twitter`), which is structurally assignable to `Metadata`; `core/config` may not import `expo-router` types (A1.4).

Slugs:
- `slug = slugify(title)` from `src/core/domain/slug.ts` (A3.3.6), the same function the API and the app use.
- A document request whose slug differs from the canonical one (including no slug) gets `throw new Response(null, {status: 301, headers: {Location: '/title/movie/603-the-matrix'}})`, with a **relative** `Location` (the canonical path). `Response.redirect` needs an absolute URL, and one built from `request.url` would point at the deployment host (A3.1); `expo-server`'s own config redirects are relative too (`node_modules/expo-server/build/cjs/utils/matchers.js:117-120`).
- The `id` param is parsed with `/^(\d{1,9})(?:-[a-z0-9-]*)?$/`. Anything else returns the 404 response (document requests) or `null` (loader-data requests).

JSON-LD (`src/server/seo/jsonLd.ts`, new):
- Rendered in the body by the web route twin as `<script type="application/ld+json">`, using a `.web.tsx` DOM element.
- The JSON is serialised with `JSON.stringify(value).replace(/</g, '\\u003c')`.
- Movie:
  ```json
  {"@context":"https://schema.org","@type":"Movie","name":"","url":"","image":"","datePublished":"YYYY-MM-DD","description":"","duration":"PT2H16M","genre":[],"director":[{"@type":"Person","name":""}],"actor":[{"@type":"Person","name":"","url":"https://yify.expo.app/person/{id}-{slug}"}],"trailer":{"@type":"VideoObject","name":"","embedUrl":"https://www.youtube-nocookie.com/embed/{key}","thumbnailUrl":"https://i.ytimg.com/vi/{key}/hqdefault.jpg","uploadDate":"{video.published_at}"}}
  ```
  At most 5 actors. `trailer` only when TMDB returns a YouTube trailer with `published_at`.
- TVSeries: `name`, `url`, `image`, `startDate`, `numberOfSeasons`, `genre`, `actor`, `trailer`.
- Person: `name`, `url`, `image`, `birthDate`, `birthPlace`, `sameAs` (IMDb and Wikidata URLs from TMDB `external_ids`).
- **No `aggregateRating`.** TMDB vote averages are not Yify user reviews.

Caching (Part 0, I-54):
- **HTML.** A loader's `Response` headers never reach the HTML: the server render keeps only the loader's JSON body (`node_modules/expo-server/build/cjs/vendor/environment/common.js:148`), and `respondHTML` adds only `Content-Type` plus the router's `headers` and `pageHeaders` (`vendor/abstract.js:263-281`). So `config/webHeaders.cjs` exports `pageHeaders`, which `app.config.js` passes to the expo-router plugin (`node_modules/expo-router/plugin/build/withRouter.d.ts:53-62,123`, `PageHeadersConfig {source, headers}`): `/title/movie/[id]`, `/title/tv/[id]` and `/person/[id]` get `Cache-Control: HTML_CACHE`. expo-server matches `pageHeaders` against the request path (`vendor/abstract.js:75-77,303-309`), so loader-data requests, whose path starts with `/_expo/loaders/`, keep the loader's own `no-store`.
- `HTML_CACHE` is `public, max-age=0, s-maxage=600, stale-while-revalidate=600` until spike S2 proves deploy isolation. The EAS docs promise that a promotion invalidates cached **assets** only, and cached HTML points at the previous deployment's chunk hashes. The S2 check: warm a title URL, promote a new deployment, request it again within 10 s; the HTML must reference the new deployment's entry chunk, or every chunk it references must still return 200. Only after that passes may the integrator raise `HTML_CACHE` to `public, max-age=0, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=604800`.
- SSR HTML carries **no region-specific data**. Watch providers load client-side for the user's chosen region, so the cache key is just the URL.

### C3.3 Feasibility spike (do first, ≤ 2 days) and fallback

Spike S1 (local only, no deploy) runs after F0-A merges and before F0-D writes the route files, on the throwaway branch `v2/s1-spike` (Part W, execution review item 15):
1. Add `web.output: 'server'`.
2. Use the shared-route tree of A7.1 with `app/(tabs)/(home,search,library,you)/title/movie/[id].web.tsx` carrying a `loader` and `generateMetadata`, data from F0-B's fixture-backed `titles.ts` when it exists (a local stand-in before), and one static route with a synchronous `generateMetadata`.
3. Run `npx expo export --platform web --output-dir dist`, then `YIFY_API_FIXTURES=1 npx expo serve dist --port 8790` (`@expo/cli/build/src/serve/index.js:29`).

Pass criteria:
1. `curl -s :8790/title/movie/603-the-matrix` contains the exact `<title>`, `og:image`, the canonical link and parseable JSON-LD. The body contains the title text, not the first-run gate. There are no hydration warnings in the browser console.
2. `/title/movie/999999999` returns 404 with the HTML body. `/title/movie/603` returns 301 with `Location: /title/movie/603-the-matrix`. The same paths requested as loader data (`/_expo/loaders/title/movie/603`, `Accept: application/json`) return 200 `null` with `Cache-Control: no-store`.
3. Client navigation from home to a title works: the header renders from the prefetched query on the first frame, and no loader round trip blocks it.
4. Server bundle (`dist/server/**`) ≤ 5 MB uncompressed. Render time per request, measured locally: p50 ≤ 150 ms with fixture TMDB.
5. Cold links to the shared route render inside the `(home)` stack with the tab chrome, and `dist/client` contains no `api.themoviedb.org` (R-1, R-2).
6. `app/sitemap.xml+api.ts` registers `/sitemap.xml`. `removeSupportedExtensions` keeps `.xml` (`node_modules/expo-router/build/matchers.js:134-135`), so this should hold.
7. The server HTML has exactly one `<title>`, and the static route's synchronous `generateMetadata` reaches `<head>` through `useServerDocumentContext()` (`WebDocument`).
8. `curl -sI` on a title URL shows the `pageHeaders` `Cache-Control`.

Spike S2 is the first P8 milestone: `bash scripts/eas.sh deploy --export-dir dist --environment production --alias v2` gives the fixed preview alias `https://yify--v2.expo.app` (docs.expo.dev/eas/hosting/deployments-and-aliases), with the owner's go-ahead (O-25). It is the first run of the render path on workerd; v1 never server-rendered on EAS. Pass criteria:
- TTFB p50 ≤ 800 ms on a cold title URL and ≤ 200 ms on a cache hit;
- one upstream TMDB call per cold title document (`generateMetadata` and `loader` share `getServerState()`, A3.8);
- the deploy-isolation check of C3.2;
- `scripts/check-legacy-contract.mjs --origin https://yify--v2.expo.app` passes (A3.7);
- a `POST /api/v2/availability` with 40 uncached keys answers with an empty `failed` list, which shows 40 upstream fetches per invocation work (A3.2);
- `robots` is `noindex` on the alias and the same HTML requested with `X-Forwarded-Host: yify.expo.app` is indexable.

Fallback F1, used if S1 or S2 fails:
- Keep `web.output: 'static'` + `apiRoutes: true` (today's mode).
- Add `app/+middleware.ts`. For `GET /title/*` and `/person/*` it returns server-built HTML for **every** client. That HTML contains the same head metadata and JSON-LD, a visible summary (title, year, overview, poster, cast names) and the SPA's script tags, copied from the exported `index.html`. Every client gets the same HTML, so this is not cloaking.
- Unknown ids get the same 404 `Response`.
- Middleware runs before routing (`vendor/abstract.js:78-91`).

### C3.4 robots, sitemaps, manifest

`public/robots.txt`:

```
User-agent: *
Allow: /
Allow: /_expo/
Disallow: /api/
Sitemap: https://yify.expo.app/sitemap.xml
```

Sitemaps (`src/server/seo/sitemaps.ts`, `app/sitemap.xml+api.ts`, `app/sitemaps/[name]+api.ts`, all new). They live outside `/api/` so robots rules never block them.

| URL | Content | Source |
|---|---|---|
| `/sitemap.xml` | `<sitemapindex>` listing `static`, `movie-1..5`, `tv-1..3`, `person-1..2` | constant |
| `/sitemaps/static.xml` | `/`, `/search`, `/plus`, `/privacy.html`, `/terms.html`, `/support.html` | constant |
| `/sitemaps/movie-{n}.xml` | 500 URLs each: TMDB `discover/movie?sort_by=popularity.desc&include_adult=false` pages `(n-1)*25+1 … n*25`, through `titles.ts` `discover` | ≤ 25 TMDB calls per file, inside the 40-fetch budget (A3.2); in fixture mode every page returns the fixture page, de-duplicated |
| `/sitemaps/tv-{n}.xml`, `/sitemaps/person-{n}.xml` | same scheme (`discover('tv', …)`, `popularPeople(…)`) | |

Sitemap responses:
- `Content-Type: application/xml; charset=utf-8`
- `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800`
- `<loc>` uses canonical slug URLs. `<lastmod>` is omitted (TMDB has no reliable modification date).

`public/manifest.json`:
- Keep the file.
- `yarn brand:stamp` writes `"name": "{appName} — movies and TV, where to watch"`, `"short_name": "{appName}"`, `background_color` and `theme_color` (`colors.dark.surface`, B2.12); P8 owns the other fields: `"start_url": "/"`, `"scope": "/"`, `"id": "/"`.
- Replace the shortcuts with Search (`/search`) and Library (`/library`).
- Remove the History shortcut.

The document (`WebDocument`, rendered by `app/+html.tsx`) adds `<link rel="manifest" href="/manifest.json">`.

### C3.5 Headers: CSP and frame-ancestors; caching realities

Headers come from `config/webHeaders.cjs` and go into the `expo-router` plugin `headers` option through `app.config.js` (C4.1) (`node_modules/expo-router/plugin/build/withRouter.d.ts:119`); global `headers` reach HTML, loader and API responses. `pageHeaders` (`:123`) apply only to HTML and loader responses whose request path matches (`expo-server/build/cjs/vendor/abstract.js:75-77,303-309`); API routes get the global `headers` only. Headers a response already carries are never replaced (`abstract.js:180-183`). `app.config.js` builds them:

- Enforced from day 1: `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, plus the existing `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. Drop `payment=()` when `EXPO_PUBLIC_WEB_CHECKOUT=1`.
- `Content-Security-Policy-Report-Only` for one release, then promoted to enforced once Sentry shows no violations:

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.googletagmanager.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://lh3.googleusercontent.com https://www.googletagmanager.com https://*.google-analytics.com; font-src 'self' data:; connect-src 'self' https://*.ingest.us.sentry.io https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://api.revenuecat.com; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://accounts.google.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; report-uri https://o4512058491338752.ingest.us.sentry.io/api/4512058497695744/security/?sentry_key=ab0c10fbe49dc5a4e4f0c9ab3c7a0386
```

Notes on this policy:
- The report URI is derived from the public DSN in `sentry.options.json`, which `app.config.js` reads.
- When checkout is on, add `https://js.stripe.com` to `script-src` and `frame-src`, and `https://api.stripe.com` to `connect-src`.
- Web auth is same-origin (A6.1), so `frame-src` lists `'self'` and no firebaseapp host (Part 0, I-35).
- `'unsafe-inline'` stays in `script-src` while Expo's SSR hydration data is inline. It is a known limitation; the clickjacking fix (frame-ancestors) is the priority.

**Hashed asset caching is not configurable on EAS Hosting.** The docs say: "For any assets your deployment responds with, a default cache time of 3600 seconds will be applied for browser caches". Assets get an `ETag` (https://docs.expo.dev/eas/hosting/reference/responses-and-headers/). Assets bypass the worker, so `headers`/`pageHeaders` do not reach them. Accept 1 h plus ETag revalidation; the spike confirms by `curl -I` on an `/_expo/static/js/web/*.js` URL.

### C3.6 Initial-JS budget: ≤ 750 KB brotli per route (phase 1)

Today: 1,186,901 bytes brotli‑11 (6.37 MB raw), plus 502 KB of TTF fonts on the wire (`research/web.md` §4).

The budget is enforced by `scripts/check-web-budget.mjs` (new; uses Node `zlib.brotliCompressSync` at quality 11, no new dependency):
1. Start `npx expo serve dist --port 8791` with `YIFY_API_FIXTURES=1`, so the API routes and the SSR loaders answer from the committed fixtures and the check never calls TMDB (A3.3.1).
2. Fetch `/`, `/search` and `/title/movie/603-the-matrix`.
3. Collect every `<script src>` and `<link rel="modulepreload">` in the HTML.
4. Brotli-compress each file from `dist/client`, and sum per route.
5. **Fail if any route is over 750,000 bytes.**
6. Also sum `<link rel="preload" as="font">` and `@font-face` sources in the linked CSS. **Fail over 120,000 bytes.**
7. Print a per-file table.

How to get there:

| Lever | Expected saving (brotli, from `research/dependencies.md` §8 and `research/web.md` §4) | Owner |
|---|---|---|
| `@revenuecat/purchases-js` only through `import()` (§1.6) | ≈ −210 KB | this section |
| Sentry on web lazy-loaded, using `@sentry/browser` with no Replay or Feedback integrations (§5.3) | ≈ −290 KB | this section |
| `firebase/auth` and `firebase/analytics` only through `import()`; v2 never imports `firebase/firestore` (sync uses REST, A6.5). Auth loads after first paint when `localStorage` holds a persisted Firebase session (`firebase:authUser:<apiKey>:[DEFAULT]`, A6.1), or on the Sign in tap. Analytics loads only after consent. | ≈ −35 KB | F0 (analytics), P6 (auth) |
| No `expo-notifications` on web (the package is removed, §4.9) | ≈ −9 KB | this section |
| Direct per-route imports, no barrels. SDK 58 async routes are on by default on web (`withRouter.d.ts:93-101`). | ≈ −60 KB of screens moved out of `__common` | architecture |
| AdSense, the anime and subscriber code, the desktop branches and the dead availability code removed | small | this section |
| Fonts: WOFF2, the three faces of `config/brand.json` (placeholders: two Hanken Grotesk weights plus one Lora weight), `font-display: swap`, served from `public/fonts/` with `@font-face` in the document CSS (Part W, F0.4). No TTF on web. | 502 KB → ≤ 120 KB | F0 |
| Icons on web: inline SVG paths of Material Symbols Rounded from `src/core/ui/icons/glyphPaths.web.ts` (54 glyphs, Apache-2.0, B2.9). No icon font on web (Ionicons was 205 KB on the wire). Android uses the subset icon font. | −205 KB fonts | F0 |
| Phase 2 (not gating v2.0): CSS transitions instead of Reanimated and Gesture Handler on web; spike `EXPO_UNSTABLE_TREE_SHAKING=1` with `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` | ≤ 450 KB target | later |

Estimate after the phase‑1 levers: ≈ 590 KB brotli for `/`.

### C3.7 Web trailer player on the official YouTube IFrame API

New: `src/features/player/platform/youtubeIframeApi.web.ts` and `src/features/player/platform/TrailerPlayer.web.tsx`. They replace `presentation/player/PlayerSurface.web.tsx` and `presentation/movies/components/YoutubePlayer.web.tsx`, whose hand-rolled `listening` handshake ignored `onReady`/`initialDelivery`. That handshake produced 16 failures in 23 starts against 4 in 129 on Android (`research/web.md` §6).

- **Loader.** `loadYouTubeIframeApi(): Promise<YTNamespace>` injects `https://www.youtube.com/iframe_api` once. It resolves on `window.onYouTubeIframeAPIReady`, chaining any existing handler, and times out at 10 s with the error `api_timeout`. Minimal local types go in `src/features/player/platform/youtube-iframe-api.d.ts`; no new dependency.
- **Player.** Mounted **only after the user taps the poster's play button** (tap-to-play):
  ```ts
  new YT.Player(element, {
    host: 'https://www.youtube-nocookie.com',
    videoId,
    width: '100%',
    height: '100%',
    playerVars: {autoplay: 1, playsinline: 1, rel: 0, controls: 1, cc_load_policy: captions ? 1 : 0, origin: window.location.origin},
    events: {onReady, onStateChange, onError},
  });
  ```
- **Behaviour.**
  - `onReady` calls `event.target.playVideo()`.
  - If `PLAYING` is not reached within 4 s after ready, autoplay was blocked. Leave YouTube's own play button visible and draw nothing over the player (III.F/III.I.4).
  - No custom controls on the player, no mini player, no PiP (decision 8).
  - `onError` codes `2|5|100|101|150` show `This trailer can't play here.` with a link `Watch on YouTube` → `https://www.youtube.com/watch?v={key}`.
- **Telemetry.**
  - `track(trailer_start)` on the first `PLAYING`.
  - Sentry metric `player.start` {outcome: playing \| blocked \| error_{code} \| api_timeout}.
- **Acceptance.** Chrome, Firefox and Safari desktop plus Android Chrome on a 4G profile: video playing, or the YouTube play button visible, ≤ 3 s after the tap. Post-release monitoring (I.5, step e): over the first 7 days of consented metrics, `player.start` outcomes in `error_*` or `api_timeout` stay under 5 %.

### C3.8 Web acceptance (checked by `scripts/check-web-export.mjs`, rewritten, §6.4)

The script serves `dist` with `npx expo serve` and `YIFY_API_FIXTURES=1` (no TMDB call in CI), then checks:

- [ ] Route manifest: `htmlRoutes` include `/`, `/search`, `/plus` and the shared `/title/movie/[id]`, `/title/tv/[id]`, `/person/[id]` routes (match on the URL pattern; group segments may appear in the manifest's file names). `apiRoutes` include `/sitemap.xml`, `/sitemaps/[name]`, the backend's edge routes, and the legacy `/api/catalog/[operation]`.
- [ ] The SSR assertions listed in §3.3 S1 pass, with a TVSeries check on `/title/tv/1399-…` and a Person check on `/person/6384-…`.
- [ ] Headers: `content-security-policy` contains `frame-ancestors 'none'`, and `x-content-type-options: nosniff` is present.
- [ ] Files: `/robots.txt` has `Disallow: /api/` and no `Disallow: /_expo/`. `/sitemap.xml` is a valid sitemapindex. `/sitemaps/movie-1.xml` contains `https://yify.expo.app/title/movie/`. `/app-ads.txt` serves the pub id. `/ads.txt` returns 404. `/.well-known/assetlinks.json` returns 200. `/privacy.html`, `/terms.html`, `/delete-account.html` and `/support.html` return 200, and `/privacy`, `/privacy/`, `/terms/`, `/delete-account/` and `/support/` reach a 200 page in at most one redirect (AND-14).
- [ ] Hosts and redirects: `/title/movie/603-the-matrix` has no `noindex`; the same page requested with `X-Forwarded-Host: yify--v2.expo.app` has `noindex`; every 301 `Location` starts with `/` or `https://yify.expo.app/`.
- [ ] The client JS in `dist/client` contains none of the patterns in `tests/policy/bannedStrings.cjs`, and none of `TMDB_API_KEY`, `api.themoviedb.org` or `RNGoogleMobileAds`.
- [ ] `scripts/check-web-budget.mjs` passes.

---

## C4. Android

### C4.1 `app.json`, `app.config.js` and the two config modules (v2, complete)

`app.json`:

```json
{
  "expo": {
    "slug": "yify",
    "orientation": "default",
    "icon": "./assets/images/icon.png",
    "scheme": "yify",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "io.github.kunal26das.yify",
      "associatedDomains": ["applinks:yify.expo.app"],
      "infoPlist": {"ITSAppUsesNonExemptEncryption": false},
      "icon": {"light": "./assets/images/icon.png", "dark": "./assets/images/icon-dark.png", "tinted": "./assets/images/icon-tinted.png"}
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": true,
      "package": "io.github.kunal26das.yify",
      "blockedPermissions": [
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.READ_APP_BADGE",
        "com.google.android.c2dm.permission.RECEIVE",
        "com.anddoes.launcher.permission.UPDATE_COUNT",
        "com.htc.launcher.permission.READ_SETTINGS",
        "com.htc.launcher.permission.UPDATE_SHORTCUT",
        "com.huawei.android.launcher.permission.CHANGE_BADGE",
        "com.huawei.android.launcher.permission.READ_SETTINGS",
        "com.huawei.android.launcher.permission.WRITE_SETTINGS",
        "com.majeur.launcher.permission.UPDATE_BADGE",
        "com.oppo.launcher.permission.READ_SETTINGS",
        "com.oppo.launcher.permission.WRITE_SETTINGS",
        "com.sec.android.provider.badge.permission.READ",
        "com.sec.android.provider.badge.permission.WRITE",
        "com.sonyericsson.home.permission.BROADCAST_BADGE",
        "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
        "me.everything.badger.permission.BADGE_COUNT_READ",
        "me.everything.badger.permission.BADGE_COUNT_WRITE"
      ],
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/title"},
            {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/person"},
            {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/search"},
            {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/plus"},
            {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/movie"},
            {"scheme": "https", "host": "yify.expo.app", "pathPrefix": "/show"}
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "web": {"output": "server", "favicon": "./assets/images/favicon.png"},
    "plugins": [
      ["expo-router", {"sitemap": false, "headOrigin": "https://yify.expo.app"}],
      ["expo-splash-screen", {"image": "./assets/images/icon.png", "imageWidth": 200, "resizeMode": "contain"}],
      ["expo-font", {"fonts": [
        "./src/core/ui/icons/YifyIcons.ttf",
        "./src/core/ui/icons/YifyIconsFilled.ttf"
      ]}],
      "@react-native-firebase/app",
      "./plugins/withGoogleServicesVersion",
      "./plugins/withHsdpVersion",
      "./plugins/withCoreLibraryDesugaring",
      "./plugins/withFirebaseSceneStartup",
      "@react-native-firebase/auth",
      ["@sentry/react-native/expo", {
        "url": "https://sentry.io/",
        "organization": "kudos-labs",
        "project": "yify",
        "useNativeInit": true,
        "experimental_android": {"enableAndroidGradlePlugin": true, "includeNativeSources": false, "includeSourceContext": false}
      }],
      "./plugins/withSentryInstallSource",
      ["@react-native-google-signin/google-signin", {"iosDependencyManager": "spm"}],
      "./plugins/withAndroidRelease",
      "./plugins/withGradleWrapper",
      "./plugins/withUmpMetricsGuard",
      ["./plugins/withGradleJvmArgs", {"properties": {"RNGMA_ANDROID_BACKEND": "classic", "expo.gif.enabled": "false", "expo.webp.enabled": "false"}}],
      ["react-native-google-mobile-ads", {"androidAppId": "ca-app-pub-2292299294214510~5237171305", "iosAppId": "ca-app-pub-3940256099942544~1458002511", "delayAppMeasurementInit": true}],
      "./plugins/withGwpAsan",
      "expo-updates",
      "expo-localization",
      ["expo-navigation-bar", {"enforceContrast": false}],
      ["expo-build-properties", {
        "ios": {"useFrameworks": "dynamic", "enableSceneSupport": true, "usePrecompiledModules": false, "forceStaticLinking": ["RNGoogleMobileAds"]},
        "android": {
          "enableProguardInReleaseBuilds": true,
          "enableShrinkResourcesInReleaseBuilds": true,
          "extraProguardRules": "-keep class com.swmansion.reanimated.** { *; }\n-keep class com.swmansion.worklets.** { *; }\n-keep class com.facebook.react.turbomodule.** { *; }\n-keep class com.google.android.gms.internal.consent_sdk.** { *; }\n-keep class expo.modules.ExpoModulesV2ModuleList { *; }\n-keep class * extends io.github.expo.modules.v2.Module { *; }\n-keep class io.github.expo.kolibri.** { *; }\n-keep class io.github.expo.modules.v2.** { *; }\n-keepattributes SourceFile,LineNumberTable\n-keepattributes *Annotation*\n",
          "kotlinVersion": "2.4.20",
          "minSdkVersion": 24
        }
      }]
    ],
    "experiments": {"typedRoutes": false, "reactCompiler": true},
    "extra": {"eas": {"projectId": "130cfded-cef0-49b3-94a4-82d3a3852ef5"}}
  }
}
```

Diff against v1 `app.json`:

- Added: `predictiveBackGestureEnabled: true`; `./plugins/withSentryInstallSource` (C4.11); the location, notification and badge `blockedPermissions`; the `/title`, `/person`, `/search` and `/plus` App Link prefixes; `web.output: 'server'`; the `expo-font` plugin embedding the three text faces and the two icon fonts (B2.4, B2.9; docs.expo.dev/versions/latest/sdk/font, "On Android, the file name becomes the font family name"); `useNativeInit: true`; the Fresco GIF/WebP flags off.
- Removed: the `headers` option (now from `config/webHeaders.cjs`); plugins `@react-native-firebase/crashlytics`, `./plugins/withCrashlyticsNdk`, `expo-location` (and the iOS `NSLocationDefaultAccuracyReduced`), `expo-background-task`, `expo-notifications`; `useLegacyPackaging: true` (C4.6); the dead `-keep class com.margelo.nitro.** { *; }` rule.
- Removed: `name`, `primaryColor`, the adaptive icon's `backgroundColor` and `backgroundImage` (decision 13 drops `android-icon-background.png` for a solid colour), the splash colours and the text-font paths. `app.config.js` derives all of them from `config/brand.json` (Part 0, §0.4).
- `name`, `primaryColor`, splash colours, adaptive-icon `backgroundColor`, the `expo-font` text faces, `runtimeVersion`, `version`, `versionCode`, `updates`, router `redirects`, `headers` and `pageHeaders`, and `googleServicesFile` come from `app.config.js`. The Identity step copies the icon files and applies `scratchpad/icons-v2/final/CHANGES.md`, which may change the icon paths above.

`app.config.js`:

```js
const base = require('./app.json');
const pkg = require('./package.json');
const brand = require('./config/brand.json');
const sentry = require('./sentry.options.json');
const legacyRedirects = require('./config/legacy-redirects.json');
const {pageHeaders, webHeaders} = require('./config/webHeaders.cjs');

const projectId = base.expo.extra.eas.projectId;
const updateChannel = process.env.EXPO_UPDATE_CHANNEL || 'Production';
const webCheckout = process.env.EXPO_PUBLIC_WEB_CHECKOUT === '1';
const defaultAccent = brand.accents.find((accent) => accent.id === 'default');
const textFonts = [brand.fonts.display.file, brand.fonts.body.file, brand.fonts.bodyStrong.file];

function withBrand(plugin) {
    if (!Array.isArray(plugin)) return plugin;
    const [name, options] = plugin;
    if (name === 'expo-router') {
        return [name, {...options, redirects: legacyRedirects, headers: webHeaders({webCheckout, sentryDsn: sentry.dsn}), pageHeaders}];
    }
    if (name === 'expo-splash-screen') {
        return [name, {...options, backgroundColor: brand.colors.light.surface, dark: {backgroundColor: brand.colors.dark.surface}}];
    }
    if (name === 'expo-font') {
        return [name, {...options, fonts: [...textFonts, ...options.fonts]}];
    }
    return plugin;
}

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        name: brand.appName,
        version: pkg.version,
        runtimeVersion: pkg.version,
        primaryColor: defaultAccent.light.primary,
        updates: {
            url: `https://u.expo.dev/${projectId}`,
            requestHeaders: {'expo-channel-name': updateChannel},
            checkAutomatically: 'ON_LOAD',
            fallbackToCacheTimeout: 0,
        },
        plugins: base.expo.plugins.map(withBrand),
        android: {
            ...base.expo.android,
            versionCode: pkg.versionCode,
            googleServicesFile: './config/android/google-services.json',
            adaptiveIcon: {...base.expo.android.adaptiveIcon, backgroundColor: brand.androidIconBackground},
        },
        ios: {...base.expo.ios, buildNumber: String(pkg.versionCode), googleServicesFile: './config/ios/GoogleService-Info.plist'},
    },
};
```

- `runtimeVersion` is exactly `package.json` `version` (decision 13; Part 0, I-5). There is no `EXPO_RUNTIME_VERSION` override: v2 never publishes an update to an older runtime.
- `app.config.js` still reads `EXPO_UPDATE_CHANNEL` and `EXPO_PUBLIC_WEB_CHECKOUT`; that cannot affect the runtime, which is the version string.
- It stops reading `EXPO_WEB_OUTPUT` and `EXPO_WEB_BASE_URL` and drops the `experiments.baseUrl` override (Pages is retired, C3.1).

`config/legacy-redirects.json` (one list for every build; A7.3; Part 0, I-34). `convertRedirect` preserves the query string (`node_modules/expo-router/build/getRoutesRedirects.js`), so destinations carry none:

```json
[
  {"source": "/privacy", "destination": "https://yify.expo.app/privacy.html", "permanent": true},
  {"source": "/terms", "destination": "https://yify.expo.app/terms.html", "permanent": true},
  {"source": "/delete-account", "destination": "https://yify.expo.app/delete-account.html", "permanent": true},
  {"source": "/support", "destination": "https://yify.expo.app/support.html", "permanent": true},
  {"source": "/guide", "destination": "/", "permanent": true},
  {"source": "/anime", "destination": "/", "permanent": true},
  {"source": "/watchlist", "destination": "/library", "permanent": true},
  {"source": "/history", "destination": "/library/recent", "permanent": true},
  {"source": "/journal", "destination": "/library/watched", "permanent": true},
  {"source": "/preferences", "destination": "/settings", "permanent": true},
  {"source": "/upgrade", "destination": "/plus", "permanent": true},
  {"source": "/browse", "destination": "/search", "permanent": true}
]
```

`config/webHeaders.cjs` (C3.5; Part 0, I-35). `ENFORCED_CSP` is repeated in `src/server/seo/securityHeaders.ts`, and `tests/web/securityHeaders.test.ts` asserts the two are equal:

```js
const ENFORCED_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

function sentryReportUri(dsn) {
    const url = new URL(dsn);
    const projectNumber = url.pathname.replace(/^\//, '');
    return `https://${url.host}/api/${projectNumber}/security/?sentry_key=${url.username}`;
}

function reportOnlyPolicy({webCheckout, sentryDsn}) {
    const stripeScript = webCheckout ? ' https://js.stripe.com' : '';
    const stripeConnect = webCheckout ? ' https://api.stripe.com' : '';
    return [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.googletagmanager.com https://apis.google.com${stripeScript}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://lh3.googleusercontent.com https://www.googletagmanager.com https://*.google-analytics.com",
        "font-src 'self' data:",
        `connect-src 'self' https://*.ingest.us.sentry.io https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://api.revenuecat.com${stripeConnect}`,
        `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://accounts.google.com${stripeScript}`,
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        `report-uri ${sentryReportUri(sentryDsn)}`,
    ].join('; ');
}

function webHeaders({webCheckout, sentryDsn}) {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': webCheckout ? 'camera=(), microphone=(), geolocation=()' : 'camera=(), microphone=(), geolocation=(), payment=()',
        'Content-Security-Policy': ENFORCED_CSP,
        'Content-Security-Policy-Report-Only': reportOnlyPolicy({webCheckout, sentryDsn}),
    };
}

const HTML_CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600';

const pageHeaders = ['/title/movie/[id]', '/title/tv/[id]', '/person/[id]']
    .map((source) => ({source, headers: {'Cache-Control': HTML_CACHE}}));

module.exports = {ENFORCED_CSP, HTML_CACHE, pageHeaders, reportOnlyPolicy, webHeaders};
```

`tests/plugins/app-config.test.cjs` asserts:

- an unset `EXPO_UPDATE_CHANNEL` gives `Production`;
- `runtimeVersion === version === '2.0.0'` and `android.versionCode === 116` at the v2.0.0 commit (`runtimeVersion === pkg.version` and `android.versionCode === pkg.versionCode` in general), and `APP_VERSION` in `src/core/config/app.ts` equals `pkg.version`;
- `name === brand.appName`; `primaryColor` is the `default` accent's light `primary`; the splash colours are the two `surface` values; the adaptive icon has `backgroundColor === brand.androidIconBackground` and no `backgroundImage`; the `expo-font` list starts with the three brand font files;
- **every asset path in the resolved config** (`icon`, the iOS icons, `adaptiveIcon.*`, `web.favicon`, the splash `image`, every font) **exists on disk** (feasibility review, item 9);
- the CSP strings for both checkout states; `frame-src` contains `'self'` and no `firebaseapp.com`; the router `redirects` equal `config/legacy-redirects.json`; the router `pageHeaders` equal `config/webHeaders.cjs` `pageHeaders`;
- no plugin entry names a removed package (`@react-native-firebase/crashlytics`, `expo-location`, `expo-notifications`, `expo-background-task`).

It replaces `scripts/check-update-channel.mjs`.

### C4.2 `eas.json` (v2, complete)

```json
{
  "cli": {"version": ">= 27.11.0", "appVersionSource": "local"},
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "env": {"EXPO_UPDATE_CHANNEL": "Production", "EXPO_PUBLIC_ADMOB_MODE": "test"},
      "android": {"buildType": "apk", "withoutCredentials": true},
      "node": "24.19.0"
    },
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "env": {"EXPO_UPDATE_CHANNEL": "Staging", "SENTRY_ENVIRONMENT": "preview", "EXPO_PUBLIC_ADMOB_MODE": "test", "EXPO_PUBLIC_DIAGNOSTICS": "1"},
      "android": {"buildType": "apk", "withoutCredentials": true},
      "node": "24.19.0"
    },
    "production": {
      "environment": "production",
      "env": {"EXPO_UPDATE_CHANNEL": "Production", "SENTRY_ENVIRONMENT": "production", "EXPO_PUBLIC_ADMOB_MODE": "live"},
      "android": {"buildType": "app-bundle", "credentialsSource": "remote"},
      "node": "24.19.0"
    }
  },
  "submit": {
    "play-production": {"android": {"track": "production", "releaseStatus": "draft"}}
  }
}
```

- `appVersionSource: "local"` keeps `versionCode` in `package.json` (decision 13: 116 for v2.0.0). There is no `autoIncrement`.
- `releaseStatus: "draft"` puts the build on the production track without starting a rollout. The one Play edit of release step (f) then sets `status: "inProgress"` with `userFraction: 0.2`, together with the listing (Part 0, I-51). There is no internal-track submission: Play refuses a version code it already has (docs.expo.dev/tutorial/eas/manage-app-versions: "Submitting builds with duplicate app version numbers results in a failed submission"), so versionCode 116 is uploaded exactly once. Values verified in eas-cli 27.11.0's `@expo/eas-json` (`release/node_modules/@expo/eas-json/build/submit/types.d.ts:2-7`: `completed | draft | halted | inProgress`; `build/submit/schema.js:15-19`: `rollout` is required with `inProgress` and forbidden otherwise).
- The iOS profiles are dropped (decision 5); `ios` keys stay in `app.json`.
- The production EAS environment must not define `EXPO_PUBLIC_API_ORIGIN` (A4.1) or `YIFY_API_FIXTURES`.

### C4.3 Permissions

| Permission (1.8.33 merged manifest, `scratchpad/manifest-1833.txt`) | v2 |
|---|---|
| `ACCESS_COARSE_LOCATION` (expo-location) | **removed** (package removed + blocked). The region comes from device locale (`expo-localization`) plus a manual picker; the server may also use `eas-ip-country` (https://docs.expo.dev/eas/hosting/reference/responses-and-headers/). |
| 15 launcher-badge permissions + `READ_APP_BADGE` (ShortcutBadger via expo-notifications) | **removed** (package removed + blocked) |
| `POST_NOTIFICATIONS`, `c2dm.permission.RECEIVE` (expo-notifications/FCM) | **removed**; no notifications in v2 (decision 8) |
| `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `RECEIVE_BOOT_COMPLETED` (WorkManager via SDKs) | kept |
| `ACCESS_WIFI_STATE` (expo-network) | kept while expo-network is kept (architecture decides) |
| `VIBRATE` (expo-haptics) | kept |
| `AD_ID`, `ACCESS_ADSERVICES_AD_ID`, `…_ATTRIBUTION`, `…_TOPICS` (GMA) | kept (ads) |
| `com.android.vending.BILLING` | kept |
| `BIND_GET_INSTALL_REFERRER_SERVICE`, `READ_GSERVICES` (Firebase Analytics) | kept |

Acceptance: `aapt2 dump permissions` on the arm64 base APK, extracted with bundletool from the v2 production AAB, lists none of the removed permissions.

### C4.4 Predictive back

- `predictiveBackGestureEnabled: true` makes the manifest set `android:enableOnBackInvokedCallback="true"`. Sources: `node_modules/@expo/config-types/build/ExpoConfig.d.ts:605-607` and `node_modules/@expo/config-plugins/build/android/PredictiveBackGesture.js:29-42`.
- React Native 0.88's `ReactActivity` registers an `OnBackPressedCallback` (`node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivity.java:31`), so `BackHandler` keeps working.
- Acceptance on an Android 15+ device:
  - Back closes sheets and dialogs first.
  - Back pops the native stack.
  - At the root tab, back leaves the app.
  - Back during an interstitial closes the ad and continues to the title.

### C4.5 In-app updates: FLEXIBLE by default (`src/core/platform/updates/storeUpdates.ts` + `.web.ts` no-op)

API (`node_modules/expo-in-app-updates/build/index.d.ts`, `ExpoInAppUpdates.types.d.ts`):
- `checkForUpdate()` returns `UpdateInfo`: `updateAvailable`, `updateInProgress`, `storeVersion`, `daysSinceRelease`, `flexibleAllowed`, `immediateAllowed`, `serverPriority`.
- `startUpdate(isImmediate?: boolean)`.
- `addUpdateListener('updateStart' | 'updateDownloaded' | 'updateCancelled' | 'updateCompleted', listener)`.

Library behaviour that must be known (verified in `node_modules/expo-in-app-updates/android/src/main/java/expo/modules/inappupdates/ExpoInAppUpdatesModule.kt`, 0.13.0):
- On `InstallStatus.DOWNLOADED` it emits `updateDownloaded` and then calls `appUpdateManager.completeUpdate()` itself (`:44-48`), which restarts the app at once, even while a diary note, a purchase or a trailer is open.
- `startUpdate` completes an update that already finished downloading with `requestCompleteUpdate()` (`:93-101`).
- A failed install opens the Play listing (`:51`, `:160-166`).
- There is no JS `completeUpdate`.

Google's flexible flow asks for the opposite: "Google Play does not automatically trigger an app restart for a flexible update … request confirmation before restarting the app", and "If you instead call `completeUpdate()` when your app is in the background, the update is installed silently" (developer.android.com/guide/playcore/in-app-updates/kotlin-java, "Install a flexible update"). So P9 adds a patch (it changes build output, which decision 12 allows; Part 0, I-56):

- `patches/expo-native/expo-in-app-updates-deferred-complete.patch` deletes the one line `appUpdateManager.completeUpdate()` from the `InstallStatus.DOWNLOADED` branch.
- `patches/expo-native/manifest.json` gains a `files` entry with `package: "expo-in-app-updates"`, `version: "0.13.0"`, `file: "android/src/main/java/expo/modules/inappupdates/ExpoInAppUpdatesModule.kt"`, the `before` and `after` SHA-256 that P9 computes, `patch`, and `upstream` (the package's repository URL). `scripts/expo-native-compat.mjs` applies it like the Reanimated patch.
- `startUpdate(false)` then becomes the way to finish a downloaded update, because it calls `requestCompleteUpdate()` when the install status is `DOWNLOADED`.

Policy (`maybePromptStoreUpdate`), once per cold start:
1. Only on Android, ≥ 10 s after the first content render, with `AppState === 'active'`.
2. `checkForUpdate()`. If `!updateAvailable`, stop.
3. If `updateInProgress`, call `startUpdate()` to resume. Play requires resuming immediate flows.
4. Throttle: if the key `updates.prompted.{storeVersion}` holds a timestamp less than 72 h old, stop. Otherwise write `now`.
5. If `serverPriority >= 4 && immediateAllowed`, call `startUpdate(true)`. This is reserved for broken releases; the priority can only be set through the Play Developer API.
6. Else if `flexibleAllowed`, call `startUpdate(false)`.
7. Listeners (snackbars through `showSnackbar`, Part 0, I-48; queued while a sheet, the trailer or a purchase flow is open):
   - `updateStart` with `updateType === 'FLEXIBLE'` shows a `short` snackbar: `Downloading an update to {APP_NAME}…`
   - `updateDownloaded` writes `updates.downloaded.<storeVersion>` and shows an `indefinite` snackbar `Update ready. Restart {APP_NAME} to finish.` with the action `Restart`, which calls `startUpdate(false)`.
   - When the app moves to the background while a downloaded update waits, call `startUpdate(false)`: Play installs it silently.
   - On a cold start where `updates.downloaded.<storeVersion>` is set for the version `checkForUpdate()` still reports, show the `Restart` snackbar instead of calling `startUpdate` (which would restart at once). Never restart without a tap or the background.
   - `updateCancelled` records `app_update {result: 'declined'}`; `updateCompleted` records `installed`.
8. `storeUpdates.test.cjs` covers the throttle, immediate only at priority ≥ 4, and the downloaded paths (snackbar, background install, cold start) with a mocked module.

v1's `data/services/PlayStoreServices.ts` (forced `IMMEDIATE`, Crashlytics breadcrumbs) is deleted.

OTA (`expo-updates`):
- `checkAutomatically: 'ON_LOAD'`, `fallbackToCacheTimeout: 0`: the update downloads in the background and applies on the next cold start.
- No snackbar, no reload, no extra foreground checks.
- The Reanimated teardown crash on reload (`research/android.md` §6) makes in-session reloads unsafe.

### C4.6 Native-library packaging: drop the legacy-packaging guard

**Decision:** remove `useLegacyPackaging: true`. This gives the default uncompressed, page-aligned libraries and `extractNativeLibs=false`. Evidence:
1. The SoLoader DSO crash that motivated the guard (`docs/crashes-20260929.md`) comes **entirely from sandbox VM templates**. Device RAM and storage totals are byte-identical across different "models", for example a "Pixel 8 Pro" reporting 1.92 GiB of RAM. Play vitals have never recorded it: 0 crashes in 90 days (`research/stability.md` §2.2, §3, §6; memory note `soloader-crash-corrupt-installs.md`, re-verified 2026‑09‑07 and 2026‑11‑23).
2. The guard does not even stop the farm. Issue `4e6ae7e5`, a `dlopen … is for EM_AARCH64 instead of EM_X86_64` crash on the "Pixel 8 Pro" template, hit 1.8.14–**1.8.33**, all of which shipped with legacy packaging on.
3. The memory note's own analysis: legacy packaging "does NOT cover base-only" installs, and a Play install always has an ABI split. Bundletool shows Play's `base-master.apk` has no `lib/`.
4. Cost: 28.83 MB of extracted `.so` per install, about 71 MB on disk against about 61 MB without it, plus slower installs and updates (`research/android.md` §4.2).

Risk control:
- Staged rollout at 20 % (§4.2).
- Gate the promotion on Play vitals plus Sentry native events (now captured, §4.11). The signature to watch is `SoLoader`/`UnsatisfiedLinkError`/`couldn't find DSO` on a **non-template** device (retail-plausible RAM and storage, 3–5 split APKs).
- Rollback: one-line config revert in a hotfix binary.
- `scripts/check-android-native-libs.mjs` and `tests/android-native-libs.test.cjs` are deleted, because they assert compressed libraries and `extractNativeLibs=true`.

### C4.7 minSdk: keep 24

Evidence:
- A real Android 7.1.1 user (Lenovo TB-8504F) hit YIFY‑2Z on 1.8.29 in November (`research/stability.md` §3).
- Play vitals hide cohorts under 10 users, so the API 24–25 share cannot be shown to be zero.
- The cost is small: `withCoreLibraryDesugaring`, 254 KB of DEX, 17.6 s of build.

Keep `minSdkVersion: 24` and `plugins/withCoreLibraryDesugaring.js`. Revisit when the Play Console Android-version report shows API 24–25 below 0.5 % of installs for 90 days.

### C4.8 Runtime and versioning (decision 13)

- **Runtime.** `runtimeVersion` is the `package.json` `version`, set in `app.config.js` (C4.1). The first v2 binary has runtime exactly `2.0.0`, so no v1 binary (runtimes up to `1.8.33`) can ever receive a v2 update, and v2 never ships as an OTA to an older runtime. The fingerprint policy is not used: `app.config.js` reads environment variables, which would make fingerprints drift between machines.
- **Marketing version.** `package.json` `version` becomes `2.0.0` in F0 and is bumped by hand. The rule from v1 stays: **bump `version` whenever native code changes** — any change to the dependency sections of `package.json`, a native package in `yarn.lock`, `app.json`, `app.config.js`, `plugins/`, `patches/` or tracked `android/`. JavaScript-only changes may ship as OTA updates to the same runtime.
- **versionCode.** `package.json` `versionCode` is `116` for 2.0.0 (production is 115; a code is never reused) and increases by one for every store build. `app.config.js` copies it into `android.versionCode`; `eas.json` keeps `appVersionSource: "local"`.
- **OTA guard** (Part 0, I-40). After the production build of a version is accepted, the release operator tags the built commit `android-v<version>` (`git tag android-v2.0.0 <sha> && git push origin android-v2.0.0`, documented in `docs/releases.md`). `scripts/eas.sh` runs `node scripts/check-ota-compat.mjs` before any `update` command. The script:
  1. reads `version` from `package.json` and requires the tag `android-v<version>`;
  2. fails if `git diff --quiet android-v<version> HEAD -- yarn.lock app.json app.config.js plugins patches` reports changes, or `android/` is tracked and differs;
  3. parses `package.json` at the tag and at `HEAD` and fails if `dependencies`, `devDependencies`, `resolutions`, `workspaces` or `expo` differ;
  4. prints the differing paths and exits non-zero, so `eas update` never runs.
  Its test lives in `tests/scripts/check-ota-compat.test.mjs` (temporary git repositories, no network).
- `scripts/eas.sh` (rewritten): `set -euo pipefail`; resolves the project root; reads `EXPO_TOKEN` from the environment, else from `~/.yify-release.json` when that file exists (the token v1's console saved), else relies on an `eas login` session; runs `node scripts/check-live-privacy.mjs` before `build … --profile production` and `submit` commands (as v1's `requiresLivePrivacyCheck`); runs `node scripts/check-ota-compat.mjs` before `update`; then `exec npx --yes eas-cli@27.11.0 "$@"`. It no longer uses `release/` or `eas-with-sentry.mjs`.

### C4.9 Dependencies

C6.6 is the complete dependency table; this section explains the native impact.

**Remove** (each one changes native code, so all go into the one v2 binary):

| Package | Native impact | Why |
|---|---|---|
| `@react-native-firebase/crashlytics` 27.1.1 | −3 `.so`/ABI (1.32 MB raw arm64), −Crashlytics Gradle plugin, −init provider, −the second R8-map upload | Sentry becomes the single tool (decision 9), §4.11 |
| `@react-native-firebase/remote-config` 27.1.1 | −module | Nothing reads it in v2: TMDB goes through the edge API, there is no ads flag, Buy-me-a-coffee is removed |
| `expo-insights` 58.0.11 | −module; stops the launch ping before consent | AND‑8 / DEP‑6 |
| `expo-location` 58.0.22 | −permission, −2 FGS declarations, −play-services-location | decision 8 |
| `expo-notifications` 58.1.9, `expo-background-task` 58.0.13, `expo-task-manager` 58.0.14 | −FCM, −15 badge permissions, −WorkManager task | decision 8 |
| `expo-store-review` 58.0.3 | −Play review AAR | unused since `9cecc57` |
| `@expo/ui` 58.0.29 | −Jetpack Compose (2.70 MB DEX, 16.7 %) | never imported (DEP‑1) |
| `expo-symbols` 58.0.5 | −976 KB font | dead template (DEP‑12) |
| `expo-device-corner-radius` 0.1.1 | −module | unused (DEP‑13) |
| `expo-blur` 58.0.6 | −module | glass/blur removed (decision 8) |
| `@yify/crashreporting` (workspace) | JS only | bridge for two reporters |
| `react-native-web-webview` 1.0.2 | JS only | unused (DEP‑15) |
| `@xmldom/xmldom` 0.9.12, `jose` 6.2.18 | server JS | only the Nyaa RSS parser and the subscriber JWT verifier used them; both are deleted (decision 2; backend confirms) |
| direct entries `expo-glass-effect`, `@expo/log-box` | none (they stay transitive) | DEP‑16/18 |
| dev: `electron`, `electron-builder`, `error-stack-parser`, `@react-native/js-polyfills` | none | desktop removed; duplicates |

**Keep:**
- `react-native-google-mobile-ads` 17.4.0, `react-native-purchases` 11.0.4, `@revenuecat/purchases-js` 1.78.0 (lazy, web only)
- `@react-native-firebase/app`, `auth` and `analytics` 27.2.0; `firebase` 13.3.0 (Part 0, I-6); `@react-native-google-signin/google-signin` 17.0.0
- `@sentry/react-native` 8.36.0
- `react-native-youtube-iframe` 2.4.1 and `react-native-webview` 14.0.1
- `expo-in-app-updates` 0.13.0, `expo-updates`, `expo-localization`, `expo-web-browser`, `expo-linking`, `expo-image`, `expo-haptics`, `expo-keep-awake`, `expo-navigation-bar`, `expo-system-ui`, `expo-status-bar`, `expo-splash-screen`, `expo-build-properties`, `expo-dev-client`, `expo-font`, `expo-constants`
- the runtime and navigation set from `research/dependencies.md` §7
- `expo-network` and `expo-sqlite` (A4.2, A5.1)

**Add:** `@sentry/browser` **10.78.0** (verified with `npm view @sentry/browser@10.78.0 version`). It is the exact version `@sentry/react-native` 8.36.0 already depends on (`node_modules/@sentry/react-native/package.json`), so no new package enters the tree. It is imported only by the web telemetry twin, so web does not bundle the React Native wrapper (§5.3).

**Size target** (bundletool `get-size total` on the production AAB, manual release check): arm64 download ≤ 21 MB (today 25.2 MB), installed ≤ 55 MB (today ~71 MB).

### C4.10 Config plugins

| Plugin | Applies or checks | v2 | Reason |
|---|---|---|---|
| `withUmpMetricsGuard.js` + `ump/{build.gradle,UmpMetricsFactory.java,UmpMetricsVisitor.java}` | **applies** an ASM bytecode transform to UMP 4.0.0 and writes `android/buildSrc` (which also pins Kotlin 2.4.20 in the parent classloader) | keep | fixes UMP consent SDK crash #908; changes build output |
| `withHsdpVersion.js` | **applies** a Gradle `strictly 2.2.0` constraint | keep | changes build output. Note: the `80e49a5e` crash it targeted was farm-only (`research/stability.md` §3). Revisit if GMA ever needs a newer HSDP. |
| `withCoreLibraryDesugaring.js` | **applies** NIO desugaring | keep | YIFY‑2Z real crash on API 24–25 |
| `withAndroidRelease.js` | **applies** local release signing and `proguard-android-optimize.txt` | keep | R8 optimise changes output; local signed builds |
| `withGradleWrapper.js` | **applies** Gradle 9.4.1 + checksum, `android.newDsl=false`, `android.builtInKotlin=false` | keep | toolchain stays (decision 12) |
| `withGradleJvmArgs.js` | **applies** gradle.properties | keep | heap for R8; `RNGMA_ANDROID_BACKEND=classic`; Fresco flags |
| `withGwpAsan.js` | **applies** manifest `gwpAsanMode` | keep | |
| `withGoogleServicesVersion.js` | **applies** the Gradle classpath | keep | |
| `withFirebaseSceneStartup.js` | **applies** to the iOS AppDelegate only | keep, inert | so iOS can be regenerated later (decision 5) |
| `withCrashlyticsNdk.js` | applies | **delete** | Crashlytics removed |
| `withSentryInstallSource.js` | **applies** Kotlin in `MainApplication` (C4.11) | **new** (P9) | tags native events with `installer` and `split_count`, so release halt rules can drop emulator-farm crashes (STB-5) |

### C4.11 Sentry native init, and removing Crashlytics in the same binary

`@sentry/react-native/expo` plugin option **`useNativeInit`** (`node_modules/@sentry/react-native/plugin/build/withSentry.d.ts:8`):
- It inserts `RNSentrySDK.init(this)` right after `super.onCreate()` in `MainApplication`; in the Kotlin file Expo generates, the inserted line has no semicolon (`plugin/build/withSentryAndroid.js:128-130`). That is before `loadReactNative`, so pre-JS native crashes such as SoLoader failures are captured.
- `RNSentrySDK.init(Context)` reads `sentry.options.json` (`android/src/main/java/io/sentry/react/RNSentrySDK.java:14`, `:65`). The Sentry Gradle script copies that file from the project root into generated assets (`sentry.gradle.kts:93-177`).
- In release builds where the options file is present, JS `Sentry.init` skips native initialisation by itself (`dist/js/sdk.js:131-138`).

Commit `sentry.options.json` at the repo root. The DSN is public and already in v1 code. Every key below is read by `RNSentryStart.java`:

```json
{
  "dsn": "https://ab0c10fbe49dc5a4e4f0c9ab3c7a0386@o4512058491338752.ingest.us.sentry.io/4512058497695744",
  "environment": "production",
  "sendDefaultPii": false,
  "enableNdk": true,
  "enableNativeCrashHandling": true,
  "enableAutoSessionTracking": false,
  "attachScreenshot": false,
  "attachViewHierarchy": false,
  "attachThreads": false,
  "enableTombstone": true,
  "enableHistoricalTombstoneReporting": false,
  "sendClientReports": false,
  "maxBreadcrumbs": 50,
  "enableUserInteractionBreadcrumbs": false,
  "enableNetworkEventBreadcrumbs": false,
  "enableLogs": false
}
```

`SENTRY_ENVIRONMENT` from the EAS profile overrides `environment` both natively and in Metro (`dist/js/tools/sentryOptionsSerializer.js:100-117`).

**Install-source tags** (`plugins/withSentryInstallSource.js`, new, P9; Part 0, I-61). A `withMainApplication` mod inserts, on the line after `RNSentrySDK.init(this)`, Kotlin that tags every later event, native ones included. `io.sentry.Sentry.setTag(key, value)` is the documented API (docs.sentry.io/platforms/android/migration/v1-to-v2, "Set tag"), and `io.sentry:sentry-android` is an `api` dependency of `@sentry/react-native` (`node_modules/@sentry/react-native/android/build.gradle:193`), so the app module can call it:

```kotlin
runCatching {
    val installer = if (android.os.Build.VERSION.SDK_INT >= 30) packageManager.getInstallSourceInfo(packageName).installingPackageName else packageManager.getInstallerPackageName(packageName)
    io.sentry.Sentry.setTag("installer", installer ?: "none")
    io.sentry.Sentry.setTag("split_count", (applicationInfo.splitSourceDirs?.size ?: 0).toString())
}
```

The emulator farms behind the SoLoader reports install base-only APKs outside Play (`research/stability.md` §2-§3), so release halt rules and alerts count only events with `installer:com.android.vending` and a `split_count` other than `0` (I.5; C5.8). `docs/telemetry.md` keeps the farm signatures (RAM and storage totals) for manual triage. The 25-per-process `beforeSend` cap covers JavaScript errors only, so Sentry spike protection stays on for native events (C5.8).

Sequence (one binary; decision 9 is satisfied by a verification gate on a preview build and on the production candidate before any rollout):
1. The v2 candidate removes Crashlytics (`@react-native-firebase/crashlytics`, both plugin entries, `firebase.json` `crashlytics_*` keys, `instrumentation/crashlytics*.ts`, the `crashreporting/` workspace) and adds `useNativeInit`.
2. Build it with the preview profile. With `EXPO_PUBLIC_DIAGNOSTICS=1` (the preview profile, C4.2), the hidden 7-tap version row in Settings › About (B4.14) shows test buttons, compiled out of production builds. Then verify:
   - **JS fatal:** `throw new Error('yify-sentry-js-fatal')` → a Sentry event appears with mechanism `onerror`, and the app process dies. JS fatals then also count in Play vitals; v1 hid them with `System.exit(0)` (`research/stability.md` §2.2).
   - **Native Java:** `adb shell am crash io.github.kunal26das.yify` → a Sentry event with platform `java`.
   - **NDK:** `Sentry.nativeCrash()` (`dist/js/sdk.d.ts:16`) → a Sentry event with a native stack and symbolicated frames (from the Sentry Gradle plugin native-symbol upload).
   - **Pre-JS:** in the generated `MainApplication.kt`, `RNSentrySDK.init(this)` (no semicolon) appears before `loadReactNative(this)`, followed by the install-source block.
3. At release step (d), on the bundletool-installed production candidate: `adb shell am crash io.github.kunal26das.yify` produces a Sentry event with environment `production`, release `2.0.0 (116)`, symbolicated Java frames and the `installer` and `split_count` tags.
4. Only after all of these pass is the build submitted (release step e).

### C4.12 Strip the RevenueCat web SDK from the Android bundle

`react-native-purchases/dist/purchases.js` requires `./browser/nativeModule` at the top level. That module requires `@revenuecat/purchases-js-hybrid-mappings` (about 1 MB minified) and dereferences it only inside functions:
- `browser/nativeModule.js:41`
- `browser/utils.js:4,10`
- `browser/simulatedstore/*.js`

`metro.config.js` (v2):

```js
const {getSentryExpoConfig} = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'android' && moduleName === '@revenuecat/purchases-js-hybrid-mappings') {
        return {type: 'empty'};
    }
    return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
```

Acceptance:
- `strings index.android.bundle | grep -c rcb-pricing-table` returns 0.
- Purchase and restore work on a device.

### C4.13 Continuous Native Generation (untrack `android/` and `ios/`)

Decision 5 allows CNG only if a clean prebuild and build are proven.

**Proof gate P‑CNG.** Run on `redesign/v2` once §4.1–4.12 are in:
1. In a fresh clone with `android/` deleted: `yarn install --frozen-lockfile && npx expo prebuild --platform android --clean --no-install` exits 0.
2. Running it twice gives identical trees: `diff -r` of the two runs, excluding `build/`, `.gradle/` and `.cxx/`, is empty.
3. `JAVA_HOME=<JDK 17> ./gradlew :app:bundleRelease` succeeds locally, falling back to debug signing without `keystore.properties`. **And** `bash scripts/eas.sh build --platform android --profile preview` succeeds with `android/` gitignored, so EAS runs prebuild.
4. The generated tree contains:
   - `RNSentrySDK.init(this)` before `loadReactNative(this)` in `MainApplication.kt`, followed by the install-source block (C4.11)
   - `enableOnBackInvokedCallback="true"` in the manifest
   - `buildSrc/` UMP guard files
   - Gradle 9.4.1 with checksum
   - none of the removed permissions

**If P‑CNG passes:**
1. Add `/android` and `/ios` to `.gitignore`. Delete the lines `/android/.gitignore`, `/ios/.gitignore` and the per-directory ignore block.
2. `git rm -r --cached android ios` in one commit (Part 0, I-41).
3. Rewrite the two kept tests that read tracked native files, `tests/plugins/core-library-desugaring-plugin.test.cjs:46-47` (`android/app/build.gradle`) and `tests/plugins/hsdp-version-plugin.test.cjs:40-41` (`android/gradle.properties`), to run each plugin's mod on fixture Gradle text (export the transform from the plugin if needed); otherwise they fail with `ENOENT` on a fresh clone (execution review, item 17).
4. `scripts/check-update-channel.mjs` is already deleted by F0-A; `tests/plugins/app-config.test.cjs` (C4.1) replaces it.
5. `package.json` `prebuild` is already `expo prebuild --platform android --clean` (C6.6).
6. Docs: native changes go only through `app.json`, `app.config.js` and `plugins/`.

**Risks:**
- `android/keystore.properties` is wiped by every prebuild; this already happens today. Production signing is EAS remote credentials, which is unaffected. For a local signed build, copy `~/.config/yify/keystore.properties` into `android/` after prebuild (documented in `docs/development.md`). `keystore.jks` lives outside the repo.
- The first local build takes longer.
- Android Studio users must run `yarn prebuild` first.
- The iOS `Package.resolved` pin for GoogleSignIn 10.1.0 is lost. iOS is not a target. If iOS returns, re-pin it with a config plugin.
- If P‑CNG fails, keep `android/` and `ios/` tracked for v2.0 (`ios/` stays outside every check), run `yarn prebuild` after every config change, and revisit.

### C4.14 Release acceptance (manual checklist in `docs/releases.md`)

- [ ] §4.3 permissions check passes; §4.11 crash checks pass, including the production-candidate check of step 3; §4.12 strings check passes.
- [ ] NIO desugaring is still in the DEX (decision 12, YIFY-2Z): `bundletool build-apks --mode=universal --bundle app-release.aab --output universal.apks --ks <upload keystore> --ks-key-alias <alias>`, unzip `universal.apk`, then `apkanalyzer dex packages universal.apk | grep -E '^C .* j\$\.nio\.file\.Path$'` prints at least one line (1.8.33's listing has `C d 29 29 828 j$.nio.file.Path`, `scratchpad/dex-packages-1833.txt`).
- [ ] App Links: `adb shell pm get-app-links io.github.kunal26das.yify` reports `yify.expo.app: verified` on the upload-key candidate (A7.4).
- [ ] Size within §4.9 targets.
- [ ] Cold start measured with `adb shell am start -W -n io.github.kunal26das.yify/.MainActivity` on a mid-range device: TTID p50 of 5 runs recorded in the release notes, target ≤ 1.5 s.
- [ ] Play pre-launch report has no new crash clusters on real-device models.

---

## C5. Telemetry

### C5.1 Principles and consent

| Signal | Android | Web | Default | Gate |
|---|---|---|---|---|
| Sentry errors and crashes, scrubbed, IP not stored | yes, native init | yes, lazy | on | legitimate interest, disclosed in the privacy policy (as v1) |
| Sentry metrics and traces | yes | metrics only | off | analytics consent (port `OptionalTelemetryConsent`; consent = `choices.analytics`, the `adultConfirmed` term is gone with the 18+ gate) |
| Sentry logs, Replay, sessions, profiling | off | off | — | — |
| GA4 (Firebase Analytics) | yes | yes, lazy | off | analytics consent |
| RevenueCat ↔ GA4 instance-id link | yes | — | off | analytics consent |
| AdMob requests | yes | — | — | UMP `canRequestAds` |
| `expo-insights` launch ping | removed | — | — | — |
| `expo-updates` launch check | yes: with `checkAutomatically: 'ON_LOAD'` every cold start sends the persistent per-install `EAS-Client-ID` header (`node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/FileDownloader.kt:900`) | — | on | app functionality (delivering updates); disclosed in the privacy policy and Data safety (C6.8, O-10) |
| Play Age Signals (2.0.x, C2.4 step 6) | under-18 signal forces analytics off and non-personalised ads | — | — | O-29 |

### C5.2 Sentry on Android (`src/core/platform/telemetry/sentry.ts`)

Port from `instrumentation/sentry-config.ts`, `sentry-consent.ts`, `optional-telemetry.ts`, `sentry-privacy.ts` (the scrubber) and `sentry-environment.ts`, with these changes:
- Remove the Crashlytics mirror (`mirrorException`, `connectCrashReportingSentry`).
- `reactNativeErrorHandlersIntegration()` uses its defaults (`onerror` and `onunhandledrejection` true) instead of `{onerror: false}`, so fatals crash normally.
- `enableLogs: false`; the logs product is not used.
- `enableAppStartTracking: true`, `enableNativeFramesTracking: true`, `enableStallTracking: true`, `tracesSampler: () => consent.token() !== undefined ? 0.1 : 0`. `beforeSendTransaction` keeps dropping unconsented transactions, so startup is measured for consented users (AND‑6).
- `sampleRate: 1`, `maxBreadcrumbs: 50`, `sendDefaultPii: false`, `enableAutoSessionTracking: false`, no Replay, no profiling.
- Per-session cap: a `beforeSend` counter drops error events after 25 per process. Combined with §5.4, this keeps the free 5k/month quota, which three apps share, from being burned by outages: v1 used about 19 % in 2 days (`research/stability.md` §5.3).
- Breadcrumbs: `breadcrumbsIntegration({console: false})`. Breadcrumbs are sanitised by `sanitizeBreadcrumb`.
- The feedback form is kept on Android ("Report a problem", the v1 options at `sentry-config.ts:43-55`).

`entry.ts` (v2) imports `@expo/metro-runtime`, then `./src/core/platform/telemetry/sentry`, then `expo-router/entry`. The `./instrumentation/crashlytics` line goes.

### C5.3 Sentry on web (`src/core/platform/telemetry/sentry.web.ts`, new)

- An inline listener records `window` `error` and `unhandledrejection` into a 10-item buffer from module evaluation.
- After `requestIdleCallback`, with a 3 s fallback, or on the first buffered error, it runs `await import('@sentry/browser')` and calls `init`:
  - `dsn` from `sentry.options.json`
  - `environment`: `production` on `yify.expo.app`, otherwise `preview` (port `sentry-environment.ts`)
  - `sendDefaultPii: false`, `defaultIntegrations: false`
  - `integrations: [breadcrumbsIntegration({console: false, dom: false}), globalHandlersIntegration(), linkedErrorsIntegration(), dedupeIntegration(), httpContextIntegration()]`
  - `tracesSampleRate: 0`, `enableMetrics: true`
  - `beforeSendMetric`: consent gate (port)
  - `beforeSend: sanitizeErrorEvent` (port) plus the same 25/session cap
  - `ignoreErrors` from `isBrowserExtensionError` (port)
  - `denyUrls: [/^chrome-extension:/, /^moz-extension:/, /^safari(-web)?-extension:/]`

  Then it replays the buffer through `captureException`.
- The Sentry Metro config injects debug IDs into web bundles, so source maps match without a `release` string.
- Error boundaries (`app/_layout.tsx` and route `ErrorBoundary` exports) call `reportError(error, {boundary})` from the telemetry facade. That facade buffers until Sentry has loaded.

### C5.4 Expected failures are metrics, not error events (`src/core/platform/telemetry/operations.ts`, new)

```ts
export type OperationOutcome =
  | 'ok' | 'cancelled' | 'offline' | 'network' | 'timeout' | 'http_404' | 'http_429' | 'http_5xx'
  | 'no_fill' | 'store' | 'billing_unavailable' | 'configuration' | 'blocked'
  | 'invalid_response' | 'http_4xx' | 'unknown';

export const EXPECTED_OUTCOMES: ReadonlySet<OperationOutcome> = new Set([
  'ok', 'cancelled', 'offline', 'network', 'timeout', 'http_404', 'http_429', 'http_5xx',
  'no_fill', 'store', 'billing_unavailable', 'configuration', 'blocked',
]);

export function reportOperation(
  operation: string,
  outcome: OperationOutcome,
  detail?: {error?: unknown; attributes?: Record<string, string | number | boolean>},
): void;
```

How `reportOperation` handles each call:
- **Always:** `Sentry.metrics.count('yify.operation', 1, {attributes: {operation, outcome, platform, ...attributes}})`. The API is `node_modules/@sentry/core/build/types/metrics/public-api.d.ts:50`, exported from `@sentry/react-native` (`dist/js/index.d.ts:7`). The metric is dropped without consent by `beforeSendMetric`.
- **Always:** a breadcrumb `{category: 'operation', message: `${operation} ${outcome}`}`.
- **Only for an unexpected outcome** (`invalid_response`, `http_4xx`, `unknown`): `captureException(error)` with tags `operation` and `outcome`, at most once per `operation:outcome` per session.

Programming errors (`TypeError`, render errors) are not routed here. They reach Sentry through the global handlers.

Operation names:
- `api.home`, `api.title`, `api.search`, `api.person`, `api.providers`, `api.find`
- `auth.sign_in`
- `sync.push`, `sync.pull`
- `purchases.configure`, `purchases.identify`, `purchases.customer`, `purchases.offers`, `purchases.purchase`, `purchases.restore`; every `purchases.*` call adds the attribute `sdk_code` (the RevenueCat error code, or `none`), because v1's `revenuecat_sync_failed` hit 12 % of Android users with no phase recorded (DB-8)
- `ads.load`, `ads.present`, `ads.consent`
- `updates.ota`, `updates.store`
- `player.start`

### C5.5 GA4 event catalog (v2): 24 events

Rules:
- Names are snake_case and ≤ 40 chars; there are ≤ 10 params per event.
- No PII and no free-text values: no titles, no search terms.
- Ids are formatted `movie:603`.
- **Never log a client-side `purchase` or `ad_impression`.** RevenueCat sends `purchase` server-side through its Firebase integration (`research/data-browser.md` §2.4), and AdMob logs `ad_impression`.

Implementation:
- `src/core/platform/telemetry/analytics.ts` and `analytics.web.ts` port `data/datasources/analytics/FirebaseAnalyticsSink.ts` and `.web.ts`. The consent check becomes `choices.analytics`. On web, `firebase/analytics` moves behind `import()`.
- The `login` event fires **only on interactive sign-in**. That fixes DB‑14 (fired on every cold start).

| Event | When | Params | Key event |
|---|---|---|---|
| `screen_view` | route focus (manual; automatic reporting stays off in `firebase.json`) | `screen_name`, `screen_class` (`home`, `search`, `title_movie`, `title_tv`, `person`, `library`, `you`, `plus`, `settings`) | |
| `select_content` | `openTitle` and person opens | `content_type` (movie\|tv\|person), `content_id`, `surface` | |
| `search` | results shown for a settled query | `query_length`, `result_count`, `scope` (all\|movie\|tv\|person), `has_filters` (0\|1) | |
| `trailer_start` | first `PLAYING` | `content_type`, `content_id`, `surface` (title\|home) | yes |
| `watchlist_add` | added | `content_type`, `content_id`, `surface` | yes |
| `watchlist_remove` | removed | `content_type`, `content_id` | |
| `watched_add` | diary entry saved | `content_type`, `has_rating` (0\|1), `has_note` (0\|1), `rewatch` (0\|1) | yes |
| `list_create` | custom list created | `list_count` (after), `plus` (0\|1) | |
| `list_item_add` | title added to a custom list | `content_type` | |
| `watch_provider_open` | provider link opened | `content_type`, `content_id`, `provider_id`, `monetization` (flatrate\|free\|ads\|rent\|buy), `region` | yes |
| `share` | share sheet completed or link copied | `method` (system_sheet\|copy_link), `content_type`, `item_id` | |
| `login` | interactive sign-in success | `method` (google) | |
| `sign_up` | sign-in with a new Firebase user | `method` (google) | yes |
| `paywall_view` | paywall or `/plus` shown | `placement`, `mode` (store\|play_link\|web_checkout), `plus` (0\|1) | |
| `purchase_start` | T20 | `package` (monthly\|annual), `placement` | |
| `purchase_result` | T22–T26 | `result` (granted\|not_granted\|cancelled\|pending\|already_owned\|failed), `package`, `error_code` | |
| `restore_result` | T28/T29 | `result` (restored\|none\|failed), `reason` (user\|post_login_reconcile) | |
| `play_store_open` | web "Get Yify Plus on Google Play" tap | `placement` | yes (web) |
| `ad_shown` | interstitial `OPENED` | `placement` (title_open), `open_ordinal` | |
| `ad_skipped` | skip with a reason in `LOGGED_SKIP_REASONS`, or `show_timeout` | `reason` | |
| `insights_view` | insights opened | `plus` (0\|1), `period` (month\|year) | |
| `setting_change` | region, theme, accent, services or analytics consent changed | `setting`, `value` | |
| `app_update` | store update flow events (§4.5) | `type` (flexible\|immediate), `result` (started\|declined\|installed\|failed) | |
| `library_migration` | v1 → TMDB migration run (decision 11) | `resolved`, `unresolved`, `result` (ok\|partial\|failed) | |

- User properties: `plus` (`true`\|`false`) and `signed_in` (`true`\|`false`).
- Server-side: RevenueCat → Firebase `purchase`, `rc_*` events. Mark `purchase` as a key event, and **not** the automatic `in_app_purchase`, which would double-count revenue.
- Custom definitions to register in GA4 (event scope): `content_type`, `surface`, `placement`, `reason`, `result`, `package`, `mode`, `monetization`, `setting`, `type`.

### C5.6 Funnels and KPI sources

GA4 is an opt-in sample, 30–50 % of real activity (`research/data-browser.md` §0). Use it for **ratios**, and use the store, ad and billing consoles for absolute numbers.

| Funnel | Steps | Where |
|---|---|---|
| F1 Activation (new users, first 24 h) | `first_open`/`first_visit` → `select_content` → any of `trailer_start`, `watchlist_add`, `watched_add`, `watch_provider_open` | GA4 funnel exploration |
| F2 Where to watch | `select_content` (movie or tv) → `watch_provider_open` | GA4 |
| F3 Search success | `search` → `select_content` (surface search), same session | GA4 |
| F4 Plus, Android | `paywall_view` (mode store) → `purchase_start` → `purchase_result` (granted) | GA4; revenue and conversions from RevenueCat |
| F5 Plus, web → Play | `paywall_view` (play_link) → `play_store_open`, then Play installs with `utm_source=yify_web` | GA4 + Play Console acquisition |
| F6 Ads, Android | tap opens (`select_content`, surface ≠ deep_link) → `ad_shown` vs `ad_skipped` by reason | GA4 + AdMob (requests, show rate, eCPM) |
| Retention | D1/D7 cohorts | GA4 sample. Absolute installed audience and uninstalls come from Play Console. |

Monthly KPI table, kept in `docs/telemetry.md`:
- Play installed audience, monthly active devices and uninstalls
- AdMob requests, show rate and earnings
- RevenueCat active subscriptions and MRR
- Play vitals crash and ANR rates
- Sentry error events per release
- GA4 activation rate (F1)

### C5.7 Removals

- Crashlytics, `@yify/crashreporting`, `instrumentation/crashlytics*.ts`.
- `expo-insights`.
- `data/services/SentryDiagnostics.ts`: its `fail → captureException` policy is the noise source. Replaced by §5.4.
- `RevenueCatAdRevenueSink`, `trackSubscriptionFunnel`, the `trailer_ad_*`, `torrent_*`, `hero_*`, `shelf_impression`, `player_*`, `supporter_*` and `coffee_open` events.
- `presentation/analytics/events.ts`, replaced by the typed catalog in `src/core/platform/telemetry/events.ts`.
- `firebase.json` keeps the `react-native` analytics defaults (all `false`) and drops `crashlytics_is_error_generation_on_js_crash_enabled` and `crashlytics_javascript_exception_handler_chaining_enabled`. A unit test, `tests/plugins/firebase-defaults.test.cjs`, asserts the ten analytics and ad defaults are `false`. It replaces the postinstall `check-firebase-compat.mjs`.

### C5.8 Sentry project settings and alerts (dev + owner, §7)

- Enable "Prevent Storing of IP Addresses" and the default data scrubbers (BE‑14).
- Issue alert: new issue in `production` → email (keep the existing high-priority rule). Release halt queries filter `installer:com.android.vending !split_count:0` (C4.11).
- Issue alert on the server events `tmdb_auth` and `internal` (logger `yify-server`, A3.2) → email.
- Metric alert: `yify.operation` count with `outcome:http_5xx`, `operation:api.*` over 5 in 10 min → email (consented metrics at about 23 daily Android users could never reach the old threshold of 30).
- Repoint the single uptime monitor from `https://kunal26das.github.io` to `https://yify.expo.app/api/v2/health` (A3.4.15), which also fails while the legacy upstream is down.
- Spike protection on (native events bypass the JavaScript per-process cap).

---

## C6. Engineering system

### C6.1 `.github/workflows/ci.yml` (the only CI workflow; written in F0)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: Typecheck and tests
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 24
          cache: yarn
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Exact dependency pins and Firebase alignment
        run: yarn check:pins
      - name: Typecheck
        run: yarn typecheck
      - name: Lint, boundaries and no-comments rule
        run: yarn lint
      - name: Tests
        run: yarn test
      - name: Expo dependency compatibility
        run: yarn check:expo

  web:
    name: Web exports render and isolate catalog data
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 24
          cache: yarn
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Export web with server output
        run: yarn export:web
      - name: Render, metadata, headers, client data boundary and budget
        run: yarn check:web

  native-guards:
    name: Native crash guards
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          fetch-depth: 0
      - name: Detect native-affecting changes
        id: changes
        run: |
          BASE="${{ github.event.pull_request.base.sha || github.event.before }}"
          if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
            echo "run=true" >> "$GITHUB_OUTPUT"
          elif git diff --quiet "$BASE" HEAD -- package.json yarn.lock patches plugins scripts/check-reanimated-lifecycle.mjs scripts/check-ump-metrics.mjs tests/fixtures/reanimated-lifecycle; then
            echo "run=false" >> "$GITHUB_OUTPUT"
          else
            echo "run=true" >> "$GITHUB_OUTPUT"
          fi
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        if: steps.changes.outputs.run == 'true'
        with:
          node-version: 24
          cache: yarn
      - name: Install dependencies
        if: steps.changes.outputs.run == 'true'
        run: yarn install --frozen-lockfile
      - name: Reanimated NodesManager lifecycle patch
        if: steps.changes.outputs.run == 'true'
        run: |
          export JAVA_HOME="${JAVA_HOME_17_X64:-$JAVA_HOME}"
          node scripts/check-reanimated-lifecycle.mjs --output "$RUNNER_TEMP/reanimated-lifecycle"
      - name: UMP consent SDK bytecode guard
        if: steps.changes.outputs.run == 'true'
        run: |
          UMP_TEST_DIR=$(mktemp -d)
          export JAVA_HOME="${JAVA_HOME_17_X64:-$JAVA_HOME}"
          UMP_ANDROID_JAR=$(find "$ANDROID_HOME/platforms" -name android.jar -type f | sort -V | tail -n 1)
          curl --fail --silent --show-error --retry 3 --max-time 120 https://dl.google.com/dl/android/maven2/com/google/android/ump/user-messaging-platform/4.0.0/user-messaging-platform-4.0.0.aar --output "$UMP_TEST_DIR/ump.aar"
          curl --fail --silent --show-error --retry 3 --max-time 120 https://repo.maven.apache.org/maven2/org/ow2/asm/asm/9.9/asm-9.9.jar --output "$UMP_TEST_DIR/asm.jar"
          curl --fail --silent --show-error --retry 3 --max-time 120 https://repo.maven.apache.org/maven2/org/ow2/asm/asm-tree/9.9/asm-tree-9.9.jar --output "$UMP_TEST_DIR/asm-tree.jar"
          node scripts/check-ump-metrics.mjs "$UMP_TEST_DIR/ump.aar" "$UMP_ANDROID_JAR" "$UMP_TEST_DIR/asm.jar" "$UMP_TEST_DIR/asm-tree.jar"

  firestore-rules:
    name: Firestore rules
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          fetch-depth: 0
      - name: Detect rules changes
        id: changes
        run: |
          BASE="${{ github.event.pull_request.base.sha || github.event.before }}"
          if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
            echo "run=true" >> "$GITHUB_OUTPUT"
          elif git diff --quiet "$BASE" HEAD -- firestore.rules tests/firestore; then
            echo "run=false" >> "$GITHUB_OUTPUT"
          else
            echo "run=true" >> "$GITHUB_OUTPUT"
          fi
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        if: steps.changes.outputs.run == 'true'
        with:
          node-version: 24
          cache: yarn
      - name: Install dependencies
        if: steps.changes.outputs.run == 'true'
        run: yarn install --frozen-lockfile
      - name: Rules emulator suite
        if: steps.changes.outputs.run == 'true'
        run: |
          export JAVA_HOME="${JAVA_HOME_21_X64:-$JAVA_HOME}"
          export PATH="$JAVA_HOME/bin:$PATH"
          npx --yes firebase-tools@15.36.0 emulators:exec --only firestore --project demo-yify-rules "node --test tests/firestore/rules.integration.cjs"
```

- The pinned action SHAs are the ones v1 already uses (checkout v7.0.1, setup-node v7.1.0), written without trailing version comments because of the no-comments rule; Dependabot updates SHA pins either way.
- **Required checks.** Branch protection on `main` requires exactly `Typecheck and tests` and `Web exports render and isolate catalog data` (decision 12; the release-console check was already removed on 2026-11-26). `Native crash guards` and `Firestore rules` stay optional because they depend on downloads from Google Maven and npm; the Firestore job must still be green before any rules deploy (Q8).
- `firebase-tools` 15.36.0 (published 2026-11-11) runs only through `npx` in this job; it is not a project dependency.
- The `web` job never calls TMDB: `check-web-export.mjs` and `check-web-budget.mjs` serve the export with `YIFY_API_FIXTURES=1` (C3.6, C3.8).

### C6.2 `.github/workflows/deploy-web.yml` (replaces `deploy-hosting.yml` and `deploy-pages.yml`)

Decision 13(c): merging `redesign/v2` into `main` deploys the v2 web app and the `/api/v2` server, verified live. Every later push to `main` that changes more than docs does the same. Manual dispatch deploys to the fixed preview alias `v2` (`https://yify--v2.expo.app`), or promotes when `production` is ticked. Before step (c) the workflow does not exist on `main`, so spike S2 and Q4 deploy the alias from `redesign/v2` with `yarn deploy:web:preview` (with `EXPO_TOKEN` and the `EXPO_PUBLIC_*` values from the integrator's local environment).

```yaml
name: Deploy web

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '**/*.md'
      - 'store-artifacts/**'
      - '.github/dependabot.yml'
  workflow_dispatch:
    inputs:
      production:
        description: Promote the deployment to the production alias
        type: boolean
        default: false

permissions:
  contents: read

concurrency:
  group: deploy-web
  cancel-in-progress: false

jobs:
  deploy:
    name: Export, check and deploy to EAS Hosting
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: production
    env:
      PROMOTE: ${{ github.event_name == 'push' || inputs.production }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 24
          cache: yarn
      - run: yarn install --frozen-lockfile
      - name: Export
        run: yarn export:web
        env:
          EXPO_PUBLIC_FIREBASE_API_KEY: ${{ secrets.EXPO_PUBLIC_FIREBASE_API_KEY }}
          EXPO_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_PROJECT_ID }}
          EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET }}
          EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
          EXPO_PUBLIC_FIREBASE_APP_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_APP_ID }}
          EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: ${{ secrets.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID }}
          EXPO_PUBLIC_REVENUECAT_WEB_KEY: ${{ secrets.EXPO_PUBLIC_REVENUECAT_WEB_KEY }}
          SENTRY_ENVIRONMENT: ${{ env.PROMOTE == 'true' && 'production' || 'preview' }}
      - name: Check export
        run: yarn check:web
      - name: Upload source maps to Sentry
        run: npx sentry-expo-upload-sourcemaps dist
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: kudos-labs
          SENTRY_PROJECT: yify
      - name: Remove source maps from the deployment
        run: find dist -name '*.map' -delete
      - name: Deploy
        run: npx --yes eas-cli@27.11.0 deploy --export-dir dist --environment production --non-interactive ${{ env.PROMOTE == 'true' && '--prod' || '--alias v2' }}
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
      - name: Live checks
        if: env.PROMOTE == 'true'
        run: |
          node scripts/check-live-web.mjs --origin https://yify.expo.app
          node scripts/check-live-privacy.mjs --url https://yify.expo.app/privacy.html
          node scripts/check-legacy-contract.mjs --origin https://yify.expo.app
      - name: Preview checks
        if: env.PROMOTE != 'true'
        run: |
          node scripts/check-live-web.mjs --origin https://yify--v2.expo.app --preview
          node scripts/check-legacy-contract.mjs --origin https://yify--v2.expo.app
```

- `sentry-expo-upload-sourcemaps` is the `@sentry/react-native` bin (`package.json` `bin`, `scripts/expo-upload-sourcemaps.js`); spike S1 (C3.3) confirms it finds `dist/client` for server output.
- `scripts/check-live-web.mjs` (P8) checks, against the given origin:
  - `GET /api/v2/health` is 200 with `tmdbKey: "env"` and `legacy: "ok"`;
  - `/` is 200 HTML whose `<title>` starts with `{APP_NAME}`;
  - `/title/movie/603` answers 301 with `Location: /title/movie/603-the-matrix` (relative), which is 200 with the canonical link, JSON-LD and the `HTML_CACHE` `Cache-Control`; on production it has no `noindex`, and with `--preview` it has `noindex,nofollow`;
  - `/title/movie/999999999` is 404; `/_expo/loaders/title/movie/603` with `Accept: application/json` is 200 `null` with `no-store`;
  - `/movie/8462` answers 301 to a `/title/movie/` URL, and every 301 `Location` starts with `/` or `https://yify.expo.app/`;
  - `GET /api/catalog/movies?v=2&page=1` is 200, contains no `"hash"`, `"seeds"`, `"peers"` or `magnet:`, and every `torrents` array is empty; `/api/subscriber-catalog/movies` is 404;
  - `/robots.txt` disallows `/api/`; `/app-ads.txt` contains `pub-2292299294214510`; `/.well-known/assetlinks.json` is 200;
  - `/privacy.html`, `/terms.html`, `/delete-account.html` and `/support.html` are 200, and `/privacy`, `/privacy/`, `/terms/`, `/delete-account/` and `/support/` reach a 200 page in at most one redirect (AND-14).

  Each failure prints the URL, status and the failed assertion.
- `scripts/check-legacy-contract.mjs` (P1) runs the vendored v1 parsers over every legacy operation on the given origin (A3.7).
- `check-live-privacy.mjs` gains a `--url` mode: status 200, `text/html`, the body contains "Privacy".
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` is deliberately not passed: on `yify.expo.app` and the `v2` alias the web build derives a same-origin `authDomain` from the host (A6.1). A repository secret of that name, if present, stays unused.
- Secrets: `EXPO_TOKEN` must exist as a repository secret in the `production` environment (Part O, O-9); the other secrets already exist from the Pages workflow.

### C6.3 `.github/dependabot.yml` (monthly grouped + security)

`main` already runs the owner's monthly grouped configuration (#1111, 2026-11-26), which is what decision 12 asks for. Stream C ports it to v2 unchanged in shape: the same schedule, cooldown, versioning strategy, ordered groups (a package joins the first group it matches) and security groups, minus the `/release` ecosystem and the packages v2 removes, plus v2's new packages.

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "monthly"
      time: "06:00"
      timezone: "Asia/Kolkata"
    open-pull-requests-limit: 30
    versioning-strategy: increase
    cooldown:
      default-days: 3
    groups:
      expo-sdk:
        patterns:
          - "expo"
          - "@expo/metro-runtime"
          - "@expo/vector-icons"
          - "eslint-config-expo"
          - "expo-build-properties"
          - "expo-constants"
          - "expo-dev-client"
          - "expo-font"
          - "expo-haptics"
          - "expo-image"
          - "expo-keep-awake"
          - "expo-linking"
          - "expo-localization"
          - "expo-navigation-bar"
          - "expo-network"
          - "expo-router"
          - "expo-splash-screen"
          - "expo-sqlite"
          - "expo-status-bar"
          - "expo-system-ui"
          - "expo-updates"
          - "expo-web-browser"
          - "react-native"
          - "@react-native/*"
          - "react"
          - "react-dom"
          - "react-test-renderer"
          - "@types/react"
          - "react-native-reanimated"
          - "react-native-worklets"
          - "react-native-gesture-handler"
          - "react-native-safe-area-context"
          - "react-native-screens"
          - "react-native-web"
          - "react-native-webview"
      firebase-native:
        patterns: ["@react-native-firebase/*", "firebase"]
      native-sdks:
        patterns:
          - "@sentry/*"
          - "react-native-purchases"
          - "@revenuecat/*"
          - "react-native-google-mobile-ads"
          - "@react-native-google-signin/*"
          - "react-native-youtube-iframe"
          - "expo-in-app-updates"
      tooling:
        patterns: ["typescript", "eslint*", "@eslint/*", "@typescript-eslint/*", "@babel/*", "subset-font"]
      everything-else:
        patterns: ["*"]
        update-types: ["minor", "patch"]
      security-updates:
        applies-to: security-updates
        patterns: ["*"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
      time: "06:30"
      timezone: "Asia/Kolkata"
    open-pull-requests-limit: 10
    cooldown:
      default-days: 3
    groups:
      actions-updates:
        patterns: ["*"]
      security-updates:
        applies-to: security-updates
        patterns: ["*"]
```

- `firebase-native` stays its own group ahead of `native-sdks`: React Native Firebase pins the Firebase JavaScript SDK exactly (27.1.1 needs 13.1.0, 27.2.0 needs 13.3.0), so a failing Firebase proposal must not hold back Sentry, RevenueCat, Mobile Ads and Google Sign-In (the reasoning of #1111). The pin checker's alignment check (Part 0, I-6) fails any proposal that moves only one side.
- `@tanstack/react-query` and every other uncoupled package fall into `everything-else` for minor and patch updates and get individual pull requests for majors.
- `versioning-strategy: increase` keeps exact pins exact. After any Dependabot PR, CI's pin check enforces the owner rule.
- SDK, React Native and compiler majors stay deliberate manual upgrades. Decision 12 forbids realigning the toolchain.
- The config test is ported from `main`'s `tests/dependabot-config.test.cjs` (#1111) to `tests/scripts/dependabot-config.test.cjs` and trimmed to v2: every registry dependency of the root and `tooling` manifests maps to its intended group at every update level, `firebase-native` precedes `native-sdks`, no exact name sits behind an earlier wildcard, cooldowns stay at three days, no group filters by dependency type, and both ecosystems keep a security group. F0 deletes the v1 copy with the other v1 tests; stream C adds the v2 copy together with this file.
- Merge policy, written in `docs/development.md`:
  - JavaScript-only bumps can ship by OTA to the current runtime (`scripts/eas.sh` refuses when native inputs changed, C4.8).
  - Native-affecting bumps (dependency sections, native packages in `yarn.lock`) are merged only when a store release is being prepared, in one batch, together with a `version` bump.
  - No auto-merge machinery (the maintenance workflow and its GitHub App are deleted, C6.4).
- The owner enables "Dependabot security updates" in the repository settings (O-16).

### C6.4 Delete list

F0-A deletes everything in this section in its reset commits (Part W, F0-A step 2), together with the v1 runtime code and tests of F0.3, so no stream ever trips over a v1 workflow, script or ignore entry, and `scripts/eas.sh` is rewritten in the same part (execution review, item 7). Each deleted name must leave `git grep` empty outside `docs/v2/`. Stream C only writes (C6.8).

**Workflows:**
- `.github/workflows/dependabot-maintenance.yml`
- `.github/workflows/dependency-watch.yml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/deploy-hosting.yml` (replaced by `deploy-web.yml`)
- `.github/workflows/publish-android-ota.yml` (hard-coded to runtime 1.8.14)
- `.github/workflows/verify-production-aab.yml` (the emulator verifier)
- `.github/workflows/android-compile-only-qa.yml`
- `.github/workflows/verify-hsdp-dependency.yml`
- `.github/workflows/availability-alerts.yml`
- `.github/FUNDING.yml` (Buy me a coffee)

**Scripts:**
- Dependabot automation: `dependabot-lockfile.mjs`, `dependabot-refresh.mjs`, `dependabot-root-policy.mjs`, `main-ci.mjs`, `dependency-watch.mjs`, `dependency-pin-reviews.json`
- `android-ota-controller.mjs`
- directories `availability-alerts/` and `android-qa/`
- AAB verifiers: `verify-production-aab.mjs`, `verify-production-aab.test.mjs`, `VerifySignedAab.java`, `verify-signed-aab.test.mjs`, `test-production-aab-emulator.sh`, `wait-production-aab-emulator-ready.sh`, `verify-hsdp.gradle`
- `check-agent-team.mjs`
- `play-upload.sh` (its token, edit, validate and commit logic is ported to `scripts/play-release.mjs` by P9, from `v1-baseline:scripts/play-upload.sh`), `setup-android-signing.sh`, `run-android-release.sh`, `setup-eas-credentials.sh`
- doctor policy: `check-expo-doctor.mjs`, `expo-dependency-policy.json`
- Firebase lock: `check-firebase-compat.mjs`, `firebase-compatibility.json`
- `check-android-native-libs.mjs` (§4.6)
- `check-update-channel.mjs` (§4.1)
- Sentry release tooling: `eas-with-sentry.mjs`, `sentry-release.mjs`, `sentry-sourcemaps.mjs` (replaced by the Sentry Gradle plugin for native, and `sentry-expo-upload-sourcemaps` for web and OTA)
- `subscription-funnel-report.mjs`, `revenuecat-setup.sh`

**Patches:**
- `patches/expo-native/google-signin-spm-exact.patch`: iOS podspec only; iOS is not a target (decision 5).
- `patches/query-string-compat.md`.
- From `patches/expo-native/manifest.json`, all 103 `sources` hash guards. Keep only the Reanimated `files` entry.

**Directories and files:**
- `release/` (console, ledger, its Dependabot entry)
- `desktop/`, `electron-builder.yml`, untracked `desktop-dist/`
- `crashreporting/`
- `openspec/`
- `.agents/skills/openspec-*` (6) and `.agents/skills/yify-product-audit` (audits v1 paths)
- `config/agent-team.json` (keep `config/android/` and `config/ios/`)
- `docs/agents/` (`state.md`, `team.md`, `verification.md`, `skills.md`, `roles/`)
- `instrumentation/crashlytics.ts`, `instrumentation/crashlytics.web.ts`
- `public/ads.txt`, `public/availability-worker.js`, `public/guide.html`, `public/guide/`, and `public/sitemap.xml` (EAS serves static files before the worker, so the v1 sitemap would shadow `app/sitemap.xml+api.ts`)
- `store-artifacts/screenshots-*`: they contain the "Download" button UI. New listing assets come from release step (d) and the Identity step (B8.2).

**Docs:**
- `docs/android-qa.md`, `docs/availability-alerts.md`, `docs/competitive-review.md`
- `docs/crashes-20260929.md`, `docs/sentry-crashes-20260921.md`, `docs/sentry-crashes-20260925.md`, `docs/privacy-readiness-20260925.md`
- `docs/dependency-automation.md`, `docs/dependency-pin-review.md`, `docs/dependency-upgrade.md`
- `docs/growth-pilot.md`, `docs/subscription-funnel.md`, `docs/notifications.md`
- `docs/revenuecat-operations.md` (replaced by `docs/monetization.md`), `docs/sentry.md` (replaced by `docs/telemetry.md`)

**Tests** (tooling and removed telemetry or monetization only; feature tests follow the architecture section):
- `agent-team`, `android-native-libs`, `android-ota-controller`, `android-qa-prerequisites`
- `crash-reporting-integration`, `crashlytics`, `crashlytics-ndk`, `sentry-crashlytics`
- `dependabot-config`, `dependabot-lockfile`, `dependabot-refresh`, `dependabot-root-policy`, `dependency-install-order`, `dependency-watch`
- `desktop`, `expo-doctor`, `expo-v2-r8-artifact`, `firebase-compat`, `google-signin-spm`, `xcode-compatibility`
- `main-ci`, `main-delivery-workflows`, `query-string-compat`
- `sentry-release`, `sentry-uploads`
- `subscription-funnel`, `subscription-funnel-report`
- `adsense-display`, `web-advertisement`, `revenuecat-ad-tracking`, `ad-tracking`, `account-ads`, `supporter-*`, `upgrade-route`
- `play-store-services`, `update-snackbar`, `remote-config-recovery`, `country-location`
- `native-notification-delivery`, `web-notification-delivery`, `notification-preferences`, `movie-notification-coordinator`

### C6.5 Keep list: "applies a patch" vs "only checks"

| Item | Kind | Keep | Why |
|---|---|---|---|
| `scripts/expo-native-compat.mjs` | **applies** `patches/expo-native/*.patch` into `node_modules`; also verified the hashes | keep the applier; the manifest keeps only `files[reanimated-nodes-lifecycle]`; `sources` removed | Reanimated `NodesManager` teardown SIGABRT (`1de4a560`), no recurrence since the patch landed (`research/tooling.md` §5.3) |
| `patches/expo-native/reanimated-nodes-lifecycle.patch` | patch | keep | same |
| `scripts/apply-tooling-compatibility.mjs` + `tooling/compatibility-patches.json` | **applies** source rewrites: Worklets Babel plugin `@babel/core` → Babel 7 alias (affects Metro output); `ts-api-utils` → TS 6 API (lint) | keep | the toolchain stays: TS 7, Babel 8 (decision 12) |
| `tooling/` workspace | aliases `babel7`, TS 6 | keep | same |
| `scripts/check-dependency-pins.mjs` | checks | keep, simplified: manifests `package.json` and `tooling/package.json`, the Firebase alignment check (Part 0, I-6) and the expo-native check (Part W, F0.2) | owner rule |
| `scripts/check-reanimated-lifecycle.mjs` + `tests/fixtures/reanimated-lifecycle` | checks the real patch's behaviour | keep (native-guards job) | crash fix |
| `scripts/check-ump-metrics.mjs` + `tests/fixtures/ump` | checks the bytecode guard | keep (native-guards job) | crash fix |
| `scripts/check-web-export.mjs` | checks | keep, rewritten (§3.8) | gate |
| `scripts/check-web-budget.mjs` | checks | new | gate |
| `scripts/check-web-preview.mjs` | checks | keep | browser QA preflight |
| `scripts/check-live-privacy.mjs` | checks | keep (+ `--url`) | Play rejected an update for a 404 privacy URL on 2026‑09‑10 |
| `scripts/eas.sh` | wrapper | rewritten: F0-A writes the minimal wrapper (`EXPO_TOKEN` from the environment, else the `token` field of `~/.yify-release.json` when present, else the `eas login` session; then `exec npx --yes eas-cli@27.11.0 "$@"`; no `release/` binary, no `eas-with-sentry.mjs`); P9 adds the privacy preflight for production builds and submissions and the OTA guard for updates (C4.8) | F0-A, then P9 |
| `scripts/play-release.mjs` | applies (Play edit) | new (P9): the listing-and-rollout edit of release step (f) (I.5) | P9 |
| `scripts/brand/stamp-public.mjs` | applies | new (F0-A): writes the brand values into the static web files (Part 0, §0.4) | F0-A, then the integrator |
| `scripts/check-legacy-contract.mjs` | checks | new (P1): v1 parsers over HTTP (A3.7) | P1 |
| `scripts/run-android-debug.sh`, `scripts/android-java.sh` | dev | keep | JDK 17 resolution |
| `scripts/privacy/*` | DSAR tool | keep; the Firestore roots follow the backend's v2 schema (drop `availabilityAlertState`) | legal ops |
| `plugins/*` | applies | see §4.10 | |
| `firebase.json` defaults test | checks | new (`tests/plugins/firebase-defaults.test.cjs`) | consent defaults |

`package.json` `postinstall`: `node scripts/expo-native-compat.mjs && node scripts/apply-tooling-compatibility.mjs`.

### C6.6 `package.json` (v2, complete; written in F0)

```json
{
  "name": "yify",
  "main": "entry.ts",
  "version": "2.0.0",
  "versionCode": 116,
  "private": true,
  "workspaces": ["tooling"],
  "scripts": {
    "start": "NODE_OPTIONS=--max-old-space-size=8192 CI=false expo start",
    "dev": "NODE_OPTIONS=--max-old-space-size=8192 CI=false expo start --dev-client",
    "android": "NODE_OPTIONS=--max-old-space-size=8192 expo run:android",
    "android:debug": "bash scripts/run-android-debug.sh",
    "web": "NODE_OPTIONS=--max-old-space-size=8192 CI=false expo start --web",
    "prebuild": "expo prebuild --platform android --clean",
    "typecheck": "tsc --noEmit",
    "lint": "eslint --max-warnings 0 .",
    "test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup/register.mjs --test 'src/**/*.test.ts' 'src/**/*.test.cjs' 'tests/*/**/*.test.ts' 'tests/*/**/*.test.cjs' 'tests/*/**/*.test.mjs'",
    "check:pins": "node scripts/check-dependency-pins.mjs",
    "check:release": "node scripts/brand/stamp-public.mjs --check --require-final",
    "check:expo": "expo install --check",
    "export:web": "NODE_OPTIONS=--max-old-space-size=8192 expo export --platform web --clear --source-maps --output-dir dist",
    "check:web": "node scripts/check-web-export.mjs dist && node scripts/check-web-budget.mjs dist",
    "serve:web": "expo serve dist --port 8790",
    "build:icons": "node scripts/icons/build-icons.mjs",
    "build:fonts": "node scripts/fonts/build-fonts.mjs",
    "brand:stamp": "node scripts/brand/stamp-public.mjs",
    "eas": "bash scripts/eas.sh",
    "build:android:preview": "bash scripts/eas.sh build --platform android --profile preview",
    "build:android:production": "bash scripts/eas.sh build --platform android --profile production",
    "submit:android:production": "bash scripts/eas.sh submit --platform android --profile play-production",
    "release:play": "node scripts/play-release.mjs",
    "update:android": "bash scripts/eas.sh update --channel Production --environment production --platform android",
    "deploy:web:preview": "yarn export:web && yarn check:web && bash scripts/eas.sh deploy --export-dir dist --environment production --alias v2",
    "postinstall": "node scripts/expo-native-compat.mjs && node scripts/apply-tooling-compatibility.mjs"
  },
  "dependencies": {
    "@expo-google-fonts/hanken-grotesk": "0.4.3",
    "@expo-google-fonts/lora": "0.4.2",
    "@expo/metro-runtime": "58.0.17",
    "@expo/vector-icons": "15.1.1",
    "@react-native-firebase/analytics": "27.2.0",
    "@react-native-firebase/app": "27.2.0",
    "@react-native-firebase/auth": "27.2.0",
    "@react-native-google-signin/google-signin": "17.0.0",
    "@revenuecat/purchases-js": "1.78.0",
    "@sentry/browser": "10.78.0",
    "@sentry/react-native": "8.36.0",
    "@tanstack/react-query": "5.107.1",
    "expo": "58.0.26",
    "expo-build-properties": "58.0.12",
    "expo-constants": "58.0.16",
    "expo-dev-client": "58.0.21",
    "expo-font": "58.0.12",
    "expo-haptics": "58.0.8",
    "expo-image": "58.0.18",
    "expo-in-app-updates": "0.13.0",
    "expo-keep-awake": "58.0.4",
    "expo-linking": "58.0.17",
    "expo-localization": "58.0.5",
    "expo-navigation-bar": "58.0.4",
    "expo-network": "58.0.5",
    "expo-router": "58.0.32",
    "expo-splash-screen": "58.0.14",
    "expo-sqlite": "58.0.18",
    "expo-status-bar": "58.0.5",
    "expo-system-ui": "58.0.7",
    "expo-updates": "58.0.22",
    "expo-web-browser": "58.1.0",
    "firebase": "13.3.0",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-native": "0.88.1",
    "react-native-gesture-handler": "3.5.0",
    "react-native-google-mobile-ads": "17.4.0",
    "react-native-purchases": "11.0.4",
    "react-native-reanimated": "4.8.0",
    "react-native-safe-area-context": "5.11.1",
    "react-native-screens": "4.30.1",
    "react-native-web": "0.21.4",
    "react-native-webview": "14.0.1",
    "react-native-worklets": "0.14.0",
    "react-native-youtube-iframe": "2.4.1"
  },
  "devDependencies": {
    "@babel/core": "8.1.3",
    "@babel/plugin-transform-dynamic-import": "8.0.1",
    "@babel/plugin-transform-modules-commonjs": "8.1.3",
    "@babel/preset-react": "8.0.1",
    "@babel/preset-typescript": "8.0.7",
    "@react-native/metro-config": "0.88.1",
    "@types/react": "19.3.0",
    "eslint": "10.15.0",
    "eslint-config-expo": "58.0.4",
    "eslint-import-resolver-typescript": "4.4.5",
    "react-test-renderer": "19.3.1",
    "subset-font": "2.9.0",
    "typescript": "7.0.2"
  },
  "resolutions": {
    "@yify/tooling/**/ts-api-utils": "2.5.0",
    "expo-modules-core": "58.1.0",
    "@expo/cli": "58.1.21",
    "@expo/metro-config": "58.0.23",
    "expo-dev-launcher": "58.0.21",
    "expo-dev-menu": "58.0.13",
    "expo-modules-autolinking": "58.1.0",
    "@expo/log-box": "58.0.15",
    "@expo/metro-runtime": "58.0.17",
    "expo-constants": "58.0.16",
    "expo-asset": "58.0.21",
    "expo-font": "58.0.12",
    "expo-modules-jsi": "58.0.23",
    "expo-file-system": "58.0.14",
    "react-native-screens": "4.30.1",
    "@expo/config": "58.0.12",
    "@expo/config-plugins": "58.0.13",
    "@expo/image-utils": "0.12.7",
    "@expo/inline-modules": "0.2.10",
    "@expo/local-build-cache-provider": "58.0.12",
    "@expo/metro-file-map": "58.0.6",
    "@expo/prebuild-config": "58.0.20",
    "@expo/require-utils": "58.0.6",
    "@expo/router-server": "58.0.23",
    "babel-preset-expo": "58.0.26",
    "@react-native/js-polyfills": "0.88.1",
    "regexpu-core": "6.5.4",
    "@babel/helper-create-regexp-features-plugin": "7.29.14",
    "regjsparser": "0.14.1",
    "@react-native/asset-utils": "0.88.1",
    "@react-native/dev-middleware": "0.88.1",
    "@react-native/babel-plugin-codegen": "0.88.1",
    "@react-native/codegen": "0.88.1",
    "@react-native/normalize-colors": "0.88.1",
    "expo-glass-effect": "58.0.5",
    "@grpc/grpc-js": "1.14.7",
    "**/@expo/fingerprint/minimatch": "11.0.9",
    "**/@typescript-eslint/typescript-estree/minimatch": "11.0.9",
    "**/@sentry/bundler-plugins/glob": "14.0.6"
  },
  "expo": {
    "install": {
      "exclude": ["typescript", "@babel/core", "react", "react-dom", "@sentry/react-native", "react-native-reanimated", "react-native-worklets", "react-native-gesture-handler", "react-native-web"]
    },
    "autolinking": {"android": {"buildFromSource": [".*"]}}
  }
}
```

`resolutions` is v1's object minus seven entries: `xcode` and `electron-to-chromium` (no-ops), `**/@electron/universal/minimatch` and `**/app-builder-lib/minimatch` (Electron is gone), `@expo-google-fonts/material-symbols` (only `expo-symbols` used it), `expo-task-manager` (its only dependents, `expo-background-task` and `expo-location`, are removed) and `expo-application` (in `yarn.lock` only `expo-notifications` depends on it). The security overrides, the tooling compatibility pins and the Expo and React Native alignment pins stay; pruning those is a later batch (DEP-18).

Dependency changes against v1 (every one lands in F0; Part W):

| Change | Package | Version | Reason |
|---|---|---|---|
| add | `@tanstack/react-query` | 5.107.1 | server state (A4.2); published 2026-11-06 |
| add | `@sentry/browser` | 10.78.0 | lazy web Sentry (C5.3); the exact version `@sentry/react-native` 8.36.0 depends on (`node_modules/@sentry/react-native/package.json`), so no new package enters the tree |
| add (dev) | `subset-font` | 2.9.0 | icon font subsetting and web WOFF2 fonts (B2.9, B2.4; Part 0, I-23); published 2026-09-20 |
| bump | `@react-native-firebase/app`, `auth`, `analytics` | 27.1.1 → 27.2.0 | decision 12 exception (Part 0, I-6) |
| bump | `firebase` | 13.1.0 → 13.3.0 | the exact `dependencies.firebase` of `@react-native-firebase/app@27.2.0` |
| bump | `version`, `versionCode` | 1.8.33 → 2.0.0, 115 → 116 | decision 13 |
| remove | `@react-native-firebase/crashlytics`, `@react-native-firebase/remote-config` | 27.1.1 | Sentry only (decision 9); no Remote Config (decision 8) |
| remove | `@yify/crashreporting` (workspace `crashreporting/`) | 0.1.0 | decision 9 |
| remove | `expo-insights`, `expo-location`, `expo-notifications`, `expo-background-task`, `expo-task-manager`, `expo-store-review` | 58.x | decisions 8 and 9 |
| remove | `@expo/ui`, `expo-symbols`, `expo-device-corner-radius`, `expo-blur`, `react-native-web-webview`, `@gorhom/bottom-sheet` | — | unused or replaced (DEP-1, DEP-12, DEP-13, DEP-15, DEP-16; `Sheet` on React Native `Modal`, B3.7) |
| remove | `@xmldom/xmldom`, `jose` | — | only the deleted Nyaa parser and subscriber JWT verifier used them |
| remove (direct entry only) | `@expo/log-box`, `expo-glass-effect` | — | stay transitive and pinned by `resolutions` |
| remove (dev) | `electron`, `electron-builder`, `error-stack-parser`, `@react-native/js-polyfills`, `expo-doctor` | — | desktop removed; duplicates; `expo install --check` replaces the doctor wrapper (Part 0, I-43) |

Script notes: `submit:android:production` is always run with `--id <buildId>` (no `--latest`, which could pick a preview build another stream made); `release:play` is the one Play edit of release step (f); `check:release` fails unless `config/brand.json` has `status: "final"`, the stamped files match it and no banned hex value remains; with `--icons <path to scratchpad/icons-v2/final/repo>` it also compares every icon file byte for byte, which the integrator runs locally where that folder exists (Part 0, §0.4).

`expo.install.exclude` lists the deliberate deviations formerly recorded in `scripts/expo-dependency-policy.json` (`@sentry/react-native` 8.36.0, `react-native-gesture-handler` 3.5.0, `react-native-worklets` 0.14.0, `react-native-reanimated` 4.8.0, `@babel/core` 8.1.3, `typescript` 7.0.2, `react` and `react-dom` 19.3.1, `react-native-web`); `expo install --check` honours it (`node_modules/@expo/cli/build/src/install/checkPackages.js:86`). `buildFromSource` stays for v2.0; dropping it (DEP-9) changes the binary and is left for a later batch.

### C6.7 No-comments rule in lint (no new dependency)

Add an inline plugin to `eslint.config.js`. It covers `**/*.{ts,tsx,js,cjs,mjs}` in `src`, `app`, `scripts`, `plugins` and the root config files:

```js
const yify = {
    rules: {
        'no-comments': {
            meta: {type: 'problem', schema: []},
            create(context) {
                return {
                    Program() {
                        for (const comment of context.sourceCode.getAllComments()) {
                            if (comment.type === 'Shebang') continue;
                            context.report({loc: comment.loc, message: 'Comments are not allowed in this codebase.'});
                        }
                    },
                };
            },
        },
    },
};
```

It is registered in A1.4's config as `{plugins: {yify}, rules: {'yify/no-comments': 'error'}}`. This also forbids `eslint-disable` directives. YAML and Java files are out of scope.

### C6.8 Docs to write

Each must be written before the v2 PR merges. Content outlines:

1. **`README.md`**
   - What Yify is: movie and TV discovery plus a watch diary. Platforms: Android and web.
   - Feature list (decision 7). Monetization summary (Plus, Android ads).
   - Privacy summary.
   - TMDB attribution: logo and "This product uses the TMDB API but is not endorsed or certified by TMDB." JustWatch attribution for watch providers.
   - Quick start: Node 24.19.0, Yarn 1, `yarn install`, `yarn dev`, `yarn web`.
   - Commands table; links to the docs.
2. **`CLAUDE.md` v2** (F0-A commits the interim version so no stream works under v1's rules; stream C finalizes it, Part W)
   - A status line: "Auto-memory notes about the v1 layers, barrels, the release console, GitHub Pages, Crashlytics or sign-in-gated purchases are historical; `docs/v2/SPEC.md` governs until v2 ships, then this file does."
   - Commands table (§6.6).
   - Architecture (Part A): feature-sliced `src/`, direct imports, the boundaries lint, platform splits only via `.web.ts(x)` twins inside platform adapters.
   - Standing rules:
     - exact pins (strip `^`/`~` after any install command)
     - zero comments (lint-enforced)
     - no agent attribution in commits or PRs
     - display name from `APP_NAME`
     - no catch-and-show crash guards
     - no system dialogs (`Alert.alert`/`window.confirm` are banned; use the confirm provider)
     - `useRouter()` only, and never `router.setParams` from an effect (YIFY‑2R/YIFY‑36)
   - Native: CNG (or tracked `android/` if P‑CNG failed); change native code only through `app.json`, `app.config.js` and `plugins/`; JDK 17; `keystore.properties` handling.
   - Monetization rules:
     - Plus benefits; ad pacing constants live in `adPolicy.ts`
     - never show an ad on or around a YouTube player, never on the play button
     - no remote ad flag
     - no web ads
     - no web checkout without owner sign-off
     - no external payment links on Android
   - Telemetry rules: `reportOperation` for expected failures; never a client-side `purchase` or `ad_impression`; consent gates.
   - Web: SSR on EAS Hosting, `yarn check:web`, the budget.
   - Releases: link to `docs/releases.md`; the runtime is the `version` string, so bump `version` (and `versionCode`) whenever native code changes (C4.8); OTA updates go through `scripts/eas.sh`, which refuses when native inputs changed.
   - Delivery: work on branches; no merge, deploy, submission or console change without the owner.
3. **`AGENTS.md` v2**: three lines. "Read CLAUDE.md. Follow its exact-pin, no-comments and no-agent-attribution rules. There is no OpenSpec and no agent-team process."
4. **`docs/releases.md` v2**
   - When to cut a binary: any native change (C4.8), or native fixes. Target ≤ 2 store releases a month (`research/android.md` budgets).
   - Version codes: `versionCode` is the highest code ever accepted by Play plus one (a failed upload consumes none; an accepted upload consumes it even if it never rolls out). Before a version's first production rollout, a native fix bumps only `versionCode` and keeps `version` (the runtime), which is safe because no OTA update exists yet for that runtime: `eas update:list` must show no Production-channel update for runtime `<version>` (checked at step d).
   - Steps (release step letters of W-I.5):
     - bump `package.json` `version` and `versionCode` (and `APP_VERSION`, which the app-config test keeps equal);
     - `yarn build:android:production`;
     - verify without a Play upload: `bundletool build-apks --bundle <aab> --output v2.apks --ks <upload keystore> --ks-key-alias <alias>` plus the same for the previous version's production AAB, then the §4.14 checklist, the upgrade test, the Sentry production crash, the DEX check and App Links on device;
     - `yarn submit:android:production --id <buildId>`: production track, `draft`;
     - `yarn release:play --version-code <n> --user-fraction 0.2 --images <dir>`: one Play edit with every listing language, the images, the release notes and the production release at 20 % `inProgress`, validated, then committed; `--dry-run` validates and deletes the edit;
     - watch for 48 h. Halt thresholds, counted only for events with `installer:com.android.vending` and a non-zero `split_count` (C4.11): a new Sentry crash issue with ≥ 3 users, a `SoLoader` or `UnsatisfiedLinkError` crash, Play vitals user-perceived crash rate > 1.09 % or ANR > 0.47 % (Play bad-behaviour thresholds), or purchase failures. To halt: `yarn release:play --track-only --halt`. Otherwise expand with `yarn release:play --track-only --user-fraction 0.5`, then `1` (owner approval each time, O-25).
   - After the production build is accepted: tag the built commit `android-v<version>` and push the tag (C4.8).
   - OTA: `yarn update:android --message "..."`, then `npx sentry-expo-upload-sourcemaps dist`. Updates reach only binaries with the same runtime (`version`); `scripts/eas.sh` refuses to publish when native inputs changed since the `android-v<version>` tag.
   - Web deploy: automatic on push to `main` (`deploy-web.yml`, C6.2); manual dispatch for the `v2` preview alias.
   - Firestore rules deploy **before** any release that changes sync.
   - Privacy URL preflight (built into `scripts/eas.sh`).
   - Rollback recipes: halt the rollout (`yarn release:play --track-only --halt`); `eas update:rollback`; point production back at the previous web deployment instantly with `eas deploy:alias --prod --id=<deploymentId>` (docs.expo.dev/eas/hosting/deployments-and-aliases).
5. **`docs/development.md`**
   - Setup: Node, Yarn 1, JDK 17 (not Android Studio's JBR 25), Android SDK.
   - `.env` from `.env.example`. Remove the `YIFY_SUBSCRIBER_*` and `EXPO_PUBLIC_REVENUECAT_IOS_KEY` lines; add `EXPO_PUBLIC_WEB_CHECKOUT`, `EXPO_PUBLIC_ADMOB_MODE`, `EXPO_PUBLIC_ADMOB_TEST_DEVICES`, `EXPO_PUBLIC_DIAGNOSTICS`. The server-side `TMDB_API_KEY` goes in EAS env only.
   - Dev client; `yarn prebuild`; local SSR with `yarn export:web && yarn serve:web`. Local API without a TMDB key: `YIFY_API_FIXTURES=1 yarn web`. Native development builds against the local server: `EXPO_PUBLIC_API_ORIGIN=http://<LAN IP>:8081` and `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=yify-2da67.firebaseapp.com` in `.env.local` (A4.1, A6.1).
   - Parallel worktrees: run `yarn install --frozen-lockfile --cache-folder "$HOME/.cache/yify-yarn/<branch>"` so concurrent installs never share Yarn's cache, and no cache ever lands inside a worktree.
   - Tests, lint, typecheck, budget.
   - Ads QA: test IDs, UMP EEA debug geography, the AdMob Ad Inspector. Launch with `am start`, never monkey.
   - Purchases QA: Play license testers, RevenueCat sandbox.
   - Sentry test crashes (§4.11).
   - Dependabot merge policy (§6.3). Yarn cache collisions: use `--cache-folder` per worktree.
6. **`docs/monetization.md`**: the §1.1 catalog, flows, owner console procedures, pacing constants.
7. **`docs/telemetry.md`**: the §5 consent matrix, event catalog, funnels, KPI table, Sentry alerts.

8. **Legal pages v2** (stream C; the paywall, the trailer panel and the store listing link to them, so they must match v2). Every page wraps the app name in `<span class="app-name">` (Part 0, §0.4), loads `brand.css` and `legal.css`, and keeps its folder twin (`public/privacy/index.html` and so on) identical.
   - `public/privacy.html`:
     - Scope: the Android app and the website at `https://yify.expo.app` only (drop iOS, desktop and `kunal26das.github.io`).
     - §1 and §2, providers and data: Firebase Auth and Cloud Firestore (account, sync); Google Analytics for Firebase (only with consent; a random app instance ID, approximate location from IP, app interactions); Sentry (crash and error reports, no IP stored); Google AdMob with Google's User Messaging Platform (Android ads; advertising ID; EEA and UK consent); RevenueCat (purchases; an anonymous app user ID on Android until you sign in); Google Play (billing and in-app updates); Expo EAS Update (an install ID sent with each update check); Expo EAS Hosting, which runs the website and the API that fetches catalog data from TMDB on the app's behalf, so the app never contacts TMDB itself; images load directly from `image.tmdb.org`; the country hint from the request's IP on the website (Part 0, I-20), never stored on the server; JustWatch data shown through TMDB.
     - A "YouTube API Services" paragraph: "{APP_NAME} uses YouTube API Services to play trailers. When you play a trailer, YouTube receives your IP address and what you watch, and may set cookies. Google's Privacy Policy applies: https://policies.google.com/privacy." (YouTube API Services Developer Policies III.A.2).
     - §7 Children: "{APP_NAME} is not directed to children under 13. We do not knowingly collect personal information from children under 13." Remove "adults aged 18 and over" and the adult-declaration text.
     - "Yify 1.8 and earlier (Android)": until 2.0.0 is at 100 % and no Play track distributes 1.8.x, a section lists what those versions still do (Firebase Crashlytics, location for country detection, local notifications, EAS Insights, and a movie catalog fetched from third-party catalog services through the legacy API). The integrator removes the section after that point (Part 0, I-60; Play requires Data safety and the policy to cover every distributed version).
     - Remove: AdSense, the Buy me a coffee mention, autoplay preferences, "the app connects directly to TMDB".
   - `public/terms.html`:
     - "What {APP_NAME} provides": discovery, trailers, where to watch and a diary; "{APP_NAME} does not host, stream or sell movies or TV shows."
     - Yify Plus: the four benefits (no {APP_NAME} ads on Android, unlimited lists, year in review, accent themes); "Plus list storage has a fair-use limit of 100 lists and 2,000 listed titles per account." (Part 0, I-12); purchases through Google Play; no account needed to buy; cancellation and refunds through Google Play.
     - "YouTube and other external services": "By playing trailers you agree to be bound by the YouTube Terms of Service: https://www.youtube.com/t/terms." (III.A.1).
     - Copyright and takedown contact: the support email, with the information a notice needs.
     - Remove: "You must be at least 18", "Sign-in is required for purchases", "File listings are informational…", the Buy me a coffee paragraph, the web customer-portal and Apple billing text.
   - `public/support.html`: v2 Plus copy (C1.9), no age line, no sign-in requirement, no `/upgrade?source=website` link (point to `/plus`).
   - `public/delete-account.html`: the v2 path "You › Settings › Account › Delete account" and A6.7's behaviour (what is deleted, what remains: the empty `journals/{uid}` barrier and the RevenueCat record on request).
   - `docs/privacy-processing-register.md`: the same provider list.
   - `tests/scripts/legal-pages.test.cjs` fails if any `public/**/*.html` contains `18 or older`, `aged 18`, `adults only`, `For adults`, `File listings`, `Buy me a coffee`, `Sign-in is required for purchases`, `YTS`, `EZTV` or `Nyaa`, or if `privacy.html` lacks `https://policies.google.com/privacy` or `terms.html` lacks `https://www.youtube.com/t/terms`.

---

## C7. Owner actions (consoles and stores only)

Consolidated in Part O. The items that originate here are O-5 (TMDB commercial agreement and server key), O-6 (app-level trader status and terms), O-7 (listing approval), O-8 (target audience and IARC), O-10 (data safety), O-11 (Play benefit text), O-12 (RevenueCat), O-13 (rotate subscriber secrets), O-14 (Stripe), O-15 (Search Console), O-16 and O-16a (GitHub settings), O-17 (Sentry), O-22 (AdMob), O-23 (Firebase restrictions), O-24 (GA4 definitions), O-25 (approvals per milestone), O-20 (name), O-29 (age signals), O-30 (legal URLs in Play Console) and O-32 (identity approval).

---

## C8. Open points

All open points of this part are resolved in Part 0, §0.3: routes (A7.1, A7.2), backend contract (A3.3), notifications (I-37), storage (A5.1), design budget (I-23), Crashlytics removal in the same binary (C4.11), Remote Config removal (no remote ads kill switch; emergency disable is an OTA), packaging (I-38), the iOS patch deletion (F0.3).

# Part W — Work breakdown

The work runs in five phases:

- **F0**, the foundation, in four parts with their own gates: F0-A (reset), F0-B (core and server skeleton), F0-C (design system) and F0-D (shell, contracts and routes), plus spike S1 before F0-D (Part 0, I-58).
- **P1 to P9**, parallel streams in separate worktrees.
- **C**, docs, workflows, legal pages and listing text, in parallel with the P streams.
- **I**, integration, the Identity step and the release.

Part Q is the QA plan the integrator executes.

## W0. Protocol for every stream

- **Baseline.** Before F0-A starts, the integrator tags `3c6d6c1` as `v1-baseline` and pushes the tag (owner approval, O-25). Every v1 citation in this spec refers to that tag: read v1 files with `git show v1-baseline:<path>`. At the same time the owner disables `dependabot-maintenance.yml` on `main` (O-16a), so `main` stops auto-merging while v2 is built.
- **Branches.** F0-A creates `redesign/v2` from `v1-baseline`. Each part and stream works on its own branch and merges into `redesign/v2` through a pull request:
  - foundation: `v2/f0a-reset`, `v2/f0b-core` (first PR `v2/f0b1-core`), `v2/f0c-design`, `v2/f0d-shell`, and `v2/s1-spike`, which is never merged;
  - streams: `v2/p1-server`, `v2/p2-home`, `v2/p3-search`, `v2/p4-title`, `v2/p5-library-sync`, `v2/p6-account-settings`, `v2/p7-monetization`, `v2/p8-web-seo`, `v2/p9-android`, `v2/c-docs`;
  - integrator: `v2/kit-<n>`, `v2/identity`, `v2/release`.

  `redesign/v2` merges into `main` only at release step (c), with the owner's approval.
- **The spec in the tree.** F0-A commits this file verbatim as `docs/v2/SPEC.md`, so every worktree reads the same contract. The integrator removes `docs/v2/` in the release PR; git history keeps it.
- **Instructions.** F0-A replaces `CLAUDE.md` and `AGENTS.md` with interim v2 versions (F0-A step 9), so no agent works under v1's layer, barrel and release-console rules. Auto-memory notes about the v1 layers, barrels, the release console, GitHub Pages, Crashlytics or sign-in-gated purchases are historical on `redesign/v2`; `docs/v2/SPEC.md` governs.
- **Worktrees.** One git worktree per stream, outside the repository folder. Install with `yarn install --frozen-lockfile --cache-folder "$HOME/.cache/yify-yarn/<branch>"`, so concurrent Yarn 1 installs never share a cache (they corrupt it) and no cache lands inside a worktree.
- **Ownership.** A stream edits only the paths it owns (listed per stream). Everything F0 creates outside a stream's list is frozen. No two streams own the same file. The integrator is not a stream: it may change any file, but only through its own PRs (kit changes, requests for frozen files, the Identity step, the release PR).
- **Requests for frozen files and kit changes.** A stream that needs a change to `src/core/**`, a frozen contract or another frozen file writes the request under "Requests for frozen files" in its PR description and tells the integrator. The integrator lands it as a small `v2/kit-<n>` PR within one working day, and the requesting stream rebases. Streams never build local one-offs of kit components (execution review, item 16).
- **Dependencies.** Only F0-A and the integrator change `package.json` and `yarn.lock`. A stream that needs a package files a request; the integrator decides, pins the exact version (`npm view <pkg> version`) and adds it.
- **Contracts.** The signatures in F0.5 are frozen. A stream may add exports to its own `public/` files but must not change or remove an F0.5 signature.
- **v1 sources.** v1 code is deleted from `redesign/v2` by F0-A. "Port" in this spec means: read the file with `git show v1-baseline:<path>` and re-create the logic in the v2 file.
- **Development loop.** `yarn web` serves the app and the `/api/v2` routes from the dev server; until P1 lands, the routes answer from the committed fixtures (F0.7). Android: build a development client once from the F0-D commit (`yarn android` with JDK 17, or `bash scripts/eas.sh build --platform android --profile development`), then `yarn dev`, with `EXPO_PUBLIC_API_ORIGIN=http://<LAN IP>:8081` in `.env.local` (A4.1). Launch the app with `adb shell am start -n io.github.kunal26das.yify/.MainActivity`, never with `adb shell monkey`.
- **Definition of done** (every stream):
  - `yarn check:pins`, `yarn typecheck`, `yarn lint`, `yarn test` and, for streams that change anything web-visible, `yarn export:web && yarn check:web` pass in the worktree;
  - the stream's acceptance criteria below are met and demonstrated in the pull request (test names, screenshots or command output);
  - criteria that need a later stream, a deployment or a Play-installed build are listed in the PR under "Deferred checks" with the step of W-I or Part Q that runs them; W-I.4 collects them;
  - no placeholder text from F0 remains in the stream's own files.
- **Commits and pull requests** carry no agent attribution (no `Co-Authored-By` trailer for an agent, no "Generated with" line), whatever a harness default says; CLAUDE.md wins. Zero code comments. Exact pins.

## W-F0. Foundation (four parts and spike S1; lands before any stream)

### F0.1 Parts, order and gates

| Part | Starts after | Owns at creation | Gate (in the part's worktree) |
|---|---|---|---|
| F0-A Reset | the `v1-baseline` tag | `redesign/v2`; every deletion and move (C6.4, F0.3); `package.json`, `yarn.lock`, `tsconfig.json`, `eslint.config.js`, `.gitignore`, `app.json`, `app.config.js`, `config/**`, `sentry.options.json`, `firebase.json`, `entry.ts`, `.github/workflows/ci.yml`, `tests/setup/**`, `tests/helpers/**`, the moved tests, `tests/plugins/{app-config,firebase-defaults}.test.cjs`, `tests/scripts/brand.test.cjs`, `scripts/check-dependency-pins.mjs`, `scripts/brand/**`, `scripts/eas.sh`, `patches/expo-native/manifest.json`, `src/core/domain/**` (F0.4), `src/core/config/**`, interim `CLAUDE.md` and `AGENTS.md`, `docs/v2/SPEC.md`, the regenerated `android/` | `yarn install --frozen-lockfile` (postinstall included), `yarn check:pins`, `yarn typecheck`, `yarn lint`, `yarn test`, `yarn check:expo`, `cd android && ./gradlew :app:assembleDebug` with JDK 17 |
| S1 spike | F0-A merged | `v2/s1-spike` (never merged) | C3.3 S1 pass criteria; the result is recorded in the F0-D PR |
| F0-B Core | F0-A merged | `src/core/{storage,store,navigation,api,query,platform}/**`, `src/server/**` skeleton, stubs and fixtures (F0.7), `tests/contracts/fixtures.test.ts`, `tests/policy/bannedStrings.cjs` | `yarn typecheck`, `yarn lint`, `yarn test` |
| F0-C Design system | F0-B1 merged | `scripts/fonts/**`, `scripts/icons/**` and their outputs, `src/core/ui/**` except `src/core/ui/document/**`, the kit tests | `yarn typecheck`, `yarn lint`, `yarn test`, `yarn web` renders a kit gallery screen locally (not committed) |
| F0-D Shell, contracts and routes | F0-B, F0-C and S1 | `src/features/**` (F0.5, F0.6), every `app/` file of A7.1, `src/core/architecture.test.ts`, `scripts/check-web-export.mjs` (baseline), `scripts/check-web-budget.mjs` | every gate of I.3 and F0.9 |

F0-B lands its first commits, `src/core/storage`, `src/core/store` and `src/core/navigation`, as an early PR (`v2/f0b1-core`), so F0-C can rebase onto the modules its kit imports (`kv`, `keys`, `hrefs`, `createStore`). The rest of F0-B and all of F0-C then proceed in parallel. F0-C merges after F0-B. Spike S1 runs in parallel with F0-B and F0-C, so the route layout F0-D freezes is the one S1 proved (execution review, item 15). If S1 fails, F0-D writes fallback F1's layout (`web.output: 'static'` with `apiRoutes: true`, twins without loaders) and P8 implements F1 (C3.3).

### F0-A Reset, step by step

1. **Order for a clean first install.** Trim `patches/expo-native/manifest.json` first: keep `reactNative` and the Reanimated `files` entry; drop the 103 `sources` entries and the Google Sign-In `files` entry, which name packages v2 removes. Delete `patches/expo-native/google-signin-spm-exact.patch` and `patches/query-string-compat.md`. Only then write `package.json` (C6.6), run `yarn install` with the cache folder of W0 to regenerate `yarn.lock`, and run `yarn check:pins` (execution review, item 25).
2. **Deletions**, one commit each for runtime, tooling and assets:
   - the v1 runtime: `domain/`, `data/`, `presentation/`, `instrumentation/`, `crashreporting/` and every v1 `app/` file (F0.3);
   - everything in C6.4: the v1 workflows (all except `ci.yml`, which this part writes), the listed scripts, `release/`, `desktop/`, `electron-builder.yml`, `openspec/`, `.agents/`, `config/agent-team.json`, `docs/agents/`, the listed docs, `public/ads.txt`, `public/availability-worker.js`, `public/guide.html`, `public/guide/`, `public/sitemap.xml`, `store-artifacts/screenshots-*`;
   - the v1 tests except the eleven kept (F0.3), `plugins/withCrashlyticsNdk.js`, `assets/images/welcome/` and `assets/images/notification-icon.png`.

   After each commit, `git grep` for every deleted name returns nothing outside `docs/v2/`.
3. **Moves** of the kept tests (F0.3 table). While moving, delete the two comment lines at the top of `tests/firestore-rules.integration.cjs`, and delete the comment at `plugins/withAndroidRelease.js:39`. These were the only lint findings in the kept files (A1.4 notes).
4. **Config:** `tsconfig.json` (A1.3), `eslint.config.js` (A1.4), `app.json`, `app.config.js`, `config/legacy-redirects.json`, `config/webHeaders.cjs` (C4.1), `config/brand.json` (Part 0 §0.4: the B2 placeholder values, `status: "placeholder"`), `sentry.options.json` (C4.11), `firebase.json` (C5.7), `entry.ts` (C5.2), `.github/workflows/ci.yml` (C6.1).
5. **Harness:** `tests/setup/register.mjs` and `tests/helpers/*` (A1.6); `tests/plugins/app-config.test.cjs` (C4.1) and `tests/plugins/firebase-defaults.test.cjs` (C5.7); `tests/scripts/brand.test.cjs` (Part 0 §0.4).
6. **Scripts:** `scripts/check-dependency-pins.mjs` (F0.2); `scripts/brand/stamp-public.mjs` (Part 0 §0.4; `--check` and `--require-final` modes for `check:release`), run once with `yarn brand:stamp` so `public/manifest.json` and `public/brand.css` match `config/brand.json`; the minimal `scripts/eas.sh`, which P9 extends (C4.8):

   ```sh
   #!/usr/bin/env bash
   set -euo pipefail
   ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
   cd "$ROOT"
   if [ -z "${EXPO_TOKEN:-}" ] && [ -f "$HOME/.yify-release.json" ]; then
     EXPO_TOKEN="$(node -e "const fs=require('node:fs');try{process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).token||''))}catch{process.stdout.write('')}" "$HOME/.yify-release.json")"
     export EXPO_TOKEN
   fi
   exec npx --yes eas-cli@27.11.0 "$@"
   ```

   It reads the same `token` field as v1 (`v1-baseline:scripts/eas.sh:17-23`) and needs neither `release/node_modules` nor `eas-with-sentry.mjs`, which this part deletes. Without a token it falls back to an `eas login` session.
7. **Domain and config** (final, F0.4): `src/core/domain/{api,account,keys,library,person,preferences,providers,search,title,slug,dates,legacyUrls}.ts` and `sync/types.ts` with their tests; `src/core/config/{app,brand,legal,seo,telemetry}.ts`.
8. **Icons:** if `scratchpad/icons-v2/final/` exists, copy `repo/**` over the same paths and apply `CHANGES.md` now; otherwise the Identity step does it (I.6).
9. **Interim `CLAUDE.md` and `AGENTS.md`.** `CLAUDE.md` contains:
   - the status line of C6.8 item 2 (v1 auto-memory notes are historical; `docs/v2/SPEC.md` governs);
   - the commands of C6.6;
   - the A1 rules: feature-sliced `src/`, `@/*` maps to `src/*`, no barrels, the import boundaries, twins only in platform folders, erasable TypeScript;
   - the owner rules: exact pins, zero comments, no agent attribution, no system dialogs, `useRouter()` only and no navigation inside effects;
   - the W0 protocol (branches, ownership, requests, definition of done).

   `AGENTS.md` is the three lines of C6.8 item 3. Stream C finalizes both.
10. **Spec copy:** `docs/v2/SPEC.md`.
11. **Android:** `JAVA_HOME=<JDK 17> npx expo prebuild --platform android --clean --no-install`, then `cd android && ./gradlew :app:assembleDebug`; commit the regenerated `android/`. Restore `android/keystore.properties` from its private copy if you have one (prebuild deletes it; it is never committed). `ios/` stays tracked and untouched until P-CNG passes (Part 0, I-41). This build is the first run of Firebase 27.2.0 and the removals; it catches native breakage before any stream starts.

### F0.2 Repository files F0 writes or changes

| Path | Part | Change |
|---|---|---|
| `package.json`, `yarn.lock` | F0-A | C6.6 exactly. `yarn install` with the cache folder of W0; then `yarn check:pins`. |
| `tsconfig.json` | F0-A | A1.3. |
| `eslint.config.js` | F0-A | A1.4. |
| `babel.config.js` | — | unchanged. |
| `metro.config.js` | — | unchanged in F0 (P9 adds the Android resolver of C4.12). |
| `app.json`, `app.config.js`, `config/legacy-redirects.json`, `config/webHeaders.cjs`, `config/brand.json` | F0-A | C4.1; Part 0 §0.4. |
| `sentry.options.json` | F0-A | C4.11 (public DSN, committed). |
| `firebase.json` | F0-A | drop `crashlytics_is_error_generation_on_js_crash_enabled` and `crashlytics_javascript_exception_handler_chaining_enabled`; keep the ten analytics and ad defaults (all `false`) and `firestore.rules`. |
| `entry.ts` | F0-A | `import '@expo/metro-runtime'; import './src/core/platform/telemetry/sentry'; import 'expo-router/entry';` |
| `.github/workflows/ci.yml` | F0-A | C6.1. F0-A deletes every other v1 workflow; stream C writes `deploy-web.yml` and `dependabot.yml`. |
| `scripts/check-dependency-pins.mjs` | F0-A | Manifests checked: `package.json` and `tooling/package.json`. Drop the `check-firebase-compat.mjs` import. Add `checkFirebaseAlignment(root)`: every installed `@react-native-firebase/*` listed in `dependencies` has the same version, and `dependencies.firebase` equals `node_modules/@react-native-firebase/app/package.json` `dependencies.firebase`; otherwise throw `Firebase JS SDK <v> does not match @react-native-firebase/app <v> (expects <v>).` Keep `applyCompatibility({check: true})`. |
| `scripts/check-firebase-compat.mjs`, `scripts/firebase-compatibility.json` | F0-A | delete (I-6 replaces them with the alignment check and `tests/plugins/firebase-defaults.test.cjs`). |
| `patches/expo-native/manifest.json` | F0-A | keep `reactNative: "0.88.1"` and the `react-native-reanimated` `files` entry; remove all 103 `sources` entries (they guard packages that v2 removes, such as `@expo/ui`, `expo-insights` and `expo-location`, and would make `postinstall` fail) and the `@react-native-google-signin/google-signin` `files` entry. P9 later adds the `expo-in-app-updates` entry (C4.5). |
| `patches/expo-native/google-signin-spm-exact.patch`, `patches/query-string-compat.md` | F0-A | delete (iOS only; stale note). |
| `plugins/withCrashlyticsNdk.js` | F0-A | delete. |
| `plugins/withAndroidRelease.js` | F0-A | remove the comment at line 39; no behaviour change. |
| `scripts/brand/stamp-public.mjs`, `public/brand.css` | F0-A | Part 0 §0.4. |
| `scripts/eas.sh` | F0-A | the minimal wrapper of F0-A step 6; P9 adds the preflight and the OTA guard. |
| `CLAUDE.md`, `AGENTS.md`, `docs/v2/SPEC.md` | F0-A | F0-A steps 9 and 10. |
| `scripts/icons/build-icons.mjs`, `scripts/fonts/build-fonts.mjs` and outputs | F0-C | B2.9 and F0.4 (fonts, read from `config/brand.json`). |
| `scripts/check-web-export.mjs` | F0-D | baseline: start `expo serve dist` on a free port with `YIFY_API_FIXTURES=1`; assert `/`, `/search`, `/library`, `/you`, `/plus`, `/title/movie/603-the-matrix`, `/person/6384-keanu-reeves` answer 200 HTML containing `<div id="root">` or the router's root element and no text "18+"; `/api/v2/health` answers 200 JSON with `tmdbKey: "fixtures"`; `dist/client` matches none of `tests/policy/bannedStrings.cjs`. P8 extends it to C3.8. |
| `scripts/check-web-budget.mjs` | F0-D | complete per C3.6 (serves with `YIFY_API_FIXTURES=1`). |
| `android/` | F0-A | regenerated by prebuild (F0-A step 11). |
| `ios/` | — | stays tracked until P-CNG passes (I-41). |

### F0.3 Deletions and moves

Delete (v1 runtime code, replaced by `src/`): `domain/`, `data/`, `presentation/`, `instrumentation/`, `crashreporting/`, and every v1 file in `app/` (`_layout.tsx`, `+html.tsx`, `index.tsx`, `anime.tsx`, `history.tsx`, `journal.tsx`, `movies.tsx`, `shows.tsx`, `preferences.tsx`, `upgrade.tsx`, `watchlist.tsx`, `movie/[id].tsx`, `show/[imdbId].tsx`, `api/catalog/[operation]+api.ts`, `api/subscriber-catalog/[operation]+api.ts`, `api/native-subscriber-catalog/[operation]+api.ts`, `api/availability-alerts/status+api.ts`). A7.1 re-creates the routes that v2 keeps; P1 re-creates the legacy catalog route.

Delete the v1-only assets `assets/images/welcome/` (18+ gate backdrops) and `assets/images/notification-icon.png` (expo-notifications). Every other file in `assets/` stays and is frozen, except `assets/attribution/**` and `assets/brand/**`, which P6 creates, and the icon files the Identity step replaces from `scratchpad/icons-v2/final/repo/` (I.6; decision 13 drops `assets/images/android-icon-background.png`).

Delete every `tests/*.test.cjs` except the eleven below, plus `tests/fixtures/journal-funnel-report.json`, `tests/fixtures/subscription-funnel-report.json` and `tests/helpers/{load-typescript,transpile-typescript,privacy-fixture}.cjs` (replaced by A1.6's helpers). Keep `tests/fixtures/reanimated-lifecycle/` and `tests/fixtures/ump/`.

Move and keep (update relative `require` paths; `../plugins/x` becomes `../../plugins/x`):

| From | To | Owner after F0 |
|---|---|---|
| `tests/android-release-plugin.test.cjs` | `tests/plugins/android-release-plugin.test.cjs` | P9 |
| `tests/core-library-desugaring-plugin.test.cjs` | `tests/plugins/core-library-desugaring-plugin.test.cjs` (reads tracked `android/` until P-CNG rewrites it, C4.13) | P9 |
| `tests/firebase-scene-startup.test.cjs` | `tests/plugins/firebase-scene-startup.test.cjs` | P9 |
| `tests/google-services-version.test.cjs` | `tests/plugins/google-services-version.test.cjs` | P9 |
| `tests/gradle-wrapper.test.cjs` | `tests/plugins/gradle-wrapper.test.cjs` | P9 |
| `tests/hsdp-version-plugin.test.cjs` | `tests/plugins/hsdp-version-plugin.test.cjs` (reads tracked `android/` until P-CNG rewrites it, C4.13) | P9 |
| `tests/ump-metrics-plugin.test.cjs` | `tests/plugins/ump-metrics-plugin.test.cjs` | P9 |
| `tests/expo-native-compat.test.cjs` | `tests/scripts/expo-native-compat.test.cjs` (updated to the trimmed manifest; no `@react-native/js-polyfills`) | P9 |
| `tests/tooling-compatibility.test.cjs` | `tests/scripts/tooling-compatibility.test.cjs` | P9 |
| `tests/live-privacy-preflight.test.cjs` | `tests/scripts/live-privacy-preflight.test.cjs` | C |
| `tests/privacy-request-workflow.test.cjs` | `tests/scripts/privacy-request-workflow.test.cjs` | C |
| `tests/firestore-rules.integration.cjs` | `tests/firestore/rules.integration.cjs` (content unchanged except the two comment lines at the top, which are deleted; not matched by `yarn test`) | P5 |

`tests/expo-v2-proguard.test.cjs` and `tests/web-preview.test.cjs` are deleted in F0-A and re-written by P9 and P8 (they depended on `@xmldom/xmldom` and on v1 server code).

New in F0-A: `tests/plugins/firebase-defaults.test.cjs` (the ten `firebase.json` analytics and ad defaults are `false` and no `crashlytics_*` key exists), `tests/plugins/app-config.test.cjs` (C4.1) and `tests/scripts/brand.test.cjs` (Part 0 §0.4).

### F0.4 `src/core` deliverables

"Final" means the file is complete in F0 and frozen. "Placeholder" means F0 writes the final signature with a simple body that the owning stream replaces.

| Path | Part | Status | Spec |
|---|---|---|---|
| `src/core/domain/{api,account,keys,library,person,preferences,providers,search,title}.ts` | F0-A | final | A2 (with Part 0 changes: accents I-13, legacy keys I-52, `HealthResponse` I-46 and A2.10) |
| `src/core/domain/slug.ts` (+ `slug.test.ts`) | F0-A | final | A3.3.6 (table cases as tests) |
| `src/core/domain/dates.ts` (+ test) | F0-A | final | port of `domain/policies/journal.ts` date helpers (`isJournalDate`, local today) |
| `src/core/domain/legacyUrls.ts` (+ test) | F0-A | final | A7.3 `/movies` mapping (`legacyMoviesToSearch(params): SearchUrlState`), `/shows` mapping, `imdbFromShowDigits(digits)` (zero-pad to 7) |
| `src/core/domain/sync/types.ts` | F0-A | final | `SectionName`, `SyncFailure`, `SyncStatus` (A6.5), `SyncedStoreAccess<S>` (F0.5) |
| `src/core/domain/insights.ts`, `sync/*` codecs, `legacy/*` | — | not in F0 | P5 |
| `src/core/config/app.ts`, `brand.ts`, `legal.ts`, `seo.ts`, `telemetry.ts` | F0-A | final | `APP_NAME = brand.appName` (Part 0 §0.4), `PLUS_NAME = APP_NAME + ' Plus'`, `SITE_ORIGIN = 'https://yify.expo.app'`, `PACKAGE_ID = 'io.github.kunal26das.yify'`, `PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify'`, `APP_VERSION = '2.0.0'`, `AUTH_PROXY_HOSTS = ['yify.expo.app', 'yify--v2.expo.app']`; `PRIVACY_URL = SITE_ORIGIN + '/privacy.html'`, `TERMS_URL = SITE_ORIGIN + '/terms.html'`, `DELETE_ACCOUNT_URL = SITE_ORIGIN + '/delete-account.html'`, `SUPPORT_URL = SITE_ORIGIN + '/support.html'` (the `.html` forms: the folder form `/privacy/` is the URL whose 404 got an update rejected on 2026-09-10, AND-14), `SUPPORT_EMAIL` = the address in the `mailto:` link of `public/privacy.html`; `seo.ts` per C3.2; `telemetry.ts` per A3.2 |
| `src/core/storage/{kv,kv.web,json,keys,legacyV1}.ts` (+ `json.test.ts`) | F0-B (B1) | final | A5.1, A5.2 (key catalogue including `v2.ui.*` and `updates.downloaded.*`), A5.3 (`readV1EntitlementCache`) |
| `src/core/store/createStore.ts` (+ test) | F0-B (B1) | final | A4.6 |
| `src/core/navigation/{urlState,hrefs,searchUrl,singular}.ts` (+ tests for `hrefs` and `searchUrl`) | F0-B (B1) | final | A4.6, A7.2, B1.4.3 |
| `src/core/api/*` (+ tests for `errors`, `decode`, `batch`, `health`, `client`) | F0-B | final | A4.1 (with `fetchHealth` instead of `fetchConfig`, I-47; error classes in `errors.ts`) |
| `src/core/query/*` (+ `retry.test.ts`) | F0-B | final | A4.2, A4.3 |
| `src/core/platform/{appState,network,locale,openUrl,share,haptics}(.web).ts` | F0-B | final | A4.2, A4.4 region, B7 |
| `src/core/platform/auth/*`, `firebase/*` | F0-B | placeholder (signed-out adapter; `signIn()` resolves `false`) | P6 implements A6.1 |
| `src/core/platform/firestore/rest.ts` | — | not in F0 | P5 |
| `src/core/platform/telemetry/{sentry,sentry.web,analytics,analytics.web,events,operations,diagnostics,start,consent}.ts` | F0-B | final | C5 |
| `src/core/platform/updates/storeUpdates(.web).ts` | F0-B | placeholder (`startStoreUpdates()` does nothing) | P9 implements C4.5 |
| `src/core/ui/**` except `document/` | F0-C | final | B1.3–B3 except the feature-local components of I-33; includes `overlays.ts`, `webProps.d.ts`, `layout/webStyle.ts` |
| `src/core/ui/document/WebDocument.tsx` | F0-D | placeholder (spreads `useServerDocumentContext()` and renders the B1.4.5 CSS) | P8 completes it (C3.2) |
| `src/core/architecture.test.ts` | F0-D | final | A1.5 |

Telemetry API (final in F0; C5):

```ts
export type ScreenName = 'home' | 'search' | 'title_movie' | 'title_tv' | 'person' | 'library' | 'you' | 'plus' | 'settings';
export function track(event: AnalyticsEvent): void;
export function trackScreen(screen: ScreenName): void;
export function setUserProperties(properties: {plus?: boolean; signed_in?: boolean}): void;
export function getAppInstanceId(): Promise<string | null>;
export function applyTelemetryConsent(analytics: boolean): void;
export function reportError(error: unknown, context?: {boundary?: string; tags?: Record<string, string>}): void;
export function reportOperation(operation: string, outcome: OperationOutcome, detail?: {error?: unknown; attributes?: Record<string, string | number | boolean>}): void;
export function startTelemetry(): void;
export type DiagnosticKind = 'js_fatal' | 'native_java' | 'native_ndk';
export const DIAGNOSTICS_ENABLED: boolean;
export function triggerDiagnostic(kind: DiagnosticKind): void;
```

`AnalyticsEvent` is the discriminated union of the 24 events of C5.5 (`{name: 'watchlist_add'; params: {content_type: 'movie' | 'tv'; content_id: string; surface: CardSurface}}` and so on, ids formatted `movie:603`). `DIAGNOSTICS_ENABLED` is `process.env.EXPO_PUBLIC_DIAGNOSTICS === '1'`; the test buttons it guards are compiled out of production builds because the condition is inlined at build time.

Fonts (I-23): `scripts/fonts/build-fonts.mjs` reads the three faces of `config/brand.json` `fonts` (`file`: today the placeholders `node_modules/@expo-google-fonts/{lora/600SemiBold/Lora_600SemiBold.ttf,hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf,hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf}`) and writes each face's `web` file (today `public/fonts/Lora-600.woff2`, `public/fonts/HankenGrotesk-400.woff2` and `public/fonts/HankenGrotesk-600.woff2`) with `subset-font` (`targetFormat: 'woff2'`), keeping Basic Latin, Latin-1 Supplement, Latin Extended-A, General Punctuation, `★` (U+2605), `½` (U+00BD), `–` and `—`. Glyphs outside the subset fall back to the CSS stacks of B2.4. `src/core/ui/theme/webCss.ts` emits one `@font-face` per face (`font-display: swap`, family names from `brand.fonts.*.family`); `WebDocument` preloads the body and display faces. Web never calls `useFonts`. Android embeds the TTFs through the `expo-font` plugin (C4.1), so no `useFonts` gate exists on any platform.

### F0.5 Cross-feature contracts (frozen signatures with placeholders)

Every file below is created by F0 with exactly these exports. "Placeholder" describes F0's body; the owner replaces it in its stream without changing the signature. Imports of domain types (`TitleKey`, `EntryKey`, `TitleSnapshot` and the rest) come from `src/core/domain/*`.

Shared types:

```ts
export type SectionName = 'watchlist' | 'diary' | 'lists' | 'recent' | 'preferences';
export type SyncFailure = 'offline' | 'denied' | 'server' | 'oversized' | 'newer-schema';
export type SyncStatus =
  | {state: 'signed-out'}
  | {state: 'idle' | 'syncing'; lastSyncedAt: number | null; pending: boolean}
  | {state: 'error'; failure: SyncFailure; sections: SectionName[]; lastSyncedAt: number | null; pending: boolean}
  | {state: 'deleted'};
export interface SyncedStoreAccess<S> {
  read(): {rev: number; state: S};
  apply(state: S, options: {dirty: boolean}): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
}
```

(`src/core/domain/sync/types.ts`.) `PreferencesSectionState = {values: Preferences; stamps: PreferenceStamps}` is exported from `src/core/domain/preferences.ts`.

Shell (F0, final):

```ts
export function AppRoot(props: {children: ReactNode}): JSX.Element;
export function AppTabBar(props: BottomTabBarProps): JSX.Element;
export function RootErrorBoundary(props: ErrorBoundaryProps): JSX.Element;
```

Files: `src/features/shell/public/AppRoot.tsx`, `AppTabBar.tsx`, `RootErrorBoundary.tsx`. `AppRoot` nests the providers of B1.4.2 and mounts `ConsentPrompt`, `PlusSheetHost` and `AdTransitionHost`; it calls `prepareLocalState()` in a `useState` initializer and `startApp()` from one mount effect (`src/features/shell/start.ts`):

```ts
export function prepareLocalState(): true;
export function startApp(): void;
```

`prepareLocalState` runs `migrateLocalV1()` then `settleImageHost()`. `startApp` is idempotent and calls, in order: `startQueryLifecycle()`, `startTelemetry()`, `startConsent()`, `startSession()`, `startSync()`, `startLegacyResolution()`, `startRegionDetection()`, `startPlus()`, `startAds()`, `startStoreUpdates()`. Each starter schedules its own delayed work (C1.7, C2.7, C4.5). `RootErrorBoundary` calls `reportError(error, {boundary: 'root'})` and renders `ErrorState` (title "Something went wrong", body "{APP_NAME} hit an unexpected problem.", button "Try again" → `retry()`).

`AppTabBar` renders `AdaptiveNavigation` (B3.23) with `headerSearch={<HeaderSearch/>}`, `account` from `useSession()`, `youBadge` (`'billing'` when `usePlus().entitlement.billingIssue`), and fires `trackScreen` on route focus with the mapping of B4.0.2.

Search (owner P3):

```ts
export function useGenres(): {genres: readonly Genre[]; status: 'loading' | 'ready' | 'error'; retry(): void};
export function HeaderSearch(): JSX.Element;
```

Files: `src/features/search/public/useGenres.ts` (final in F0: genres query with the `v2.cache.reference` snapshot), `src/features/search/public/HeaderSearch.tsx` (placeholder: a `SearchField variant="header"` that calls `router.navigate(searchHref({q}))` on submit).

Title (owner P4):

```ts
export function useOpenMedia(surface: CardSurface): (item: MediaCardItem) => void;
export interface AvailabilityState {
  availability: RegionAvailability | null;
  status: 'loading' | 'ready' | 'error';
  updatedAt: number | null;
  retry(): void;
}
export function useAvailability(key: TitleKey | null, region?: RegionCode): AvailabilityState;
```

Files: `src/features/title/public/titleQuery.ts` (final), `useOpenMedia.ts` (final), `useAvailability.ts` (final: availability query through the batcher of A4.1; `region` defaults to `useEffectiveRegion()`). `titleQueryOptions` is:

```ts
export function titleQueryOptions(key: TitleKey, region: RegionCode) {
  return queryOptions({
    queryKey: queryKeys.title(key, region),
    queryFn: ({signal}) => fetchTitle(key, region, signal),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}
```

`useOpenMedia` is:

```ts
export function useOpenMedia(surface: CardSurface): (item: MediaCardItem) => void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const region = useEffectiveRegion();
  return useCallback((item: MediaCardItem) => {
    const target = mediaTarget(item);
    if (target.kind === 'legacy') {
      router.push(searchHref({q: target.title}));
      return;
    }
    void queryClient.prefetchQuery(titleQueryOptions(target.key, region));
    openTitle(() => router.push(titleHref(target.key, target.slug)), {
      source: 'tap',
      surface,
      contentType: target.type,
      contentId: target.id,
      title: target.title,
      posterPath: target.posterPath,
    });
  }, [router, queryClient, region, surface]);
}
```

`mediaTarget(item)` lives in `src/core/navigation/hrefs.ts` and returns `{kind: 'title'; key; type; id; slug; title; posterPath} | {kind: 'legacy'; title}`.

Player (owner P4):

```ts
export interface TrailerFrameProps {
  open: boolean;
  onClose: () => void;
  video: Video;
  title: string;
  titleKey: TitleKey;
  surface: 'title' | 'home';
  backdropPath?: string | null;
}
export function TrailerFrame(props: TrailerFrameProps): JSX.Element | null;
```

File: `src/features/player/public/TrailerFrame.tsx` (placeholder: a `Sheet` titled "Trailer: {title}" with a "Watch on YouTube" button that opens `https://www.youtube.com/watch?v={key}` through `openUrl`).

Library (owner P5):

```ts
export type ToggleResult = 'added' | 'removed' | 'full';
export function useWatchlist<T>(select: (entries: readonly LibraryEntry[]) => T, equals?: (a: T, b: T) => boolean): T;
export function useInWatchlist(key: EntryKey): boolean;
export function toggleWatchlist(key: EntryKey, snapshot: TitleSnapshot): ToggleResult;
export function removeFromWatchlist(key: EntryKey): LibraryEntry | null;
export function restoreWatchlistEntry(entry: LibraryEntry): void;

export interface LogWatchInput {
  key: EntryKey;
  snapshot: TitleSnapshot;
  watchedOn: string | null;
  rating: HalfStars | null;
  note: string;
  rewatch: boolean;
}
export type DiaryPatch = Partial<Pick<DiaryEntry, 'watchedOn' | 'rating' | 'note' | 'rewatch'>>;
export function useDiary<T>(select: (entries: readonly DiaryEntry[]) => T, equals?: (a: T, b: T) => boolean): T;
export function useWatched(key: EntryKey): {watched: boolean; latest: DiaryEntry | null; count: number};
export function logWatch(input: LogWatchInput): DiaryEntry | 'full';
export function updateEntry(id: string, patch: DiaryPatch): DiaryEntry | null;
export function removeEntry(id: string): DiaryEntry | null;
export function restoreEntry(entry: DiaryEntry): void;

export type ListResult = {ok: true; list: UserList} | {ok: false; reason: 'empty' | 'duplicate' | 'max'};
export function useLists<T>(select: (lists: readonly UserList[]) => T, equals?: (a: T, b: T) => boolean): T;
export function useList(id: string): UserList | null;
export function useCustomListCount(): number;
export function createList(name: string): ListResult;
export function renameList(id: string, name: string): ListResult;
export function removeList(id: string): UserList | null;
export function restoreList(list: UserList): void;
export function setListItem(id: string, key: EntryKey, snapshot: TitleSnapshot, included: boolean): void;

export function useRecent<T>(select: (entries: readonly (RecentEntry & {key: EntryKey})[]) => T, equals?: (a: T, b: T) => boolean): T;
export function recordView(key: TitleKey, snapshot: TitleSnapshot): void;
export function removeRecent(key: EntryKey): RecentEntry | null;
export function restoreRecent(key: EntryKey, entry: RecentEntry): void;
export function clearRecent(): RecentState;
export function restoreRecentState(state: RecentState): void;

export function migrateLocalV1(): void;
export function startLegacyResolution(): void;
export function retryLegacyResolution(): void;
export function useLegacyMigrationStatus(): {unresolved: number; noticeVisible: boolean; dismissNotice(): void};

export interface LibraryTarget {key: EntryKey; snapshot: TitleSnapshot}
export function DiarySheet(props: {open: boolean; onClose: () => void; target: LibraryTarget; entryId?: string | null; startNew?: boolean}): JSX.Element | null;
export function AddToListSheet(props: {open: boolean; onClose: () => void; target: LibraryTarget}): JSX.Element | null;
```

Files: `src/features/library/public/{watchlist,diary,lists,recent,migration}.ts`, `DiarySheet.tsx`, `AddToListSheet.tsx`. Placeholder: in-memory `createStore` stores without persistence or limits (`useDiary` returns live entries newest first; `useLists` live lists newest `updatedAt` first); `migrateLocalV1`, `startLegacyResolution` and `retryLegacyResolution` do nothing; `useLegacyMigrationStatus` returns `{unresolved: 0, noticeVisible: false}`; the sheets are a `Sheet` with a "Save" (diary: `logWatch` with today) or one checkbox row per list.

Sync (owner P5):

```ts
export function useSyncStatus(): SyncStatus;
export function syncNow(): void;
export function startSync(): void;
export function prepareSignOut(uid: string): Promise<void>;
export function pauseSync(): Promise<void>;
export function resumeSync(): void;
export function deleteRemoteAccountData(uid: string): Promise<'ok' | 'failed'>;
export function clearLocalAccountData(uid: string): void;
export function useV1ImportStatus(): {lastImportedAt: number | null; running: boolean};
export function importV1Again(): Promise<'ok' | 'failed'>;
```

File: `src/features/sync/public/sync.ts`. Placeholder: status `{state: 'signed-out'}`; every function resolves immediately (`'ok'`).

Account (owner P6):

```ts
export function useSession(): AuthSession;
export function getSession(): AuthSession;
export function subscribeUid(listener: (uid: string | null) => void): () => void;
export function isNewUser(): boolean;
export function signIn(): Promise<boolean>;
export function onAccountDeleted(listener: (uid: string) => Promise<void> | void): () => void;
export function startSession(): void;
export function signOut(): Promise<void>;
export type DeleteAccountResult = 'deleted' | 'cancelled' | 'failed' | 'incomplete';
export function deleteAccount(): Promise<DeleteAccountResult>;
```

Files: `src/features/account/public/session.ts` (all but the last three), `signOut.ts`, `deletion.ts`. Placeholder: the session is `INITIAL_AUTH_SESSION` made ready and signed out; `signIn()` resolves `false`. `session.ts` must never import `features/sync` (I-27).

Settings (owner P6):

```ts
export function usePreferences<T>(select: (preferences: Preferences) => T, equals?: (a: T, b: T) => boolean): T;
export function getPreferences(): Preferences;
export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
export const preferencesSyncAccess: SyncedStoreAccess<PreferencesSectionState>;
export function useEffectiveRegion(): RegionCode;
export function getEffectiveRegion(): RegionCode;
export function useRegionSource(): 'manual' | 'locale' | 'geo' | 'default';
export function startRegionDetection(): void;
export function useRegions(): {regions: readonly Region[]; status: 'loading' | 'ready' | 'error'; retry(): void};
export function useProviderCatalog(region: RegionCode): {providers: readonly CatalogProvider[]; status: 'loading' | 'ready' | 'error'; retry(): void};
export function useMyServices(region: RegionCode): readonly number[];
export function setMyServices(region: RegionCode, providerIds: readonly number[]): void;
export function useConsent(): Consent;
export function getConsent(): Consent;
export function setConsent(patch: Partial<Pick<Consent, 'analytics' | 'youtube'>>): void;
export function isConsentPromptResolved(): boolean;
export function subscribeConsent(listener: () => void): () => void;
export function startConsent(): void;
export function ConsentPrompt(): JSX.Element | null;
export function ServicesPickerSheet(props: {open: boolean; onClose: () => void; region: RegionCode}): JSX.Element | null;
export function CountryPickerSheet(props: {open: boolean; onClose: () => void}): JSX.Element | null;
```

Files: `src/features/settings/public/{preferences,region,streaming,consent}.ts`, `ConsentPrompt.tsx`, `ServicesPickerSheet.tsx`, `CountryPickerSheet.tsx`. Placeholder: preferences in memory with `DEFAULT_PREFERENCES`; region `deviceRegion()`; regions and provider catalog from their queries; consent `DEFAULT_CONSENT`, `isConsentPromptResolved()` returns `true`; `startConsent` calls `applyTelemetryConsent(false)`; the prompt and sheets render `null`.

Monetization (owner P7):

```ts
export type PlusStatus = 'unknown' | 'free' | 'plus';
export type PlusStore = 'play_store' | 'rc_billing' | 'other';
export interface EntitlementSnapshot {
  active: boolean;
  productId: string | null;
  store: PlusStore | null;
  expiresAt: string | null;
  willRenew: boolean;
  billingIssue: boolean;
  managementUrl: string | null;
}
export interface PlusEntitlement extends EntitlementSnapshot {
  status: PlusStatus;
  source: 'none' | 'cache' | 'store';
  appUserId: string | null;
  checkedAt: number | null;
}
export type PaywallPlacement = 'you_card' | 'plus_route' | 'list_limit' | 'insights' | 'ad_free_row' | 'accent_theme';
export type TitleOpenSource = 'tap' | 'deep_link';
export interface OpenTitleInput {
  source: TitleOpenSource;
  surface: CardSurface | 'deep_link';
  contentType: MediaType;
  contentId: number;
  title: string;
  posterPath: string | null;
}
export const PLUS_ENTITLEMENT = 'remove_ads';
export const FREE_CUSTOM_LIST_LIMIT = 3;

export function usePlus(): {status: PlusStatus; entitlement: PlusEntitlement; ensureKnown(): Promise<'free' | 'plus'>; openPaywall(placement: PaywallPlacement): void};
export function getPlusStatus(): PlusStatus;
export function openPaywall(placement: PaywallPlacement): void;
export function canCreateCustomList(input: {customListCount: number; status: PlusStatus}): {allowed: true} | {allowed: false; reason: 'limit'};
export function effectiveAccent<T extends string>(input: {stored: T; status: PlusStatus; fallback: T}): T;
export function insightsAccess(status: PlusStatus): 'full' | 'teaser';
export function startPlus(): void;
export function openTitle(navigate: () => void, input: OpenTitleInput): void;
export function startAds(): void;
export function reportTrailerState(state: 'requested' | 'playing' | 'stopped'): void;
export function useAdPrivacyOptions(): {required: boolean; show(): Promise<void>};
export function PlusSheetHost(): JSX.Element | null;
export function AdTransitionHost(): JSX.Element | null;
```

Files: `src/features/monetization/public/types.ts` (types and the two constants, final), `plus.ts`, `openTitle.ts` (re-exports `openTitle` from `../platform/openTitle`, whose `.web.ts` twin exists from F0), `ads.ts`, `PlusSheetHost.tsx`, `AdTransitionHost.tsx`. Placeholder: status `'free'`, entitlement free with `source: 'none'`; `openPaywall` does nothing; `canCreateCustomList`, `effectiveAccent` and `insightsAccess` are final (pure, C1.11); `openTitle` (both twins) calls `track(select_content)` and `navigate()` immediately; the hosts render `null`; `useAdPrivacyOptions` returns `{required: false}`.

Platform placeholders: `src/core/platform/auth/firebaseAuth.ts` and `.web.ts` export `auth: AuthAdapter` (A6.1) signed out; `src/core/platform/updates/storeUpdates.ts` and `.web.ts` export `startStoreUpdates(): void` doing nothing.

Overlays (F0-C, final, `src/core/ui/overlays.ts`; B3.8):

```ts
export function setPlayerOpen(open: boolean): void;
export function usePlayerOpen(): boolean;
```

`TrailerFrame` (P4) calls `setPlayerOpen`; `SnackbarHost`, `ConsentPrompt` (P6), `PlusSheetHost` (P7) and the update snackbars (P9) read `usePlayerOpen()` and wait while it is `true`. The F0 placeholder `TrailerFrame` calls it too.

### F0.6 Screens and routes (F0-D)

Every route file of A7.1 owned by F0 or P8 is written in F0-D, as a thin adapter of at most 30 lines. The web twins start as plain twins (`export default function MovieRoute() { return <TitleRoute type="movie"/>; }`); P8 adds `loader` and `generateMetadata`. The static route files listed in C3.2 are written with their final synchronous `generateMetadata` (it only calls `staticMetadata()` from `src/core/config/seo.ts`). The API adapters of A3.8 are written against `src/server/**` modules that F0-B created (F0.7), so they typecheck from day one. `app/+html.tsx` renders the `WebDocument` placeholder, which already spreads `useServerDocumentContext()`.

Placeholder screens (owner in brackets). Each exports a named component with the props shown and renders `ScreenScaffold` with the screen title and an `EmptyState` (`icon="info"`, title "{Screen} is being rebuilt", no actions). Owners replace the file.

| File | Export | Owner |
|---|---|---|
| `src/features/home/screens/HomeScreen.tsx` | `HomeScreen()` | P2 |
| `src/features/search/screens/SearchScreen.tsx` | `SearchScreen()` | P3 |
| `src/features/title/screens/TitleRoute.tsx` | `TitleRoute(props: {type: MediaType; initialData?: TitleDetails \| null})` | P4 |
| `src/features/title/screens/SeasonRoute.tsx` | `SeasonRoute()` | P4 |
| `src/features/person/screens/PersonRoute.tsx` | `PersonRoute(props: {initialData?: PersonDetails \| null})` | P4 |
| `src/features/library/screens/LibraryLayout.tsx` | `LibraryLayout()` (F0-D writes the working headless tabs of B1.4.4 with plain section tabs) | P5 |
| `src/features/library/screens/{WatchlistScreen,DiaryScreen,ListsScreen,RecentScreen,ListScreen}.tsx` | same names | P5 |
| `src/features/you/screens/YouScreen.tsx` | `YouScreen()` | P6 |
| `src/features/settings/screens/{SettingsScreen,AppearanceScreen,StreamingSettingsScreen,PrivacySettingsScreen,AboutScreen}.tsx` | same names | P6 |
| `src/features/account/screens/AccountSettingsScreen.tsx` | `AccountSettingsScreen()` | P6 |
| `src/features/monetization/screens/PlusScreen.tsx` | `PlusScreen()` | P7 |
| `src/features/legacy/screens/{LegacyMovieRedirect,LegacyShowRedirect,LegacyMoviesRedirect,LegacyShowsRedirect}.tsx` | same names | P8 |
| `src/features/shell/screens/NotFoundScreen.tsx` | `NotFoundScreen()` (final, B4.15) | F0 |

The shared tab stack layout (B1.4.3), the tabs layout (B1.4.2) and the root layout are final in F0-D.

### F0.7 Server skeleton, stubs and fixtures (F0-B)

- `src/server/env.ts` (A3.3.1, with `YIFY_API_FIXTURES`), `src/server/http/cachePolicy.ts` (A3.2), `src/server/http/params.ts` (the validation table of A3.2), `src/server/http/state.ts` (`getServerState()`, A3.8), `src/server/http/respond.ts` (`withApi` with validation errors, the error envelope, the headers of A3.2, the `FetchBudget` and the log line; admission, deadlines and `report.ts` arrive with P1) — final signatures of A3.8.
- `src/server/endpoints/*.ts`: one exported route function per adapter (`homeRoute`, `discoverRoute`, `searchRoute`, `titleRoute`, `seasonRoute`, `personRoute`, `genresRoute`, `regionsRoute`, `providersRoute`, `availabilityRoute`, `findRoute`, `legacyMovieRoute`, `resolveRoute`, `geoRoute`, `healthRoute`, `imageRoute`). In F0 they answer from fixtures: known ids return the fixture with `X-Yify-Source: fixture` and the route's cache policy; unknown ids return `404 not_found`; `search` filters the fixture titles by a case-insensitive substring of `q`; `discover` returns the fixture page for any parameters; `imageRoute` returns 404; `health` returns `{v: 2, ok: true, upstream: 'ok', legacy: 'ok', tmdbKey: 'fixtures'}`.
- `src/server/tmdb/titles.ts` with the final signatures of A3.3.2 (`getMovie`, `getTv`, `getPerson`, `discover`, `popularPeople`), answering from the fixtures (execution review, item 6). P1 owns it after F0.
- Stubs that P1 and P8 replace (execution review, item 4): `src/server/legacy/catalog/handler.ts` answers `501 {"error":"rebuilding"}`; `src/server/auth/firebaseProxy.ts` answers 501; `src/server/middleware/legacyRedirects.ts` returns `undefined`; `src/server/seo/sitemaps.ts` returns an empty `<sitemapindex>`.
- `src/server/fixtures/v2/`: `home.IN.json`, `home.US.json`, `discover.movie.json`, `discover.tv.json`, `people.popular.json`, `search.json` (12 movies, 6 TV shows, 4 people), `title.movie.603.json`, `title.movie.299536.json`, `title.tv.1399.json`, `season.tv.1399.1.json`, `person.6384.json`, `genres.json`, `regions.json`, `providers.IN.json`, `providers.US.json`, `availability.IN.json`, `availability.US.json`, `find.json` (`tt0133093` → `movie:603`, `tt0944947` → `tv:1399`), `legacyMovie.json` (`8462` → `movie:299536`). Values are real public TMDB metadata (titles, years, poster and backdrop paths, provider names and logo paths) shaped exactly as A2.10. F0-B may record them once with the existing public key through a throw-away script that is not committed; the key never appears in the repository's new files.
- `tests/contracts/fixtures.test.ts` decodes every fixture with the decoders of `src/core/api/decode.ts` and fails on any dropped item.
- `tests/policy/bannedStrings.cjs`: the shared list of A1.5 check 8.

### F0.8 Tests F0 adds

- F0-A: the `slug`, `dates`, `legacyUrls` and `consentPromptDue` unit tests; `tests/plugins/{app-config,firebase-defaults}.test.cjs`; `tests/scripts/brand.test.cjs`; the eleven moved v1 tests.
- F0-B: `json`, `createStore`, `hrefs`, `searchUrl`, `errors`, `client`, `retry`, `decode`, `batch`, `health` and `imageHost` unit tests; `tests/contracts/fixtures.test.ts`.
- F0-C: `windowClass` and one `*.test.cjs` per kit component asserting `role` and `aria-*` props in every state (B6.7).
- F0-D: `src/core/architecture.test.ts`.

Every `.test.ts` loads under Node's strip-only mode: erasable syntax, `import type` for types, JSON through the A1.6 loader.

### F0.9 Acceptance

1. `yarn install --frozen-lockfile` succeeds from a clean clone (postinstall included); `yarn check:pins`, `yarn typecheck`, `yarn lint` (on every file F0 keeps, A1.4 notes), `yarn test`, `yarn check:expo` and `yarn export:web && yarn check:web` pass. F0-A meets the subset in its gate (F0.1); F0-D meets all of it.
2. `yarn web` shows the tab chrome at 390 px (bottom bar), 700 px (rail) and 1,280 px (header) with every placeholder screen reachable, and fixture data visible on any screen F0 wires (`HomeScreen` placeholder may show the fixture `home` rail titles as a list to prove the API path).
3. The Android debug build of F0-D installs on an API 36 emulator and an API 25 emulator, launches, shows the four tabs, and `adb logcat -b crash` is empty.
4. `grep -rn "Platform.OS" src/features app` returns nothing; the architecture test passes; no file under `src/` or `app/` contains a comment.
5. Every F0.5 signature exists and typechecks; every placeholder screen renders.
6. `git ls-files domain data presentation instrumentation crashreporting release desktop openspec .agents` is empty, and `git grep` for every name deleted in C6.4 returns nothing outside `docs/v2/`.
7. `CLAUDE.md` and `AGENTS.md` are the interim v2 versions; `docs/v2/SPEC.md` is present.

### F0.10 Out of scope for F0

The real implementations of every placeholder, the edge API logic, SSR loaders and metadata, sync, migration, purchases, ads, store updates, CNG, the final docs and legal pages (stream C), and the Identity step (I.6).

## W-P. Parallel streams

Each stream starts from `redesign/v2` after F0-D and may run at the same time as every other stream and stream C. "Uses" lists what a stream consumes; everything it consumes from another stream is an F0.5 contract, so it works against the placeholder until integration. "Deferred checks" are acceptance items that only a later stream, a deployment or the release can show; the PR lists them and W-I.4 tracks them.

### P1. Edge API v2 and server

- **Goal.** The real `/api/v2` (A3) on EAS Hosting, the stripped legacy catalog, the Firebase auth proxy, the legacy-URL middleware and the server alerts.
- **Owns.** `src/server/**` except `src/server/seo/**`; `app/api/**`; `app/__/**`; `app/+middleware.ts`; `scripts/dev/tmdb-fixture-server.mjs`; `scripts/check-legacy-contract.mjs`; `tests/contracts/server-*.test.ts`, `tests/contracts/legacy-v1-client.test.ts`, `tests/contracts/v1/**`.
- **Uses.** `src/core/domain/**` (types, `slug.ts`, `legacyUrls.ts`), `src/core/config/**`, `src/core/api/decode.ts` (in contract tests only).
- **Must not touch.** Client code, `src/server/seo/**`, route files outside `app/api`, `app/__` and `app/+middleware.ts`.
- **Deliverables.**
  1. A3.1–A3.6 complete: the TMDB client with `TMDB_API_BASE_URL`, the credentials rule, the isolate cache and last-good, projection, trailer selection, every endpoint of A3.4 including `/img`, admission (port `data/server/catalog/admission.ts` with its test), deadlines (port `cancellation.ts` with its test), the `FetchBudget`, response size caps, the log line, `getServerState()` for every singleton, and `report.ts` (A3.2).
  2. `src/server/tmdb/titles.ts` bodies (TMDB, or fixtures when `YIFY_API_FIXTURES=1`), used by P8.
  3. Legacy catalog A3.7 (`src/server/legacy/catalog/*`, `src/server/legacy/yts/*`, `src/server/legacy/lookup.ts`, `app/api/catalog/[operation]+api.ts`), including the `YIFY_LEGACY_CATALOG=gone` switch, the blocked-fields rule, the vendored v1 parsers and `scripts/check-legacy-contract.mjs`.
  4. `/legacy/movie` and `/resolve` with the title-and-year match (A3.4.12, A3.4.13); `/health` with the legacy probe (A3.4.15).
  5. Firebase auth proxy (A6.1 item 2): `src/server/auth/firebaseProxy.ts` with the header stripping, `app/__/auth/[...path]+api.ts`, `app/__/firebase/[...path]+api.ts`.
  6. Middleware A7.3: `src/server/middleware/legacyRedirects.ts` with relative `Location` headers, `app/+middleware.ts`.
  7. Fixture mode: `YIFY_API_FIXTURES=1` serves `src/server/fixtures/v2/*` (kept from F0) for local development, tests and the CI web checks; no EAS environment sets it.
  8. Recorded raw TMDB fixtures in `src/server/tmdb/fixtures/` (ids 603, 299536, 1399 and its season 1, 6384; trending day and week; popular, now playing, top rated and discover for `IN` and `US`; on the air; genres; regions; providers `IN` and `US`; `find` for `tt0133093`, `tt0944947`, `tt4154756`; `search/movie` for the title-match cases) and synthetic legacy fixtures in `src/server/legacy/yts/fixtures/` whose torrent fields are fake (`"hash": "0000000000000000000000000000000000000000"`, `"url": "https://example.invalid/t.torrent"`), plus `scripts/dev/tmdb-fixture-server.mjs` (serves the TMDB fixtures at `http://127.0.0.1:<port>/3/...`, keyed by path and sorted query without the credential; unknown paths answer TMDB's 404 body `{"success":false,"status_code":34}`).
- **Acceptance.** A10 items 4, 5, 7 and 8; every `/api/v2` route has a handler test with recorded fixtures covering the cases of A10 item 4; `tests/contracts/server-decode.test.ts` runs every endpoint against the fixture server and decodes the output with `src/core/api/decode.ts` without dropped items; `tests/contracts/legacy-v1-client.test.ts` passes for every legacy operation; the resolve test covers an exact title-and-year match, an ambiguous match falling back to the legacy lookup, and a spent fetch budget listing ids in `failed`; the auth proxy test asserts forwarded and stripped headers, `redirect: 'manual'`, `Cache-Control: no-store`, the `frame-ancestors 'self'` CSP on every proxied response and a gzip-encoded upstream; the middleware test covers every row of A7.3 handled by middleware, relative `Location`s and timeouts that fall through; a grep test proves no response, cache key or log line contains the credential.
- **Deferred checks.** A10 item 6 and the legacy contract over HTTP run at spike S2 (P8's first milestone); A10 item 9's installed-1.8.33 check runs at release step (c).
- **Notes.** Server code returns `Response` objects (no runtime import of `expo-server`). The season route rejects `type !== 'tv'` with 404.

### P2. Home

- **Goal.** The Home tab of B4.1 with the data hooks of A4.4 and the offline snapshot of A4.5.
- **Owns.** `src/features/home/**`.
- **Uses.** `src/core/**`; `features/title/public/{useOpenMedia,useAvailability}`; `features/player/public/TrailerFrame`; `features/library/public/{watchlist,diary}`; `features/settings/public/{region,streaming}`; `features/search/public/useGenres`; `features/account/public/session`.
- **Must not touch.** Anything outside `src/features/home/`.
- **Deliverables.** `HomeScreen` and its components (`FeaturedTitle`, the sections), `homeSections.ts` (typed constant of B4.1's table), `useHome`, `useServicesRail`, `useWatchlistOnServices`, the home snapshot (`v2.cache.home.<REGION>`, two regions kept), the offline and outage banner copy of A4.5, the `v2.ui.home` key (Popular toggle), analytics of B4.1. There is no Plus card (Part 0, I-15).
- **Acceptance.** B4.1 layout targets (first rail poster top ≤ 600 dp on 360×800 at font scale 1.0; featured block and first rail within the first 800 px at 1,280 px); A10 item 10 (offline cold start renders the saved Home within 1 s with the offline copy); no carousel, no autoplay; "See all" links match B4.1; the featured "Play trailer" opens `TrailerFrame`; Home renders at font scale 2.0 without clipping (B6.4).
- **Tests.** `homeSections.test.ts` (section order, omissions when rails are missing, services vs no-services branch); `homeSnapshot.test.ts` (write, read, two-region eviction, `initialDataUpdatedAt`); `HomeScreen.test.cjs` (states: loading, snapshot offline, error with no snapshot).

### P3. Search

- **Goal.** Search and browse (B4.3), the expanded-web header search (B3.22, Part 0 I-26) and recent searches.
- **Owns.** `src/features/search/**`.
- **Uses.** `src/core/**` (including `navigation/urlState`, `navigation/searchUrl`); `features/title/public/useOpenMedia`; `features/settings/public/{region,streaming,ServicesPickerSheet}`; `features/library/public/diary` (watched badges).
- **Must not touch.** `src/core/navigation/searchUrl.ts` (frozen; request changes).
- **Deliverables.** `SearchScreen` (start, search and browse modes; chips and sheets; sort; result count announcement; empty and error states), `useSearchResults`, `useDiscoverResults`, `recentSearches.ts` (`v2.search.recent`, 10 terms, case-insensitive dedupe, undo of "Clear all"), `headerQuery.ts` (`registerSearchCommit`), the real `HeaderSearch`, `useGenres` (keep F0's), analytics of B4.3.
- **Acceptance.** The URL is the only state and never inherits saved defaults (UXL-6): opening `/search?q=dune` shows unfiltered results; with a non-empty `q` only Type is offered; switching Type to People clears the other filters with the snackbar; live search commits 300 ms after the last keystroke from the `onChangeText` timer; on expanded web, typing in the header from Home navigates to `/search?q=…` and further typing updates `q` through the registered commit; no `setParams`, `navigate` or `commit` call happens inside an effect (lint plus a test that mounts `SearchScreen`, toggles `AppState` background/foreground and asserts no navigation call happened outside handlers).
- **Tests.** `recentSearches.test.ts`; `SearchScreen.test.cjs` (modes, chips, sheets, counts, announcement throttling); `HeaderSearch.test.cjs` (no Search screen mounted → `router.navigate`; mounted → registered commit; Escape clears).

### P4. Title, season, person and trailer player

- **Goal.** The unified Title page (B4.4), Season (B4.5), Person (B4.6), trailers (B5, C3.7) and the feature-local components of I-33.
- **Owns.** `src/features/title/**`, `src/features/person/**`, `src/features/player/**`.
- **Uses.** `src/core/**`; `features/library/public/*` (watchlist, diary, lists, recent, `DiarySheet`, `AddToListSheet`); `features/settings/public/{region,streaming,consent,CountryPickerSheet,ServicesPickerSheet}`; `features/monetization/public/{openTitle,ads}` (`reportTrailerState`); `features/account/public/session` (sign-in hint).
- **Must not touch.** `features/title/public/{titleQuery,useOpenMedia}.ts` signatures (frozen bodies may change only through the integrator).
- **Deliverables.** `TitleRoute`, `TitleScreen` (header, actions, Where to watch with "Your services" first and the JustWatch line, overview, cast, seasons, more like this, images, details; expanded two-column layout; `documentTitle` from `titleDocumentTitle()`), `ProviderRow`, `ImageViewer`, `SeasonRoute`, `PersonRoute` (`documentTitle` from `personDocumentTitle()`); `useTitle` (header from `summaryCache`), `useSeason`, `usePerson`; `recordView` once per open (skipped while Recent is paused); share; `select_content {content_type: 'person'}` on person links (I-42); `TrailerFrame` (the consent panel with the III.A agreement copy and three links of B5.2, the error panel, the presentations of B5.3, `setPlayerOpen` on open and close) with `TrailerPlayer.tsx` (Android, `react-native-youtube-iframe` 2.4.1 with `YOUTUBE_WEB_VIEW_PROPS` ported from `presentation/player/youtubeWebView.ts` and its test) and `TrailerPlayer.web.tsx` + `youtubeIframeApi.web.ts` (C3.7) in `src/features/player/platform/`; the YouTube error map ported from `presentation/player/PlaybackDiagnostics.ts:3-10` to `src/features/player/youtubeErrors.ts`; `reportTrailerState('requested' | 'playing' | 'stopped')`; the `v2.ui.title` key (sign-in hint shown once).
- **Acceptance.** B4.4 placement target (Where-to-watch heading at or above 560 dp and one provider tile fully visible on 360×800 at font scale 1.0, with a trailer and providers); A10 item 12 on native; a 404 title shows the not-found state; B5.1 rules (nothing over the player, no snackbar or prompt while it is open, tap-to-play only, no player outside the frame, 200×200 dp minimum); C3.7 playback acceptance on Chrome, Firefox, Safari and Android Chrome; with test ads, 20 consecutive "Play trailer" taps never present an ad (B5.4); TalkBack and keyboard passes for find a title, play a trailer, save to Watchlist and undo (B6.7).
- **Deferred checks.** A10 item 12 on web in-app navigation needs P8's loader (W-I.4); C3.7's 7-day `player.start` metric is post-release monitoring (I.5 e).
- **Tests.** `TitleScreen.test.cjs` (states, toggles, undo snackbars, ordering of provider rows and de-duplication against "Your services"); `ProviderRow.test.cjs`; `youtubeWebView.test.ts` (ported); `youtubeErrors.test.ts`; `TrailerFrame.test.cjs` (consent panel → player in one tap, the three links, error panel, `reportTrailerState` and `setPlayerOpen` calls); `PersonRoute.test.cjs` (department segments, grouping by year, "Upcoming" first).

### P5. Library, diary, lists, migration and sync

- **Goal.** Local-first library stores, the v1 migration, insights, the sync engine and the Firestore rules (A2.6, A5.3–A5.4, A6.2–A6.7, B4.7–B4.10).
- **Owns.** `src/features/library/**`, `src/features/sync/**`, `src/core/domain/insights.ts` (+ test), `src/core/domain/sync/**` except `types.ts`, `src/core/domain/legacy/**`, `src/core/platform/firestore/**`, `firestore.rules`, `tests/firestore/**`.
- **Uses.** `src/core/**`; `features/settings/public/preferences` (`preferencesSyncAccess`); `features/account/public/session` (`subscribeUid`, `getSession`); `src/core/platform/auth/firebaseAuth` (`getIdToken`); `features/monetization/public/plus` (`canCreateCustomList`, `insightsAccess`, `openPaywall`); `features/title/public/useOpenMedia`.
- **Must not touch.** `src/core/domain/sync/types.ts`; settings or account files.
- **Deliverables.** The four stores with limits that block new additions and never evict on merge, byte budgets, stamps and undo (A2.6, A5.2; Recent rolls at 500); every library public function of F0.5 including `retryLegacyResolution`; `LibraryLayout`, Watchlist, Watched (diary and insights views), Lists, List detail, Recent; `DiarySheet`, `AddToListSheet`, `ListNameSheet`, `StarRating`, `DatePickerSheet` (B3.16, B3.28 in `src/features/library/components/`); `useDiaryInsights`; `migrateLocalV1` (phase A with the space-first order, owner rules, stashes and the write-failure rule), `startLegacyResolution` (phase B: batches of 12 with titles and years, no transient failure ever final), v1 cleanup at `v1CleanupAt`, the migration banner with "Try again" (I-29), `GA4 library_migration`; the section codecs (A6.4, the diary `normalize` rule for `w1_` marks), the REST transport with per-section reads and caps (A6.5), the engine with triggers and status copy, `importV1` with `importPending` and the hourly v1 change check (A6.6), `prepareSignOut`, `pauseSync`, `resumeSync`, `deleteRemoteAccountData` (barrier then deletes), `clearLocalAccountData`; the `firestore.rules` diff (A6.3, recent budget 150,000) and its emulator suite (A6.3 tests 1–5).
- **Acceptance.** A10 items 14–21; B4.7 targets (first poster within 200 dp of the bar on 360×800); creating a fourth list as a free user calls `openPaywall('list_limit')` (asserted with a spy, because the real sheet arrives with P7) and lists above the limit stay usable; the `Firestore rules` CI job passes; `yarn test` covers the twelve migration fixtures of A5.4.
- **Deferred checks.** The real Plus sheet at the fourth list (after P7 merges, W-I.4); the live-rules checks of Q8 (after release step b); Q5 on device (release step d).
- **Tests.** Ported with their code: `syncMerge`, `historyMerge`, `libraryMerge`, `journal`, `journalInsights`, `historyView`, `watchlistView` tests (renamed per A8.2); new: `convert.test.ts`, `rekey.test.ts`, `migrateLocal.test.cjs` (v1 key fixtures through a mock KV, including write failures and a multi-account device), `engine.test.ts` (409 conflict path, 401 refresh, 403 barrier, oversized section isolated, clamp with a clock one day ahead, a full-budget quote-heavy diary through the REST encoding, an import failure that does not block sections, no polling), `importV1.test.ts` (including the re-import on a newer v1 `updateTime`), store tests per limit copy; the emulator suite in `tests/firestore/rules.integration.cjs`.

### P6. Account, You, settings and consent

- **Goal.** Sign-in on both platforms, sign-out and deletion flows, the You tab, every settings page, preferences, region and consent (A2.7, A4.4, A6.1, A6.7, B4.11, B4.13, B4.14).
- **Owns.** `src/features/account/**`, `src/features/settings/**`, `src/features/you/**`, `src/core/platform/auth/**`, `src/core/platform/firebase/**`, `assets/attribution/**` (the approved TMDB logo), `assets/brand/**` (the Google "G" mark supplied by the owner, O-26).
- **Uses.** `src/core/**`; `features/sync/public/sync`; `features/monetization/public/{plus,ads}` (Plus card, "Ad-free with Plus", `useAdPrivacyOptions`); `features/library/public/migration`.
- **Must not touch.** `src/core/platform/telemetry/**` (call `applyTelemetryConsent` only).
- **Deliverables.** The auth adapters (A6.1: native port of `FirebaseAuthRepositoryImpl.ts` with public `reauthenticate()` and non-reauthenticating `deleteUser()`; web port with the host-derived `authDomain`, lazy SDK, `initializeAuth` with `browserLocalPersistence` and `browserPopupRedirectResolver`, popup first and the redirect flag); `session.ts` (`subscribeUid` emits once when ready; `isNewUser`; `login` and `sign_up` events only after interactive sign-in); `signOut.ts` and `deletion.ts` (A6.7 order); preferences store (`v2.prefs`, per-field stamps, neutral accent ids, `preferencesSyncAccess`); region detection and `/geo` on web; consent store (`v2.consent`, `consentPromptDue`, the session deferral, `applyTelemetryConsent` on start and change); `ConsentPrompt` (B4.13 copy, deferral, hidden while a trailer is open); `ServicesPickerSheet`, `CountryPickerSheet`; `YouScreen` (account card, Plus card per platform, settings list), `SettingsScreen`, `AppearanceScreen` (theme, accent swatches named from `tokens.accentNames` and gated by `effectiveAccent`, trailer captions), `StreamingSettingsScreen`, `PrivacySettingsScreen` (B4.11 copy, "Ad privacy choices" when required), `AccountSettingsScreen` (sync line, v1 import row, sign out, delete), `AboutScreen` (attribution, the YouTube links of B4.14, TMDB logo `assets/attribution/tmdb.svg`, the hidden 7-tap diagnostics row of C4.11 when `DIAGNOSTICS_ENABLED`); GA4 `setting_change`.
- **Acceptance.** The consent prompt shows on a fresh install and once for migrated v1 records, never blocks content, and defers after 60 s or the third title page without setting analytics; changing analytics consent toggles GA4 and Sentry metrics immediately; deletion with a cancelled reauthentication changes nothing; the `/settings/account` route redirects to `/you` when signed out.
- **Deferred checks.** A10 items 20 and 21 end to end need P5's sync (W-I.4); A10 item 22 (web redirect sign-in with third-party storage blocked) runs in Q4 on the `yify--v2.expo.app` alias after O-3b.
- **Tests.** `preferences.test.ts` (per-field stamps, unknown accent decodes to `default`), `consent.test.ts` (the B4.13 cases), `regionDetection.test.ts`, `deletion.test.ts` (step order with mocks of sync and auth; cancel at each step), `session.test.ts` (`subscribeUid` timing, `isNewUser`), `firebaseAuth.web.test.cjs` (`authDomain` per host), screen tests for You and each settings page.

### P7. Plus, purchases and ads

- **Goal.** C1 and C2 complete, the Plus page and sheet of B4.12, and the ad transition surface of B5.4.
- **Owns.** `src/features/monetization/**`.
- **Uses.** `src/core/**`; `features/account/public/session` (`subscribeUid`, `onAccountDeleted`, `signIn`); `features/settings/public/consent` (`isConsentPromptResolved`, analytics consent for the RevenueCat instance-id link).
- **Must not touch.** `features/monetization/public/types.ts` (frozen in F0).
- **Deliverables.** `plusMachine.ts` (+ test, every transition T1–T35 and selector), `plusController.ts` (dispatches `WEB_IDENTIFY_REQUESTED` from `openPaywall`, `/plus`, `ensureKnown()` and the idle check), `platform/purchasesAdapter.ts` and `.web.ts`, `purchaseErrors.ts`, `entitlementCache.ts` (key `plus.entitlement.v1` on both platforms, I-19), `offers.ts` (monthly first and preselected), `copy.ts` (+ `copy.test.ts`, no bare "No ads"), `usePaywall.ts`, `components/PlusOffer.tsx`, `screens/PlusScreen.tsx`, `public/PlusSheetHost.tsx` (waits while a trailer is open); `ads/adPolicy.ts` (+ the 21 tests), `ads/adSession.ts`, `platform/adConsent.ts` and `.web.ts`, `platform/interstitialGateway.ts` and `.web.ts`, `platform/openTitle.ts` and `.web.ts`, `public/AdTransitionHost.tsx` (B5.4 surface, 400 ms), `public/ads.ts`; GA4 events of C5.5 for paywall, purchase, restore, `play_store_open`, `ad_shown`, `ad_skipped`; Sentry metrics of C2.8 and the `purchases.*` operations with `sdk_code` (C5.4).
- **Acceptance.** C1.13 and C2.11 checklists; web `play_link` mode loads `@revenuecat/purchases-js` only after a signed-in user opens a Plus surface or a gate needs the status; with test ads the fourth tap open shows the ad after the 400 ms surface and the title appears on close; a deep link never shows an ad; a Plus tester never initialises the ads SDK; with the consent prompt ignored, UMP runs after its deferral.
- **Deferred checks.** The license-tester purchase rows of C1.13 run in Q4 on a preview build (W-I.4).
- **Tests.** `plusMachine.test.ts`, `adPolicy.test.ts`, `offers.test.ts` (order, preselection, savings and per-month labels), `purchaseErrors.test.ts`, `entitlementCache.test.ts`, `copy.test.ts`, `openTitle.test.cjs` (sequence of C2.6 with a fake gateway and clock), `PlusOffer.test.cjs` (modes `store` and `play_link`, member, pending, billing issue, signed-in and signed-out restore small print).

### P8. Web: server rendering, SEO, legacy URLs and web checks

- **Goal.** C3 except the player (C3.7): server output with loaders and metadata, real 404s, JSON-LD, sitemaps, robots, manifest, header and cache checks, the JavaScript budget, the client legacy resolvers and the web export checks.
- **Owns.** `src/server/seo/**`; `src/features/legacy/**`; `src/core/ui/document/**`; the three web twins of A7.1; `app/sitemap.xml+api.ts`; `app/sitemaps/[name]+api.ts`; `app/+html.tsx`; `public/robots.txt`, `public/manifest.json` (except the fields `yarn brand:stamp` writes), `public/og-card.png`; `scripts/check-web-export.mjs`, `scripts/check-web-budget.mjs`, `scripts/check-web-preview.mjs`, `scripts/check-live-web.mjs`; `tests/web/**`; `tests/scripts/web-preview.test.cjs`.
- **Uses.** `src/server/tmdb/titles.ts` (fixture-backed from F0-B; P1's bodies later), `src/core/domain/**`, `src/core/config/**` (`seo.ts`), `src/core/ui/theme/webCss.ts`, `src/core/navigation/hrefs.ts`, `features/title/screens/TitleRoute`, `features/person/screens/PersonRoute`.
- **Must not touch.** `config/webHeaders.cjs` and `app.config.js` (request changes through the integrator); the icon files under `public/` (Identity step).
- **Deliverables.**
  1. **Milestone 1, spike S2** (C3.3): deploy to the `v2` alias with the owner's go-ahead (O-25) as soon as F0-D merges, and run every S2 check, including the deploy-isolation check of C3.2 and the legacy contract once P1 has merged. This is the first run of the render path on workerd.
  2. `titlePage.ts` and `personPage.ts`: the document versus loader-data branch, `generateMetadata` per C3.2, the relative 301 to the canonical slug, the 404 `Response` with `notFoundHtml`, `publicHost`.
  3. `jsonLd.ts`, `metadata.ts` (sharing `seo.ts`), `securityHeaders.ts`, `sitemaps.ts`.
  4. `WebDocument.tsx`, rendered by `+html.tsx`: it spreads `useServerDocumentContext()` (`htmlAttributes`, `headNodes`, `bodyAttributes`, `bodyNodes`; `node_modules/expo-router/build/server/ServerDocument.d.ts`), without which `generateMetadata` never reaches `<head>`. It also carries the B1.4.5 CSS, the B2.11 theme variables and boot script reading `v2.prefs` and `plus.entitlement.v1`, the font preloads and `@font-face`, `<link rel="manifest">`, `theme-color` and the skip-link target styles.
  5. `LegacyMovieRedirect`, `LegacyShowRedirect`, `LegacyMoviesRedirect` and `LegacyShowsRedirect` (A7.3, B4.16).
  6. `check-web-export.mjs` to C3.8, with the shared banned list, fixture mode, the host and redirect checks; `check-live-web.mjs` (C6.2, `--preview` mode); the rewritten `web-preview.test.cjs`.
- **Acceptance.** C3.3 S1 criteria 1–8 on the final tree; C3.8 checklist; `check-web-budget.mjs` passes (≤ 750,000 bytes brotli for `/`, `/search` and `/title/movie/603-the-matrix`; fonts ≤ 120,000 bytes); B1.4.5 acceptance (server HTML at 360, 700 and 1,280 px shows exactly one navigation variant with JavaScript disabled); every legacy URL row of A7.3 reaches its destination on web; in-app navigation to a title on web paints the header on the first frame (A10 item 12).
- **Fallback F1.** If S1 failed, P8 writes the middleware renderer in `src/server/seo/ssrFallback.ts` and the integrator adds the `/title/*` and `/person/*` patterns and one call to `app/+middleware.ts` (P1-owned); the route twins then drop their `loader` and `generateMetadata`.
- **Tests.** `tests/web/metadata.test.ts` (titles, descriptions, canonical, OG image fallbacks, noindex rules by `X-Forwarded-Host`), `tests/web/titlePage.test.ts` (loader-data requests return `null` with `no-store`; document requests redirect with a relative `Location` and 404 unknown ids), `tests/web/jsonLd.test.ts` (escaping of `<`, actor cap, no `aggregateRating`), `tests/web/sitemaps.test.ts`, `tests/web/securityHeaders.test.ts` (equality with `config/webHeaders.cjs`), `tests/web/legacyResolvers.test.cjs`.

### P9. Android platform

- **Goal.** C4: a verified Android 2.0.0 configuration and release path.
- **Owns.** `app.json`, `app.config.js` (the code; brand values come from `config/brand.json`), `eas.json`, `metro.config.js`, `sentry.options.json`, `firebase.json`, `plugins/**`, `patches/**`, `android/**` (or its removal under CNG), `ios/**` (only its removal under CNG), `config/android/**`, `public/.well-known/assetlinks.json`, `public/app-ads.txt`, `src/core/platform/updates/**`, `tooling/**`, `scripts/eas.sh`, `scripts/check-ota-compat.mjs`, `scripts/play-release.mjs`, `scripts/expo-native-compat.mjs`, `scripts/apply-tooling-compatibility.mjs`, `scripts/run-android-debug.sh`, `scripts/android-java.sh`, `scripts/check-reanimated-lifecycle.mjs`, `scripts/check-ump-metrics.mjs`, `tests/plugins/**`, `tests/scripts/{expo-native-compat,tooling-compatibility,check-ota-compat,play-release}.test.*`, `tests/fixtures/{reanimated-lifecycle,ump}/**`, `.gitignore` (CNG lines only).
- **Uses.** `src/core/ui/components/SnackbarHost` (`showSnackbar`), `src/core/ui/overlays.ts`, `src/core/platform/telemetry` (`track`, `reportOperation`).
- **Must not touch.** `config/legacy-redirects.json`, `config/webHeaders.cjs`, `config/brand.json` (frozen; the integrator owns them).
- **Deliverables.**
  1. C4.3 permissions check; C4.4 predictive back verification.
  2. C4.5: the `expo-in-app-updates` patch and its manifest entry; `storeUpdates.ts` (flexible updates, the throttle key `updates.prompted.<storeVersion>`, the downloaded flag `updates.downloaded.<storeVersion>`, the Restart snackbar, the background install, `app_update` events) and its `.web.ts` no-op.
  3. C4.6 packaging and its rollout gate.
  4. C4.8: the preflight and OTA guard in `eas.sh`, and `check-ota-compat.mjs`.
  5. C4.11: `plugins/withSentryInstallSource.js` and the crash checks on a preview build.
  6. C4.12 `metro.config.js` resolver.
  7. C4.13 proof gate P-CNG and its decision: untrack `android/` and `ios/` only if all four criteria pass, and rewrite the two Gradle-reading plugin tests.
  8. `scripts/play-release.mjs`: a Node 24 script with no dependency, ported from `v1-baseline:scripts/play-upload.sh`. It first runs the live privacy preflight (`scripts/check-live-privacy.mjs` on `PRIVACY_URL`, as `eas.sh` does for submissions), then mints the service-account token with `node:crypto` (RS256 JWT, scope `https://www.googleapis.com/auth/androidpublisher`), then runs `edits.insert`; `edits.listings.list`; `edits.listings.update` (`PUT .../edits/{editId}/listings/{language}`) for every `store-listing/<lang>.json`; `edits.images.deleteall` (`DELETE .../listings/{language}/{imageType}`) and `edits.images.upload` (`POST https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{packageName}/edits/{editId}/listings/{language}/{imageType}?uploadType=media`) for `phoneScreenshots`, `sevenInchScreenshots`, `tenInchScreenshots`, `featureGraphic` and `icon`; `edits.tracks.update` on `production` with `{"releases":[{"versionCodes":["<code>"],"status":"inProgress","userFraction":<fraction>,"releaseNotes":[…]}]}`; `edits:validate`; and `edits:commit`. Any failure deletes the edit. Flags: `--list-languages`, `--dry-run` (validate, then delete), `--track-only --user-fraction <f>`, `--track-only --halt`. The service-account key path comes from `PLAY_SERVICE_ACCOUNT_JSON` (no default in the repository). Image types are `AppImageType` values (developers.google.com/android-publisher/api-ref/rest/v3/AppImageType).
  9. The rewritten `tests/plugins/expo-v2-proguard.test.cjs` (Android assertions only, no `@xmldom/xmldom`).
  10. App Links: `assetlinks.json` lists the Play App Signing certificate (proved with the Play-installed 1.8.33) and the upload certificate (`keytool`), A7.4.
  11. The orphaned v1 WorkManager job check on an upgraded device (A5.4, Q5 step 6).
  12. A GitHub issue with the 2.0.x Play Age Signals module design (C2.4 step 6, O-29); no age-signal code ships in 2.0.0.
- **Acceptance.** C4.14 checklist; C4.3 `aapt2 dump permissions` on the arm64 base APK lists none of the removed permissions; the C4.11 preview-build crash tests pass; `strings index.android.bundle | grep -c rcb-pricing-table` is 0; size within C4.9 targets (arm64 download ≤ 21 MB, installed ≤ 55 MB); cold start TTID p50 of 5 runs recorded; a build installs and launches on API 25 and API 36 emulators; the DEX check of C4.14; `node scripts/play-release.mjs --list-languages` and `--dry-run` (with the current production version code) succeed against Play.
- **Deferred checks.** The production-candidate Sentry crash, App Links on the candidate and Q5 run at release step (d); the 20 % rollout runs at (f).
- **Tests.** `storeUpdates.test.cjs` (throttle, immediate only for priority ≥ 4, the downloaded paths), `check-ota-compat.test.mjs`, `play-release.test.mjs` (the request sequence against a fake server, abandon on failure, refusal when a listed language has no file), `expo-v2-proguard.test.cjs`, the existing plugin tests kept green.

### Stream C. Docs, workflows, legal pages and listing text (parallel with P*)

- **Owns.** `.github/**` except `.github/workflows/ci.yml` (F0-A writes the CI gates because every stream needs them from day one); `docs/**` except `docs/v2/`; `README.md`; the final `CLAUDE.md` and `AGENTS.md` (F0-A writes the interim versions); `.env.example`; `public/privacy.html`, `public/privacy/`, `public/terms.html`, `public/terms/`, `public/support.html`, `public/support/`, `public/delete-account.html`, `public/delete-account/`, `public/legal.css`; `store-listing/**`; `scripts/check-live-privacy.mjs`, `scripts/privacy/**`; `tests/scripts/{live-privacy-preflight,privacy-request-workflow,dependabot-config,legal-pages,store-listing}.test.cjs`.
- **Deletions.** None: F0-A deleted every v1 path (C6.4).
- **Writes.**
  - `.github/workflows/deploy-web.yml` (C6.2); `.github/dependabot.yml` and `tests/scripts/dependabot-config.test.cjs` (C6.3).
  - `README.md`, the final `CLAUDE.md` and `AGENTS.md`, `docs/releases.md`, `docs/development.md`, `docs/monetization.md`, `docs/telemetry.md` (with the farm signatures of C4.11) (C6.8).
  - The legal pages v2 and `docs/privacy-processing-register.md` (C6.8 item 8), with `tests/scripts/legal-pages.test.cjs`; `docs/privacy-requests.md` (v2 Firestore roots).
  - `store-listing/` (B8.1): `en-US.json`, one translated file per current listing language, `banned-words.json`, `release-notes/<lang>.txt`, and `tests/scripts/store-listing.test.cjs`.
  - `.env.example` (C6.8 item 5); the `check-live-privacy.mjs --url` mode; `scripts/privacy/*` roots for the v2 schema (`users/{uid}/sections/*`; drop `availabilityAlertState`).
- **Acceptance.** `CLAUDE.md` states the v2 rules (A1, C6.8 item 2, the version-based runtime rule of C4.8) and `AGENTS.md` is the three lines of C6.8; `tests/scripts/legal-pages.test.cjs` and `store-listing.test.cjs` pass; `check-live-privacy.mjs --url https://yify--v2.expo.app/privacy.html` passes against the preview alias; every listing language Play reports has a file.

## W-I. Integration and release

### I.1 Merge order into `redesign/v2`

Merges follow the dependency graph, not a single line (execution review, item 30):

- Foundation: F0-A; then F0-B1; then the rest of F0-B and F0-C in parallel, with S1 alongside; F0-D after F0-B, F0-C and S1.
- Streams: P1 → P6 → {P5, P7} → P4 → {P2, P3, P8} → P9 → C, where braces mean "in either order".

| Merge | Waits for | Why |
|---|---|---|
| P1 server | F0-D | the web checks, P8's loaders and every client screen need real API responses |
| P6 account and settings | P1 | preferences, region, consent and the session are read by every other feature |
| P5 library and sync, P7 monetization (either order) | P6 | both read the session and consent; P5 calls P7's `openPaywall` only through the F0.5 contract |
| P4 title, person, player | P5 and P7 | uses the library sheets, settings pickers and `openTitle` |
| P2 home, P3 search, P8 web (any order) | P4 | they open titles and render `TitleRoute` |
| P9 Android | P2, P3 and P8 | final native verification on the integrated JavaScript |
| C | P9 | docs describe the final state |

Kit PRs (`v2/kit-<n>`) and the Identity PR (I.6) land whenever they are ready, between stream merges. Rebase each stream on the current `redesign/v2` before its merge. After every merge the integrator runs the gates of I.3 on `redesign/v2`; a red gate blocks the next merge.

### I.2 Hotspots

File-level conflicts cannot happen by construction (no shared files). The integration risks are behavioural:

| Hotspot | What changes at merge | Check |
|---|---|---|
| `yarn.lock`, `package.json` | only F0-A and the integrator change them | `git diff` of every stream PR shows no change to either |
| Placeholders becoming real | `isConsentPromptResolved()` (P6) starts returning `false` on first run, which delays UMP (P7) until the prompt is answered or deferred; `useEffectiveRegion()` changes query keys; `openTitle` starts showing test ads; sync starts network traffic on sign-in | run the Q4 flows after the P6, P5 and P7 merges |
| `start.ts` order | real starters replace no-ops | cold start on Android with `adb logcat` shows no error and TTID within C4.14 |
| `summaryCache` and `initialData` | P4 and P8 both feed the title query | web in-app navigation paints the header without a loader round trip; a document load hydrates without a refetch |
| `WebDocument` and theme CSS | P8 owns the document, F0-C owns `webCss.ts` | no theme flash in light mode (B2.11); one navigation variant at each width; one `<title>` |
| Overlays and the player | P4 sets `setPlayerOpen`; P6, P7 and P9 surfaces read it | no snackbar, prompt or sheet appears while a trailer is open |
| Kit change requests | streams cannot edit `src/core/ui` | the integrator lands each request as a `v2/kit-<n>` PR within one working day; streams rebase |
| Identity | `config/brand.json`, icon files, stamped files | `yarn test` (brand and app-config tests), Q2 light and dark screenshots, `yarn check:release` |
| `main` drift | monthly Dependabot on `main` (from 2026-12-01) and security updates | before step (c), merge `main` into `redesign/v2`, keep v2's `package.json` and `yarn.lock`, and re-apply any security floor from `main` as an exact pin or `resolutions` entry |

### I.3 Gate commands

Run from the repository root of `redesign/v2`, in this order:

```sh
yarn install --frozen-lockfile
yarn check:pins
yarn typecheck
yarn lint
yarn test
yarn check:expo
yarn export:web
yarn check:web
```

Plus, before release: the `Firestore rules` job (or the same command locally with `firebase-tools` 15.36.0), the `Native crash guards` job, `yarn check:release` (once the Identity step has landed), and Part Q.

### I.4 Final wiring checklist

1. `git grep -n "is being rebuilt"` returns nothing (no placeholder screen survives).
2. `git grep -n "YIFY_API_FIXTURES" -- src app` appears only in `src/server/env.ts` and the fixture code paths; no EAS environment sets it.
3. Every F0.5 placeholder body is replaced (the integrator diffs each public file against its F0 version).
4. `config/legacy-redirects.json`, `config/webHeaders.cjs` and `src/server/seo/securityHeaders.ts` agree (P8 test).
5. P-CNG decision recorded in the P9 pull request; `.gitignore` and `docs/development.md` match it.
6. Spike S2 passed on the `v2` alias with the owner's approval (C3.3), including the deploy-isolation check; `HTML_CACHE` raised only if that check passed.
7. Every "Deferred checks" item of every stream PR is either done or scheduled in I.5 with its step.
8. The Identity step (I.6) has landed and `yarn check:release` passes.
9. `main` has been merged into `redesign/v2` (I.2, `main` drift) and the gates of I.3 are green on the result.
10. The owner actions marked "before merge" in Part O are confirmed.

### I.5 Release (decision 13)

| Step | Action | Who | Evidence |
|---|---|---|---|
| (a) | All gates of I.3 green on the final `redesign/v2` commit, plus the parts of Part Q that need no live rules, deployment or release build: Q1, Q2 (local fixtures), Q3 on a preview build, Q6 (static and bundle checks), Q7, Q8 (emulator suite), Q9 (local) and Q10. `yarn check:release` passes (Identity applied, icon files identical to `scratchpad/icons-v2/final/repo/`). | integrator | CI run links; Q report |
| (b) | Deploy the `firestore.rules` change (A6.3) and verify that the live rules match the file. The rules are additive (A6.3 test 5), so the owner may deploy them earlier, once P5's rules pass the emulator suite, to unblock Q4; (b) then re-verifies the live ruleset against the final file. Then run Q4 on preview builds against `https://yify--v2.expo.app` (authorized by O-3b) and the Q8 live checks. | owner (O-1), integrator | Firebase console or REST `GET` of the ruleset; Q4 report |
| (c) | Record the production deployment id serving v1 (rollback: `eas deploy:alias --prod --id=<it>`, A3.7). Merge `redesign/v2` into `main` (owner approval); the integrator removes `docs/v2/` in the same release PR. `deploy-web.yml` deploys the web app and `/api/v2` to production and runs `check-live-web.mjs`, `check-live-privacy.mjs` and `check-legacy-contract.mjs`. The integrator then repeats Q2, Q6 (live API) and Q9 on `https://yify.expo.app` and checks that an installed 1.8.33 build still browses (A10 item 9). | owner + integrator | workflow run; screenshots |
| (d) | `yarn build:android:production` from that exact `main` commit (version 2.0.0, versionCode 116). Without any Play upload: build APKs with `bundletool build-apks --ks <upload keystore>` from this AAB and from 1.8.33's production AAB; run Q5 (fresh install and upgrade over 1.8.33 with v1 data), the C4.14 checklist (including the DEX check and App Links), the production Sentry crash of C4.11 step 3, the screenshots of B8.2, and `eas update:list` showing no Production-channel update for runtime 2.0.0. Tag the commit `android-v2.0.0`. A native fix found here gets a new versionCode only if 116 was already accepted by Play (C6.8 item 4); otherwise rebuild with 116. | integrator + owner | build id; Q5 report |
| (e) | `yarn submit:android:production --id <buildId>`: EAS Submit uploads 116 once, to the production track as a `draft` (C4.2; Part 0, I-51). | owner (O-25) | EAS submission id; Play shows a draft production release |
| (f) | `yarn release:play --version-code 116 --user-fraction 0.2 --images <dir>`: one validated Play edit with every listing language (B8.1), the phone and tablet screenshots, the feature graphic and the 512 px icon (B8.2), the release notes, and the production release set to `inProgress` at 20 %, committed (decision 13 (e) and (f)). Run `--dry-run` first. Then watch 48 h with the farm-filtered halt criteria of C6.8 item 4 (a new Sentry crash issue with 3 or more Play-installed users, a `SoLoader`/`UnsatisfiedLinkError` on a non-template device, user-perceived crash rate above 1.09 % or ANR above 0.47 % in Play vitals, or purchase failures), and the 7-day `player.start` metric of C3.7. Otherwise expand with `--track-only --user-fraction 0.5`, then `1`. | owner (O-7, O-25) + integrator | the edit id; Play Console; Sentry |

The legacy `/api/catalog/*` keeps serving 1.8.x throughout; its sunset is O-21. The 1.8.x section of the privacy policy and the 1.8.x Data safety declarations stay until 2.0.0 is at 100 % and no track distributes 1.8.x (Part 0, I-60).

### I.6 Identity step (integrator; Part 0, §0.4)

**Inputs.** A final direction in `scratchpad/identity/` (tokens for light and dark, five accents, the font families, the icon direction) and `scratchpad/icons-v2/final/` (`repo/` mirroring repository paths, `CHANGES.md`, the 512 px store icon). The owner approves the result (O-32).

**When.** As soon as both inputs exist, and before release step (a): the Q2 screenshots, the B8.2 store screenshots and the feature graphic need it.

**One PR (`v2/identity`)** that:

1. replaces every value in `config/brand.json` and sets `status: "final"`;
2. recomputes the B2.2 contrast table with `spec/B-design-ux-tools/matrix.py` (every text pair at least 4.5:1, every boundary and focus ring at least 3:1) and records it in the PR;
3. adds or swaps font packages with exact pins (`npm view <pkg> version`) when the families change, and rebuilds the fonts (`yarn build:fonts`);
4. copies `scratchpad/icons-v2/final/repo/**` over the same repository paths and applies every edit in `scratchpad/icons-v2/final/CHANGES.md` (the adaptive icon gets a solid background colour and no `android-icon-background.png`, which is deleted);
5. runs `yarn brand:stamp`;
6. writes `store-artifacts/v2/feature-graphic.png` (1024×500) and `store-artifacts/v2/icon-512.png`.

**Acceptance:**

- `yarn test`, including the brand and app-config tests (every asset path exists, no `backgroundImage`), passes;
- `yarn check:release` passes;
- Q2's light and dark screenshots of Home, Title and Settings › Appearance show the new identity;
- `npx expo prebuild --platform android --clean --no-install` succeeds.

If the identity inputs are not final by the time everything else is ready, the release waits: decision 13 requires the new icon, and the placeholder palette is banned (Part 0, §0.4).

# Part Q — QA plan

Part Q runs in four rounds, because some checks need live rules, a deployment or the release build (execution review, item 11):

- **Step (a), final `redesign/v2` commit:** Q1, Q2 (local fixtures), Q3 on a preview build, Q6 (static and bundle checks), Q7, Q8 (emulator suite), Q9 (local) and Q10.
- **After step (b):** Q4 on preview builds against `https://yify--v2.expo.app`, and the Q8 live checks.
- **Step (c):** Q2, Q6 (live API) and Q9 against `https://yify.expo.app`.
- **Step (d):** Q5, and the Q3 and C4.14 checks that need the production candidate.

Results go into the release pull request description; screenshots stay outside the repository.

## Q1. Static gates

The commands of I.3, all green. Also: `git grep -nE "^\s*(//|/\*)" -- '*.ts' '*.tsx' '*.js' '*.cjs' '*.mjs'` returns nothing (the lint rule's backstop), `src/core/architecture.test.ts` passes, and `yarn check:release --icons <path to scratchpad/icons-v2/final/repo>` passes: `config/brand.json` has `status: "final"`, `git grep -niE "#D97757|#9C452B|#F3F0E9" -- config src public app.json` returns nothing, the icon files under `assets/` and `public/` are byte-identical to `scratchpad/icons-v2/final/repo/**`, and nothing references `android-icon-background.png` (Part 0, §0.4).

## Q2. Web: local run and screenshots

Setup (no production traffic). The quick variant answers from the committed v2 fixtures; the second exercises P1's real projections against recorded TMDB responses:

```sh
yarn export:web
YIFY_API_FIXTURES=1 npx expo serve dist --port 8790
```

```sh
node scripts/dev/tmdb-fixture-server.mjs --port 8799 &
yarn export:web
TMDB_API_BASE_URL=http://127.0.0.1:8799/3 TMDB_API_KEY=fixture npx expo serve dist --port 8790
node scripts/check-web-preview.mjs http://127.0.0.1:8790
```

Before navigating, block outbound telemetry in the browser (request blocking for `*.ingest.us.sentry.io`, `*.google-analytics.com`, `*.analytics.google.com`, `www.googletagmanager.com`). Disable colour-altering extensions (Dark Reader inverts screenshots); verify colours with `getComputedStyle`, not by eye. A second pass with a real key (`TMDB_API_KEY` from the integrator's local environment, never committed) checks real artwork and providers.

Capture every route below at **390×844** and **1440×900** in the default dark theme, plus Home, Title (movie) and Settings › Appearance in light theme, and the three B1.4.5 widths (360, 700, 1,280 px) with JavaScript disabled for `/`, `/search` and `/title/movie/603-the-matrix`:

| Route | Expected at a glance |
|---|---|
| `/` | featured title, sections of B4.1, footer (web) |
| `/search` | start mode: recent searches, trending |
| `/search?q=dune` | mixed results, Type chip only |
| `/search?type=movie&genres=878&sort=rating` | browse grid with chips |
| `/title/movie/603-the-matrix` | header, actions, Where to watch above the fold at 390 px, JustWatch line |
| `/title/tv/1399-game-of-thrones` | TV meta line, seasons rail |
| `/title/tv/1399-game-of-thrones/season/1` | episode list |
| `/person/6384-keanu-reeves` | profile, known for, filmography segments |
| `/library` | empty state (fresh profile), then with 3 items |
| `/library/watched`, `/library/watched?view=insights` | diary list; insights teaser for free users |
| `/library/lists`, `/list/<id>` | lists with mosaic; list detail |
| `/library/recent` | grouped by day |
| `/you`, `/plus` | account card, Plus card; web Plus page with the Google Play CTA |
| `/settings`, `/settings/appearance`, `/settings/streaming`, `/settings/privacy`, `/settings/about` | reading width ≤ 720 px |
| `/settings/account` (signed out) | redirects to `/you` |
| `/no-such-page` | 404 page, HTTP 404 |
| `/title/movie/999999999` | 404 page, HTTP 404, `noindex` |

Pass criteria: no horizontal scroll; exactly one navigation variant per width; nothing under the fixed bar or rail; no text over imagery; focus ring visible on Tab; console free of hydration warnings and errors; `document.title` changes on every in-app navigation and the server HTML has one `<title>`; the identity is the final one (no banned palette).

## Q3. Android: release build and emulator smoke

Build: `yarn build:android:production` (EAS) for the release candidate, or locally with JDK 17: `cd android && ./gradlew :app:bundleRelease`. Produce device APKs with bundletool and the upload keystore: `bundletool build-apks --bundle app-release.aab --output v2.apks --ks <upload keystore> --ks-key-alias <alias> --connected-device`, then `bundletool install-apks --apks v2.apks`.

AVDs (images in the host's native ABI: `arm64-v8a` on Apple silicon, `x86_64` elsewhere): `yify-api36` from `system-images;android-36;google_apis_playstore;<abi>` (Pixel 8 profile, gesture navigation) and `yify-api25` from `system-images;android-25;google_apis;<abi>` (Nexus 5X). Create with `avdmanager create avd`, run with `emulator -avd <name> -no-snapshot -no-audio`. Launch only with `adb shell am start -W -n io.github.kunal26das.yify/.MainActivity`; never `adb shell monkey`.

Smoke on `yify-api36` (debug-off release build, test ads through a preview build where ads matter):

1. Cold start: record TTID from `am start -W` five times; Home renders sections; `adb logcat -b crash` is empty.
2. Open three titles: no ad; the fourth tap after 180 s shows the test interstitial after the 400 ms surface (preview build); back from the ad opens the title.
3. Title: Where to watch visible without scrolling more than one screen; Play trailer → consent panel → plays; Close stops audio; no ad appears around the trailer.
4. Watchlist add and undo; Mark watched → "Add details" → half-star rating and date → diary entry.
5. Create three lists; the fourth opens the Plus sheet with test offers.
6. Search "dune"; browse with Genre and Year; person page; season page.
7. You: settings pages; theme light; accent swatches locked; Privacy shows "Ad privacy choices" only when UMP requires it.
8. Predictive back with gesture navigation and with 3-button navigation: sheet, then trailer, then stack; tab root → Home; Home → exits.
9. Font scale 2.0 (`adb shell settings put system font_scale 2.0`): Home, Search, Title, Library, You, Plus sheet and Diary sheet without clipping.
10. Airplane mode cold start after one online launch: saved Home within 1 s with the offline copy.
11. Deep links: `adb shell am start -a android.intent.action.VIEW -d https://yify.expo.app/title/movie/603` (opens the title, no ad), `/person/6384`, `/search?q=dune`, `/plus`, `/movie/8462` (resolves to the title), `/show/944947` (resolves to the TV title).
12. Consent: on a fresh install, leave the privacy card alone; it hides after 60 s (or after the third title page), and on the EEA debug-geography preview build the UMP form follows; no ad, snackbar or card ever appears while a trailer is open.

On `yify-api25`: launch, Home, one title, one trailer (regression for YIFY-2Z, Android 7.1).

At step (d) the production candidate (bundletool APKs signed with the upload key) repeats steps 1, 3, 10 and 11, the C4.14 checks (DEX, App Links, permissions, size) and the production Sentry crash of C4.11 step 3.

## Q4. Cross-platform flows

Q4 runs after release step (b) on preview builds (`yarn build:android:preview`) and on `https://yify--v2.expo.app` (authorized for sign-in by O-3b). License testers can make test purchases on sideloaded builds ("license testers can bypass this check, meaning you can sideload apps for testing", developer.android.com/google/play/billing/test), so the purchase rows need no Play-distributed build.

| Flow | Expected |
|---|---|
| Web redirect sign-in on `yify--v2.expo.app` with third-party storage blocked | completes without a cross-site request to `firebaseapp.com` from the page (A10 item 22) |
| Sign in on Android and web with one Google account | both show the same watchlist, diary, lists, recent and settings after sync; edits on one appear on the other after foreground |
| Concurrent edits | two devices edit the same section offline, reconnect: both converge (A10 item 17) |
| Sign out | confirmation; library and synced settings leave the device; sign in again restores them |
| Delete account | dialog; reauthentication; data gone from Firestore; signed out; the deletion page text matches |
| Plus on Android, signed out | license tester buys monthly; ads stop at once; Plus survives an offline restart |
| Plus then sign in | web shows Plus after signing in with the same account |
| Restore | on a second device with the same account the post-login reconcile runs once |
| Pending purchase | slow test card: pending message, buttons disabled, unlock without restart |
| Consent | first run shows the prompt until answered; "Not now" leaves analytics off; an ignored prompt defers after 60 s or three title pages and returns on the next cold start; the UMP form (EEA debug geography build) appears only after the prompt is answered or deferred |
| Web Plus loading | a signed-in page view without a Plus surface makes no `api.revenuecat.com` request; opening `/plus` loads the SDK once (C1.13) |

## Q5. Upgrade from 1.8.33 with v1 data (release step d)

Unit level (P5): the eight migration fixtures of A5.4 pass.

Device level, at release step (d), on `yify-api36` and on one physical device. Nothing is uploaded to Play for this (Part 0, I-51):

1. Build APKs from 1.8.33's EAS production AAB and from the 2.0.0 candidate AAB with `bundletool build-apks --ks <upload keystore> --ks-key-alias <alias>`, so both carry the same signature, and install 1.8.33 with `bundletool install-apks`. (A Play-installed 1.8.33 carries the Play App Signing certificate and would refuse the upload-key candidate.)
2. Seed: watchlist of five movies, history of ten entries including one show, one collection of three movies with two watched marks, three journal entries while signed in, manual region `IN`, two streaming services, light theme, analytics consent on.
3. Install the v2 candidate over it. Verify without network on first launch: the same watchlist order, diary entries for the journal and watched marks, the list with its items, recent entries, region `IN`, the two services, light theme, consent carried over and the prompt shown once (new notice version).
4. Go online: legacy keys resolve to TMDB titles with artwork; any unresolved title shows "Saved in an older version of Yify" and opens Search; the migration banner appears once if anything stayed unresolved.
5. Sign in: the account's v1 Firestore data imports once (`users/{uid}/sections/meta` written); a second device still on 1.8.33 keeps syncing its own fields, and an edit made there reaches the v2 device within an hour through the v1 change check (A6.6).
6. Orphaned v1 background job: `adb shell dumpsys jobscheduler | grep -i yify`; force any remaining job with `adb shell cmd jobscheduler run -f io.github.kunal26das.yify <jobId>`; no crash, no notification (A5.4). If it crashes, keep `expo-background-task` for one release to unregister the task (A5.4).
7. Multi-account device: seed 1.8.33 with journals for two accounts (sign in as A, add entries, sign out, sign in as B, add entries offline). After the upgrade, A's data is in the library and B's entries return when B signs in (stash, A5.4 phase A step 7).

## Q6. Policy checklist

Web client bundle (`dist/client/**/*.js`, case-insensitive) — no match for:

```
every pattern of tests/policy/bannedStrings.cjs, plus infohash|api\.themoviedb\.org|TMDB_API_KEY|@revenuecat/purchases-js-hybrid-mappings
```

and, case-sensitive, no `RNGoogleMobileAds`. `@revenuecat/purchases-js` may appear only in its lazy chunk.

Android JavaScript bundle (`unzip -p base.apk assets/index.android.bundle | strings`) — no match for the same pattern; `RNGoogleMobileAds` is expected on Android and is not checked; `rcb-pricing-table` count is 0 (C4.12).

Source and copy: `git grep -niE "\byts\b|torrent|free movies|watch movies|watch now" -- src app public ':!src/server/legacy'` returns nothing (the same exemption as A1.5 check 8; legacy identifiers are neutral, Part 0 I-52); "download" appears in UI copy only as "Downloading an update to {APP_NAME}…" (C4.5); no file under `src/` contains the bare string "No ads" (C1.9); `tests/scripts/legal-pages.test.cjs` passes (C6.8 item 8).

Live API: `curl -s https://yify.expo.app/api/catalog/movie?id=8462\&v=2` has `"torrents":[]` and no `downloadCount`; `curl -s -o /dev/null -w '%{http_code}' https://yify.expo.app/api/subscriber-catalog/movies` prints 404.

Product rules: no ad within 30 s of a trailer request (unit test of C2.2 plus Q3 step 3); nothing drawn over the YouTube player, including snackbars and the consent card (screenshots of Q2 and Q3); TMDB notice on About and in the web footer; "Streaming data from JustWatch" on Where to watch and the services picker; no external payment link on Android (`git grep -n "stripe\|buymeacoffee" -- src` only inside the web checkout module behind `EXPO_PUBLIC_WEB_CHECKOUT`); the Android "Manage subscription" row opens only Play URLs (C1.9).

YouTube API Services (C2.9):
- III.A.1: the first-trailer panel and About link `https://www.youtube.com/t/terms`; `terms.html` contains it.
- III.A.2: the first-trailer panel reads "By playing, you agree to the {APP_NAME} Privacy Policy and the YouTube Terms of Service" with the three links of B5.2, and `privacy.html` has the YouTube API Services paragraph linking `https://policies.google.com/privacy`.

## Q7. Budgets

- Web: `node scripts/check-web-budget.mjs dist` — each of `/`, `/search`, `/title/movie/603-the-matrix` at most 750,000 bytes brotli-11 of initial JavaScript; fonts at most 120,000 bytes. Record the per-file table in the report.
- Android: `bundletool get-size total --apks v2.apks` — arm64 download at most 21 MB; installed size at most 55 MB (Settings › Apps › Yify › Storage on `yify-api36`); TTID p50 at most 1.5 s on a mid-range device (C4.14).

## Q8. Firestore rules

The `Firestore rules` job is green on the final commit. After the owner deploys (release step b), use a test account to check through the REST API that a v1-shaped write to `users/{uid}` still succeeds and a v2 write to `users/{uid}/sections/watchlist` succeeds, and that another uid is denied.

## Q9. Legacy URLs

For every row of A7.3, on the local server and again on production: `curl -sI <url>` shows the documented status (301 with `Location`, or 200 for the client resolvers' fallback pages, or 404), and every `Location` starts with `/` or `https://yify.expo.app/` (never a `yify--<deployment>.expo.app` host). On Android, open each with `adb shell am start -a android.intent.action.VIEW -d <url>` and confirm the destination screen.

## Q10. Accessibility

B6.7 manual passes (TalkBack over six flows; keyboard-only over the same flows), the contrast spot-check (`/private/tmp/claude-501/-Users-kunal-GitHub-yify/bcec1b70-927b-4684-9e30-9eaac4e0918d/scratchpad/spec/B-design-ux-tools/matrix.py` after copying values from `tokens.ts`; the tables in B2.2 are the reference if that folder is gone), font scale 2.0 (Q3 step 9), 200 % browser zoom and 200 % text-only zoom (Firefox) on web, and WCAG 2.2 SC 2.4.11: tabbing to the last control above the consent card or a snackbar scrolls it fully into view (B1.4.5).

# Part O — Owner actions

Consoles, stores and accounts only; nothing here is code. "When" is relative to the release steps of W-I.5. Numbers are stable: O-19 is withdrawn, and O-3b, O-16a and O-29 to O-32 were added after the reviews.

| # | Action | Where | Why | When |
|---|---|---|---|---|
| O-1 | Deploy the `firestore.rules` change (A6.3) after the `Firestore rules` CI job is green, and confirm the live ruleset equals the file. Use the REST fallback if the CLI deploy is blocked. The rules are additive, so they may go live as soon as P5's rules pass the emulator suite; step (b) re-verifies them against the final file. | Firebase | Lesson of the 2026-09-04 outage; v2 sync needs the `sections` subcollection | release step (b), or earlier once P5's rules are final |
| O-2 | Create a server-only TMDB key and add `TMDB_API_KEY` to the EAS `production` and `preview` environments with **sensitive** visibility (not secret). Retire the public v1 key after v1 clients are gone. | TMDB, EAS | Server-only TMDB (decision 1); secrets cannot be deployed to EAS Hosting (I-9) | before spike S2 |
| O-3 | Add `https://yify.expo.app/__/auth/handler` to the authorized redirect URIs of the Google OAuth web client used by Firebase Auth; keep `yify.expo.app` in Firebase Auth authorized domains. | Google Cloud, Firebase | Same-origin web sign-in (A6.1) | before the merge |
| O-3b | Add the preview alias `yify--v2.expo.app` to Firebase Auth authorized domains and `https://yify--v2.expo.app/__/auth/handler` to the OAuth client's redirect URIs. | Google Cloud, Firebase | Q4 tests web sign-in on the preview alias before step (c); the web build derives `authDomain` from that host (A6.1) | before Q4 (after step b) |
| O-4 | Remove the EAS environment variables `YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID`, `YIFY_SUBSCRIBER_OWNER_UID`, `YIFY_SUBSCRIBER_REVENUECAT_API_KEY`, `YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS` and the availability-alert variables. | EAS | Subscriber and availability routes are deleted (decision 2) | after the first v2 hosting deploy |
| O-5 | Obtain a TMDB commercial agreement, or written confirmation that a supporter subscription plus ads needs none. | TMDB | TMDB terms (MON-5) | before the production rollout |
| O-6 | Complete App content › "App-level trader status and Terms of Service" for Yify: confirm that the account's trader status applies and enter `https://yify.expo.app/terms.html` (the v2 terms, C6.8 item 8). The account-level trader declaration is already done (confirmed 2026-11-10; MON-8 and SCOPE-6 were refuted). | Play Console › App content | DB-11 | before step (e) |
| O-7 | Approve the listing text in `store-listing/` (English source in B8.1, one file per current listing language, the per-language banned words), the phone and tablet screenshots, the feature graphic and the 512 px icon. The listing is published by the one Play edit of step (f), not by hand. | Play Console (review only) | Decision 13 (f); listing matches v2 (AND-16, UXL-3) | before step (f) |
| O-8 | Set target audience to 13+ (exclude under 13) and redo the IARC questionnaire (likely Teen). | Play Console | Ads and YouTube embeds; the 18+ gate is gone (AND-4); see O-29 for age signals | before the rollout |
| O-9 | GitHub: add the repository secret `EXPO_TOKEN` (environment `production`) for `deploy-web.yml`; confirm `SENTRY_AUTH_TOKEN` and the `EXPO_PUBLIC_*` secrets exist. | GitHub | Merge-to-main deploy (I-8) | before the merge |
| O-10 | Update Data safety in two stages, because the form must cover every version Play distributes and 1.8.x stays live during the staged rollout (Part 0, I-60). **Before step (f), add v2's declarations:** crash logs and diagnostics (Sentry); app interactions, approximate location and the GA4 app-instance ID for analytics (optional, consent); the advertising ID, approximate location and app interactions for advertising and fraud prevention (GMA SDK); the RevenueCat app user ID and purchase history for app functionality; the `EAS-Client-ID` install ID for app functionality (update delivery, C5.1); optional name, email and user IDs (sign-in); other user-generated content (diary notes); the delete-account URL `https://yify.expo.app/delete-account.html`. **After 2.0.0 is at 100 % and no track distributes 1.8.x, remove** location used for app functionality, notifications and Crashlytics. | Play Console | AND-9; Play Data safety covers all distributed versions (support.google.com/googleplay/android-developer/answer/10787469) | stage 1 before step (f); stage 2 after 100 % |
| O-11 | Update the subscription benefit text to "No Yify ads · Unlimited lists · Year in review · Accent themes". Deactivating the one-time `remove_ads_lifetime` purchase option is optional, after launch, and only with your explicit decision (decision 13: no product changes for the release). | Play Console › Monetize | The old copy says "Applies on every signed-in device" | before step (f) |
| O-12 | RevenueCat: confirm restore behaviour is "Transfer to new App User ID"; keep `remove_ads` attached to every product; set the RC Billing support email. Detaching `remove_ads_monthly_web` from `$rc_monthly` is optional, after launch, and only with your explicit decision (v2 web never reads offerings in `play_link` mode). | RevenueCat | C1.4 relies on the default transfer | now |
| O-13 | Rotate and delete the server RevenueCat secret key that the subscriber catalog used. | RevenueCat | The subscriber catalog is deleted | after the first v2 hosting deploy |
| O-14 | Stripe: complete business verification or leave web checkout off permanently. Never set `EXPO_PUBLIC_WEB_CHECKOUT=1` until Stripe can charge, the offering re-attaches the web products and you have signed off. | Stripe, RevenueCat | MON-4, WEB-1 | optional |
| O-15 | Search Console: add the URL-prefix property `https://yify.expo.app/`, verify with an HTML file (the integrator adds `public/google<token>.html`), submit `/sitemap.xml`. | Google Search Console | No property for the canonical domain today (WEB-12) | at the web launch (step c) |
| O-16 | GitHub settings: delete `DEPENDABOT_APP_ID`, `DEPENDABOT_APP_PRIVATE_KEY` and `DEPENDABOT_REBASE_TOKEN`; uninstall the maintenance GitHub App; enable Dependabot security updates; unpublish the project's Pages site. Branch protection already requires exactly the two v2 check names (I-7). | GitHub | TOOL-15, C3.1, decision 5 | at the merge |
| O-16a | Disable the `dependabot-maintenance.yml` workflow on `main` (Actions › the workflow › Disable), and approve the `v1-baseline` tag on `3c6d6c1`. | GitHub | `main` must stop auto-merging while v2 is built; citations refer to the tag (W0) | before F0-A starts |
| O-17 | Sentry: enable "Prevent Storing of IP Addresses" and the default scrubbers; repoint the uptime monitor to `https://yify.expo.app/api/v2/health`; add the alerts of C5.8 (server events, the 5-in-10-minutes metric alert); save the farm-filtered release query (`installer:com.android.vending !split_count:0`); keep spike protection on. | Sentry | BE-10, BE-14, STB-5 | with v2 |
| O-18 | Confirm the store-screenshot artwork policy (public-domain and classic titles, B8.2). | — | AND-16 | before step (f) |
| O-19 | Withdrawn. The icon is decided (decision 13, `scratchpad/icons-v2/final/`) and the palette is replaced by the Identity step (Part 0, §0.4); there is no `#D97757` fallback. | — | — | — |
| O-20 | Reconsider the name. The lead recommends a rename after the second Play suspension; the code is rename-ready (`config/brand.json` plus `yarn brand:stamp`). | — | Decision 3 | open |
| O-21 | Set `YIFY_LEGACY_CATALOG=gone` once versions below 2.0.0 run on fewer than 2 % of active devices for 30 consecutive days (A3.7). This also retires `/api/v2/legacy/movie`, the legacy step of `/resolve` and the legacy health probe. | EAS | Sunset of the legacy catalog and the last YTS-backed code | later |
| O-22 | AdMob: confirm `app-ads.txt` is verified for the listing's developer website; keep the EEA/UK and US-state UMP messages published; set the maximum ad content rating to T; confirm the AdMob app is linked to the Firebase project (automatic `ad_impression`, C2.5). | AdMob | C2.4, C2.5, C2.10 | with v2 |
| O-23 | Firebase: restrict API keys (Android package plus SHA-1s including Play App Signing; browser key to `https://yify.expo.app/*` and `https://yify--v2.expo.app/*`); remove `kunal26das.github.io` from authorized domains after Pages is unpublished; enable Firestore delete protection; keep the Remote Config template until clients at 1.8.16 or older have had no sessions for 90 days, then delete the dead parameters. | Firebase | BE-16, BE-19, BE-20 | after launch |
| O-24 | GA4: register the custom definitions of C5.5; mark the key events; do not mark `in_app_purchase`. Register v1's `phase` parameter of `revenuecat_sync_failed` and check, before the first expansion past 20 %, whether one phase dominates (DB-8). | GA4 | C5.5, C5.4 | with v2 |
| O-25 | Approve each milestone: the `v1-baseline` tag, spike S2 (preview deployment to the `v2` alias), the merge to `main`, the production build, the EAS submission (step e), the listing-and-rollout edit (step f) and each rollout expansion or halt. | — | Decision 13 | per milestone |
| O-26 | Supply the Google "G" mark (`assets/brand/google-g.png`, per Google's sign-in branding guidelines) and the approved TMDB logo if P6 cannot download it from TMDB's logo page. | — | B4.11, A3.6 | before P6 merges |
| O-27 | Optional: move to an organization developer account with a business address and support email instead of the personal address shown on the listing. | Play Console | AND-15 | open |
| O-28 | Confirm `SENTRY_AUTH_TOKEN` exists as an EAS secret for native symbol and source-map uploads during EAS builds. | EAS | C4.11 | before step (d) |
| O-29 | Get a legal determination of the California AB 1043 and Brazil (ECA Digital) age-signal duties for a 13+ app with ads and analytics. Play's 2026-11-19 notice makes sharing age signals mandatory for those users from January 2027 (`research/android.md` §2.7). The result scopes the 2.0.x Play Age Signals module (C2.4 step 6). | legal adviser, Play Console | AND-4 | before 2026-12-31 |
| O-30 | Point Play Console's privacy policy URL and the Data safety "delete account" URL at `https://yify.expo.app/privacy.html` and `https://yify.expo.app/delete-account.html` (the folder form `/privacy/` 404'd on 2026-09-10 and caused a rejection). | Play Console | AND-14 | before step (f) |
| O-31 | Decide what builds 1.8.16 and older show. Recommended: give the Remote Config parameter `base_url_yify` a conditional value for `app.version` below 1.8.17 of `https://yify.expo.app/api/v1-retired`, so their movie catalog fails closed instead of showing swarm data. Their TV feed uses a host compiled into the app and cannot be switched off. The alternative is to accept the cohort until it ages out (A3.7). | Firebase Remote Config | Decision 2 for clients the server cannot reach | before step (c) |
| O-32 | Approve the final visual identity (palette, fonts, accent names) and the new icon before the Identity step lands (I.6). | — | The owner rejected the v1 look on 2026-11-26 | before step (a) |

# Part R — Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-1 | Shared routes with `.web.tsx` twins, loaders and `generateMetadata` inside the array group `(home,search,library,you)` misbehave under `web.output: 'server'` (wrong group, missing metadata, hydration mismatch), or the render path fails on workerd. | medium | high: titles lose SEO and unfurling | Spike S1 runs on exactly this tree before F0-D freezes the routes (C3.3, Part W); S2 on the `v2` alias is P8's first milestone and the first workerd run; fallback F1 serves the same HTML from `+middleware.ts` without route twins; the B tree itself is the documented "One screen, two tabs" pattern. | integrator, P8 |
| R-2 | Server code leaks into the client bundle through a route twin. | low | high: TMDB fallback key and server code shipped to browsers | Dynamic `import()` inside `loader`/`generateMetadata` (I-28); architecture test bans static `@/server` imports in `app/**/*.tsx`; `check-web-export.mjs` greps `dist/client` for `api.themoviedb.org` and `TMDB_API_KEY`. | P8, F0 |
| R-3 | Dropping `useLegacyPackaging` brings back SoLoader startup crashes on real devices. | low (evidence points to emulator farms) | high | 20 % staged rollout; halt on any `SoLoader`/`UnsatisfiedLinkError` from a non-template device; Sentry native init now captures pre-JS crashes; one-line revert in a hotfix binary (C4.6). | P9, owner |
| R-4 | Sentry native init misses crashes after Crashlytics is removed in the same binary. | low | medium | Four test crashes on a preview build, and a crash on the production candidate with environment `production` and release `2.0.0 (116)`, gate the submission (C4.11). | P9 |
| R-5 | The v1 → v2 migration loses or duplicates data on upgrade. | medium | high: users' watchlists and diaries | Phase A is synchronous, deterministic and merge-based with crash-after-each-step tests; v1 keys stay untouched for 30 days so a fixed build can re-run it; Q5 device tests with seeded data. | P5 |
| R-6 | Firestore rules deployed late or wrong break sync for v1 or v2 clients. | low | high | Rules are additive; emulator suite includes the v1-write regression; deploy is release step (b) before the merge; Q8 live checks. | P5, owner |
| R-7 | The Firebase 27.2.0 bump (published 2026-11-25) carries a regression. | low | medium | It ships only in the 2.0.0 binary; F0-A builds it and F0-D runs it on API 25 and API 36; preview builds, Q4 and the production candidate at step (d) precede the 20 % rollout; the pin checker keeps the JavaScript SDK aligned. | F0, P9 |
| R-8 | TMDB rate limits or an outage take the catalog down. | low | high | Edge `stale-while-revalidate` and `stale-if-error`, isolate last-good, the persisted Home snapshot, the client circuit breaker, `Retry-After` (A3.2, A3.3.3, A4.2, A4.5); uptime monitor on `/api/v2/health` (O-17). | P1 |
| R-9 | `TMDB_API_KEY` set with the wrong visibility silently falls back to the public key. | medium | low | `/api/v2/health` reports `tmdbKey`; `check-live-web.mjs` requires `env` after every production deploy. | P1, owner |
| R-10 | Web JavaScript stays above the 750 KB budget. | medium | medium: slow web | Budget gate in CI; levers in C3.6 with owners; phase 2 levers are not gating. | P8, F0 |
| R-11 | A third Play enforcement action because of the "Yify" name or leftover torrent signals. | medium | critical | Every torrent surface and string removed and grepped (Q6); listing and screenshots refreshed (O-7); the lead's rename recommendation stands (O-20). | all, owner |
| R-12 | Ad pacing or placement breaches AdMob or YouTube policy (accidental clicks, gating playback). | low | high | Tap-open only with a 400 ms pre-ad surface, never near a trailer, never on deep links (C2); 21 policy tests; test ads in preview builds. | P7 |
| R-13 | A merge-to-main deploy ships a broken web app or API. | medium | high: web users and every 1.8.x client (legacy catalog) | Required checks plus `check:web` before deploy; the vendored v1 parsers run against the legacy handler in CI, the preview alias and production (A3.7); live checks after deploy; instant rollback with `eas deploy:alias --prod --id=<previous deployment id>` (id recorded before step c). | P1, integrator |
| R-14 | An OTA is published to a runtime whose native code changed. | low | high: crashes on launch | Version-based runtime plus the `check-ota-compat.mjs` guard in `eas.sh` (I-40). | P9 |
| R-15 | Parallel streams diverge from frozen contracts or need kit changes. | medium | medium | F0.5 signatures frozen and typechecked; requests for frozen files go through the integrator; merge order I.1 with full gates after each merge. | integrator |
| R-16 | Web lazy-route chunks fail after a new deployment for tabs opened before it (AsyncRequireError, STB-12). | medium | low | Accepted (deploys are rare and the owner rejects catch-and-reload guards); revisit if Sentry shows the error after deploys. | integrator |
| R-17 | Old signed-in v1 web tabs fail catalog requests until reloaded. | high | low | Accepted (I-22); a reload loads v2. | — |
| R-18 | Google sign-in on the web regresses with the same-origin auth domain. | medium | medium | Proxy tests including a gzip upstream (P1); the host-derived `authDomain` (A6.1); the third-party-storage-blocked check in Q4 on the authorized `v2` alias; OAuth redirect URI owner actions (O-3, O-3b). | P1, P6 |
| R-19 | The identity or icon workflow is not final when everything else is ready. | medium | high: the release waits | The placeholder palette is banned and `yarn check:release` blocks step (a); the Identity step is one PR because every brand value lives in `config/brand.json` (Part 0, §0.4); the owner approves early (O-32). | integrator, owner |
| R-20 | EAS Hosting enforces a lower per-request subrequest limit than the 40-fetch budget. | low | medium: `/resolve`, `/availability`, sitemaps fail | Every handler counts its upstream fetches and degrades to `failed` lists (A3.2); S2 measures a 40-fetch invocation before release. | P1, P8 |
| R-21 | The single Play edit of step (f) fails validation (for example a missing language file or an image that breaks a rule). | medium | low: the release waits a day | `--dry-run` validates and deletes the edit first; `scripts/play-release.mjs` refuses to run when Play lists a language without a file; `--list-languages` runs in P9 and stream C. | P9, C |
| R-22 | Play's age-signal requirement (January 2027) lands before the 2.0.x module. | medium | medium | Legal determination by 2026-12-31 (O-29); the module design is filed by P9 (C2.4 step 6); ads and analytics settings for under-18 users are specified. | owner, P9 |

# Appendix D — Review dispositions

Three independent reviews of this spec ran on 2026-11-26: technical feasibility (`spec/review-feasibility.md`, 20 items), product, policy and defect coverage (`spec/review-coverage.md`, 29 items) and execution and migration safety (`spec/review-execution.md`, 30 items). Every item is listed here. "Applied" means the reviewer's fix is in the named sections; "Applied, changed" says how the integrator's version differs and why; "Rejected" and "Deferred" give the reason.

## D.1 Rejected or deferred

| Review item | Disposition | Reason |
|---|---|---|
| Execution 23: final redirect-only GitHub Pages deploy, kept published | **Rejected** | Decision 5 deletes the GitHub Pages deployment, and a published stub is still one. C3.1 keeps the research rationale: the project site had at most 7 users in 90 days and its deep links already 404. The owner unpublishes it (O-16). |
| Coverage 25: `plugins/withoutAmazonStore.js` (Gradle exclude of `purchases-store-amazon`) | **Deferred to 2.0.x** | Excluding a module that `purchases-hybrid-common` references needs R8 `-dontwarn` rules and an on-device purchase regression, for about 291 KB of DEX. The 2.0.0 binary already removes Crashlytics, changes native packaging and bumps Firebase; the saving does not justify one more native risk in it. It goes into the same later batch as DEP-9 (`buildFromSource`). AND-7 and DEP-8 stay "Partial" in Appendix T. |

## D.2 Applied with a change

| Review item | Integrator's version |
|---|---|
| Feasibility 8 (keep the internal upload, promote 116 through the Play API) | No internal upload at all. Step (d) verifies bundletool APKs signed with the upload key; both 1.8.33 and 2.0.0 are built that way, so the upgrade path is tested. EAS Submit then puts 116 on the **production** track as a draft (decision 13 (e) names the production track), and one Play edit starts the 20 % rollout together with the listing (decision 13 (f)). The two other reviews asked for this shape. The reviewer's concerns are covered elsewhere: license testers can buy on sideloaded builds (Q4, developer.android.com/google/play/billing/test); App Links verify for the upload key because `assetlinks.json` lists it (A7.4); the production Sentry check runs on the candidate (C4.11). |
| Coverage 6 (Play Console "Promote release" for an internal soak) | Not needed: nothing goes to the internal track (I-51). |
| Coverage 7 (`scripts/play-listing.mjs`) | The same Play calls live in `scripts/play-release.mjs`, which also sets the production rollout, so the listing and the release are one validated edit (I.5 f). |
| Coverage 12 (patch, or a user-started update) | Option (a), the patch. Two facts favour it: `startUpdate()` already completes a downloaded update through `requestCompleteUpdate()`, and Google's guide asks for a confirmation or a background install (C4.5). |
| Coverage 16 (fail closed or accept builds 1.8.16 and older) | The integrator recommends failing closed and leaves the switch to the owner, because it is a Remote Config change (O-31, A3.7). |
| Coverage 20 (drop the Home card; keep the web header link only with sign-off) | Both are dropped, so the paywall entry points are exactly decision 6's list (I-15). |
| Execution 1 (split F0 into A, B, C and D) | Applied. `src/core/domain` and `src/core/config` moved into F0-A, and F0-B lands an early `F0-B1` PR (storage, store, navigation), so F0-B and F0-C really run in parallel (Part W, F0.1). |
| Execution 3 (port `play-upload.sh` as `scripts/play-release.sh`) | Ported as `scripts/play-release.mjs` (Node 24 built-ins, no dependency); the v1 shell script is deleted with the other v1 tooling (C6.4). |
| Execution 6 (synthesized `discover` pages 1–25 for P8) | Fixture mode returns the fixture page for every page, and sitemaps de-duplicate, which is enough for the sitemap checks (A3.3.2, C3.4). |
| Execution 9 (cap = requested budgets × 1.5 + 64 KiB) | One `GET` per section with `2 × budget + 65,536` characters (the feasibility review's factor, more headroom for quote-heavy notes); v1 documents at 2,162,688 characters (A6.5). |
| Execution 11 (deploy rules as soon as P5's rules are final) | Decision 13 keeps (b) after (a). The owner **may** deploy the additive rules earlier to unblock Q4, and (b) re-verifies them (I.5, O-1). |
| Execution 15 (run S1 inside F0-A) | S1 runs right after F0-A, in parallel with F0-B and F0-C, and before F0-D writes the route files: the same effect, without lengthening F0-A (Part W, F0.1). |
| Execution 19 (diary cap 2,500; state the history cut to 200) | Diary 2,500 as asked. The Recent cut is not stated but **removed**: Recent keeps 500 entries with a 150,000-byte budget, because decision 11 migrates existing history (A2.6, A6.2, I-59). |
| Execution 21 ("Match old titles again" in Settings) | The action is "Try again" on the Watchlist migration banner, where unmatched titles are shown (B4.7, A5.4). |
| Execution 22 (re-import on newer v1 `updateTime`, at most hourly) | Applied, and it stops after the legacy sunset (A6.6). |
| Feasibility 3 (cap HTML at `s-maxage=600` until S2) | `HTML_CACHE` is `public, max-age=0, s-maxage=600, stale-while-revalidate=600`; a longer value needs the S2 deploy-isolation check (C3.2). |

## D.3 Applied as proposed

| Review | Items | Where |
|---|---|---|
| Feasibility | 1 erasable syntax, `import type`, JSON loader, platform header, warning flag | A1.2, A1.3, A1.6, A3.3.2, A4.1 |
| Feasibility | 2 Node globals and comment removal | A1.4, Part W F0-A step 3 |
| Feasibility | 4 `X-Forwarded-Host`, relative redirects, live checks | A3.1, A3.8, A7.3, C3.2, C6.2 |
| Feasibility | 5 document versus loader-data requests | C3.2, A7.1, A10 item 12, S1 criteria |
| Feasibility | 6 static-route metadata and client titles | C3.2, B3.27, A1.5 check 6 |
| Feasibility | 7 Firestore REST caps | A6.5, A6.6 |
| Feasibility | 9 icon set, asset-path test | Part 0 §0.4, C4.1, I.6 |
| Feasibility | 10 subrequest budget | A3.1, A3.2, A3.4.10, A3.4.13, S2 |
| Feasibility | 11 `globalThis` state | A1.2, A3.8 |
| Feasibility | 12 `WebDocument`, `useServerDocumentContext` | A1.5 check 3, A7.1, P8 |
| Feasibility | 13 Kotlin grep without semicolon | C4.11, C4.13 |
| Feasibility | 14 banned strings by host pattern | A1.5 check 8, Q6 |
| Feasibility | 15 `dataSet` augmentation, `webStyle()` | B1.4.5, B3.12, B3.13 |
| Feasibility | 16 DEX check | C4.14 |
| Feasibility | 17 S2 as P8's first milestone | C3.3, P8 |
| Feasibility | 18 proxy header stripping, GET-only callback, gzip test | A6.1, P1 |
| Feasibility | 19 `useState(getQueryClient)` | A4.2 |
| Feasibility | 20 CI never calls TMDB | A3.3.1, A3.3.2, C3.6, C3.8, C6.1 |
| Coverage | 1 decision-13 icon | Part 0 §0.4, B2.12, B8.2, C4.1, I.6, O-19 withdrawn |
| Coverage | 2 legal pages v2 | C6.8 item 8 |
| Coverage | 3 YouTube III.A.1 and III.A.2 | B5.2, B4.14, C2.9, Q6, I-62 |
| Coverage | 4 consent prompt logic | A2.7, B4.13, C2.4, I-17 |
| Coverage | 5 neutral legacy names, title-and-year match, retirement | A2.1, A2.10, A3.4.12–13, A3.7, I-52 |
| Coverage | 8 Play Age Signals | C2.4 step 6, C5.1, O-29, R-22 |
| Coverage | 9 no web SDK load on sign-in | C1.5 (T10, T32–T35), C1.7 |
| Coverage | 10 monthly preselected | B4.12, I-63 |
| Coverage | 11 Plus copy | B4.11, C1.9 |
| Coverage | 13 farm-filtered halt rules | C4.11, C5.8, C6.8 item 4, I.5 |
| Coverage | 14 one banned-strings list | A1.5 check 8, C3.8, Q6 |
| Coverage | 15 `.html` legal URLs and checks | F0.4, C3.8, C6.2, O-30 |
| Coverage | 17 O-6 rewrite | Part O |
| Coverage | 18 Data safety and analytics wording | O-10, C5.1, B4.11, B4.13 |
| Coverage | 19 server alerts and legacy monitoring | A3.2, A3.4.15, C5.8 |
| Coverage | 21 `ios/` untracked only with P-CNG | C4.13, I-41 |
| Coverage | 22 product and offering changes optional | O-11, O-12 |
| Coverage | 23 DEX check | C4.14 |
| Coverage | 24 display name single-sourced | Part 0 §0.4, I-4 |
| Coverage | 26 overlays and focus | B1.4.5, B3.8, B4.13, B5.1, B6 |
| Coverage | 27 Sentry check on the production build | C4.11 step 3, I.5 (d) |
| Coverage | 28 traceability | Appendix T |
| Coverage | 29 RevenueCat failure instrumentation | C5.4, O-24 |
| Execution | 2 interim `CLAUDE.md` and `AGENTS.md` | W0, F0-A step 9, C6.8 item 2 |
| Execution | 4 F0 gates (deletions, stubs, comments) | F0-A, F0.7, A3.8 |
| Execution | 5 parameter properties, `migrateLocal.test.cjs` | A3.3.2, A4.1, A5.4 |
| Execution | 7 deletions in F0-A, `eas.sh` early | C6.4, C6.5, F0-A steps 2 and 6 |
| Execution | 8 brand source, neutral accent ids, Identity step | Part 0 §0.4, A2.7, B2, I.6 |
| Execution | 10 phase A stash, write failures, transitions | A5.3, A5.4 |
| Execution | 12 legacy contract test, blocked fields, rollback | A3.7, P1, I.5 (c) |
| Execution | 13 testable acceptance, O-3b, `authDomain` | W0 deferred checks, P5, P6, A6.1, O-3b |
| Execution | 14 two-stage Data safety and privacy policy | O-10, C6.8 item 8, I-60 |
| Execution | 16 kit changes within a day | W0, I.2 |
| Execution | 17 CNG and the two Gradle-reading tests | C4.13 |
| Execution | 18 banned strings | A1.5 check 8, Q6 |
| Execution | 20 `w1_<v1 id>` | A2.6, A5.4 |
| Execution | 24 Yarn cache outside the worktree | W0, C6.8 item 5 |
| Execution | 25 trim the manifest before install | F0-A step 1 |
| Execution | 26 `v1-baseline` tag, maintenance workflow, merge `main` | W0, O-16a, I.2, I.4 |
| Execution | 27 versionCode rules | C6.8 item 4, I.5 (d) |
| Execution | 28 fixture mode in the CI web checks | C3.6, C3.8, C6.1 |
| Execution | 29 delete `public/sitemap.xml` | C6.4 |
| Execution | 30 merge along the dependency graph | I.1 |

# Appendix T — Findings traceability

Every critical, high and medium finding of `research/all.json` that was not refuted (154; the refuted MON-8, SCOPE-6 and TOOL-2 are excluded), with where this spec addresses it. The base matrix is `spec/review-coverage.md`, updated for this revision. Status: **Fixed**; **Partial** (with the reason); **Decision** (dropped or changed by the named decision); **Constraint** (task constraint); **Deferred**; **Owner** (owner action only).

Totals after this revision: Fixed 136, Partial 2 (AND-7 and DEP-8: the Amazon store module, Appendix D), Decision 11, Deferred 1 (DEP-9), Owner 3, Constraint 1.

| ID | Sev | Status | Where |
|---|---|---|---|
| STB-1 | high | Fixed | A4.6 useUrlState, A1.2/A1.4 lint ban, A9 |
| STB-2 | high | Fixed | A3.2 stale-if-error, A3.3.3 last-good, A4.5 snapshot; legacy upstream in `/health` and server alerts (A3.2, A3.4.15, C5.8) |
| STB-3 | medium | Fixed | A3.2 Retry-After, A4.2 single retry + breaker |
| STB-4 | medium | Fixed | EZTV removed (decision 2); A3.7 shows/episodes empty |
| STB-5 | medium | Fixed | C4.11 install-source tags (`withSentryInstallSource`); farm-filtered halt rules (C6.8 item 4, I.5 f) and alerts (C5.8) |
| STB-6 | medium | Fixed | C4.11, C5.7 |
| STB-7 | medium | Fixed | C5.4 reportOperation |
| STB-8 | medium | Fixed | C5.2 default onerror; C4.11 JS-fatal check |
| STB-9 | medium | Fixed | A3 server-side TMDB; A3.5 image proxy fallback |
| STB-10 | medium | Fixed | 2.0.0 store binary (C4.8); v1 in-app update path moves 1.8.x users |
| MON-1 | critical | Fixed | A3.7 deletions, C1.12, Q6 live checks |
| MON-2 | critical | Decision 3 | torrent removal Fixed; name kept; rename recommended O-20 |
| MON-3 | high | Fixed | C2.6 show-then-navigate, B5.1 rule 5 |
| MON-4 | medium | Fixed | C1.3 play_link default, O-14; offering detach optional after launch (O-12) |
| MON-5 | medium | Owner | O-5 (report-only per decision 6) |
| MON-6 | medium | Decision 6 | Plus benefits redefined; insights stay Plus |
| MON-9 | medium | Fixed | C2.2 shouldPreload near eligibility, C2.7 |
| MON-10 | medium | Fixed | C1.12 (no project-id comparisons) |
| MON-11 | medium | Fixed | A3.7, B7 |
| MON-12 | medium | Fixed | A3.7 subscriber routes deleted |
| MON-13 | medium | Fixed | B4.11, C1.13; legal pages rewritten (C6.8 item 8) |
| MON-14 | medium | Fixed | C2.10 |
| ARC-1 | high | Fixed | A4.6, A1.2 |
| ARC-2 | medium | Fixed | A0 A2 no barrels, C3.6 lazy SDKs; web purchase SDK only on a Plus surface (C1.5 T10, T32–T35) |
| ARC-3 | medium | Fixed | A3.4.1 /home aggregate |
| ARC-4 | medium | Fixed | A1 feature slices (decision 10) |
| ARC-5 | medium | Fixed | A1.4/A1.5, C6.1 lint gate |
| ARC-6 | medium | Fixed | C1.5 machine + C1.6 adapters |
| ARC-7 | medium | Fixed | A4.6 createStore selectors |
| ARC-8 | medium | Fixed | A8, B7, C4.9, C6.4 |
| ARC-9 | medium | Fixed | availability alerts deleted; journal merged into diary (A12) |
| ARC-10 | medium | Fixed | A1.2 Platform.OS rule; B3 kit |
| ARC-11 | medium | Fixed | A1.1 tree |
| ARC-12 | medium | Fixed | F0.3, A1.6 |
| AND-1 | critical | Fixed | A3.7, B7 |
| AND-2 | critical | Decision 3 | torrent data/UI Fixed (A3.7, B4.4, B8.2); rebrand declined |
| AND-3 | medium | Fixed | C4.5: FLEXIBLE plus the deferred-complete patch; Restart snackbar or background install |
| AND-4 | medium | Fixed | gate removed; O-8 re-rating; age signals: O-29 and the 2.0.x module (C2.4 step 6) |
| AND-5 | medium | Decision 8 | in-app review and alerts removed; lighter first run Fixed |
| AND-6 | medium | Fixed | C4.14 TTID, C5.2 app-start tracking, F0.5 staged start |
| AND-7 | medium | Partial | C4.9, C4.12, Fresco flags fixed; the Amazon store module is deferred to 2.0.x (Appendix D, coverage 25) |
| AND-8 | medium | Fixed | C4.9 expo-insights removed |
| AND-9 | medium | Fixed | O-10 in two stages with every v2 identifier and the 1.8.x declarations kept until 100 % |
| AND-10 | medium | Fixed | C4.3 |
| AND-11 | medium | Fixed | B1, C4.4, B2.12 |
| AND-12 | medium | Fixed | C4.6, gated by the staged rollout and farm-filtered halt rules (C4.11) |
| AND-13 | medium | Fixed | C4.11 |
| AND-14 | medium | Fixed | `legal.ts` uses the `.html` URLs (F0.4); C3.8 and `check-live-web.mjs` check every legal URL; O-30 |
| AND-15 | medium | Owner | O-27 |
| AND-20 | medium | Fixed | C6.4/C6.5 |
| WEB-1 | high | Fixed | C1.3, O-14; offering detach optional (O-12) |
| WEB-2 | critical | Fixed | A3.7 |
| WEB-4 | medium | Fixed | C3.2 SSR + generateMetadata |
| WEB-5 | medium | Fixed | B4.13, C3.2 |
| WEB-6 | high | Fixed | A3.2/A3.3.3; server alerts and the legacy probe (A3.2, A3.4.15, C5.8) |
| WEB-7 | high | Fixed | C3.6 budget gate; signed-in page views load no purchase SDK (C1.5) |
| WEB-8 | medium | Fixed | C3.7 IFrame API player |
| WEB-9 | medium | Fixed | C2.10 |
| WEB-10 | medium | Fixed | C3.1 Pages unpublished; redirect stub dropped with rationale (<=7 users/90 d) |
| WEB-11 | medium | Fixed | decision 5, C6.4 |
| WEB-12 | medium | Fixed | C3.4 sitemaps, C3.2 404s, O-15 |
| WEB-13 | medium | Fixed | A0 A2; tree shaking left to phase 2 (C3.6) |
| SCOPE-1 | critical | Fixed | A3.7 |
| SCOPE-2 | critical | Fixed | A3.7/B7 (only the owner used it, MON-11; no notice needed) |
| SCOPE-3 | high | Fixed | B4.4, A3.7 sort rewrite, C5.7 events |
| SCOPE-4 | high | Fixed | TMDB TV: A3.4.4-5, B4.4-4.5 |
| SCOPE-5 | medium | Fixed | B8.1 listing languages in `store-listing/`; one Play edit at release step (f) (I.5, `scripts/play-release.mjs`) |
| SCOPE-7 | medium | Fixed | C2.10, C1.3 |
| SCOPE-8 | medium | Fixed | B5 |
| SCOPE-9 | medium | Fixed | B4.13, C3.2, O-8; age signals O-29 |
| SCOPE-10 | medium | Fixed | decision 8, C6.4 |
| SCOPE-11 | medium | Fixed | decision 5 |
| SCOPE-12 | medium | Fixed | C4.9, C6.6 |
| SCOPE-13 | medium | Fixed | A3.6, B4.14, B4.17; licence O-5 |
| SCOPE-14 | medium | Fixed | C6 overall |
| TOOL-1 | high | Fixed | C6 |
| TOOL-3 | medium | Fixed | C4.2 production draft plus the one edit at 20 % (I.5 e, f; Part 0 I-51) |
| TOOL-4 | high | Fixed | F0.2 manifest trim, C6.3 |
| TOOL-5 | medium | Fixed | C6.4 |
| TOOL-6 | medium | Fixed | C4.8 android-v tags, C6.8 releases doc |
| TOOL-7 | medium | Fixed | C6.4 release/ deleted |
| TOOL-8 | medium | Fixed | A1.4, C6.1 |
| TOOL-9 | medium | Fixed | C6.4; Q3 manual smoke |
| TOOL-10 | medium | Fixed | C6.2 paths-ignore, one target |
| TOOL-11 | medium | Decision 12 | toolchain (TS 7, Babel 8) stays |
| TOOL-12 | medium | Fixed | C4.13 P-CNG gate; `ios/` leaves git only with `android/` (I-41) |
| TOOL-13 | medium | Fixed | C6.4 OpenSpec removed |
| TOOL-14 | medium | Fixed | decision 5 |
| DEP-1 | medium | Fixed | C4.9 |
| DEP-2 | medium | Fixed | C1.6 lazy import; no SDK load on sign-in (C1.5 T10) |
| DEP-3 | medium | Fixed | C5.3 lazy @sentry/browser |
| DEP-4 | high | Decision 12 | hash guards removed, expo install --check (Fixed); TS 7/Babel 8 kept |
| DEP-5 | medium | Fixed | C4.11 useNativeInit + crash checks on a preview build and the production candidate |
| DEP-6 | medium | Fixed | C4.9 |
| DEP-7 | medium | Fixed | C4.3 |
| DEP-8 | medium | Partial | JS mappings stubbed (C4.12); the Amazon store module is deferred to 2.0.x (Appendix D, coverage 25) |
| DEP-9 | medium | Deferred | C6.6: buildFromSource kept for 2.0, later batch |
| DEP-10 | medium | Constraint | expo-sqlite 58 kept by task instruction |
| DEP-11 | medium | Decision 6 | Android ads kept |
| DEP-17 | medium | Decision 12 | Babel 8 test transpiler kept |
| DEP-22 | medium | Fixed | A3.4.15 RC removed; O-23 template kept for <=1.8.16 |
| BE-1 | critical | Fixed | A3.7 |
| BE-2 | high | Fixed | C1.3, O-14 |
| BE-3 | high | Fixed | A3 TMDB + stale-if-error |
| BE-4 | medium | Fixed | A3.2, A4.2 |
| BE-5 | medium | Fixed | EZTV removed |
| BE-6 | medium | Fixed | A6.5 trigger-based sync |
| BE-7 | medium | Fixed | A6.5 preconditions, A6.4 clamp |
| BE-8 | medium | Fixed | subscriber auth deleted |
| BE-9 | medium | Fixed | deleted; v1 rules field kept for old clients (acceptable) |
| BE-10 | medium | Fixed | server alerts to Sentry (A3.2 `report.ts`), legacy upstream in `/health` (A3.4.15), alert at 5 in 10 min (C5.8) |
| BE-11 | medium | Fixed | A6.1 same-origin auth proxy, O-3 |
| BE-12 | medium | Owner | O-5 |
| DES-1 | medium | Fixed | B1 |
| DES-2 | high | Fixed | B4.4, B4.5, B7 |
| DES-3 | medium | Fixed | B4.4 |
| DES-4 | high | Fixed | B4.1 |
| DES-5 | high | Fixed | B4.13 |
| DES-6 | high | Fixed | B5, C3.7 |
| DES-7 | medium | Fixed | B2, B3, token lint |
| DES-8 | medium | Fixed | A12, B4.7-4.9 |
| DES-9 | medium | Fixed | B4.3 |
| DES-10 | medium | Fixed | B2.2, B6; SC 2.4.11 via `scroll-padding-bottom` (B1.4.5) |
| DES-11 | medium | Fixed | B4.7.1 |
| DES-12 | medium | Fixed | B4.4 one TitleScreen |
| DES-13 | medium | Fixed | B4.11, B4.12; entry points limited to decision 6 (I-15) |
| DES-14 | medium | Fixed | B4.11 |
| DES-15 | medium | Fixed | B4.3 |
| DES-16 | medium | Fixed | B2.5 |
| DES-17 | medium | Fixed | B8.2 |
| DB-1 | critical | Fixed | C2.2 pacing per decision 6 |
| DB-2 | critical | Fixed | decision 2; B4.14; B8.1 "What Yify is not" |
| DB-3 | high | Fixed | structural; C5.6 KPI sources |
| DB-4 | high | Decision 9 | C5.6 ratio rule; consent-free counters not adopted |
| DB-5 | high | Fixed | A3, A4.5 |
| DB-6 | high | Decision 6 | two SKUs kept; web paywall points to Play |
| DB-7 | medium | Decision 6 | title-open tap kept; 400 ms surface + test IDs mitigate (C2.5-2.6) |
| DB-8 | medium | Fixed | `purchases.identify` and `purchases.customer` with `sdk_code` (C5.4); v1 phase check (O-24) |
| DB-9 | medium | Fixed | decisions 5-6, C3 |
| DB-10 | medium | Fixed | B8 listing rework (non-Play install investigation not planned; low) |
| DB-11 | medium | Fixed | O-6 rewritten to the app-level trader status and terms |
| DB-12 | medium | Fixed | C1.4 web uid-only; no web SDK load without a Plus surface (C1.5) |
| UXL-1 | critical | Fixed | B4.4, B7 |
| UXL-2 | high | Fixed | C3.7, B5 |
| UXL-3 | high | Fixed | B8 with every listing language, O-7, O-8, I.5 (f) |
| UXL-4 | high | Fixed | Anime deleted |
| UXL-5 | medium | Fixed | A3.4.1 |
| UXL-6 | medium | Fixed | B4.3, A4.6 search codec |
| UXL-7 | medium | Fixed | B6 |
| UXL-8 | medium | Fixed | B4.1/B4.4 placement targets |
| UXL-9 | medium | Fixed | B1.4.3 singularById |
| UXL-10 | medium | Fixed | B3.7 |
| UXL-13 | medium | Fixed | C3.1, C3.2 |
| UXL-16 | medium | Fixed | B4.13, B5.2 |
