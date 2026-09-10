# Releases

[Back to README](../README.md)

## Setup

Install the release console dependencies, then launch it from the repository root:

```bash
yarn --cwd release install --frozen-lockfile
yarn release
```

Sign in through the console. The [EAS wrapper](../scripts/eas.sh) reuses its saved Expo token,
or an `EXPO_TOKEN` supplied through the environment.

Android signing uses `~/.config/yify/signing.env` (override with `YIFY_SIGNING_ENV`).
[setup-eas-credentials.sh](../scripts/setup-eas-credentials.sh) validates the upload key and
generates the gitignored `credentials.json`; the console runs it before production builds.
Configure the Play service-account path through `YIFY_RELEASE_PLAY_SERVICE_ACCOUNT`, or use
the default path in [eas.json](../eas.json). Keep credentials outside source control.

## Android store releases

In the console, select **Android → Production**, leave the APK field empty, validate, and release.
It uploads the current repository with the `production` EAS profile and schedules automatic
Google Play production submission with `play-production`. The console finishes once Expo accepts
both jobs. Expo continues the build and Play upload remotely; the console can then be closed.
Follow the build and upload links in the output for their final status. Check those jobs before
retrying to avoid creating a duplicate build.

Update `package.json`'s `versionCode` for each new Play binary. The console synchronizes the
checked-in Android version, runtime and channel before building. Review those changes afterward.
A queued job is not recorded as a shipped release or used to unlock OTA updates. After confirming
the actual release, record it in `release/releases.json`. A successful Play upload can still await
Google review or managed publishing; check Play Console. Record a confirmed release with:

```bash
yarn --cwd release tsx scripts/recordRelease.ts android Production <VERSION> <RUNTIME_VERSION>
```

| Command | Result |
| --- | --- |
| `yarn build:preview:android` | Internal APK on the `Staging` update channel |
| `yarn build:production:android` | Store AAB on the `Production` update channel |
| `yarn submit:android --id <EAS_BUILD_ID>` | Google Play **internal** track, **draft** status |
| `yarn submit:android:play --id <EAS_BUILD_ID>` | Google Play **production** track, **completed** rollout |

For manual production builds, prepare signing credentials and synchronize native version/runtime
fields first; the build command alone does not perform the console's preparation or ledger update.
Always submit a specific verified build ID. To upload a local AAB to internal/draft instead, use
`yarn submit:android --path <AAB_PATH>`.

Console **Staging** releases build locally and distribute an APK through Firebase App Distribution.
An existing APK is accepted only when Staging alone is selected. Selecting both channels requires
an empty APK field and builds each channel separately. The iOS console flow records a supplied IPA;
upload it to App Store Connect separately.

## Android native crash symbols

React Native Firebase includes Crashlytics NDK capture by default. The
`withCrashlyticsNdk` Expo plugin enables Firebase symbol generation and makes both
`assembleRelease` and `bundleRelease` depend on `uploadCrashlyticsSymbolFileRelease`.
This covers local, preview and production builds; an upload failure fails the build.
Debug builds do not trigger this upload, and requesting both release tasks uploads once.

Crashlytics reads Gradle's merged native-library artifact, including app and dependency
libraries, before packaging strips it. Sentry's native symbol upload remains separate.
Function and source-line coverage depends on the symbols each library provides; already
stripped third-party libraries may need matching unstripped symbols from their publisher.

