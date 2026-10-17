# Yearly Plus evidence

## Source and implementation

Baseline `d64f4afb1190273db2bbe6f8fd3267515f042531`; application source independently accepted at `6ec18e3a593557a60f1bbed909c0a359ff63991b`. Subsequent changes are legal copy, specifications and delivery documentation. The selector persists its initial resolved plan and explicit selections, announces a removed plan, preserves account/session guards and recovery, and uses explicit web checked/disabled ARIA alongside native accessibility state. A delivered P1Y offer has bounded funnel kind `yearly`.

## Verification on October 17

- Typecheck passed. Full tests: 2,321 app passed, one existing native-artifact skip, zero failures; 51 crashreporting passed. Independent focused paywall/funnel verification: 62/62 passed.
- Strict OpenSpec: 10/10 before final documentation; exact dependency pins, reviewed Expo doctor wrapper and Production channel guard passed. Doctor retains three reviewed deviations and 13 recommendations; this is not a clean raw doctor result.
- Both sequential Hosting and Pages exports and export checkers passed against the accepted application source. After conditional monthly/yearly terms changes, legal/export tests passed 51/51. Final required CI remains a merge gate.
- Independent rendered review accepted narrow 320px, short landscape, desktop, both themes, enlarged text, long price, monthly-only, yearly-only prepaid, guest, member, legacy, unavailable and pending states. Web radio checked state, arrows, Space, Tab, matching checkout action, visible focus and modal Escape passed.
- Rendering used the actual presentation with mock ports and blocked Yify vendor calls. It is not a native screen-reader or live purchase test. Designer used independent native Chrome when the in-app browser was unavailable; one mistaken local URL briefly reached search, so browser-wide zero outbound traffic is not claimed.

## Provider configuration and transaction limits

Google Play `yify_plus_yearly:p1y` is ACTIVE/P1Y and legacy-compatible. All 172 product regional configurations match the corresponding monthly currency and availability with exactly ten times its price, including INR 990 and USD 10. Monthly JSON is unchanged. Product region configuration does not establish binary country availability.

RevenueCat Android annual `prodd3197ad24a` and Web Billing annual `prod0baca6bf3d` grant existing entitlement `remove_ads` alongside every original product. Existing `$rc_monthly` package `pkge66f1602b59` is unchanged. A noncurrent validation offering exercised the existing sandbox SDK, returning the correct annual title, P1Y period and USD 10 full charge without exposing new customer sales.

Actual Web Billing sandbox checkout used Stripe's official test-card fixture and a synthetic identity, with test keys only and analytics collection disabled. Stripe rejected international payment because the connected Indian account does not meet its registered-business requirements. No successful purchase, active restoration, management, cancellation or renewal was established. No live charge or customer transaction was made. The new web annual product must remain outside the current offering until the provider restriction is legitimately resolved and these journeys pass. Existing monthly web configuration is preserved; its international checkout warrants separate verification. [Stripe requirements](https://docs.stripe.com/india-accept-international-payments) explain the account prerequisite.

The Android-only catalog exposure gate requires the independently reviewed merge source, both verified web publications and Android Production OTA publication/runtime/channel readback. This is explicitly not installed-device receipt. After publication, attach only `prodd3197ad24a` to the current `$rc_annual` package and re-read that mapping, unchanged monthly configuration and absence of web annual. Archive the owned noncurrent validation offering after testing. Keep ownership/entitlement products intact on rollback; remove only the new offered package if needed.

No Android device is connected in this session. Native license-test purchase, restore, cancellation/renewal, native screen readers and installed OTA receipt remain unverified. iOS products/publication remain unconfigured/out of scope. Monthly-only server Anime/raw authorization is unchanged and is not marketed as an annual benefit.

## Release and follow-up

Normal required CI, merge, both automatic web deployments and one compatible Android OTA are pending at this committed checkpoint. Record exact final source, deployment/update receipts, final catalog mapping, validation-offering archive and cleanup in the delivery PR closure. Do not archive this change while the provider/device checks remain incomplete. No new binary, native dependency or runtime change is included.

The previous rollback references are Hosting `g13f4ikaow`, Pages deployment `7139204711`, Android OTA group `db46773f-685e-4be8-bbd4-62bfcd1b0144`, update `01a149b7-929b-7c56-8802-717cb1a45bdb`, runtime 1.8.25/code 107. Provider receipts, sanitized SDK events, browser evidence and logs are retained in private task evidence; no credential or customer data belongs in this public record.


## Publication reconciliation

[PR #1007 closure](https://github.com/kunal26das/yify/pull/1007#issuecomment-6234075702) records final source `8cb416336b1f9cacfeb557f094c009466170bde9`, successful required CI and both web publications, Android OTA publication/endpoint readback, Android-only annual package attachment, archived validation offering and completed task-owned cleanup. The pre-publication snapshot above remains provenance. Native transactions/receipt and web checkout recovery remain unverified, so this change remains active rather than archived.
