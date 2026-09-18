# Availability alert pilot

The pilot watches up to 20 saved, unwatched movies for each of at most 20 explicitly allowlisted subscribers. A movie becoming available through a selected streaming service can generate one digest per enrolled device per local day. Rentals and purchases do not qualify. The first observation is a silent baseline, including movies newly added to a watchlist or a changed country/service selection.

**Status: implementation and offline simulation only. Live delivery is disabled.** The owner has not confirmed commercial rights for the availability data. No commercial agreement, cloud identity, push credential, paid service, or live recipient has been configured by this implementation.

## Run without touching accounts

Node 24 is sufficient; no dependency installation is needed.

```sh
node --test domain/availability/pilot.test.ts scripts/availability-alerts/worker.test.mjs
node scripts/availability-alerts/run.mjs --dry-run
```

The offline demonstration uses synthetic movies/accounts and an in-memory transport: baseline = 0 messages, newly available = 1, repeated run = 0. It makes no external request. With no arguments, the runner uses this same simulation. Tests replace every network transport; they do not send push notifications.

The rule integration suite uses the real Firestore emulator and refuses non-loopback endpoints. Start an isolated emulator with this repository's `firestore.rules`, Java 21+, and the synthetic project `demo-yify-rules`, then run:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test tests/firestore-rules.integration.cjs
```

It checks owner-only enrollment reads/writes, 16,000-character/type limits, private worker state/cache, account deletion, and field-masked compare-and-set writes preserving existing synced data. The rule treats enrollment as a bounded opaque string; the shared parser and worker additionally enforce its JSON schema. No production project is involved.

## What needs confirming before launch

1. Confirm a commercial TMDB agreement and any JustWatch requirements covering this paid availability-alert use, permitted storage, and attribution. Possession of an API key does not establish those rights. Keep `TMDB_COMMERCIAL_LICENSE_CONFIRMED` unset until the agreement is checked. See [TMDB commercial use](https://developer.themoviedb.org/docs/faq) and [watch-provider attribution](https://developer.themoviedb.org/reference/movie-watch-providers).
2. Configure Google Workload Identity Federation for this GitHub repository, constrained to its main branch and the `availability-alerts` environment. Use a dedicated service account with only the Firestore entity permissions the runner needs and `cloudmessaging.messages.create` for web push. IAM access bypasses Firestore client rules; do not reuse this identity in the app. Firestore IAM is broader than a collection-level client rule, so keep the identity confined to this workflow. No long-lived service-account key is used or accepted. [Google authentication action](https://github.com/google-github-actions/auth).
3. Configure native Expo push credentials for Android FCM and iOS APNs. Configure Firebase Web Push/VAPID plus the app's service worker for web. Set an Expo push access token if push security is enabled. Validate consent, token refresh, opt-out, sign-out, notification navigation, and deleted-account behavior on real devices. Existing app binaries may need a new store build for native credential/config changes. [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
4. Configure the workflow variables/secrets below; deploy owner-only enrollment rules and deny all client access to `availabilityAlertState`. Run the offline workflow, then a deliberate live run with a consenting test customer who has a real eligible subscription. Sandbox, lifetime, promotional and unverified purchases do not qualify; this worker has no owner exemption.
5. Only after review, set **both** live flags to the exact string `true`. A scheduled hourly run and a manual live run both require them. The workflow also limits live execution to main. The default manual run remains offline.

## Configuration

The app also requires `EXPO_PUBLIC_AVAILABILITY_ALERTS_PILOT=true` at build/export time to show the pilot controls. Leave it unset while preparing this pilot. This public flag only controls presentation; it cannot grant server access. Signed-in clients call `GET /api/availability-alerts/status` with their Firebase bearer token: the current Expo Hosting/local preview origin on web, otherwise `https://yify.expo.app`. That route verifies the two server gates, allowlist and live recurring subscription and returns only eligibility plus the 20-title limit. Configure `YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID=yify-2da67`, the server gates, allowlist and RevenueCat credentials in the API-host environment as well as the worker. Never expose server credentials with an `EXPO_PUBLIC_` prefix.

Web push additionally requires the public `EXPO_PUBLIC_FIREBASE_VAPID_KEY` in the app build. A dedicated `availability-worker.js` handles only availability push messages and local notification navigation; it does not cache app requests. Client registration asks for notification permission only from the explicit switch action. Opt-out revokes the device transport before attempting account cleanup, and failed cleanup retries when the app reconnects or returns to the foreground. Existing consent remains removable if paid access expires. Switching accounts revokes the old transport and blocks reusing it until old enrollment cleanup succeeds.

