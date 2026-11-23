# App stability

## Purpose

Keep the app usable through platform lifecycle changes on every supported Android version, and keep error reporting focused on failures in Yify's own code.

## ADDED Requirements

### Requirement: In-app navigation survives navigation container teardown

Screens and components SHALL navigate through the router bound to their own Expo Router tree, so a navigation container mounting or unmounting elsewhere cannot make an in-app navigation fail.

#### Scenario: Global imperative router is unbound

- **WHEN** Expo Router has reset its module-level imperative router because a navigation container was torn down, and the user taps a top-bar destination
- **THEN** the app navigates to that destination without an error

#### Scenario: Destination already in the stack

- **WHEN** the user selects a destination whose route is already in the native stack
- **THEN** the app returns to that route instead of pushing a duplicate

#### Scenario: Same route with new browse parameters

- **WHEN** the selected destination is the current route with different browse parameters
- **THEN** the parameters update in place without a new navigation

### Requirement: Supported Android versions start the app

The Android app SHALL install Expo Modules v2 and launch on every supported API level from Android 7.0 (API 24), including runtimes that lack `java.nio.file`.

#### Scenario: Android 7.1 launch

- **WHEN** the release build starts on an API 25 device
- **THEN** Expo Modules v2 installs, the ExpoApplication module is available and the first screen renders without a fatal error

#### Scenario: Current Android launch

- **WHEN** the same build starts on a current Android version
- **THEN** startup, consent and navigation behave as before

### Requirement: Web error reporting excludes browser extension failures

Web error reporting SHALL drop an error only when every stack frame of the original error belongs to a browser extension, and SHALL keep errors with any application or unknown frame. Native error reporting is unchanged.

#### Scenario: Extension content-script failure

- **WHEN** an unhandled rejection's stack frames all use a `chrome-extension://`, `moz-extension://` or Safari extension URL
- **THEN** no error event is sent

#### Scenario: Application or mixed stack

- **WHEN** an error's stack contains an application frame, or no frame URL at all
- **THEN** the error is sanitized and reported as before
