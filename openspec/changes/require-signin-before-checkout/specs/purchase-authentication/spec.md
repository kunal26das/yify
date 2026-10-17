## ADDED Requirements

### Requirement: Checkout requires the current signed-in customer

Native and web purchase repositories SHALL invoke checkout only for a ready, nonempty identified account matching the current RevenueCat customer. They SHALL check identity before accepting work and again immediately before opening billing. Rejected authentication attempts SHALL NOT invoke the billing SDK or emit checkout-start analytics.

#### Scenario: Authentication is unresolved or signed out
- **WHEN** a caller requests a purchase before identity resolution or after confirmed sign-out
- **THEN** checkout is rejected even if the anonymous customer has loaded valid offers

#### Scenario: Identity is invalid or identification failed
- **WHEN** the account UID is blank, identification has not completed, or the SDK customer differs from the requested account
- **THEN** no purchase SDK is invoked and no purchase is reported successful

#### Scenario: Account changes while checkout waits
- **WHEN** sign-out or an account switch occurs after purchase is queued but before billing starts
- **THEN** the obsolete request is rejected without charging either account

#### Scenario: Native identity lookup races with sign-out
- **WHEN** sign-out occurs while the final native SDK customer lookup is pending
- **THEN** checkout rechecks the current account after that lookup and does not open billing

#### Scenario: Signed-in customer explicitly buys a plan
- **WHEN** a ready identified customer matching RevenueCat explicitly requests a current offer
- **THEN** normal checkout proceeds and concurrent duplicate taps share a single purchase

### Requirement: Sign-in does not purchase or remove recovery access

The existing modal and membership page SHALL require confirmed sign-in before exposing checkout on Android, iOS and web. Sign-in completion and plan selection SHALL NOT themselves trigger a purchase. Anonymous plan browsing, verified legacy access, explicit restore and account checks SHALL retain their existing behavior.

#### Scenario: Guest signs in on a page or modal
- **WHEN** a guest completes sign-in while viewing Plus plans
- **THEN** the customer must make a separate explicit purchase action before checkout starts

#### Scenario: Sign-in fails, is cancelled or redirects
- **WHEN** sign-in does not produce a confirmed account
- **THEN** no checkout can start

#### Scenario: A stale signed-in UI handler runs after sign-out
- **WHEN** a previous purchase action is invoked after the current session has signed out
- **THEN** it does not call the purchase repository

#### Scenario: Anonymous customer checks existing access
- **WHEN** a signed-out customer browses plans or invokes a supported explicit restoration/account check
- **THEN** those existing non-purchase operations remain available without starting a new charge
