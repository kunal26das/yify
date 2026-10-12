# Dependency recovery

## Purpose

Keep eligible Dependabot updates moving after validated main-branch repairs while preserving dependency and workflow provenance safeguards.

## ADDED Requirements

### Requirement: Recover eligible clean-install failures

The system SHALL consider a uniquely identified completed failed clean-install job on the current unrefreshed eligible Dependabot PR when recovering outdated updates after successful current-main CI, without requiring one of the three mandatory jobs to have failed.

#### Scenario: Clean install alone failed

- **WHEN** all required CI jobs passed, the current scope's clean-install job failed, main has advanced successfully, and the PR is eligible under existing policy
- **THEN** recovery requests a verified Dependabot rebase and requires the resulting checks and lockfile provenance before merging

#### Scenario: Incomplete or unrelated job evidence

- **WHEN** the clean-install job is missing, duplicated, pending, cancelled, skipped, successful, or for another dependency scope, and no required job failed
- **THEN** recovery does not request a rebase on that evidence

#### Scenario: Unreviewed update or stale source

- **WHEN** the update is outside the existing merge policy or the source head, run, attempt, or PR association no longer matches
- **THEN** recovery does not bypass the existing eligibility or provenance checks