Repository variables: `AVAILABILITY_ALERTS_PILOT_ENABLED`, `TMDB_COMMERCIAL_LICENSE_CONFIRMED`, `AVAILABILITY_ALERTS_WIF_PROVIDER`, `AVAILABILITY_ALERTS_SERVICE_ACCOUNT`, `YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS` (comma-separated RevenueCat internal recurring `prod…` IDs).

Environment secrets: `AVAILABILITY_ALERTS_PILOT_UIDS` (1–20 Firebase UIDs, comma-separated), `TMDB_READ_ACCESS_TOKEN`, `YIFY_SUBSCRIBER_REVENUECAT_API_KEY` (subscription-read scope), and optional `EXPO_PUSH_ACCESS_TOKEN`.

The pinned Google auth action generates `GOOGLE_ACCESS_TOKEN` for the process. `GOOGLE_CLOUD_PROJECT` is `yify-2da67`. There is no Firebase Functions deployment or billing-plan change. GitHub Actions usage and existing service quotas still need monitoring; the implementation does not claim unlimited free operation.

## Data contract and behavior

- `users/{uid}.availabilityAlerts` is a JSON string of at most 16,000 characters: `{version:1,devices:[{id,kind,token,country,timeZone,updatedAt}]}`. Five devices maximum. `kind` is `expo` or `fcm`; country is uppercase ISO-2; timezone must resolve through `Intl`. IDs are 16–80 alphanumeric/hyphen characters. Enrollment removal is opt-out; deleting the account document removes tokens.
- The worker reads synced `preferences`, `watchlist` version-2 items/tombstones, and `library` watched marks. Canonical `watchRegion` wins; a device's country is fallback only when it is unset. Selected service IDs are taken only from `streamingServices[country]`. It processes movie IMDb IDs; TV episode alerts are outside this pilot.
- `availabilityAlertState/{uid}` stores server-only snapshots, pending event IDs, daily attempts, disabled token hashes, a lease and provider ticket IDs. `availabilityAlertState/_cache` shares only public catalog observations across users for the UTC day. No tokens or movie names are logged or placed in server state. Allowlisted accounts deleted from Firestore are cleaned up on the next run. Removing someone from the allowlist also stops processing; remove their server state separately for full cleanup.
- Catalog results are cached for a day and capped below Firestore's document limit. Requests are sequential, spaced by 250 ms, capped at 850 per run, with 12-second timeouts and an eight-minute processing budget checked between users/devices/titles. A title already in progress can finish its bounded requests after that deadline. API failures, invalid responses, ambiguous IMDb matches and unsupported countries preserve earlier successful snapshots and cannot manufacture availability gains. Pending events expire after seven days.
- Preferred daily hour and quiet hours are interpreted in each device's timezone. Notifications delayed by quiet hours remain pending; quiet hours covering the entire day suppress sends. GitHub schedules may be late. These are daily availability checks, not immediate-release alerts or an exact-time SLA.
- RevenueCat eligibility is checked before looking up titles and immediately before each send. The policy mirrors `data/server/subscribers/revenuecat.ts`: only configured recurring products, production environment, active entitlement and allowed store/status; legitimate grace periods follow that policy. Keep both verifier policies aligned when changing billing rules.
- Current account document version, device registration, token, country/services and subscription are rechecked before transport. Mid-run changes postpone delivery to another run.

## Deduplication and delivery limits

CAS writes using Firestore `updateTime` protect user leases and every state transition; overlapping jobs cannot each claim the same state. Before a send, the worker durably reserves the event IDs and local day. Provider-accepted sends consume those events. A definitive rejection can retry on a later day; an ambiguous timeout or crash is **not retried**, to avoid duplicate notifications. This favors at-most-once attempts over guaranteed delivery. Push networks do not provide an end-to-end exactly-once guarantee.

`accepted` means provider acceptance, not a confirmed user impression. Expo receipt IDs are checked on later hourly runs. Invalid token receipts disable that token until re-enrollment supplies a refreshed token. Missing/expired receipts and ambiguous sends are tracked separately. The client also deduplicates event IDs and uses a stable notification tag. Aggregate run logs expose counts only; unknown sends or operational errors fail the job so they can be investigated without revealing customer data.

There are no live-delivery claims from the offline test suite. Before expanding the pilot, verify closed-app delivery and notification clicks on Android/iOS/web, simulate revoked tokens and account deletion, monitor quotas/costs, and measure conversion plus renewal cohorts. Roll back immediately by clearing `AVAILABILITY_ALERTS_PILOT_ENABLED`; both live gates are checked again by every invocation.
