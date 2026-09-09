# Error reporting

Yify uses `@sentry/react-native` for JavaScript and native errors in Sentry project
**kudos-labs / react-native**. Initialization runs before Expo Router in
[`entry.ts`](../entry.ts); development sessions and static web rendering do not send events.
Existing Firebase Crashlytics remains enabled.

## Configuration

The public DSN lives in [`instrumentation/sentry.ts`](../instrumentation/sentry.ts).
The private `SENTRY_AUTH_TOKEN` authorizes source-map and native debug-symbol uploads.
Supply it through:

- Expo's environment for native EAS builds, including `production` for store releases.
- The GitHub Actions secret `SENTRY_AUTH_TOKEN` for both web deployment workflows.
- A local environment variable or gitignored `.env.sentry-build-plugin` for manual uploads.

Never put the upload token in an `EXPO_PUBLIC_*` variable or tracked configuration.
The Expo plugin supplies the organization/project, native build hooks and symbol uploads;
Metro embeds matching Debug IDs in bundles and maps. Native sources/source context are excluded.
Normal local Debug builds do not require upload credentials.

The Sentry native module first ships in runtime **1.7.6** (Android code **78**).
This integration needs a new binary; do not send its bundle to earlier runtimes.
See [releases](releases.md) for signing, store submission and OTA compatibility.

## Publishing and verification

| Path | Source-map behavior |
| --- | --- |
| EAS native build | SDK build hooks upload bundle maps and native debug symbols. |
| `yarn eas update …` or release-console OTA | Requires upload credentials before publishing; uploads maps afterward from the actual export directory. |
| `yarn deploy:hosting[:prod]` | Exports maps, uploads them, removes public `.map` files, then deploys. |
| GitHub Pages workflow | Uploads and removes maps before creating the Pages artifact. |

Use the repository's EAS wrapper for OTA/hosting so uploads are included. Web exports and tests
alone need no Sentry credentials. Keep external source maps enabled; do not change a compiled
bundle after uploading its corresponding map.

If an OTA succeeds but its map upload fails, retry only the saved export's upload:

```bash
node scripts/sentry-sourcemaps.mjs /path/to/exact/export
```

For a failed web deployment after maps were removed, export again before retrying the normal
deploy command. Upload failures stop web publication and preserve the maps for diagnosis.

Check successful upload logs, then verify a controlled handled error in a release-mode test
build resolves to the original TypeScript file and line in Sentry. Remove temporary test calls
before distribution. Check the native release and `ota_updates` context for the expected runtime,
channel and update ID; source-map upload success alone does not prove device event delivery.

The app disables console breadcrumbs and default personal information, strips HTTP request
details to the origin/method, and retains only origin/method/status for HTTP breadcrumbs.
Session replay, performance tracing, screenshots and structured logs are not enabled.

References: [Expo's Sentry guide](https://docs.expo.dev/guides/using-sentry/),
[Sentry React Native setup](https://docs.sentry.io/platforms/react-native/).
