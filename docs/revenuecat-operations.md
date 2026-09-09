# RevenueCat operations

Verified on 2026-09-09. This records dashboard and infrastructure configuration, separately from the app's purchase and ad-tracking implementation. It contains no credentials.

## Project and products

RevenueCat project: [Yify (`8b6ff243`)](https://app.revenuecat.com/projects/8b6ff243/overview).

- Android app: `app92a1e3ba4c`, package `io.github.kunal26das.yify`.
- Web Billing app: `app28ce2d8b73`; an existing Stripe account is connected.
- No native iOS RevenueCat app is configured in this project. iOS purchase support requires the actual App Store app, products and credentials before it can be treated as operational.

The current/default offering is [Support Yify (`default`, `ofrng79abbf96a9`)](https://app.revenuecat.com/projects/8b6ff243/product-catalog/offerings/ofrng79abbf96a9):

| Package | Android product | Web product |
| --- | --- | --- |
| `$rc_monthly` | `remove_ads_monthly:p1m` | `remove_ads_monthly_web` |

The offering is monthly-only. On 2026-09-09, `$rc_lifetime` was removed from the default offering for Android and Web at the owner's request. Reloading the app's plans confirmed that only the monthly subscription remained. Current and older app versions read their packages from this offering, so no OTA or native build is needed; already-open/cached paywalls update when offerings refresh.

The monthly products and previously sold lifetime products still grant the [Supporter entitlement (`remove_ads`, `entl2b0b9c6396`)](https://app.revenuecat.com/projects/8b6ff243/product-catalog/entitlements/entl2b0b9c6396). The unoffered lifetime products `remove_ads_lifetime`, `remove_ads_web` and `remove_ads_lifetime_web` remain attached so existing purchasers retain access and can restore purchases. Do not detach or delete these legacy products to stop new sales; the offering controls which options are displayed.

[Targeting](https://app.revenuecat.com/projects/8b6ff243/targeting) has no rules. This is valid: RevenueCat returns the project's default offering when no targeting rule matches a placement. The app's `settings_supporter` and `post_ad_supporter` placements can use the existing offering without creating a new product or experiment. See [placements documentation](https://www.revenuecat.com/docs/tools/targeting/placements).

No managed RevenueCat Paywall or Web Purchase Link is attached to the offering. The app uses its own purchase UI. Adding a native Customer Center or RevenueCat Paywalls UI would require the separate native UI package and a new store build; it is not required for the monthly subscription and legacy purchase-restoration flows.

## Ad tracking and AdMob

The [AdMob integration](https://app.revenuecat.com/projects/8b6ff243/integrations/admob) is connected to publisher `pub-2292299294214510` with the existing read-only/reporting scopes. No OAuth grant was added or changed.

The [production Ads dashboard](https://app.revenuecat.com/projects/8b6ff243/ads), with Sandbox off, showed one ad-monetized customer and two interstitial impressions for `movie_open`, with 100% fill rate. The dashboard displayed `$0` at its displayed precision; this is not evidence that the underlying revenue was exactly zero. These were existing production events, not synthetic verification telemetry.

The AdMob dashboard integration supplies ad-network metadata; the app still needs to send lifecycle and revenue events through the installed SDK. The app uses `react-native-purchases` 10.9.0, which already exposes the five ad callbacks and custom paywall impression tracking. These JavaScript changes do not require a native dependency upgrade. See [AdMob integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/google-admob) and [custom paywall impressions](https://www.revenuecat.com/docs/getting-started/tracking-custom-paywall-impressions).

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

Purchase-event delivery has **not yet been verified**: RevenueCat's Integration Events table was empty after setup, and no purchase or synthetic production event was generated. Verify the next legitimate Android purchase in RevenueCat's integration event log and Google Analytics. A `204` response alone does not prove Google processed an event, especially if the app-instance ID is invalid. Sandbox forwarding remains off to avoid mixing test events into the production Analytics stream.

Reference: [RevenueCat Firebase integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/firebase-integration).

## Web Billing policy and purchase UI

The [Web Billing settings](https://app.revenuecat.com/projects/8b6ff243/web/app28ce2d8b73?activeTab=settings) have the existing support contact and Play store link. The Terms and conditions URL is blank, and the requirement to agree to terms before paying is off. The user has been asked for the actual Terms URL; no placeholder or invented terms were added.

No separate Privacy Policy URL field was visible in the inspected App info, Billing or Appearance overview. No dashboard privacy field was changed. The app purchase UI links the existing published [privacy policy](https://www.freeprivacypolicy.com/live/a06bb609-730e-41fe-8ca4-c5494cdad41e).

An anonymous local-browser check after removing the lifetime package showed only the monthly `$1.00` Web subscription with automatic renewal disclosure. Purchase controls correctly required sign-in. The dialog scrolled to reload, account-purchase checks, access refresh and policy controls, while its close control remained available. No sign-in, purchase or restore transaction was performed during this check. Displayed prices are a verification snapshot, not a replacement for SDK-provided localized pricing.

## Remaining operational checks

- Verify the next legitimate Android purchase reaches both the RevenueCat Firebase integration log and Google Analytics; configuration is saved, but delivery has not yet been observed.
- Obtain the actual Terms URL before configuring Web Billing terms or requiring acceptance.
- If native iOS purchases are intended, configure the real RevenueCat iOS app and App Store products/credentials; Android and Web setup does not establish iOS readiness.
- Validate purchase, restore and subscription-management behavior with the appropriate existing test accounts. Do not use the successful RTDN test or observed ad events as evidence that a new purchase was exercised.
- Add targeting rules or experiments only for a deliberate product decision; existing default-offering fallback already supports both app placements.
