# Yify Plus growth strategy

Updated October 17, 2026. Yify Plus offers two existing benefits: no ads placed by Yify and monthly/all-time insights from movies users log in their private journals. Browsing, watchlists, account sync and journal creation/editing remain free. The immediate checkpoint is 10 genuine paying subscribers including existing members, followed by 100 who renew and the long-term 10,000-subscriber objective. These are goals, not forecasts. The previously discussed ₹25,000 monthly ceiling does not authorize acquisition spending, outreach or customer messages.

## Product and commercial boundaries

The membership destination at `/upgrade` presents the same offer and account recovery as voluntary contextual dialogs, and gives existing members direct actions to view insights, log a movie and manage billing. Checkout uses actual prices and billing terms; it contains no fictional example statistics. Sign-in does not subscribe. YouTube and external-service ads remain separate, and Yify Plus does not include full movies or streaming subscriptions. Pending/not-yet-granted payments lead to recovery instead of an immediate second purchase.

Home and Watchlist retain engagement thresholds and a shared persistent dismissal. A returning Home installation has a first observed visit at least 24 hours earlier; Watchlist eligibility starts at three saved titles. This is not an analytics returning-user cohort. Current supporters and billing-issue states receive no discovery sales invitation. Automatic post-ad offers are removed. Android interstitials leave the first two movie opens of a session free, require three opens and at least 120 seconds between actual displays, and consume no display allowance on no-fill or failed presentation. Restart begins a fresh session; this is not an installation-wide daily cap.

The app shows only actual recurring offers, using plan selection and one checkout action with full billing terms. October 17 provider setup prepared a distinct Android yearly subscription at ten monthly payments per mirrored regional configuration (INR 990 or USD 10 for a full year), preserving monthly prices and legacy grants. Android annual was exposed after verified web and compatible OTA publication; the monthly package remains unchanged. Web yearly metadata is prepared but sales remain held because Stripe rejected international sandbox checkout for the connected account; resolving its provider requirements and verifying a successful checkout come first. Native transaction and renewal journeys remain unverified in this session. See [yearly delivery evidence](../openspec/changes/complete-yearly-plus/evidence.md) and [RevenueCat operations](revenuecat-operations.md). New one-time sales remain excluded; legacy ownership and restoration remain valid.

Server-verified Anime/raw access remains a separate contract and cannot be inferred from a local Supporter grant or a yearly purchase. The [availability-alert pilot](availability-alerts.md) stays disabled pending its existing rights, enrollment, consent and delivery prerequisites. Neither is advertised as a universal membership benefit. Privacy access/export requests and account deletion remain free.

## Release and evidence

Track the prior monetization release in [rethink-monetization](../openspec/changes/rethink-monetization/tasks.md) and the yearly selector/catalog release in [complete-yearly-plus](../openspec/changes/complete-yearly-plus/tasks.md). The OTA targets existing runtime 1.8.25/code 107 without native or dependency changes. Publication alone does not prove client receipt; an export does not prove rendering. Record actual per-platform release dates and previous rollback identifiers.

The current release's live growth baseline is **unknown**. Historical September aggregate snapshots, dimension setup and offline report fixtures do not establish a new ordered conversion cohort. Previously proposed September experiment windows must not be treated as completed measurements. Keep financial/customer snapshots private and use the [subscription funnel](subscription-funnel.md) only within its stated consent, dimension and cohort limits.

## Measurement and decisions

Begin a fresh 14-day observation window only after released-client behavior and actual event values are verified. Record completed dates in the GA4 property's timezone, platform and release coverage, and separate existing members from exposed free users. Missing or thresholded data is unknown, not zero. Do not divide independent event totals or sum daily users to invent conversion. No new identity linkage, viewing-history export or personal content in analytics is needed.

| Question | Evidence | Decision |
| --- | --- | --- |
| Can people understand and load the offer? | Actual offer exposure, supported plan availability, explicit sign-in and checkout outcomes in a defined consented cohort | Fix offer/recovery failures before changing prices |
| Do members use the paid benefit? | Ordered journal-to-insights activity and later-day use within the same observed cohort | Improve the free logging and member journey when use stalls; do not invent extra benefits |
| Are customers paying and staying? | RevenueCat production payments, refunds and first renewals, separating legacy grants, restores and sandbox activity | Observe a full monthly renewal cycle before judging monthly retention; any future yearly cohort needs its own longer renewal horizon |
| Does reduced interruption help sustainable usage? | Comparable released cohorts, playback failures, actual ad displays, ad revenue and subsequent use with coverage stated | Treat changes as associations, not causal uplift from a small uncontrolled rollout |

Stop expansion immediately for incorrect charges/access, cross-account exposure, consent regressions, broken restore/cancellation recovery, blocking crashes or playback failures. Investigate and roll back affected behavior when reliable evidence shows those regressions. If checkout failures, refunds or reports of unwanted charges worsen materially against a comparable established baseline, pause the experiment and investigate. If traffic or baseline coverage is insufficient, report inconclusive and retain the safe existing offer; do not scale spending or declare success.

Review the complete 14-day window for usability and genuine purchase outcomes, then a full monthly cycle for first renewal. Use measured net contribution and observed retention before proposing a separate acquisition experiment. No revenue uplift, payback period or profitable scale is established by implementing this release.
