# Evidence

## Failure, 2026-11-24

The live web catalog API (`https://yify.expo.app/api/catalog/movies?v=2`) returned posters such as `https://wsrv.nl/?url=https%3A%2F%2Fyts.pw%2Fassets%2Fimages%2Fmovies%2Fmicrostar_2026%2Flarge-cover.jpg&w=240&…`. Every such URL answered:

```
HTTP 400 application/json
{"status":"error","code":400,"message":"Domain or TLD blocked by policy"}
```

wsrv.nl returns the same policy error for `img.yts.pw` and `yts.lt`. `yts.mx` no longer resolves. A TMDB image through the same proxy returns `200 image/webp`.

The catalog's own URLs load directly. `https://yts.pw/assets/images/movies/microstar_2026/large-cover.jpg` returns 301 to `img.yts.pw`, then `200 image/jpeg` with `cache-control: public, max-age=2592000` and no hotlink restriction for an external referrer. Sampled sizes:

| Variant | Pixels | Bytes |
| --- | --- | --- |
| Small cover | 45 × 67 | 3,083 |
| Medium cover | 230 × 345 | 33,302–41,258 |
| Large cover | 500 × 750 | 121,109–150,735 |
| Background | 896 × 375 | 32,040–33,974 |
| Medium screenshot | 350 × 147 | 18,475 |
| Large screenshot | 1280 × 536 | 115,339 |
| Cast thumbnail | — | about 1,500 |

For comparison, the proxy's 480 px and 240 px WebP renditions of a comparable TMDB poster are 45,258 and 14,230 bytes.

## Platform reach

