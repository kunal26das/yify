# Existing journey audit prompts

Select relevant rows, then discover current routes and implementations. This is a prompt list, not a requirement to invent missing features.

| Journey | Gaps to inspect |
| --- | --- |
| Browse, shelves and search | Empty versus failed results; filters and clear actions; pagination; retained refresh content; race conditions; loading geometry; hero controls and text bounds. |
| Title detail and trailer | Missing metadata; unavailable media; stale title responses; retries; player interaction and scrolling; accurate external-link outcomes. |
| Watchlist, journal and history | Empty states; save/remove/repeat actions; dialog names and focus; account switching; pending sync and deletion failures. |
| Account and preferences | Sign-in cancellation versus failure; stale authenticated state; sign-out; deletion confirmation and outcome; expandable row alignment. |
| Streaming services and countries | Actual availability versus lookup failure; selected region; sheet scrolling; consistent provider item sizing; honest launch behavior. |
| Supporter access and purchases | Restoring or refreshing entitlement failure; account binding; loading versus verified access; retry; cancellation; localized price and billing period. |
| Consent, ads and notifications | Existing choices remain respected; refusal and withdrawal; optional analytics; notification permission and scheduling outcomes; no ads for verified ad-free access. |

Use actual source and an isolated reproduction to establish a defect. For races, control resolution order instead of relying on delays. For stale private data, change the identity while a request is pending. Preserve data only within the same valid identity and query context.

Before web QA, follow `CLAUDE.md` and `scripts/check-web-preview.mjs`: hosting API routes need a server; a static export cannot execute them. Block telemetry before navigation. Keep assertions about native fonts, safe areas, sheets and assistive technology limited to the devices or tools actually exercised.
