# Spec Delta

## Purpose

Determine optional analytics eligibility from the recorded purpose, applicable policy and user choice without interpreting uncertain geography or a default setting as consent.

## ADDED Requirements

### Requirement: Regional defaults require a current purpose-specific assessment

The system SHALL enable optional analytics by regional default only for an adult with no prior decision, after presenting the notice and verifying a current rule for the jurisdiction, purpose, provider configuration and platform. Missing or uncertain evidence SHALL keep optional collection off pending a valid explicit choice and applicable restrictions.

#### Scenario: Current assessment permits the exact configuration
- **WHEN** a new adult user has no prior decision and verified jurisdiction evidence matches a current approved rule for the exact purpose, provider configuration and platform
- **THEN** only that purpose becomes eligible after its default-on explanation is displayed
- **AND** the recorded basis is a regional default, not affirmative consent

#### Scenario: Jurisdiction or assessment cannot be established
- **WHEN** geography is unknown, conflicting or derived only from a selected streaming country, or the matching policy is absent, expired or unavailable
- **THEN** optional collection remains off until a valid explicit choice is made
- **AND** language, time zone, purchase country or a US fallback does not create eligibility

### Requirement: Explicit decisions survive policy and location changes

The system SHALL preserve explicit refusal independently of notice versions, travel, account changes and rollout assignment. Existing permission SHALL authorize only its recorded purposes and notice scope. Missing, corrupt or unwritable records SHALL never silently authorize a default.

#### Scenario: An earlier refusal meets an eligible regional default
- **WHEN** a user who refused analytics changes country, signs in or receives a newer notice or default-on policy
- **THEN** the refusal remains effective for its recorded scope
- **AND** the system does not reinterpret that refusal as an unset decision

#### Scenario: Permission predates a newly added purpose
- **WHEN** an existing permission does not cover a new optional purpose or expanded provider use
- **THEN** the new processing stays off until its own valid decision exists
- **AND** an editorial notice update does not force an adult declaration again

### Requirement: Product analytics and advertising have separate decisions

The system SHALL distinguish defined product analytics from advertising measurement, attribution and cross-service identifiers. Product analytics permission or a regional default SHALL NOT authorize those other purposes, personalized advertising or embedded media. Applicable provider, platform and browser opt-out signals SHALL constrain the relevant processing independently.

#### Scenario: Product measurement is allowed but advertising is not
- **WHEN** product analytics is eligible while advertising consent is absent or refused
- **THEN** product measurement does not enable ad storage, personalization, attribution or Firebase-to-RevenueCat measurement linkage
- **AND** advertising and media providers retain their separate controls

#### Scenario: A relevant platform opt-out applies
- **WHEN** a recognized privacy signal or platform restriction disallows the proposed data use
- **THEN** a regional default does not override that restriction

### Requirement: Defaults and explicit choices are explained accurately

The system SHALL explain the enabled purpose, providers and available refusal before optional collection starts. Users SHALL be able to enter and use the app with optional analytics off. Continuing with an untouched default-on control SHALL NOT be recorded as affirmative consent.

#### Scenario: A permitted default is displayed
- **WHEN** a new user is eligible for a regional default
- **THEN** the control explains that the measurement is on by regional default and can be turned off immediately or in Privacy preferences
- **AND** keyboard and assistive-technology users can make the same choice

### Requirement: Changes stop stale optional work

The system SHALL stop new optional collection on withdrawal or loss of eligibility and discard optional work queued under the previous decision. Delayed jurisdiction results SHALL NOT overwrite a displayed or submitted user choice. Storage or policy failures SHALL leave optional collection off and permit recovery without enabling it.

#### Scenario: Withdrawal occurs during asynchronous initialization
- **WHEN** a user refuses while policy lookup, SDK initialization or optional events are pending
- **THEN** the pending result does not enable collection or replay those events after a later opt-in

#### Scenario: A rollout is disabled
- **WHEN** the operator disables a regional rule
- **THEN** collection relying on that rule stops
- **AND** separately recorded valid explicit decisions remain intact subject to applicable restrictions

### Requirement: Requested services and minimized evidence remain separate

The system SHALL keep requested account and purchase access usable with optional analytics off and SHALL assess operational error reporting independently. Regional eligibility evidence SHALL NOT require retaining precise coordinates or raw IP addresses, and SHALL NOT be sent as behavioral analytics merely to prove the decision.

#### Scenario: A user refuses all optional measurement
- **WHEN** an adult refuses optional measurement
- **THEN** sign-in, purchase access, restoration and paid benefits remain usable
- **AND** operational error reporting does not inherit a legal basis from its implementation label
