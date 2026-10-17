## ADDED Requirements

### Requirement: Customers select a real Plus billing plan before checkout

The membership page and voluntary modal SHALL present only delivered supported recurring offers as an accessible single-selection group, followed by one explicit purchase action for the current selected offer. Each offer SHALL disclose the full localized charge and actual renewal or prepaid terms. Selecting a plan or signing in SHALL NOT initiate a purchase.

#### Scenario: Both real billing periods are available
- **WHEN** a current-account response supplies monthly and yearly offers
- **THEN** the page shows their real prices and periods, initially selects yearly and exposes only one checkout action for that selection

#### Scenario: A deliberate selection survives refresh
- **WHEN** a customer selects monthly and plans reload or a yearly plan appears
- **THEN** monthly remains selected while still present and transient loading exposes no stale checkout

#### Scenario: The selected plan disappears
- **WHEN** a settled current-account response no longer contains the selected offer
- **THEN** a real remaining plan is selected and an accessible notice asks the customer to review it before an explicit checkout

#### Scenario: Access or payment is unresolved
- **WHEN** account identity is changing, another operation is busy or payment remains pending/not granted
- **THEN** no stale or duplicate checkout can run and existing access recovery remains available

### Requirement: Yearly catalog changes preserve existing purchases

Verified yearly store and Web Billing products SHALL grant the existing Plus entitlement through a yearly package, while current monthly prices, billing periods, package links and legacy purchase ownership remain intact. No existing subscriber SHALL be automatically migrated or repriced.

#### Scenario: Yearly is unavailable or removed from sale
- **WHEN** no verified yearly package is returned or yearly sales are rolled back
- **THEN** no yearly placeholder is shown, monthly recovery remains available and existing yearly ownership is preserved

#### Scenario: Yearly activity is measured
- **WHEN** a delivered P1Y offer starts or finishes checkout
- **THEN** the bounded subscription funnel identifies its plan kind as yearly without logging a payment transaction or customer identity
