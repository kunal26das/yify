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
It builds the current repository with the `production` EAS profile, verifies the completed build,
then submits that exact build ID with `play-production` to Google Play's production track.

Update `package.json`'s `versionCode` for each new Play binary. The console synchronizes the
checked-in Android version, runtime and channel before building. Review those changes afterward.
A successful submission can still await Google review or managed publishing; check Play Console.

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

For manual deployments, check the export with `node scripts/check-web-export.mjs dist-hosting`.
New web origins also need Firebase Auth and Google OAuth configuration for sign-in.
