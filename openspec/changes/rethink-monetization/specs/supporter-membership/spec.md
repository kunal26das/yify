# Spec Delta

## Purpose

Give customers a lasting place to understand, purchase, use and recover the existing Yify Supporter membership without compromising free access or account boundaries.

## ADDED Requirements

### Requirement: Membership has a persistent destination
The app SHALL provide a persistent `/upgrade` membership page and voluntary contextual offer dialogs sharing the same benefit, price and account-state information. The page SHALL remain usable without automatically opening a modal or redirecting after an offer closes.

#### Scenario: Direct membership visit
- **WHEN** a user opens `/upgrade`, including from the public support page
- **THEN** the membership content renders as a page, with existing adult confirmation preserved and a way to continue browsing

#### Scenario: Contextual invitation
- **WHEN** an eligible user explicitly chooses a supporter action in Home, Watchlist or Journal
- **THEN** an offer opens with the relevant placement, and dismissing it returns to the existing activity without a purchase

### Requirement: Benefits describe actual value and the free boundary
Membership content SHALL describe removal of Yify-placed ads and monthly/all-time insights from manually logged journal entries. It SHALL retain free browsing, watchlists and journal entry editing, distinguish external-service ads, and exclude fictional statistics from checkout.

#### Scenario: Comparing the offer
- **WHEN** a free user views membership content
- **THEN** the two benefits and free features are visible without suggesting automatic viewing tracking, included streaming subscriptions, full movies, or removal of external-service ads

#### Scenario: Empty journal
- **WHEN** a member has no journal entries
- **THEN** the app invites them to log a movie rather than presenting example statistics as their own results

### Requirement: Recurring plan choices remain truthful and explicit
The app SHALL offer only actual recurring monthly or yearly subscriptions for new sales, using SDK-localized prices and actual billing terms. Signing in SHALL NOT start a purchase. Missing, excluded or unsupported offers SHALL provide recovery without inventing prices, yearly availability, savings or one-time sale options.

#### Scenario: Signed-out offer
- **WHEN** a signed-out user opens a loaded recurring offer
- **THEN** its price and billing terms are visible before sign-in, and a separate explicit purchase action is required after sign-in

#### Scenario: Plans cannot load
- **WHEN** no supported recurring plan is available
- **THEN** the user can keep using free features, retry plan loading and check existing access without a stale purchase action

#### Scenario: Actual billing terms
- **WHEN** a recurring offer is presented
- **THEN** its regular price and renewal or prepaid terms accompany the purchase action, without invented trial eligibility or savings

#### Scenario: Yearly plan is not configured
- **WHEN** the live offering contains a monthly subscription and no yearly product
- **THEN** the UI shows the actual monthly offer without a yearly price, disabled placeholder or fabricated discount

#### Scenario: Yearly plan becomes available
- **WHEN** the SDK supplies an available recurring yearly product
- **THEN** it can be selected with its real full-year charge and billing terms, without inferring server-only benefits

### Requirement: Unresolved payments favor access recovery
Pending or not-yet-granted payment outcomes SHALL suppress repeat purchase actions and provide an explicit access check. Cancellation and ordinary failures SHALL remain distinguishable, and repeated actions SHALL NOT launch concurrent purchases or restores.

#### Scenario: Pending payment
- **WHEN** checkout returns a pending outcome
- **THEN** the user sees that another payment is unnecessary and can refresh access while purchase actions remain suppressed until the unresolved outcome is cleared

#### Scenario: Access not yet granted
- **WHEN** checkout completes without the expected entitlement
- **THEN** the UI offers access recovery and does not invite an immediate second purchase

#### Scenario: Account changes during checkout
- **WHEN** the signed-in account changes while checkout or restore is pending
- **THEN** its late result cannot grant access or display a success notice for the new account

### Requirement: Existing members can use and manage access
Active members SHALL receive actions to view insights at `/journal?tab=insights`, log movies at `/journal`, and manage or recover billing. Legacy active entitlements SHALL retain the same benefits without a repurchase prompt. Cancellation SHALL preserve access through the paid period.

#### Scenario: Active member
- **WHEN** a member opens the membership page or dialog
- **THEN** it shows accurate access status and benefit actions instead of a purchase pitch, with a safe management link when available

#### Scenario: Legacy lifetime grant
- **WHEN** an existing lifetime customer has active access
- **THEN** benefits remain active without an invented renewal date or a new one-time sale offer

#### Scenario: Platform restoration
- **WHEN** a member requests purchase recovery
- **THEN** mobile offers Restore purchases and web offers Check account purchases, with truthful platform-specific guidance when no purchase is found

#### Scenario: Failed access refresh
- **WHEN** a member's refresh fails during an outage
- **THEN** valid existing access remains intact and the UI reports verification failure rather than fresh confirmation

### Requirement: Other access and privacy boundaries remain independent
Membership changes SHALL preserve account isolation, optional analytics choices, logged-out browsing, and free privacy requests and account deletion. Server-verified Anime/raw access and the disabled availability-alert pilot SHALL retain their existing separate eligibility rather than being promised as universal member benefits.

#### Scenario: Analytics declined
- **WHEN** an adult user declines optional analytics
- **THEN** membership and purchase recovery remain usable without opting them into measurement

#### Scenario: Local membership is active
- **WHEN** a local entitlement is active but server-only access is denied
- **THEN** the local paid benefits remain accurate and no server-only capability is unlocked or advertised as guaranteed
