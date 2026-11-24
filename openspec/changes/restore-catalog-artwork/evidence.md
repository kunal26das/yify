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
