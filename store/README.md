# Store rollout

Free distribution channels beyond Google Play. Everything here is additive: no app
code changes, no rename, and the Play build and its release flow are untouched.

## Build the artifacts

```
yarn store:apk        # signed ARM-only universal APK -> store-artifacts/
```

Verifies before it writes: the signature must match `YIFY_UPLOAD_EXPECTED_SHA1`
from `~/.config/yify/signing.env`, and the ABI set must be exactly the one
requested. A debug-signed or all-ABI artifact aborts the build rather than
reaching a store.

Desktop packages are built by CI, because the appx needs a Windows host and the
snap needs a Linux one:

```
gh workflow run desktop-artifacts.yml
```

Tagging `v*` runs the same workflow and attaches every artifact to the GitHub
release.

## Channels

| Channel | Artifact | Account needed | Status |
| --- | --- | --- | --- |
| GitHub Releases | `store-artifacts/*.apk` | none | ready |
| Obtainium | the GitHub release | none | ready |
| Uptodown | `store-artifacts/*.apk` | free signup | needs account |
| Indus Appstore | `store-artifacts/*.apk` | free signup | needs account |
| Palm Store | `store-artifacts/*.apk` | free signup + ID | needs account |
| Microsoft Store | `desktop-dist/*.appx` | free signup | needs account + secrets |
| Snap Store | `desktop-dist/*.snap` | free Ubuntu One | needs name registration |

### GitHub Releases + Obtainium

Nothing to register. Tag a release, let the workflow attach the desktop
artifacts, and upload the APK alongside them:

```
gh release upload v1.6.3 store-artifacts/yify-1.6.3-65.apk
```

Obtainium users then add `https://github.com/kunal26das/yify` as a source and get
updates automatically. Note that a sideloaded install and a Play install are
signed by different certificates and cannot upgrade over each other — they are
two separate populations by design.

### Uptodown

Register at <https://en.uptodown.com/developers-console>. Free. Upload the APK
and the listing copy below. Their developer terms carry an IP warranty and a
discretionary rejection right, so the listing is not unconditional.

### Indus Appstore

Register at <https://developer.indusappstore.com/>. IAP commission is 0%; the
annual listing fee is not documented publicly — confirm at signup rather than
assuming it is free. The developer terms name exclusive Indian jurisdiction.

### Palm Store (TECNO / Infinix / itel)

Register at <https://dev.dlightek.com/>. Individual accounts are accepted: email,
mobile, ID or passport number, a photo of you holding the ID, and bank card
details. Two clauses to read before submitting — §3.1 forbids apps that are "a
combination of third-party content, or lists of links", and listing makes Palm
Store the default release channel on Dlightek devices.

### Microsoft Store

Register at <https://partner.microsoft.com/dashboard>. Individual registration
has been free since September 2025. Reserve the app name, then take the three
identity values from Product Setup and set them as repository secrets:

| Secret | Where it comes from |
| --- | --- |
| `MS_STORE_IDENTITY_NAME` | Partner Center → Product identity → Package/Identity/Name |
| `MS_STORE_PUBLISHER` | Partner Center → Product identity → Package/Identity/Publisher |
| `MS_STORE_PUBLISHER_DISPLAY_NAME` | Partner Center → Product identity → Publisher display name |

Without them the workflow still builds an appx, but with a placeholder identity
that Partner Center will reject. Microsoft signs the package on ingestion, so no
code-signing certificate is needed. Policy 10.8.1 permits a non-game PC app to
use a third-party purchase API, so the existing RevenueCat web checkout can stay.

### Snap Store

Register at <https://snapcraft.io/account>. Reserve the name `yify` first — the
snap will not upload until the name is yours:

```
snapcraft register yify
snapcraft upload --release=stable desktop-dist/yify_1.6.3_amd64.snap
```

Name registration is reviewed by a human at Canonical.

## Listing copy

Reused across every channel so the listings stay consistent.

**Name** — Yify Movies: Trailers, Ratings (matches the Play listing; publisher Kudos Labs)

**Short description** (80 characters)

> Browse movies with trailers, ratings, cast and a watchlist that syncs.

**Full description**

> Yify turns a public movie catalogue into a proper streaming-app experience.
>
> A curated home of editorial rails over a rotating full-bleed hero: a ranked Top
> 10 This Week, Critically Acclaimed, Just Added, Loved by Viewers, 4K Ultra HD,
> and rows for every genre. A fast, deep-linkable browse-and-filter grid with
> quality, rating, genre and sort controls in a native bottom sheet. Cinematic
> detail pages with an inline trailer, cast, screenshots with a pinch-to-zoom
> lightbox, parental guidance and a "More like this" rail.
>
> The trailer follows you — one player is mounted once and animates between the
> watch page and a docked miniplayer, so it keeps playing while you browse.
>
> Save any title to a watchlist that persists locally and syncs across your
> devices when you sign in. Turn on new-release notifications and a background
> task tells you when fresh titles land, deep-linking straight into the movie.
>
> Yify is a browsing companion for discovering movies. It does not host, stream
> or download any film.

**Category** — Entertainment

**Content rating** — Teen / 13+ (user-generated catalogue metadata, no purchases required)

**Privacy policy** — <https://www.freeprivacypolicy.com/live/a06bb609-730e-41fe-8ca4-c5494cdad41e>
(the same URL the Play listing and `public/delete-account/index.html` already use)

**Account deletion** — <https://kunal26das.github.io/yify/delete-account>

**Support email** — kunal26das@gmail.com

## Assets

Screenshots and the icon are shared across channels. Phone screenshots must be at
least 1080px on the short edge; Uptodown and Indus both want a 512x512 PNG icon
that matches the one inside the APK.

Store-specific sizes worth noting: Palm Store wants a 1024x500 banner, and the
Microsoft Store wants a 2160x2160 Store logo alongside the tile assets that
electron-builder generates from `desktop/assets/icon.png`.
