# spec-validation Specification

## Purpose

Keep Yify's requirements, proposed changes, and archived completion records structurally valid in the same CI gate used to assess application changes.

## Requirements

### Requirement: Active and canonical artifacts are checked
The required CI test job SHALL strictly validate all active OpenSpec changes and canonical specs, and fail when any artifact is invalid.

#### Scenario: Valid requirements
- **WHEN** a proposed change contains valid requirements and scenarios
- **THEN** the spec-validation step succeeds and the remaining application checks can run

#### Scenario: Malformed requirement
- **WHEN** a requirement lacks a required scenario
- **THEN** the spec-validation step exits unsuccessfully and the required job cannot pass

### Requirement: Incomplete archives are rejected
The required CI test job SHALL reject archived changes containing incomplete tasks. An active plan MAY retain incomplete tasks without claiming implementation or release completion.

#### Scenario: Open work remains active
- **WHEN** a valid active Android release plan still has uncompleted device checks
- **THEN** structural validation succeeds while its task progress remains incomplete

#### Scenario: Premature archive
- **WHEN** an archived change contains an unchecked task
- **THEN** archive validation fails

### Requirement: Validation uses a declared tool version
CI and contributor instructions SHALL use the same exact OpenSpec CLI version. CI SHALL disable OpenSpec usage telemetry and require a recognized OpenSpec root before artifact validation.

#### Scenario: Fresh runner
- **WHEN** CI starts on a runner without OpenSpec installed
- **THEN** it runs the declared version and validates the checked-out repository with telemetry disabled

#### Scenario: Missing project root
- **WHEN** the checkout has no OpenSpec root
- **THEN** the doctor command exits unsuccessfully instead of proceeding with validation
