# Spec Delta

## Purpose

Make Android crash-release decisions traceable to the exact installed candidate, observed journeys and delivery evidence, without treating an uploaded artifact as recovery.

## ADDED Requirements

### Requirement: Evidence identifies the candidate
The release verifier SHALL bind its result to the expected source, build identifier, artifact hash, package identity, signing certificate, version code and runtime. A mismatch SHALL prevent that result from approving the candidate.

#### Scenario: Intended candidate
- **WHEN** the expected signed bundle is converted to device APKs and installed
- **THEN** the report records the verified bundle and installed package identities with the device and test results

#### Scenario: Superseded evidence
- **WHEN** a supplied artifact or installation belongs to another candidate
- **THEN** verification fails and a previous candidate's screenshot or receipt cannot satisfy the current device check

### Requirement: Release evidence distinguishes execution outcomes
The verification report SHALL distinguish passed, application-failed and not-executed checks. Compilation, static inspection, symbol ingestion and mocked journeys SHALL NOT stand in for device or connected-provider results.

#### Scenario: Framework failure and recovery control
- **WHEN** the malformed-intent regression is exercised on supported Android framework targets
- **THEN** the report records the legacy failure control and corrected repeated and lifecycle cases on each target

#### Scenario: Infrastructure unavailable
- **WHEN** an emulator cannot start or a runner lacks required virtualization access
- **THEN** affected cases are reported as not executed, with the infrastructure cause, rather than as passing or as candidate defects

### Requirement: Connected journeys preserve access and consent
Release readiness SHALL include candidate-specific consent, restart, browsing, sign-in, subscriber access, purchase and restore evidence. Provider tests SHALL use a valid test configuration or an explicitly authorized bounded account, without disclosing account identifiers in public evidence.

#### Scenario: Optional analytics declined
- **WHEN** an adult user continues with optional analytics off and restarts the app
- **THEN** browsing remains available and the choice remains off without optional analytics events being sent

#### Scenario: Subscriber and account boundary
- **WHEN** a verified subscriber signs in and then switches to an account without that entitlement
- **THEN** protected access follows the current account and does not carry the previous account's entitlement across the switch

#### Scenario: Billing evidence is inapplicable
- **WHEN** a purchase or restore check uses an incompatible installer, signature or billing account
- **THEN** the report leaves that journey unverified and identifies the missing prerequisite

### Requirement: Delivery and recovery remain distinct
Release records SHALL distinguish submission acceptance, store availability and observed crash recovery. Recovery claims SHALL include the affected version, observation window, exposure and matching issue signatures; insufficient exposure SHALL remain inconclusive.

#### Scenario: Submitted but unavailable
- **WHEN** Expo accepts a submission but Play has not made it available
- **THEN** the record reports submission only and leaves user availability unverified

#### Scenario: Too little usage
- **WHEN** no matching crashes arrive but the new version has insufficient observed sessions
- **THEN** the record reports inconclusive recovery and leaves incident observation open

#### Scenario: Runtime incompatibility
- **WHEN** the fix changes native code beyond an installed runtime
- **THEN** delivery requires a compatible store binary and cannot be reported as fixed by an OTA to that older runtime
