# Movie journal and supporter insights

Open a movie and choose **Log a watch**, or open **Movie journal** from Watchlist. A Google sign-in is required. Existing watched checkmarks are not converted into viewing dates.

## Free and paid access

- Free: explicit watch date, optional half-star rating, private note, repeat viewings, account sync, reading, editing and deletion.
- Supporter: monthly and all-time viewing summaries, unique movies, rewatches, personal ratings, logged runtime, top genres and a monthly trend. Uses the existing RevenueCat `remove_ads` entitlement, including eligible legacy purchases. No new product or price.
- Subscription expiry removes insights access, while journal records remain accessible and editable.

Insights use only journal entries. Runtime is an estimate from movie lengths, with missing runtime disclosed. A movie may count in multiple genres. Ratings are the user's ratings, not catalog scores. The trend shows up to 12 calendar months ending at the latest logged month; all-time totals still include older entries.

## Data and privacy

`JournalRepositoryImpl` stores an account-partitioned local cache and synchronizes to the owner-only Firestore document `journals/{uid}`. It uses conditional writes, revision merging and deletion tombstones. No journal data is added to the existing library payload, so older installed clients cannot strip it. Edits remain local while offline and sync on reconnect/foreground or periodic checks.

Version 1 limits: 500 records including deletion tombstones, 1,000 characters per note and a 400,000-byte UTF-8 payload. Capacity errors preserve existing records and the unsaved draft. Limits prevent oversized Firestore documents; do not advertise unlimited storage. A later paginated storage migration must preserve old-client behavior before raising them.

Account deletion first pauses journal writes and removes its contents, leaving an immutable empty deletion marker. Rules block stale devices from restoring notes. Other connected clients clear cached entries when they see that marker. The deleting device clears its cache. An interrupted account deletion can therefore leave the journal removed even if the sign-in account remains; no automatic reset can resurrect notes.

Journal analytics contain only an allowlisted action and platform. Notes, personal ratings, viewing dates and logged movie identifiers/titles are excluded. General movie browsing analytics retain their existing behavior. `/journal` is excluded from indexing and the public sitemap. Cloud rules provide account isolation; local cache is not encrypted against another person with access to the same device/browser profile.

## Measure before buying traffic

The launch hypothesis is that a useful free journal creates repeat visits and that personal insights give engaged viewers a reason to support Yify. It is not a revenue forecast.

Track unique users for `journal_action` with actions `opened`, `entry_saved`, `entry_deleted`, `insights_opened`, and `upgrade_opened`. Compare these with the existing offer/checkout funnel and RevenueCat purchases and first renewals. Do not count journal opens, checkout starts or restored access as new subscriptions.

Review after two weeks of exposure: are people saving entries on different days, opening insights, and reaching checkout? If use is low, improve discovery and the logging flow before adding more premium features or spending on acquisition. Confirm renewal behavior over a complete monthly billing cycle. There is no new live baseline or observed conversion uplift at implementation time.

Tests cover free/paid/expired access, loading and sign-in states, date/rating validation, insights calculations, offline restart, account isolation, concurrent writes, storage failures, deletion and rules authorization. Visual QA uses fictional local fixtures without real account writes.
