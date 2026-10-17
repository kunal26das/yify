# Design

## Scope and decisions

Use the current shared Plus page/modal and Yify typography, palette, spacing and rounded rows. Touché is a reference for selection, not a source of prices, lifetime sales, audience policy or entitlement changes.

Show only supported actual SDK offers. Stack Yearly Plus then Monthly Plus when present. Each row is one accessible radio with its full charge, billing period and `offerDisclosure()` text. Keep the selection marker, wrapping text, accent border and `accentSoft` selected background. Keep one purchase button using `purchaseLabel(selectedOffer)` below the group; guests still sign in first without automatic checkout. No discount badge, equivalent monthly calculation, placeholder yearly plan or invented benefit is displayed.

Choose a real yearly offer initially, otherwise monthly. Preserve an explicit choice through reload and newly arriving offers. Temporary empty loading data must not reset it. A settled result that removes the selection chooses a real fallback and announces that the customer must review the changed plan. An account remount invalidates the previous account's offers and selection. No old or unresolved offer can be purchased.

Pending/not-granted payment states and active members retain their existing recovery/member content rather than another purchase selector. Busy state disables selection and duplicate operations. Cancellation is quiet. Web uses radio keyboard navigation and visible focus; native screen-reader selection does not purchase. Single-column flexible rows and in-flow checkout preserve 320px, short-landscape, enlarged-text and both-theme behavior without fixed text heights.

## Catalog and compatibility

Create a new Android product `yify_plus_yearly` with annual auto-renewing base plan `p1y`, and a separate Web Billing product `yify_plus_yearly_web`. Set the full annual charge to ten current monthly payments in each mirrored enabled region/currency. No trial or introductory phase is added. Preserve monthly JSON and its package links, existing lifetime entitlement attachments, availability boundaries and all existing customer subscriptions. Existing members continue to use management/cancellation and are not automatically moved between plans.

The new products grant the existing `remove_ads` entitlement. After successful application publication and reviewed catalog readback, expose only Android through the new `$rc_annual` package in current/default offering `default`. Web yearly stays unoffered: actual sandbox checkout was rejected by Stripe for the connected Indian account business requirements. Its verified SDK price/period alone is insufficient. Resolve the provider restriction and verify checkout, restoration, management and renewal before any later web exposure; preserve the existing monthly configuration meanwhile. Provider operations are serialized and recorded privately without credentials/customer data. Older clients enumerate actual offerings; inspect their period/title/price mapping before broad exposure. Rollback removes only the new offered package, preserving annual ownership and renewal support for any completed purchase.

Server Anime/raw checks remain monthly-only; do not market or infer access from the new annual entitlement. iOS store products are absent and remain an explicit setup limit. Production purchases, real charges/refunds, consent changes, new credentials and grants are outside verification scope.

## Verification and delivery

Run focused selector/account/recovery and analytics tests, required typecheck/full tests, strict OpenSpec validation, dependency/runtime guards and both exports. Independently review the exact source and actual rendered narrow/short/large-text/theme/keyboard states with production telemetry, ads and checkout blocked. Record provider product, price, period, entitlement/package and preserved-monthly readbacks separately from live SDK transaction evidence.

Use existing sandbox/test services when available for purchase, active restoration, cancellation and renewal checks; mocked tests and stored catalog metadata do not prove a real store transaction. Verify compatible installed OTA receipt only if a suitable device is available. Leave unavailable provider/device journeys pending. Merge via normal required checks, verify automatic web publications, publish one compatible Android OTA through `scripts/eas.sh`, and retain exact receipts/rollback targets. Observe real yearly payments/renewals separately; no revenue uplift is implied by availability.
