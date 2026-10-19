# Spec Delta

## Purpose

Make Android production delivery traceable to the exact tested binary and distinguish a store upload from a release that users can install.

## ADDED Requirements

### Requirement: Production submission uses the verified candidate
The release record SHALL bind the source revision, build identifier, signed bundle hash, upload certificate, package, version code, runtime and update channel to one candidate. Production submission SHALL use that candidate only after its artifact and installed-device gates pass.

#### Scenario: Candidate passes the gate
- **WHEN** the finished bundle and installed APKs match the expected identity and required checks pass
- **THEN** the release owner can submit that exact build once to the production track

#### Scenario: Candidate identity differs
- **WHEN** the bundle, installed package or submission references a different build or version
- **THEN** previous evidence cannot approve or label that candidate as verified

#### Scenario: Device evidence is incomplete
- **WHEN** compilation and bundle inspection pass but required installation or startup checks have not run
- **THEN** production submission remains pending and the missing checks are recorded

### Requirement: Publication states remain distinct
The release record SHALL distinguish queued build, verified candidate, accepted submission, Play production availability and version-specific health. A queued job or accepted upload SHALL NOT be recorded as a shipped runtime.

#### Scenario: Upload is accepted but review is pending
- **WHEN** the store accepts the production upload but users cannot yet obtain the release
- **THEN** the record reports submission success and leaves availability and ledger reconciliation pending

#### Scenario: Release becomes available
- **WHEN** the production listing shows the intended version available and the store artifact matches the tested bundle
- **THEN** the shipped-runtime ledger can record that confirmed release with its observed availability time

#### Scenario: Outcome is ambiguous
- **WHEN** a build or upload command ends without a reliable receipt
- **THEN** the owner inspects remote build, submission and store state before any retry

### Requirement: Untested behavior remains explicit
The release record SHALL identify journeys and health checks that were not executed. Tests with temporary APK signing SHALL NOT establish Play-delivered signing or billing behavior.

#### Scenario: Isolated device check passes
- **WHEN** the candidate starts and retains optional analytics consent on an isolated device
- **THEN** those observed paths are reported as passing while connected account, purchase, provider and Play-installed behavior retain their actual verification status

#### Scenario: Crash-health exposure is insufficient
- **WHEN** matching crash reports are absent but the new version lacks a sufficient observation window or exposure
- **THEN** recovery remains inconclusive rather than confirmed
