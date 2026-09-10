# Diagnostics

Yify uses `@sentry/react-native` for JavaScript and native errors in Sentry project
**kudos-labs / react-native**. Initialization runs before Expo Router in
[`entry.ts`](../entry.ts); development sessions and static web rendering do not send events.
Existing Firebase Crashlytics remains enabled.

## Application monitoring

Production and preview builds record errors, release sessions, native crashes and hangs,
navigation timing, frame performance, and explicit operation diagnostics. Tracing samples
10% of operations; native profiling samples 10% of those traces (about 1% overall).
Screen display checkpoints cover home, browse, movie details and shows. Native SDK options
refresh from JavaScript, so these settings are compatible with runtime **1.7.7** through OTA.

The domain `Diagnostics` port separates monitoring from application behavior. Its Sentry
adapter records spans, structured logs, operation counts and duration distributions. It
observes catalogue requests/cache behavior, account authentication/sync, purchases/restore,
ads, remote configuration, background notification work, OTA checks/downloads and playback.
Playback separates ad wait from startup and buffering; unavailable videos and cancellations
are outcomes rather than application issues. Instrument actual failures at the owning
operation to avoid duplicate captures from consumers of a shared request.

Preferences → About → **Report a problem** opens Sentry's feedback form. The user chooses
whether to submit text; identity fields, screenshots and shake-to-report are disabled.
Feedback may reference the last captured error, as provided by the SDK.

Operation names and attributes must be static and bounded. Never forward the Firebase
Analytics stream into Sentry: it contains content titles, identifiers and search activity.
Diagnostics deliberately exclude those fields, purchase receipts, customer records,
authentication tokens and network bodies. HTTP data retains only origin, method and status;
route names use templates without parameters. Error messages are scrubbed while original
stack locations and debugging identifiers are retained. Console logging is not collected.
No tracing headers propagate to external APIs.

Session replay is configured for controlled verification but disabled in distributed builds.
It must pass a real-device masking/performance check before activation; error-only buffering
also has overhead. The verification option masks text, images and vectors, excludes player
surfaces, and captures no network bodies or headers. No native source attachment or automatic
screenshot collection is enabled.

There is no instrumented backend, AI agent, or reliably scheduled server job in this app.
Do not fabricate Sentry AI spans, cron check-ins or feature flags for unrelated capabilities.
Current Remote Config values are endpoints and keys, not feature switches.

## Firebase fatal JavaScript crashes

Crashlytics initializes before Sentry and Expo Router. Sentry captures and flushes an
uncaught error, then the Firebase handler records its JavaScript stack as fatal and
terminates the failed app. Disabling Firebase's handler chaining avoids a second generic
React Native exception. A guard keeps recoverable errors nonfatal.
The Firebase SDK is loaded synchronously inside the installer, after saving React Native's
handler: importing it at module scope installs its own handler too early.
React Native 0.86 sends uncaught render errors directly to `ExceptionsManager`, so its fatal
path is routed through the current global handler too. A guarded fallback prevents recursion;
caught and recoverable render errors retain React Native's normal handling. Recheck this private
React Native integration when upgrading the framework.

Firebase receives an error copy with the original message and parsed stack frames. The first
source frame's function name gains a stable namespace based on the error type and failure location,
including the Hermes column offset; its file, line and column and the remaining frames are retained.
The namespace uses an alphabetic encoding of a 64-bit signature. Live Android tests showed
that Firebase merged hexadecimal suffixes but separated this class-like representation.
Repeated failures at that location share a signature; different locations
get different signatures. Caller stacks, timestamps, user identifiers and changing error
messages do not split a known failure. Errors without a usable location fall back to type
and message. Sentry receives the original error unchanged.

Firebase controls final issue grouping and may create variants; it has no custom fingerprint
API. Verify changes with release-build crashes A, B, then A again, checking two fatal issues
and two events under A. Restart the test app after each crash to upload its report.
This A/B/A result was verified against Firebase on Android on 2026-09-10. Signatures follow
the available stack locations; rebuilt bundles can move those locations between releases.
Firebase retains bundle positions; Sentry's uploaded maps provide original TypeScript locations.
Runtime, update ID and channel are attached as Firebase custom keys.

The Firebase configuration change first ships in **1.7.7 / Android 79** and requires a new
binary. Do not publish this handler to older runtimes through OTA. Native crashes continue
through the native SDKs; caught errors and promise rejections are not automatically fatal.

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

References: [Expo's Sentry guide](https://docs.expo.dev/guides/using-sentry/),
[Sentry React Native setup](https://docs.sentry.io/platforms/react-native/),
[tracing](https://docs.sentry.io/platforms/react-native/tracing/),
[logs](https://docs.sentry.io/platforms/react-native/logs/),
[metrics](https://docs.sentry.io/platforms/react-native/metrics/),
[feedback](https://docs.sentry.io/platforms/react-native/user-feedback/).

## Release and deployment metadata

The web workflows finalize the exact exported release after deployment succeeds, associate its
source commit, and record the deployment environment and immutable identity. Pages records its
workflow run; Hosting records Expo's deployment identifier. Hosting preview exports set
`EXPO_PUBLIC_SENTRY_ENVIRONMENT=preview`; manual preview exports must set this too before bundling.
Native builds alone are not marked deployed: store submission must finish successfully first.

For a manual OTA, prepare a JSON plan using the shipped binary's exact Sentry release, the source
commit being published, and its runtime. Do not infer an older binary's version code from the current
checkout. Example for the Android 1.7.7 binary:

```json
{
  "kind": "ota",
  "releases": {"android": "io.github.kunal26das.yify@1.7.7+79"},
  "commit": "<full source commit hash>",
  "environment": "production",
  "runtimeVersion": "1.7.7"
}
```

Save the plan outside tracked source, such as under `.expo/`. Set `SENTRY_DEPLOYMENT_PLAN` to
that file and publish through `scripts/eas.sh` with `--json` and explicit `--channel Production`
or `--channel Staging` from a clean checkout at its stated commit. The channel must match the plan
environment and `EXPO_UPDATE_CHANNEL` when it is set.
The wrapper checks the returned update's commit, runtime and platforms against the plan. It saves
Expo's response beside the plan as `.eas.json` and a verified `.published.json` receipt, then uploads
maps and records Sentry metadata. A manual Hosting plan instead uses `kind: "hosting"` and
`releases: {"web": "Yify@<exported version>"}`; production plans require confirmed Expo promotion. The wrapper also reads the exported entry
bundle’s Sentry release prelude and rejects stale or unidentifiable web exports before uploading maps.
Without a plan, manual publication still uploads source maps but does not guess release metadata.

A successful store submission can be recorded with the same receipt format:

```json
{
  "status": "succeeded",
  "releases": ["io.github.kunal26das.yify@1.7.7+79"],
  "commit": "<verified build source commit>",
  "environment": "production",
  "name": "expo-submission:<confirmed submission ID>",
  "url": "https://expo.dev/accounts/kunal26das/projects/yify/submissions/<submission ID>",
  "dateFinished": "<confirmed submission completion timestamp>"
}
```

If metadata recording fails after publishing, retry only the saved successful receipt:

```bash
node scripts/sentry-release.mjs /path/to/plan.json.published.json
```

The API checks existing deployments before writing, including paginated results, so sequential
retries retain the original deployment. It preserves the first release date and existing commit
associations. Serialize metadata updates for the same release, including updates from different deployment paths. GitHub workflows retain receipts as
workflow artifacts for 30 days. Metadata uses the existing `org:ci` upload credential; it does not
need broader project administration access.
