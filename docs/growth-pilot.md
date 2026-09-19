# First 100 renewing subscribers

The long-term target is 10,000 active monthly subscribers. The first checkpoint is 100 real monthly subscribers who renew; it is a target, not a forecast. The growth budget ceiling is ₹25,000 per month for six months. No acquisition spend, outreach or customer messaging has been started by this implementation.

## First delivery

- [Movie journal and supporter insights](journal.md): the first usable paid-benefit experiment. Journal logging and editing stay free; supporter access adds personal viewing summaries alongside ad removal. This feature does not wait for availability-alert permissions or a new streaming API.
- [Subscription funnel](subscription-funnel.md): measure service selection, saved-title activation, viewing-option opens, actual offer exposure and checkout outcomes. RevenueCat remains the source for payments and renewals, avoiding duplicate Firebase purchase revenue.
- [Availability-alert pilot](availability-alerts.md): optional alerts when a saved, unwatched movie becomes available on a selected service in the user's viewing country. Start with at most 20 consenting, eligible monthly subscribers and 20 movies each. The pilot remains disabled pending data rights and real-device delivery validation.

## Rollout and decisions

1. Release the measurement changes and register the documented GA4 dimensions. Verify real events, establish a dated baseline and separate existing users from newly acquired users. The included report currently has an offline fixture, not a live growth baseline.
2. Confirm commercial TMDB/JustWatch rights and the associated cost before promising paid alerts. Configure the restricted worker identity and push credentials, then test delivery, links, opt-out and account deletion on each supported platform. Do not advertise a platform before it passes.
3. Invite a small consenting cohort only after those checks. Record enrollment, provider-accepted sends, notification opens, subsequent viewing-option opens and first renewal. Provider acceptance is not evidence that a notification was seen. Compare behavior with the cohort's prior activity; a 20-person pilot cannot establish causal conversion uplift.
4. Review after a complete monthly renewal cycle. Expand only if alerts provide useful matches, permission/opt-out behavior is reliable, and subscribers keep the feature enabled. Sparse alerts may reflect catalog availability, so review eligible saved-title coverage alongside engagement.
5. Use measured net subscription contribution and observed retention to set an acquisition ceiling before approving a specific paid campaign. Count ad/creator spend and associated fees in subscriber acquisition cost. Start with one small experiment; the ₹25,000 ceiling is not a spending target. Scaling requires evidence of a sustainable payback period, not installs or clicks alone.

Keep prices, data costs and acquisition economics in a dated review using actual receipts. Do not infer monthly profit or future retention from this code change. Measure journal use and insight-to-checkout interest first. Data-rights confirmation and push setup remain separate prerequisites for the disabled availability-alert pilot; the code does not enable or purchase these automatically.

## Journal experiment: September 20–October 3, 2026

The next experiment reduces the work needed to log a first movie. **Log a movie** opens a chooser with saved movies and explicit title search. A successful save confirms the entry and offers **View insights**; only **Explore supporter access** opens the paid offer. Free logging, editing and notes stay free. No advertising or outreach is launched by this change, and the ₹25,000 monthly ceiling remains unchanged.

This is a planned 14-day observation window, not an already measured result. Begin only after the release, event validation and `action` custom dimension are ready; record revised dates if that slips. Use completed dates in the GA4 property's timezone, and separate existing users/supporters from new non-supporters exposed during the window.

| Question | Evidence required | What does not answer it |
| --- | --- | --- |
| Can people create their first journal entry? | First observed `entry_created` in a defined user cohort, with earlier-event coverage stated; inspect picker-to-create drop-off | Total `entry_saved`, repeated creates or raw event/user ratios |
| Does the journal bring them back? | The same cohort performs a journal action on a later calendar day, established in user-level analysis | Summing daily users or assuming that two days of activity are the same people |
| Do insights lead to genuine offer interest? | Ordered journal → insights → loaded offer → checkout activity, using `journal_insights` on checkout steps | Insight opens, empty paywalls or checkout starts counted as subscribers |
| Are people paying and staying? | RevenueCat production payments and first renewals, with refunds and sandbox/lifetime grants separated | `granted: true`, restores or successful entitlement checks |

The [read-only report](subscription-funnel.md#read-only-report) keeps journal and paywall queries separate. Journal events have no funnel version; applying the paywall's `funnel_version: 1` filter to them hides the evidence. If the `action` dimension is unavailable, action-level results are **unknown**, not zero. As of preparation on September 20, no verified live baseline or conversion result has been produced; GA4 access was returning HTTP 403 for insufficient token scope. An offline fixture is only a test, and restored access alone does not establish that dimensions or historical data are ready.

Review after the complete window. If users open the picker but do not create entries, fix that flow first. If they create but do not return, improve the free journal's usefulness before adding more paid benefits. If they use insights but do not see loaded offers, investigate offer delivery before changing prices. Observe a full billing cycle before judging renewal. The next milestone remains **100 real monthly subscribers who renew**, toward the longer-term 10,000 goal; a two-week usage experiment cannot establish that outcome or causal uplift.
