# Proposal

## Why

The owner requested a polished, professional experience across existing journeys so that Plus feels worth considering. Source audit and isolated current-component rendering found low-contrast primary buttons, cramped enlarged-text navigation/journal controls, and membership/recovery language that can misrepresent cached access or direct customers to unavailable actions. An absent show also looks like a valid blank title.

## What changes

- Retain Yify's existing typography, palette, rounded controls and free/paid boundaries while improving primary-action contrast, compact navigation and Journal layout.
- Group actual Plus plans and their primary action separately from purchase recovery, preserving all prices, terms, account and duplicate-payment guards.
- Distinguish cached/unverified Plus access from verified benefits, and make recovery copy match available actions.
- Clarify the free-journal-to-Plus-insights transition and distinguish missing show metadata from a valid title without releases.

## Capabilities

### Modified capabilities

- `accessible-product-controls`: readable existing controls, clear membership actions and honest recovery states.

## Impact

Presentation and focused tests only; no new feature, benefit, payment provider, catalog/price, entitlement, consent, analytics identity, native dependency or runtime change. Baseline is `8cb416336b1f9cacfeb557f094c009466170bde9`. Web annual stays held on its documented Stripe prerequisite; native checkout/installed OTA receipt remain separate unverified gates. Improvements are usability corrections, not evidence of a conversion or revenue increase.
