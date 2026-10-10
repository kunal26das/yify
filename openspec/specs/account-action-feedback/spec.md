# account-action-feedback Specification

## Purpose
Make existing account, supporter and privacy actions communicate verified outcomes and useful recovery without changing entitlements or consent.

## Requirements

### Requirement: Sign-out matches the authenticated session
An unsuccessful authentication sign-out SHALL preserve the account state and show retryable feedback. A successful authentication sign-out SHALL clear the app session even if secondary provider cleanup fails.

#### Scenario: Authentication failure
- **WHEN** Firebase rejects sign-out
- **THEN** the signed-in account remains visible and the user can retry rather than seeing false signed-out state

#### Scenario: Provider cleanup failure
- **WHEN** Firebase signs out but optional Google-provider cleanup fails
- **THEN** the app remains signed out

### Requirement: Access refresh reports verification outcome
An explicit supporter-access refresh SHALL distinguish successful verification from a failed attempt while retaining otherwise valid cached access during an outage.

#### Scenario: Cached entitlement during outage
- **WHEN** a previously ready supporter refresh fails
- **THEN** the UI reports that refresh failed without claiming access was freshly verified or revoking the cached grant

### Requirement: Deletion communicates partial and final outcomes
Account deletion SHALL distinguish deleted synced data from a deleted account, show failure or cancellation feedback, prevent conflicting account actions while pending, and explain that deleting the account does not cancel store billing.

#### Scenario: Reauthentication is cancelled
- **WHEN** synced data was deleted but account deletion is cancelled or fails
- **THEN** the account is not described as deleted and the user is told what remains and can retry

#### Scenario: Deletion succeeds
- **WHEN** both data and authentication deletion complete
- **THEN** the user receives account-deleted confirmation

### Requirement: Existing external actions disclose failure
Privacy-form and external support-link failures SHALL display useful retry feedback without unhandled errors or changes to consent.

#### Scenario: Privacy form fails
- **WHEN** the advertising privacy form cannot open
- **THEN** the operation becomes available for retry and the failure is announced without enabling ads

#### Scenario: Support link fails
- **WHEN** a browser cannot open an existing support or website link
- **THEN** the app explains the failure and remains usable
