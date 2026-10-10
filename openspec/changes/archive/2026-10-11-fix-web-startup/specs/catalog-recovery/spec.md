# Spec Delta

## ADDED Requirements

### Requirement: Web startup preserves the home layout
After adult confirmation, the web homepage SHALL render a stable loading layout whose visible sections can load independently, without waiting for every font or replacing the entire homepage when the hero becomes ready.

#### Scenario: Hero is slower than a visible shelf
- **WHEN** the initial hero response is delayed and a visible shelf succeeds
- **THEN** the shelf is browsable while the hero remains a placeholder in the same page

#### Scenario: Custom fonts are unavailable
- **WHEN** web fonts are delayed or fail
- **THEN** the user can see and operate consent controls or the eligible homepage using fallback text

#### Scenario: First-ever visitor
- **WHEN** no valid adult confirmation is saved
- **THEN** the existing adult confirmation dialog remains required, optional analytics remains off by default, and catalog/bootstrap requests do not start before confirmation

#### Scenario: Returning visitor
- **WHEN** a valid adult confirmation is saved
- **THEN** its choices are retained and the homepage starts without requiring confirmation again

### Requirement: Web offline feedback requires corroboration
The web app SHALL NOT report an outage solely because a browser reports offline when the site remains reachable. A confirmed disconnection SHALL retain offline feedback and recovery; provider or HTTP errors SHALL remain request failures rather than device-offline claims.

#### Scenario: Browser reports offline but site responds
- **WHEN** the browser reports offline and a same-origin check receives an HTTP response
- **THEN** the offline banner stays hidden and catalog requests remain usable

#### Scenario: Disconnection and recovery
- **WHEN** a negative browser report is corroborated by failed reachability and connectivity subsequently returns
- **THEN** the offline banner appears for the outage and clears after recovery, allowing failed content to retry

#### Scenario: Stale connectivity result
- **WHEN** a pending check completes after a newer connectivity event
- **THEN** it cannot overwrite the newer connectivity state
