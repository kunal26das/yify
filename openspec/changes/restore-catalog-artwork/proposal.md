# Proposal

## Why

Movie artwork stopped rendering everywhere. Every movie poster, backdrop, screenshot and cast photo is a `https://wsrv.nl/?url=…` URL built by `MovieRepositoryImpl`, and wsrv.nl now rejects the catalog's image hosts with HTTP 400 `{"message":"Domain or TLD blocked by policy"}` for `yts.pw`, `img.yts.pw` and `yts.lt`. Browsers report `net::ERR_BLOCKED_BY_ORB` for every proxied image, and the Android image loader logs `status code: 400`. Show artwork from TMDB does not use the proxy and still loads.

The web catalog API on EAS Hosting builds these URLs on the server, and Android has read movies from that API since 1.8.17. One server deployment therefore restores catalog artwork for the web and for every Android release from 1.8.17 on. Watchlist, history and journal entries saved before the fix store the proxied URLs on the device and in sync, so they stay blank until the app repairs them.

## What Changes

- Catalog artwork is referenced directly from the catalog's HTTPS image host. Posters offer the catalog's 230 px medium and 500 px large covers as a size ladder (`POSTER_WIDTHS = [230, 500]`), and backdrops, screenshots and cast photos use their original files. Insecure URLs are upgraded to HTTPS and unusable values are omitted.
- The public catalog projection accepts only direct HTTPS image URLs, so proxied or query-carrying image URLs are dropped instead of forwarded.
- Saved watchlist, history and journal entries whose artwork points at the retired proxy show the direct source image. The watchlist stores the repaired URLs when it next reads its items; history and journal repair what they display and leave synced records unchanged.
- The web page no longer preconnects to wsrv.nl.

## Capabilities

### New Capabilities

- `catalog-artwork`: catalog artwork loads from the catalog's own HTTPS image host on every platform, including artwork saved before the proxy was retired.

### Modified Capabilities

None.

## Non-goals

- No replacement image proxy or resizing service. Hosting or proxying catalog artwork, for example for networks that block the catalog's image host, is a separate product, cost and legal decision.
- Android releases before 1.8.17 build their artwork URLs on the device; the server deployment cannot repair them.
- No change to catalog data, torrent visibility, consent, entitlements or sync formats.

## Impact

JavaScript only; no native change or runtime bump. The EAS Hosting deployment from `main` repairs catalog artwork for web and Android 1.8.17 or later as soon as clients refresh their in-memory catalog cache (one minute for lists, ten for details). Repair of saved entries ships in the next binary, or earlier through an OTA update if one is authorized. Direct covers are JPEG originals: the sampled 500 px covers are 120–150 KB, where the proxy's 480 px WebP of a comparable poster is about 45 KB. First loads therefore use roughly three times the data until the image cache holds them; the catalog's image host allows 30 days of caching.
