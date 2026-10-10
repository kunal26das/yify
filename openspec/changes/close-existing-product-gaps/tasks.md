# Tasks

## 1. Existing catalog journeys

- [x] 1.1 Isolate home refresh generations and preserve partial success; verify deferred old/new hero and shelf responses cannot replace current state.
- [x] 1.2 Surface home-section and retained-content refresh failures with retry; test partial failure/recovery and inspect rendered states.
- [x] 1.3 Preserve loaded movie details after refresh failure; test initial failure, retained failure, successful retry and route change.

## 2. Existing account actions

- [x] 2.1 Preserve real session state on failed sign-out and return verified access-refresh outcomes; cover failure, retry, account switches and cached access on both platforms with mocks.
- [x] 2.2 Show precise account deletion outcomes, prevent overlapping actions and clarify billing; test failure, partial cancellation, retry and success without live deletion.
- [x] 2.3 Surface privacy-form and support-link failures; test rejection and subsequent retry without production requests.

## 3. Existing controls

- [x] 3.1 Make mobile search reset apply while preserving other filters; verify empty queries never enter history and inspect mobile and desktop behavior.
- [ ] 3.2 Correct contextual labels, preference copy, actual heading roles and compact action dimensions; verify accessibility tree and narrow/enlarged-text rendering.

## 4. Whole-product review

- [ ] 4.1 Record journey coverage and rendered results on isolated previews, including loading/empty/error/recovery and explicit untested native/live-service paths.
- [ ] 4.2 Run affected regressions, typecheck and required app/release/web checks; independently review the exact final commit and resolve findings.

## Workflow follow-up

- Sync implemented requirements and archive completed work after verification.
- Merge through required CI; preserve actual web deployment receipts separately from Android store/OTA work.
