# First 100 renewing subscribers

The long-term target is 10,000 active monthly subscribers. The first checkpoint is 100 real monthly subscribers who renew; it is a target, not a forecast. The growth budget ceiling is ₹25,000 per month for six months. No acquisition spend, outreach or customer messaging has been started by this implementation.

## First delivery

- [Subscription funnel](subscription-funnel.md): measure service selection, saved-title activation, viewing-option opens, actual offer exposure and checkout outcomes. RevenueCat remains the source for payments and renewals, avoiding duplicate Firebase purchase revenue.
- [Availability-alert pilot](availability-alerts.md): optional alerts when a saved, unwatched movie becomes available on a selected service in the user's viewing country. Start with at most 20 consenting, eligible monthly subscribers and 20 movies each. The pilot remains disabled pending data rights and real-device delivery validation.

## Rollout and decisions

1. Release the measurement changes and register the documented GA4 dimensions. Verify real events, establish a dated baseline and separate existing users from newly acquired users. The included report currently has an offline fixture, not a live growth baseline.
2. Confirm commercial TMDB/JustWatch rights and the associated cost before promising paid alerts. Configure the restricted worker identity and push credentials, then test delivery, links, opt-out and account deletion on each supported platform. Do not advertise a platform before it passes.
3. Invite a small consenting cohort only after those checks. Record enrollment, provider-accepted sends, notification opens, subsequent viewing-option opens and first renewal. Provider acceptance is not evidence that a notification was seen. Compare behavior with the cohort's prior activity; a 20-person pilot cannot establish causal conversion uplift.
4. Review after a complete monthly renewal cycle. Expand only if alerts provide useful matches, permission/opt-out behavior is reliable, and subscribers keep the feature enabled. Sparse alerts may reflect catalog availability, so review eligible saved-title coverage alongside engagement.
5. Use measured net subscription contribution and observed retention to set an acquisition ceiling before approving a specific paid campaign. Count ad/creator spend and associated fees in subscriber acquisition cost. Start with one small experiment; the ₹25,000 ceiling is not a spending target. Scaling requires evidence of a sustainable payback period, not installs or clicks alone.

Keep prices, legal/data costs and acquisition economics in a dated review using actual receipts. Do not infer monthly profit or future retention from this code change. The next operational steps are data-rights confirmation, analytics configuration and push setup; the code does not enable or purchase these automatically.
