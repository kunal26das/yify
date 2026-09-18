# Subscription funnel

The funnel measures product use and checkout behavior. RevenueCat remains the source for paid subscribers, transactions, renewals, refunds and revenue. App events never send a purchase amount or claim that an entitlement check is a renewal.

## Events

| Event | Recorded when | Useful breakdown |
| --- | --- | --- |
| `watchlist_activation` | A local save crosses one or three saved titles for the first time in this installation's cache | `saved_milestone` |
| `streaming_country_selected` | The user applies a viewing country | `method`: manual or location |
| `streaming_services_saved` | The user changes their saved service choices | `service_count`: none, one, two_to_three, four_plus |
| `watch_option_opened` | A regional viewing-options link opens successfully | `media_type`, `source` |
| `availability_alert_changed` | The user changes availability-alert enrollment | `enabled` |
| `supporter_prompt` | Supporter options become visible | `placement`, `signed_in`, `supporter_access` |
| `supporter_offers_visible` | A visible paywall has at least one loaded offer and no active supporter access | `placement`, `offer_count` |
| `remove_ads_purchase_start` | The purchase repository starts one SDK checkout | `placement`, `plan_kind` |
| `remove_ads_purchase_done` | Checkout returns customer information for the same account | `placement`, `plan_kind`, `granted` |
| `remove_ads_purchase_failed` | Checkout is unavailable, cancelled, pending, already owned or fails | `placement`, `plan_kind`, `reason` |
| `supporter_paywall_closed` | The user explicitly closes supporter options | `placement`, `supporter_access` |

The checkout and prompt event names are retained from the existing implementation. Their `funnel_version: 1` payload replaces package identifiers with bounded categories. RevenueCat custom paywall impressions continue independently with their existing offering context. Repeated checkout taps share one attempt; refreshed plans do not create another offers-visible event in the same account's open dialog. A different account starts a fresh exposure.

All funnel events carry `app_platform`. `viewing_country` is included when a valid two-letter country is supplied; it describes viewing preferences, not billing country. The allowlisted payload excludes names, emails, account IDs, title IDs/names, package IDs, provider credentials, amounts and arbitrary error text. Existing unrelated analytics are unchanged.

## Reading results

- Activation: unique analytics users reaching three saved titles, selecting services, and opening viewing options. Compare against new app users in a defined acquisition cohort; these actions are not necessarily sequential.
- Paywall conversion: unique non-supporters with `supporter_offers_visible` who start checkout in the same cohort/window. An opened dialog with no plans is not an offer exposure.
- Checkout completion: completed SDK attempts and their outcomes. `granted: true` means access was returned, not a new paid subscriber; use RevenueCat for purchase conversion.
- Retention and subscriber value: RevenueCat production cohorts, first renewal, paid retention, refunds and net proceeds. Exclude sandbox and legacy lifetime grants from monthly-subscriber totals.

Do not add app-side `purchase`, `in_app_purchase`, renewal events, or revenue-valued conversion events. Keep the direct Google Play-to-Analytics purchase feed disabled as recorded in [RevenueCat operations](revenuecat-operations.md).

## Limits and setup

Watchlist milestones are installation-local, persist through list removal, and never fire from cache reads or synchronization. Reinstallation and another device can report them again; they are not unique cross-device customer counts. Existing users who already have three saved titles are not retroactively counted as newly activated. Existing `login` can reflect a restored session and is not a signup metric.

The existing Firebase sinks handle delivery; disabled/unsupported analytics, blockers and network failures can leave gaps. No raw account ID is added to join platforms. Country/platform/placement comparisons should use comparable cohorts; Android's existing RevenueCat–Firebase association does not establish a matching web or iOS revenue integration.

Register the listed bounded parameters as event-scoped dimensions where needed, and build dated GA4 explorations for these definitions before claiming a baseline. This code change does not create dashboards, configure key events, send test production purchases, or change billing. Verify with a debug/sandbox account, including cancellation and repeated taps; then confirm the next legitimate purchase in RevenueCat.

## Read-only report

The local report reads only GA4 property `292918173`. Supply a short-lived OAuth access token in `GA4_ACCESS_TOKEN` using an existing secret manager or hidden prompt; it needs `analytics.readonly` scope and access to this property. Do not put the token on the command line, in a file committed to Git, or in shared output.

```sh
node scripts/subscription-funnel-report.mjs --from 2026-09-19 --to 2026-09-30
```

Output is JSON with date, platform, country, event count and distinct event users per row. Available placement, checkout outcome and saved-title milestone dimensions are included. User counts are not additive across dates, events or segments; the report calculates no conversion rates and no subscriber totals. Default dates cover the preceding 28 completed UTC calendar dates; GA4 evaluates the explicit dates in the property's reported timezone. Use explicit dates when comparing cohorts or release periods.

Metadata discovery checks which custom dimensions are registered. Without `viewing_country`, the report explicitly labels its fallback as GA4 activity country, never billing or viewing country. Without `funnel_version`, it warns that older prompt/checkout events may be mixed in. Thresholding, sampling and high-cardinality data loss are surfaced; unobserved events are not asserted to be zero. Large/incomplete reports fail instead of silently truncating.

This credential-free command verifies the report using fabricated data, labeled `offline_fixture`:

```sh
node scripts/subscription-funnel-report.mjs --fixture tests/fixtures/subscription-funnel-report.json --from 2026-09-01 --to 2026-09-30
```

## GA4 setup for review

In property **292918173 → Admin → Data display → Custom definitions**, inspect existing definitions first. Create only missing **event-scoped** dimensions using these exact parameter names:

| Display name | Event parameter |
| --- | --- |
| Funnel version | `funnel_version` |
| Viewing country | `viewing_country` |
| Funnel platform | `app_platform` |
| Paywall placement | `placement` |
| Supporter access | `supporter_access` |
| Checkout access granted | `granted` |
| Checkout outcome reason | `reason` |
| Saved-title milestone | `saved_milestone` |
| Selected service count | `service_count` |

Use DebugView with a debug device to confirm values; do not generate production purchases for validation. Allow custom definitions to become available before treating missing rows as a tracking defect. Definitions do not reconstruct previously unavailable custom-dimension history.

Create two explorations:

1. **Funnel activity:** Free form; rows Event name and Date; columns Platform; values Event count and Total users. Filter event names to the table above and Funnel version to `1`. Add Viewing country and Paywall placement as filters. Keep event count and users separate; do not total users across rows.
2. **Checkout journey:** Closed funnel; step 1 `supporter_offers_visible`, step 2 `remove_ads_purchase_start`, step 3 `remove_ads_purchase_done` with Checkout access granted matching the verified true value. Require indirect succession within seven days, filter Funnel version to `1`, and break down by Platform or Paywall placement. This measures ordered analytics users receiving access, not paid subscriptions. It is not an acquisition-cohort purchase-conversion report.

For activation, use a separate user segment with `watchlist_activation` and Saved-title milestone `3`; compare date-bounded acquisition cohorts rather than dividing independent event totals. Use RevenueCat production cohorts separately for first payment, renewal and subscriber retention. Do not mark custom checkout outcomes as additional revenue events.

References: [GA4 dimensions, metrics and custom parameters](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [read-only reporting API](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport), [property metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata).