After a failed Firebase upload, retry `./gradlew :app:uploadCrashlyticsSymbolFileRelease`
from `android/` with the same build inputs. For a shipped build, recover its original
symbols and verify their GNU build IDs against that exact APK/AAB before uploading;
matching version names alone are insufficient. OTA updates do not replace native libraries
or supply their symbols. See [Firebase's NDK guidance](https://firebase.google.com/docs/crashlytics/ndk-reports).

## Over-the-air updates

OTA updates can change JavaScript and assets supported by an installed binary. Native dependency,
plugin or native code changes require a new binary and a new runtime version. The runtime defaults
to `package.json`'s `version`; **bump that version whenever native compatibility changes**.

`EXPO_UPDATE_CHANNEL` sets the binary's channel (`Production` or `Staging`). The release console uses
[releases.json](../release/releases.json) to check that a matching binary has shipped before publishing
an update. Record actual binary releases there, not OTA releases.

For a manual Android production update, choose a shipped runtime whose native modules support the
bundle, and publish from the tested source revision:

```bash
EXPO_RUNTIME_VERSION="<SHIPPED_RUNTIME>" EXPO_UPDATE_CHANNEL=Production \
  yarn eas update --channel Production --platform android \
  --environment production --message "Describe the update" --clear-cache
```

For Staging, use its shipped runtime, set both channel values to `Staging`, and use the `preview`
environment. Overriding the runtime does not make an incompatible bundle safe. Verify the published
update's platform, channel and runtime; the app checks on launch/foreground and prompts for restart.

## Web

A push to `main` deploys the canonical site at [yify.expo.app](https://yify.expo.app/) and the
[GitHub Pages mirror](https://kunal26das.github.io/yify/). Their workflows check the exported pages
with `scripts/check-web-export.mjs` before deployment.

| Command | Result |
| --- | --- |
| `yarn export:hosting` | Export the root-path site to `dist-hosting/` |
| `yarn deploy:hosting` | Export and create an EAS Hosting deployment |
| `yarn deploy:hosting:prod` | Export and deploy to the production alias |
| `yarn export:web` | Export the `/yify` mirror to `dist/` |

For manual deployments, check the export with `node scripts/check-web-export.mjs dist-hosting --server`.
New web origins also need Firebase Auth and Google OAuth configuration for sign-in.

The web catalog API projects public metadata before responding. Browser exports must pass the
provider-data check; never promote or restore a deployment built before that boundary was added.
Old EAS deployments retain public URLs until deleted, even after production moves to a newer build.

Current clients request `v=2`, which includes the torrent list, format, size, seeds and peers for
everyone. The existing torrent panels and notice remain available without sign-in. Public JSON
omits hashes, torrent URLs and magnets; those remain in the verified subscriber's `raw.responses`.
Requests without `v` retain the earlier response shape for already-open clients. Deploy the API
with `v=2` support before publishing an updated Pages client.

Signed-in subscribers use `/api/subscriber-catalog/[operation]`. Every request verifies the Firebase
ID token and checks RevenueCat for a current production monthly subscription before fetching the
catalog. Its response contains `metadata` for the UI and `raw.responses` with the original upstream
JSON, visible in the browser's Network panel. Raw responses are never cached, saved in app storage,
or included in diagnostics. Subscribers can still copy or share data they receive.

Set these **sensitive**, server-only variables in the EAS `production` environment before deploying:
`YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID`, `YIFY_SUBSCRIBER_REVENUECAT_API_KEY`, and
`YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS`. The key requires only
`customer_information:subscriptions:read`; `.env.example` lists the project and approved product IDs.
Do not prefix these with `EXPO_PUBLIC_`. Missing configuration fails closed and the browser falls
back to public metadata. Both API bundles are required by the Hosting export check and excluded
from Pages assets. See [Expo's Hosting environment-variable rules](https://docs.expo.dev/eas/environment-variables/usage/#using-environment-variables-with-eas-hosting).

Legacy lifetime, promotional and sandbox access does not qualify for this endpoint. Canceled
subscriptions retain access through their paid period; RevenueCat-approved grace periods also
qualify. Subscription checks are not cached. JWT verification caches only Google's public signing
keys and does not perform Firebase token-revocation checks; a revoked ID token can remain valid
until its normal expiry. Signing out stops further subscriber requests in that browser, but cannot
erase responses already received or invalidate a copied token immediately.

Open the browser Network panel before reloading, enable Keep log, and filter by `catalog`
to see both public and subscriber requests. Select a fetch request and its Response tab.
A `403` means the server found no qualifying subscription. The app's “supporter access”
message also covers legacy lifetime and sandbox purchases, so it does not confirm eligibility
for raw responses. Inspect the customer's production subscriptions in RevenueCat before changing access.

Catalog requests have a 25-second deadline that cancels upstream fetches and further pagination.
For each API, a worker limits upstream work to 60 units per client per minute and 240 units overall, with bursts
of the same size and at most 24/48 concurrent units. An episode request reserves six units for its
possible six upstream pages; other operations reserve one. Excess requests receive uncached `429`
responses with `Retry-After`. Client identity uses EAS Hosting's `X-Real-IP`; absent or invalid values
share one fallback bucket. The bounded, transient client table is not persisted or logged.

These counters protect each warm worker independently. They reset on worker replacement and are
not a distributed quota across regions or deployments. A strict service-wide quota requires a
shared rate-limit store or an edge gateway; never expose such a store's credential in the web bundle.
