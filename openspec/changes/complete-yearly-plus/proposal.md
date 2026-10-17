# Proposal

## Why

Yify Plus accepts yearly SDK offers but its live catalog contains only monthly products. Customers cannot choose a longer billing period, and the current paywall repeats a checkout action for each offer. The owner authorized completing yearly availability after reviewing Touché's monthly/yearly selector.

## What changes

- Add distinct yearly Google Play and RevenueCat Web Billing products at ten current monthly payments per supported currency/region, retaining monthly products, prices and legacy ownership.
- Attach yearly products to existing `remove_ads` ownership. Offer Android through `$rc_annual` after application publication; hold web yearly sales after the observed Stripe sandbox rejection until provider requirements and checkout are verified. Do not add lifetime sales, introductory offers or trials.
- Present actual monthly/yearly plans as accessible selection rows and one explicit checkout action with full localized charge and renewal/prepaid terms.
- Retain account-safe purchase, restore, cancellation and pending-payment recovery. Distinguish yearly checkout analytics from other recurring periods.

## Capabilities

### Modified capabilities

- `supporter-membership`: real yearly catalog availability, plan selection and unchanged recovery/free boundaries.

## Impact

The change affects purchase presentation, focused tests, yearly catalog metadata, annual analytics labeling and release documentation. No native dependency, binary/runtime, consent, free-feature or server subscriber authorization changes are intended. Android Production OTA targets the shipped 1.8.25 runtime/code 107; both production web targets publish through normal main CI. iOS implementation remains compatible but its store setup/publication is not authorized here. The separate monthly-only Anime/raw contract remains unchanged and is not advertised as a general Plus benefit.

The source baseline is `d64f4afb1190273db2bbe6f8fd3267515f042531`. Read-only October 17 provider inspection confirms one active Play monthly base plan and no yearly RevenueCat product. Current monthly US/India charges are USD 1/INR 99; the lead selected a new full-year charge of USD 10/INR 990 with equivalent tenfold regional prices under the owner's authorization to complete yearly setup. No existing subscription is migrated or repriced.

Actual sandbox validation subsequently confirmed annual Web Billing SDK metadata but checkout failed on the connected account business requirements. The release therefore includes the selector on web while retaining its existing monthly offer, and limits new annual offering exposure to Android. Purchase/renewal and installed-device evidence remain explicit open gates rather than inferred successes.
