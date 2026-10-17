## ADDED Requirements

### Requirement: Existing journeys remain readable at narrow widths and enlarged text

Primary filled actions SHALL use legible foreground/background combinations in both themes. Existing navigation, Journal actions and consent disclosures SHALL accommodate narrow windows and enlarged text without overlapping controls or truncating destination names.

#### Scenario: Compact navigation with larger text
- **WHEN** a customer uses compact navigation with enlarged text
- **THEN** full destination labels are scrollable and the active/focused destination can be revealed, while content remains below the header

#### Scenario: Consent and Journal controls
- **WHEN** optional analytics disclosures or Journal actions occupy a narrow window
- **THEN** prose has readable width, controls wrap/grow without clipping and consent defaults and existing actions remain unchanged

### Requirement: Membership presentation distinguishes action and verified access

The Plus page and dialog SHALL separate the primary plan/account action from existing-purchase recovery. Actual full charges and billing terms SHALL remain visible. Cached unverified access SHALL NOT be described as verified active benefits, and billing-recovery instructions SHALL correspond to available actions. Cached paid suppression and duplicate-payment guards SHALL remain intact.

#### Scenario: Cached access is being checked
- **WHEN** a cached ad-free grant exists but current purchase readiness is false
- **THEN** the interface explains verification, does not assert active verified benefits or renewal dates, and does not offer another payment

#### Scenario: Billing management link is unavailable
- **WHEN** a billing issue exists without a safe management link
- **THEN** recovery describes a usable account/store route without directing the user to a missing in-app button

#### Scenario: A free journal entry is saved
- **WHEN** a free customer saves an entry and follows the insights action
- **THEN** its label clearly identifies Plus exploration while verified members retain direct insight language

### Requirement: Missing series metadata has an honest recovery state

An absent series title SHALL be distinguished from a failed lookup and a valid title without episode releases, with an existing browse or retry path.

#### Scenario: Series is absent
- **WHEN** a successful title lookup contains no matching series
- **THEN** the screen explains the missing title rather than presenting a generic blank series, and provides recovery

#### Scenario: A valid series has no episodes
- **WHEN** metadata identifies the series but no episodes are listed
- **THEN** the valid title remains visible with its specific empty-release state
