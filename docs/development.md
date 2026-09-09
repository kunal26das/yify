# Development

[Back to README](../README.md)

## Setup

Use Node.js 24 and Yarn Classic, matching CI. Install with `yarn install --frozen-lockfile`.

| Platform | Command | Requirements |
| --- | --- | --- |
| Web | `yarn web` | Browser |
| Android | `yarn android` | Android SDK, JDK 17, emulator or connected device |
| iOS | `yarn ios` | macOS, Xcode at `/Applications/Xcode.app`, simulator |
| Desktop | `yarn desktop` | Exports web and launches Electron |
| Installed development build | `yarn dev` | A development build already installed on the device |

Native Firebase, Google Sign-In, and purchase modules require a development build;
use `yarn android` or `yarn ios` to build one locally. Expo Go does not include all of them.
Set `JAVA_HOME` to JDK 17 for local Android builds.

## Service configuration

[`.env.example`](../.env.example) lists the Firebase, Google OAuth, and RevenueCat
client configuration overrides. Copy it to `.env` when supplying your own values.
The app already includes Yify Firebase defaults; omitting `.env` does not disable Firebase.

For a fork or a different Firebase project:

- Replace `config/android/google-services.json` and `config/ios/GoogleService-Info.plist`.
- Set the web Firebase configuration and Google web client ID in `.env`.
- Enable Google sign-in and register the web domains and Android signing fingerprints.
- Use RevenueCat public SDK keys for the corresponding platform and project.

After changing native configuration, run `yarn prebuild`, review the generated
changes, and rebuild the app.

`EXPO_PUBLIC_*` values are bundled at build/export time. Restart the development
server or rebuild the export after changing them. Purchase and ad configuration is
covered in [RevenueCat operations](revenuecat-operations.md).
Error reporting and source-map uploads are covered in [Sentry setup](sentry.md).

## Working in the codebase

| Directory | Purpose |
| --- | --- |
| `app/` | Expo Router routes |
| `presentation/` | Screens, components, and view models |
| `domain/` | Entities, repository/service interfaces, and business rules |
| `data/` | API, storage, Firebase, purchases, and other implementations |
| `desktop/` | Electron shell |
| `release/` | Release console with its own dependencies |

Keep `domain` independent of the other layers. `data` and `presentation` use domain
interfaces and do not import each other. Dependencies are assembled in `data/di/`
and supplied to UI through `presentation/di/DependenciesContext.tsx`.

Platform-specific implementations use `.web.ts` or `.web.tsx` files; check both sides
when changing a shared interface. Reuse existing UI components and keep dependency
versions pinned in `package.json`. Commit `yarn.lock` with dependency changes.

## Validation

Run `npx tsc --noEmit` and `yarn test`. `yarn lint` checks style and layer boundaries;
it currently also reports existing React hook findings, so compare findings against
the baseline when reviewing a change.

For web changes, run `yarn export:hosting` and
`node scripts/check-web-export.mjs dist-hosting`, then check the rendered UI.
See [releases](releases.md) for distribution and production deployment.
