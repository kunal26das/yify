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

- [x] 3.1 Pass required CI and merge (#1104 as `1a975398d9a5ca62347e454222d203ff56f9b5d2`; PR CI 45318124651, main CI 45318593333).
- [x] 3.2 Confirm the EAS Hosting and GitHub Pages deployments render catalog artwork on both sites (runs 45319102035 and 45319101991).
- [x] 3.3 Confirm an installed production Android binary renders catalog artwork from the deployed API (1.8.29/code 111 without an update).
- [x] 3.4 Deliver saved-entry repair to installed apps through the next binary or an authorized OTA update built from each runtime's compatible source (Production OTA groups `2b47b925-ba77-45d7-93c5-38472a5e52ff` for 1.8.29 and `860214b3-8065-49c5-b8c7-542bdd85aae1` for 1.8.32).
