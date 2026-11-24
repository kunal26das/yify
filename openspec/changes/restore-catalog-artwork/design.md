# Design

## Where artwork URLs come from

`MovieRepositoryImpl` maps YTS DTOs to `Movie` and `MovieDetails`. It runs on the EAS Hosting catalog API, whose `projections.ts` sanitizes the response for web and native clients. Android has used that API through `WebMovieRepositoryImpl` since 1.8.17 (#969); 1.8.16 and earlier map YTS responses on the device. TMDB artwork is built separately by `tmdbImageUrl` and never used the proxy.

## Direct catalog artwork

The YTS image host serves fixed sizes: small covers are 45 × 67 px, medium 230 × 345 px and large 500 × 750 px; backdrops and screenshots are served at their stored size. Instead of resizing through a proxy, posters use the catalog's own sizes as the ladder that `posterRung` already understands: `POSTER_WIDTHS` becomes `[230, 500]` and data supplies `[medium, large]`, deduplicated. The small cover is used only when neither exists. A poster drawn up to 230 physical pixels wide loads the medium cover; larger tiles load the large cover with the medium as placeholder, as before. Backdrops use `background_image_original`, falling back to `background_image`; thumbnails reuse the backdrop. Screenshots prefer the large file, and the thumbnail strip uses the same files as the lightbox, which then opens from cache. Cast photos use `url_small_image`. `thumbCandidates` drops duplicate URLs: the thumbnail and backdrop are now the same file, as are the repaired thumbnail and backdrop of saved entries, so a failed backdrop falls back to the poster instead of requesting the same file again.

`artworkUrl` trims values, keeps HTTPS URLs as given, upgrades HTTP and rejects other schemes or unparsable values. The previous helper threw on an unparsable URL, which failed the whole list mapping; such values are now omitted and the UI keeps its title fallback.

The catalog's URLs answer with a 301 from `yts.pw` to `img.yts.pw`. Browsers, OkHttp/Glide on Android and NSURLSession on iOS follow it; rewriting to the redirect target would hard-code the provider's host layout, so the catalog's URLs are used unchanged. The image host sends `cache-control: public, max-age=2592000` and no hotlink restriction; web `<img>` elements do not request CORS, so the absence of CORS headers does not matter.

## Public projection

`safeImageUrl` dropped its wsrv.nl branch. Every image URL must now be HTTPS on a public host with an image extension and no query, credentials, port or fragment, and the existing download, magnet and hash checks still apply. Proxied URLs are rejected rather than forwarded.

## Saved entries

`withoutLegacyProxy` returns the `url` parameter of a `wsrv.nl` URL when it is a usable HTTPS or HTTP image URL and returns every other value unchanged, so it cannot throw on malformed stored data.

- Watchlist: `toWatchlistMovie` already re-projects stored items on read, add and remote apply, and rewrites local storage when the projection differs. It now repairs poster, backdrop and thumbnail URLs and deduplicates the three proxied poster sizes into one direct cover. Watchlist sync compares IDs and marks only, so repaired local items do not trigger an upload.
- History and journal: their states are merged by timestamp with remote copies, so changing stored records would cause sync writes and compare-and-swap conflicts. The repositories repair the entries they publish to the UI and leave stored and synced state untouched.

Entries saved with sources on hosts that no longer resolve, such as `yts.mx`, remain without artwork; recovering them would need a catalog lookup and is out of scope.

## Validation

Unit tests cover direct mapping, HTTPS upgrade, invalid and missing values, the small-cover fallback, poster selection at several densities, distinct thumbnail candidates, the projection's acceptance of direct catalog artwork and rejection of proxied URLs, and repair of each saved-entry type, including malformed stored values and the absence of sync writes. The new behavior tests fail against the previous source. Typecheck, the full suites and both web exports pass.

A local Hosting server preview was exercised in a separate headless Chrome profile whose DNS refused Sentry, Firebase, RevenueCat, ads and YouTube hosts. With analytics off, it loaded 133 catalog images from `img.yts.pw` with no failures; the same run against production failed all 148 proxied images with `ERR_BLOCKED_BY_ORB`. A release APK built from this source ran on a dedicated API 36 emulator whose DNS refused telemetry, ads, OTA and sign-in hosts. A title saved from production's proxied response showed its backdrop and poster on Watchlist through Android's native loader.

## Release and rollback

An independent review found no correctness defects. It suggested preconnecting to the catalog's image hosts; that was declined because the host comes from catalog data and has changed before (`yts.mx` no longer resolves), so a hard-coded hint would go stale.

Merging deploys EAS Hosting and GitHub Pages. No native change or runtime bump is involved. Verify that both sites render artwork and that an installed production Android binary renders catalog artwork from the deployed API. Repair of saved entries reaches devices with the next binary, or through OTA updates built from each runtime's compatible source if authorized; the changed files are identical in the 1.8.29 source (`ec216d5`). Reverting restores proxied URLs that the proxy rejects, so rollback is only useful if wsrv.nl lifts its block.
