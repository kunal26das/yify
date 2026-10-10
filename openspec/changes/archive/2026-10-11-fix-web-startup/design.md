# Design

## Context

See proposal.md. Web uses Expo Router server/static exports and client hydration; the existing privacy gate must continue to prevent catalog/bootstrap work before adult confirmation. The native monitor uses expo-network. Home currently mounts real shelf rows only after the hero's initial request resolves.

## Goals / Non-Goals

Keep the existing visual language, consent choices and native startup contract. Improve web readiness and recovery without adding a new splash screen, third-party connectivity endpoint, data source or persistent cache.

## Decisions

- Add a web-specific network monitor. Browser connectivity is a hint; a bounded, uncached same-origin request corroborates a negative report. Any HTTP response proves reachability, including server errors. Unknown/server-rendered state remains optimistic. Events invalidate stale checks; retries and foreground checks recover genuine outages. Leaving the shared native implementation intact avoids changing native connectivity semantics. Browser flags alone are unreliable: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine.
- Keep web font registration for exported font faces, but do not return a blank application while every font downloads. Native startup retains its font readiness check. Verify delayed/failed fonts in a browser rather than inferring readiness from export success.
- Mount the real homepage list immediately on web. Use a hero placeholder inside its existing header, with the existing shelf components below it. Their requests can start while the hero is pending; completed content remains visible through partial failures and refreshes. Retain the native loading composition unless an explicitly verified shared change is needed.
- Preserve privacy controls and default-off analytics. No data prefetch moves outside the gate. A small head script validates the existing saved-choice schema solely to show an inert homepage-shaped placeholder instead of the incorrect SSR consent dialog on returning homepage visits. This hint grants no access and writes no choices. The real gate clears it only when its snapshot matches the actual privacy store. Other routes remain untouched; after 12 seconds a slow-script fallback offers reload and public information links. Invalid or unavailable storage retains the required dialog.

## Risks / Trade-offs

- Same-origin reachability does not establish that a catalog provider is healthy → retain provider-specific errors and retry; do not label an HTTP error as offline.
- Unavailable fonts can change text metrics → preserve fallback fonts and test long titles, mobile wrapping and blocked font downloads.
- Earlier shelf mounts increase concurrent hero/shelf activity → keep existing serial shelf queue and visible-row virtualization.
- Skeleton dimensions can shift when content arrives → compare phone/desktop screenshots, preserve artwork ratio, copy/thumbnail regions and list identity.
- Saved consent hydration may reveal a transient gate → capture returning visits and fix only with hydration-safe behavior that does not mount protected content early.

## Migration Plan

Run targeted connectivity, home recovery and privacy tests, full tests/typecheck, OpenSpec validation and rendered phone/desktop QA. Obtain independent code and scenario review. Merge through CI and verify both automatic web deployments. Roll back by reverting this focused change; no schema, credentials, native runtime or store migration is required.
