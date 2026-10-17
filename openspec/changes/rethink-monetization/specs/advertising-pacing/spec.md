# Spec Delta

## Purpose

Keep Android movie browsing usable by limiting actual interstitial displays, continuing requested content promptly, and protecting customers with existing paid access.

## ADDED Requirements

### Requirement: Movie-open ads have a bounded cadence
Android interstitials SHALL leave the first two movie opens of an app session uninterrupted, require at least three movie opens between actual displays, and require at least 120 seconds between actual displays. Queue advancement SHALL NOT count as a qualifying movie open or present an ad.

#### Scenario: New session
- **WHEN** a free user opens the first, second and third movie in a session with a loaded eligible ad
- **THEN** the first two opens proceed without an interstitial and the third is the earliest eligible opportunity

#### Scenario: Repeated browsing
- **WHEN** an interstitial has actually opened
- **THEN** another cannot display until both three subsequent movie opens and 120 seconds have elapsed

#### Scenario: Playback queue advances
- **WHEN** playback moves to the next queued item
- **THEN** it neither presents an interstitial nor advances the movie-open pacing count

### Requirement: Display allowance follows actual opening
Only an actual interstitial opening SHALL start the cooldown and reset the movie-open display allowance. Missing inventory, load failure, rejected presentation, or an attempt that never opens SHALL NOT consume that allowance or delay requested content to wait for inventory.

#### Scenario: No fill at an eligible opportunity
- **WHEN** an otherwise eligible movie open has no loaded ad
- **THEN** content proceeds, no display is recorded, and the next movie open can attempt a newly loaded ad without another three-open wait

#### Scenario: Presentation fails
- **WHEN** a requested ad fails before opening
- **THEN** the app continues to the requested content and retains the unused display allowance

#### Scenario: Ad actually opens
- **WHEN** the ad SDK reports that the interstitial opened
- **THEN** pacing records one actual display and duplicate callbacks do not consume additional allowance

### Requirement: Ad completion does not trigger a sales interruption
The app SHALL continue to the requested content after an ad finishes without automatically opening or waiting for supporter offers. Existing voluntary membership entrypoints SHALL remain available.

#### Scenario: Ad closes
- **WHEN** a qualifying interstitial closes
- **THEN** the requested content continues without a supporter dialog or offer-loading delay

### Requirement: Cached supporters do not preload advertising
An existing cached paid grant SHALL suppress new native ad preloads and retries even while entitlement verification is incomplete. Unresolved entitlement SHALL continue to suppress ad display, and advertising consent controls SHALL remain required independently of pacing.

#### Scenario: Cached paid startup
- **WHEN** the current account has cached paid access while customer verification is pending
- **THEN** initialization, foreground recovery and connectivity recovery do not create a new ad request

#### Scenario: Paid state changes during loading
- **WHEN** a pending connectivity check or failed ad request completes after the current account gains cached or verified paid access
- **THEN** it cannot start a new load or retry for that paid state

#### Scenario: Confirmed free access
- **WHEN** verification subsequently confirms free access
- **THEN** a later eligible movie-open, foreground or connectivity trigger can resume loading, subject to consent and pacing

#### Scenario: Consent withdrawn
- **WHEN** advertising consent no longer permits requests
- **THEN** pacing does not bypass the existing request and display restrictions
