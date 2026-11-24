# Tasks

## 1. Artwork source

- [x] 1.1 Map catalog posters, backdrops, thumbnails, screenshots and cast photos to direct HTTPS catalog URLs, set `POSTER_WIDTHS` to the catalog's `[230, 500]` covers and remove the wsrv.nl preconnect; typecheck passes.
- [x] 1.2 Restrict the public projection to direct HTTPS image URLs; the projection test rejects proxied URLs and accepts direct artwork.
- [x] 1.3 Repair proxied artwork in saved watchlist, history and journal entries without sync writes for history and journal.
- [x] 1.4 Seven new or updated tests fail against the previous source and pass with the change.
- [x] 1.5 Try each distinct thumbnail URL once and pin poster selection and direct-artwork projection with tests.

## 2. Verification

- [x] 2.1 Typecheck, 2,475 app tests (one existing skip), 51 workspace tests and both web export checks pass.
- [x] 2.2 A local Hosting preview renders catalog artwork in an isolated Chrome profile with telemetry hosts refused; production fails every proxied image with `ERR_BLOCKED_BY_ORB`.
- [x] 2.3 A release APK built from this source shows a saved title's direct artwork on Watchlist on an isolated API 36 emulator.
- [x] 2.4 An independent review found no correctness defects; its low-severity findings are fixed or recorded in the design.

## 3. Delivery

- [ ] 3.1 Pass required CI and merge.
- [ ] 3.2 Confirm the EAS Hosting and GitHub Pages deployments render catalog artwork on both sites.
- [ ] 3.3 Confirm an installed production Android binary renders catalog artwork from the deployed API.
- [ ] 3.4 Deliver saved-entry repair to installed apps through the next binary or an authorized OTA update built from each runtime's compatible source.
