# RevenueCat operations

Catalog inspected and yearly products prepared on 2026-10-17; older infrastructure sections retain their dated evidence. This records dashboard and infrastructure configuration, separately from the app's purchase and ad-tracking implementation. It contains no credentials.

## Yify Plus name — October 17, 2026

The customer-facing membership name is Yify Plus. Google Play's existing monthly product title and RevenueCat's current monthly product/offering display names were renamed without changing SKU identifiers, prices, billing periods, availability or entitlement relationships. Historical product names below describe earlier configuration; legacy one-time purchases remain valid and are not offered for new sales. `/support/`, `#supporter-purchases` and analytics placement IDs remain stable for compatibility.

## Project and products

RevenueCat project: [Yify (`8b6ff243`)](https://app.revenuecat.com/projects/8b6ff243/overview).

- Android app: `app92a1e3ba4c`, package `io.github.kunal26das.yify`.
- Web Billing app: `app28ce2d8b73`; an existing Stripe account is connected.
- No native iOS RevenueCat app is configured in this project. iOS purchase support requires the actual App Store app, products and credentials before it can be treated as operational.

The current/default offering is [Yify Plus (`default`, `ofrng79abbf96a9`)](https://app.revenuecat.com/projects/8b6ff243/product-catalog/offerings/ofrng79abbf96a9):

| Package | Android product | Web product |
| --- | --- | --- |
| `$rc_monthly` | `remove_ads_monthly:p1m` | `remove_ads_monthly_web` |

At the October 17 starting checkpoint, the offering was monthly-only. On 2026-09-09, `$rc_lifetime` was removed from the default offering for Android and Web at the owner's request. Current and older app versions read their packages from this offering; already-open/cached paywalls update when offerings refresh. New yearly preparation and exposure are tracked below separately from the unchanged monthly package.

### October 17 yearly setup

The starting read-only inspection confirmed Android app `app92a1e3ba4c`, Web Billing app `app28ce2d8b73`, and Test Store app `appb982f2aa15`. Default offering `ofrng79abbf96a9` contained only `$rc_monthly` package `pkge66f1602b59`: Android product `prod4a474db633` (`remove_ads_monthly:p1m`) and web product `prod3b9edb236c` (`remove_ads_monthly_web`). Legacy one-time products remain attached for restoration.

The owner subsequently authorized completing yearly setup. New Google Play subscription `yify_plus_yearly`, base plan `p1y`, is active and imported as `prodd3197ad24a`. Its full annual prices equal ten current monthly payments in each of the 172 mirrored product regional configurations, including INR 990 and USD 10; product region configuration is distinct from app/store availability. Native old-client retrieval is retained through the new base plan's legacy-compatible setting. Existing monthly JSON, prices and periods were checked unchanged.

New Web Billing product `yify_plus_yearly_web` (`prod0baca6bf3d`) has customer-facing title **Yify Plus (Yearly)**, period `P1Y`, USD 10 base price, and no trial, introductory or grace period. Both yearly products attach to existing entitlement `remove_ads`. This preparation alone does not expose them through the default offering or establish a successful checkout. A noncurrent `yearly_validation_20261017` offering supported sandbox inspection without targeting customers and was archived after verification. The SDK returned the correct yearly title, P1Y period and USD 10 full charge, but Stripe rejected the sandbox international-card payment because the connected Indian account does not satisfy its business requirements. Keep the web yearly product out of the default offering until provider setup and checkout verification succeed. Existing monthly configuration is preserved; this failure also warrants checking its international checkout separately. See [Stripe requirements](https://docs.stripe.com/india-accept-international-payments) and [delivery evidence](../openspec/changes/complete-yearly-plus/evidence.md).

The revised page/modal uses actual monthly/yearly radio selection and one explicit checkout action, with the full selected charge and renewal/prepaid terms. There is no invented discount, annual placeholder, automatic subscriber migration or new lifetime sale. Existing monthly subscribers manage billing through their original store; the app does not charge them again to switch plans. After verified web and Android OTA publications, default `$rc_annual` package `pkge8177d30315` was attached only to the verified Android yearly product; fresh readback confirms monthly is unchanged and web annual is absent. [PR #1007 closure](https://github.com/kunal26das/yify/pull/1007#issuecomment-6234075702) records exact delivery receipts. Native checkout, restore, management and renewal remain unverified without a suitable test device. Native iOS products remain unconfigured.

Yearly general Supporter access must not be marketed as Anime/raw access: server subscriber checks currently allowlist the monthly product IDs below. Extending server eligibility would require a deliberate separate authorization/configuration review; a new package alone does not change it.

`scripts/revenuecat-setup.sh` is retired. Its former `--apply` flow created lifetime-sale products/packages and advised removing monthly sales, contrary to the current contract. All invocations now exit nonzero with guidance before reading credentials or making network requests. Do not revive that migration or detach/delete legacy entitlement attachments. Use a separately reviewed catalog operation for authorized future changes; the retired script is not the yearly setup route.

The monthly products and previously sold lifetime products still grant the [Supporter entitlement (`remove_ads`, `entl2b0b9c6396`)](https://app.revenuecat.com/projects/8b6ff243/product-catalog/entitlements/entl2b0b9c6396). The unoffered lifetime products `remove_ads_lifetime`, `remove_ads_web` and `remove_ads_lifetime_web` remain attached so existing purchasers retain access and can restore purchases. Do not detach or delete these legacy products to stop new sales; the offering controls which options are displayed.

The subscriber catalog API separately requires a current production subscription to Android
`prod4a474db633` or Web Billing `prod3b9edb236c`. Its V2 key **Yify subscriber catalog server**
(`apikeya111bdc6fb`, created 2026-09-11) has only `customer_information:subscriptions:read`.
The existing product-setup key is unchanged. The server queries the Firebase-verified UID, including
RevenueCat aliases; it does not trust the browser's supporter state or grant catalog access from a
lifetime entitlement alone. The separately configured owner can access the catalog using their
verified Firebase identity without a subscription; this does not change RevenueCat entitlements
or customer billing rules. [Deployment configuration](releases.md#web)

[Targeting](https://app.revenuecat.com/projects/8b6ff243/targeting) has no rules. This is valid: RevenueCat returns the project's default offering when no targeting rule matches a placement. The app's voluntary supporter placements reuse `settings_supporter` without creating a new product or experiment. `post_ad_supporter` remains historical attribution; this release removes its automatic prompt. See [placements documentation](https://www.revenuecat.com/docs/tools/targeting/placements).

No managed RevenueCat Paywall or Web Purchase Link is attached to the offering. The app uses its own purchase UI. Adding a native Customer Center or RevenueCat Paywalls UI would require the separate native UI package and a new store build; it is not required for the monthly subscription and legacy purchase-restoration flows.

## Ad tracking and AdMob

The [AdMob integration](https://app.revenuecat.com/projects/8b6ff243/integrations/admob) is connected to publisher `pub-2292299294214510` with the existing read-only/reporting scopes. No OAuth grant was added or changed.

The [production Ads dashboard](https://app.revenuecat.com/projects/8b6ff243/ads), with Sandbox off, showed one ad-monetized customer and two interstitial impressions for `movie_open`, with 100% fill rate. The dashboard displayed `$0` at its displayed precision; this is not evidence that the underlying revenue was exactly zero. These were existing production events, not synthetic verification telemetry.

The AdMob dashboard integration supplies ad-network metadata; the app still needs to send lifecycle and revenue events through the installed SDK. The app uses `react-native-purchases` 10.9.0, which already exposes the five ad callbacks and custom paywall impression tracking. These JavaScript changes do not require a native dependency upgrade. See [AdMob integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/google-admob) and [custom paywall impressions](https://www.revenuecat.com/docs/getting-started/tracking-custom-paywall-impressions).

For revenue reporting, enable **Impression-level ad revenue** in AdMob Settings and use the RevenueCat Android SDK key for this project. Debug builds report sandbox events; use test ads and the dashboard's Sandbox filter when checking tracking.

Android reports loaded, displayed, clicked, failed-to-load, and revenue events with a shared impression ID and the `movie_open` placement. AdMob `OPENED` means displayed; only `CLICKED` maps to RevenueCat's Ad Opened event. Tracking runs independently of purchase loading, and rejected calls produce a sanitized `ad_tracking_failed` diagnostic. See the [manual integration guide](https://www.revenuecat.com/docs/ad-monetization/manual-integration) for event definitions.

## Google Play notifications: connected and verified

Real-time developer notifications (RTDN) are enabled for Yify in [Google Play monetization setup](https://play.google.com/console/u/0/developers/7945922940168867324/app/4974126843295183994/monetization-setup).

- Existing Play API project: `pc-api-7945922940168867324-276` (project number `800469779625`).
- Pub/Sub API: enabled.
- Topic: `projects/pc-api-7945922940168867324-276/topics/revenuecat-yify-rtdn`.
- RevenueCat push subscription: `projects/pc-api-7945922940168867324-276/subscriptions/RevenueCat-Subscriber-app92a1e3ba4c`.
- Subscription status: `ACTIVE`; push destination host: `api.revenuecat.com`.
- Play notification content: **Subscriptions, voided purchases, and all one-time products**. This includes the lifetime purchase model.

The existing Play/RevenueCat service account was verified against the configured credential project and the project's service-account inventory before granting access:

`service-account@pc-api-7945922940168867324-276.iam.gserviceaccount.com`

It has the documented project-level `roles/pubsub.editor` and `roles/monitoring.viewer` needed for RevenueCat's managed subscription setup. The Google Play notification publisher, `google-play-developer-notifications@system.gserviceaccount.com`, has only `roles/pubsub.publisher` on this topic. No unrelated project Owner/Editor permissions were added. The managed setup needs to create/manage its subscription, so a topic-only publisher grant to the RevenueCat account would not complete it.

Verification:

1. RevenueCat reported **Successfully connected to Google** after selecting the topic.
2. Play confirmed the settings were saved and **Test notification sent**.
3. RevenueCat showed **Last received: 2026-09-09, 6:03 p.m. UTC**.
4. A read-only Cloud query confirmed the active push subscription and matching topic.

No credentials were rotated. RevenueCat's **Track new purchases from server-to-server notifications** option remains off; enabling automatic import was not needed to connect notifications for SDK-tracked purchases. A delivered test verifies the notification route, not a new purchase, refund or entitlement change.

References: [Google server notifications](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications), [Play service credentials and required roles](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials).

## Firebase analytics: Android configured

The [Firebase integration](https://app.revenuecat.com/projects/8b6ff243/integrations/firebase) is saved for the production Android stream. The configured App ID and masked credential persisted after a full page reload. Google’s data-collection acknowledgement was accepted with the owner's explicit authorization.

Verified configuration:

| Setting | Value |
| --- | --- |
| Firebase project | `yify-2da67` |
| Firebase project number | `325235052319` |
| Google Analytics account | `61423288` |
| Google Analytics property | `292918173` |
| Production Android data stream | `3042389195` |
| Android Firebase App ID | `1:325235052319:android:d0952f8b37e046062d2a2a` |
| Measurement Protocol credential nickname | `RevenueCat Android production` |
| Sales reporting | Gross revenue, in US dollars |
| Sandbox events | Off |
| Hashed email for ad conversion matching | Off |

The dedicated credential was created in the [production Android stream](https://analytics.google.com/analytics/web/#/a61423288p292918173/admin/streams/table/3042389195) after confirming no existing credential was present. Its value is stored in RevenueCat, not in this repository. iOS and Web analytics fields remain blank. No Firebase extension was installed; it is separate from the Analytics integration.

The installed app's Firebase linkage supplies the real native `$firebaseAppInstanceId` subscriber attribute. A Web GA client ID must not be substituted for this value. The current RevenueCat instructions document Android/iOS analytics streams; the dashboard's Web fields alone do not establish supported Web identity matching. Web purchases remain tracked in RevenueCat independently.

Purchase-event delivery was verified on 18 September 2026: RevenueCat recorded one production monthly subscription for $1.03 on 16 September at 07:01 UTC and a matching Firebase integration event marked Sent. Firebase reported one `purchase` event for $1.03 and a separate automatic `in_app_purchase` event for $1.04, producing $2.07 in purchase revenue. Ad revenue was $0.00.

On 18 September, Yify's Android app was unlinked only from the Google Analytics product within [Firebase's Google Play integration](https://console.firebase.google.com/project/yify-2da67/settings/integrations/playlink). The saved Google Analytics purchase-data switch is off; App Distribution and Crashlytics remain enabled with one linked app each. RevenueCat remains the source of purchase revenue sent to Firebase. Keep this direct Play purchase feed off to prevent duplicate revenue; retain the app's Firebase Analytics SDK and RevenueCat app-instance-ID association. This configuration change requires no app build and does not correct historical totals. Verify the next legitimate purchase is counted once after the change; no purchase or synthetic production event was generated for verification.

Google documents that removing the Play link stops purchase/subscription ingestion and that product links can be managed independently. See [Google Play analytics ingestion](https://support.google.com/analytics/answer/11548051?hl=en) and [per-product Firebase unlinking](https://support.google.com/firebase/answer/6392038?hl=en). Sandbox forwarding remains off to avoid mixing test events into the production Analytics stream.

Reference: [RevenueCat Firebase integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/firebase-integration).

## Web Billing policy and purchase UI

The [Web Billing settings](https://app.revenuecat.com/projects/8b6ff243/web/app28ce2d8b73?activeTab=settings) retain the Play store link and the account-email fallback for support. On 10 September 2026, the approved [Terms and conditions](https://yify.expo.app/terms/) URL was saved and verified after reloading the dashboard. The existing requirement to agree to terms before paying remains off.

No separate Privacy Policy URL field was visible in the inspected App info, Billing or Appearance overview. No dashboard privacy field was changed. The purchase UI, Preferences and web footer link the self-hosted [Privacy Policy](https://yify.expo.app/privacy/) and [Terms and conditions](https://yify.expo.app/terms/). Android opens both pages in custom tabs.

The published AdSense message, `Yify web consent`, also uses the self-hosted privacy URL for both `yify.expo.app` and `kunal26das.github.io`. Both saved URLs and the message's Published status were verified after publication on 10 September 2026.

An anonymous local-browser check after removing the lifetime package showed only the monthly `$1.00` Web subscription with automatic renewal disclosure. Purchase controls correctly required sign-in. The dialog scrolled to reload, account-purchase checks, access refresh and policy controls, while its close control remained available. No sign-in, purchase or restore transaction was performed during this check. Displayed prices are a verification snapshot, not a replacement for SDK-provided localized pricing.

## Web advertising

On 18 September 2026, AdSense listed both `yify.expo.app` and `kunal26das.github.io` as
`Getting ready`; the Expo review was requested on 10 September at 11:02 IST. Account setup
was complete. Google must approve the sites before live ads can serve. Do not remove and
resubmit a site while its review is pending.

The existing `Yify web content` display unit (`8399492432`) matches the app's publisher
`ca-pub-2292299294214510`. Auto ads are off; the app requests its manual homepage placement
only after purchase readiness resolves and ad-free supporter access is absent. The inspected
browser account had active supporter access, so no Google ad script or placement was expected.
`Yify web consent` remained published for two sites in Privacy & messaging.

Both production origins serve the correct publisher record at `/ads.txt` with HTTP 200.
The Expo endpoint also returned it for requests using Google's advertising crawler user agents.
AdSense still showed Expo's ads.txt status as `Not found` from 10 September; GitHub's was
`Authorized`. Recheck Google's crawler status after it updates, and verify a real non-subscriber
ad response once approval reaches `Ready`. Current checks do not establish live ad fill.

Failed script loads now expire from the page's loader cache, so a later fresh placement can
recover after a network error or timeout. Existing placements never retry automatically, and
successful script loads remain shared. Tests cover both recovery paths, supporter exclusion,
empty responses, and placement cleanup.

References: [AdSense site statuses](https://support.google.com/adsense/answer/12170222?hl=en)
and [connecting a site](https://support.google.com/adsense/answer/7584263?hl=en).

## Remaining operational checks

- Verify the next legitimate Android purchase reaches both the RevenueCat Firebase integration log and Google Analytics exactly once, without the previous duplicate automatic `in_app_purchase` revenue.
- If native iOS purchases are intended, configure the real RevenueCat iOS app and App Store products/credentials; Android and Web setup does not establish iOS readiness.
- Validate purchase, restore and subscription-management behavior with the appropriate existing test accounts. Do not use the successful RTDN test or observed ad events as evidence that a new purchase was exercised.
- Add targeting rules or experiments only for a deliberate product decision; existing default-offering fallback already supports both app placements.
