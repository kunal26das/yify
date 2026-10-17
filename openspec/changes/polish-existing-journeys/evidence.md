# Existing-journey polish evidence

## Scope and source

Baseline `8cb416336b1f9cacfeb557f094c009466170bde9`; candidate application source `911f6c1841be200516d55778924d27c875ff208f`. Subsequent delivery documentation does not change application behavior. No catalog, price, provider, benefit, entitlement, consent default, dependency or native-runtime change is included.

The review traced existing onboarding, navigation, browse/search/detail, Watchlist, Journal/Insights, preferences and Plus discovery/account/checkout/recovery/member/management paths. Existing working loading/empty/error infrastructure was retained. This is a bounded audit and correction pass, not proof that every application state or device has no defects.

## Evidence-backed corrections

| Prior problem | Correction and verification |
| --- | --- |
| Four compact destination names truncated at 320px with enlarged text | Full-label horizontal navigation with shared scaled header/content offsets, active/focused-item reveal and 12px edge space. Seven behavior regressions cover geometry, focus, active changes and desktop/compact remounts. |
| Primary white button text used the light dark-theme accent (2.30:1) | Existing accentStrong/onAccent pair provides 6.36:1 for onboarding Continue, YouTube allow, service-picker Done and restart action. Consent copy/defaults and operations are unchanged. |
| Consent explanation cramped beside a vertically centered switch | Analytics heading/switch share a row; its unchanged description uses the full width underneath. |
| Journal tabs/actions and empty Watchlist CTA overflowed enlarged text | Constrained wrapping actions, vertical padding and growing buttons; guest Journal centered at a readable maximum width with safe bottom spacing. |
| Free journal save implied immediate paid-insight access | Free account action says Explore Plus insights; verified member action remains View insights. Existing tab/action behavior remains unchanged. |
| Cached ad-free state was described as verified active benefits | Honest verification copy, verified-only active-benefit wording and disabled insights action until ready. Cached ad suppression and duplicate-payment prevention remain intact. |
| A billing issue could point to a missing management button | Safe-link state names Manage billing or cancel; absent/unsafe-link state directs to the original store then Refresh access. |
| Plus checkout, notices and utilities formed one undifferentiated stack | One plan/action group, in-flow readable notices and separate existing-purchase recovery. Actual full price/period/renewal terms and all identity/payment guards remain unchanged. |
| An absent series appeared as a blank generic Series title | Honest not-found versus lookup-failed recovery with existing browse/retry actions, distinct from valid titles without episode releases. |

Independent source review found a navigation offset bug across compact → desktop → compact remounts. The final candidate resets measurements on scroll-instance changes and adds a resize regression. Re-review accepted `911f6c1`; seven navigation tests and independent probes of six layout callback orders passed. Earlier source review also verified privacy/consent and purchase/account guards (145 focused tests passed); no remaining findings were reported.

## Verification and limits

At final application source `911f6c1`, typecheck passed; full app tests passed 2,333 of 2,334 with one existing minified native-artifact JNI skip; crashreporting passed 51/51. Both sequential web exports and their structural checkers passed. Earlier unchanged-source checks passed strict active specs 11/11, archived specs 6/6, OpenSpec doctor, exact pins, reviewed Expo doctor wrapper and Production channel guard. Raw Expo doctor retains three reviewed deviations and 13 package recommendations. Strict specs are refreshed after final documentation reconciliation; required final-head CI remains a merge gate.

The designer uses actual current presentation components in isolated web fixtures with local-only CSP and production services blocked. Icons, external images and native animation wrappers use neutral fixture substitutes. Narrow/enlarged text is a browser fixture, not physical Android font-scale, TalkBack or VoiceOver evidence. Purchase outcomes and populated states are mocked; no production payment, advertisement, notification or account deletion is exercised. Designer acceptance passed at `911f6c1`, including 320px/2× text, short landscape, desktop, light/dark, keyboard focus/radio behavior, navigation resize/reveal, Journal/Insights, empty Watchlist, series recovery and guest/member/cached/legacy/loading/unavailable/pending/prepaid Plus states. Onboarding primary contrast and keyboard/default-off consent were rendered; the other three primary-action color changes were inspected in source rather than live service journeys. Helpers and the owned review tab were closed. No blocking visual findings remain within that scope.

Web annual stays intentionally unoffered on its existing provider restriction. Native purchase/restore/renewal, actual installed OTA receipt and iOS release setup remain unverified/out of scope here. No conversion or revenue improvement is established by these UI corrections.

## Delivery and rollback

Required final-head CI, both automatic web publications and one compatible Android Production OTA are pending at this committed checkpoint. Record exact merge/deployment/update receipts and task-owned cleanup in the delivery PR closure; leave unavailable device/provider checks explicit. Preserve the unrelated Compose migration worktree.

Rollback source is `8cb416336b1f9cacfeb557f094c009466170bde9`; Hosting `p0jo5bps44`, Pages deployment `7139714665`, Android OTA group `3e52f237-90f9-40e0-8603-9576d45f46a8` / update `01a149dd-80a7-7f86-905f-b3124129defa`, runtime 1.8.25/code 107. Publication does not prove installed receipt. Private task evidence retains logs, before/after render captures and specialist reports without credentials/customer data.