Android has used `WebMovieRepositoryImpl` against the canonical catalog API since 1.8.17 (`934455c`, #969); 1.8.14 to 1.8.16 map YTS on the device. The files this change touches are identical in the 1.8.29 source `ec216d5a41672ebeda82d883af4b1d29ce5a92bb`. `WebCatalogClient` caches responses in memory for one minute (lists) or ten minutes (details).

## Tests

With the change: `yarn typecheck` passes, `yarn test` passes 2,474 of 2,475 app tests with the existing artifact-dependent skip plus 51 workspace tests, and `check-web-export.mjs` passes for `dist-hosting --server` and `dist --static`. The first seven new or updated tests (`MovieRepositoryImpl.test.ts` ×3, watchlist, history, journal and projection) fail against `origin/main` in a detached worktree; the later distinct-thumbnail test fails against the previous `thumbCandidates`, and the poster-selection test pins existing `posterRung` behavior with the new widths.

## Independent review

A separate reviewer read the diff without these conclusions and found no correctness defects. Its low-severity findings: the shared thumbnail and backdrop URL made a failed backdrop retry the same file (fixed by distinct candidates); poster selection and direct-artwork projection lacked tests (added); the documented data cost omitted the placeholder (corrected). Its preconnect suggestion was declined, as recorded in the design.

## Web rendering

`expo serve dist-hosting` passed `check-web-preview.mjs`. A separate headless Chrome profile with `--host-resolver-rules` refusing Sentry, Google Analytics, Firebase, RevenueCat, ads, YouTube and Google sign-in hosts confirmed the adult gate with analytics off and visited home, Browse Movies and a movie page. Image responses: 133 × `img.yts.pw 200`, 8 × `image.tmdb.org 200`, no failures, no proxied URLs. The same run against `https://yify.expo.app/` recorded 148 × `net::ERR_BLOCKED_BY_ORB`, with every movie image proxied and blank.

## Android

`./gradlew -PreactNativeArchitectures=arm64-v8a -I ../scripts/android-qa/compile-only.gradle :app:assembleRelease` with `SENTRY_DISABLE_AUTO_UPLOAD=true` built a debug-signed 1.8.32 (114) APK from this source in 4 min 14 s; `android/` stayed unchanged. On a new `yify_artwork_api36` emulator (AOSP API 36, arm64), DNS went through a loopback-only filter that refused Sentry, Crashlytics, Firebase, RevenueCat, ads, Expo update and YouTube hosts and forwarded the rest. After the adult gate with analytics off, catalog screens still received proxied URLs from production and ExpoImage logged `status code: 400`. A title saved from that response showed its backdrop and poster on Watchlist, loaded from `yts.pw` and `img.yts.pw` by the native image loader.

## Delivery

PR #1104 merged as `1a975398d9a5ca62347e454222d203ff56f9b5d2`, tree-identical to reviewed head `a502aed`. Required checks passed on that head in run 45318124651; an earlier attempt of the head's first commit failed only because Google Maven and Maven Central answered the consent-guard downloads with HTTP 429, and its rerun passed. Main CI 45318593333, EAS Hosting run 45319102035 and GitHub Pages run 45319101991 passed.

After deployment, `https://yify.expo.app/api/catalog/movies?v=2` returned direct `yts.pw` posters and backdrops. The isolated headless Chrome run recorded 134 × `img.yts.pw 200` on yify.expo.app and 181 × `img.yts.pw 200` on the Pages mirror, with no failed image and no proxied URL. On the isolated emulator, the production-derived 1.8.29/code 111 APK, without any update, rendered Browse posters from the deployed API with no ExpoImage failure.

## Android OTA updates

On the owner's request to publish OTAs for 1.8.29 through 1.8.32, only runtimes with shipped binaries received an update: 1.8.30 was never released and 1.8.31/code 113 was never submitted.

| Runtime | Source | Update group | Update ID | Published (UTC) | Sentry bundle debug ID |
| --- | --- | --- | --- | --- | --- |
| 1.8.29 | `00d6411fac6524016ddd9dc438090e40b284f9d7` on `release/catalog-artwork-1.8.29` | `2b47b925-ba77-45d7-93c5-38472a5e52ff` | `01a20b9f-f544-7c5d-85ec-14b9235351e7` | 2026-11-24T03:36:02.116Z | `62d2d190-b96b-4f99-9b78-f37dd6197f54` |
| 1.8.32 | `1a975398d9a5ca62347e454222d203ff56f9b5d2` on `main` | `860214b3-8065-49c5-b8c7-542bdd85aae1` | `01a20ba2-6de0-7a3c-bb4d-f10f7a02b5a4` | 2026-11-24T03:38:44.064Z | `4af0c275-4eb5-4c07-8783-9ffefd04f4a1` |

Both were published with `scripts/eas.sh update --channel Production --platform android --environment production --clear-cache --source-maps true`, `EXPO_UPDATE_CHANNEL=Production` and the matching `EXPO_RUNTIME_VERSION`. The wrapper uploaded each Hermes bundle's source map to Sentry; it skipped `availability-worker.js`, a public-folder file outside the Android bundle.

The 1.8.29 source is the 1.8.29 store commit `ec216d5a41672ebeda82d883af4b1d29ce5a92bb` plus this change's hunks, applied unchanged because every touched file was identical there and on `main` before the fix. `main` differs from the 1.8.32 store source `e9c8d18db91e9e9ce45c9def12dd3e05a9980672` only by this change in application code.

Backport checks: dependencies installed from the frozen 1.8.29 lockfile with postinstall guards; typecheck passed. CI 45319487112 on `00d6411` passed pins, typecheck, the full test suite, the consent guard, web exports and the release console. The animation lifecycle guard fixture then failed on the Ubuntu 26.04 sanitizer-runtime lookup that #1089 fixed on `main` (test infrastructure; the native code is the shipped binary's), so the channel and doctor steps were skipped. Locally the channel check passed; Expo doctor reports drift from Expo's current recommendations for 36 packages of the frozen 1.8.29 set (first: `expo-web-browser@58.0.6`, expected `~58.1.0`), which an OTA must not change. A debug-signed release APK built from `00d6411` booted on the isolated API 36 emulator, rendered Browse and showed a newly saved title's artwork on Watchlist with no image failure or fatal exception.

Post-publication, on the same emulator with DNS still refusing telemetry, ads and Expo Insights but allowing `u.expo.dev`:

- The production-derived 1.8.29 APK had saved Microstar while production still served proxied URLs; its Watchlist card was blank. It found update `01a20b9f…`, downloaded 41 of 41 assets, showed "Update downloaded. Applies on next app start." and after a cold start reported no newer update. The saved card then showed its backdrop and poster.
- The production-derived 1.8.32/code 114 APK found update `01a20ba2…`, downloaded 41 of 41 assets and after a cold start reported no newer update. Browse and Watchlist rendered artwork with no ExpoImage failure or fatal exception.
