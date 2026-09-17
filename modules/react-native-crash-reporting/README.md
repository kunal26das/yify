# React Native crash reporting

An independent, dependency-injected bridge between Sentry JavaScript exceptions and Firebase
Crashlytics. Importing it has no side effects. It imports no application code, Expo, React Native,
Firebase or Sentry SDK; its only runtime dependency is `error-stack-parser`.

The host supplies SDK adapters and owns credentials, consent, privacy filtering, native configuration
and source-map uploads. Tested with React Native 0.86.2, React Native Firebase 24.1.1 and
Sentry React Native 8.26.0. Other SDK versions need integration verification.

## Review and test

`index.ts` is the public API. `src/bridge.ts` wires the injected SDKs; the other source files contain
grouping, global fatal handling, Sentry capture and nonfatal forwarding. `tests/` is self-contained.

```sh
cd modules/react-native-crash-reporting
yarn install
yarn test
yarn typecheck
```

Copy this directory into another React Native project and install its declared dependency, or add
it as a local package with `yarn add file:./modules/react-native-crash-reporting`. The package ships
TypeScript source for Metro. It is private and has not been published to a registry.

## Connect a native host

Create the bridge exactly once per JavaScript runtime, before importing any code that loads Firebase
Crashlytics. Its loader must perform the first runtime import of the SDK: the module captures React
Native's original handler before that import installs Firebase's handler. Use a no-op host in
development and a separate `.web.ts` host for browsers.

```ts
import {createCrashReportingBridge} from './modules/react-native-crash-reporting';

export const crashReporting = createCrashReportingBridge({
    errorUtils: ErrorUtils,
    loadCrashlytics: () => require('@react-native-firebase/crashlytics'),
    exceptionsManager: require('react-native/Libraries/Core/ExceptionsManager').default,
    groupingNamespace: 'MyAppCrash',
    attributes: {app_channel: 'production'},
});
```

`exceptionsManager` is optional, but required to intercept React Native 0.86's uncaught render path.
It is a private React Native API; recheck the adapter after a framework upgrade. Keep the namespace
stable between releases. `globalMechanism` defaults to `react_native.crash_bridge.global` and must
also stay consistent with the bridge's exclusion rule. Metadata writes default to a 500 ms deadline;
Sentry capture/flush gets at most 2 seconds before Firebase's fatal handler proceeds.

Initialize Sentry next, then connect it before loading the router or application. Add this to your
own Sentry options; keep the rest of your integrations and privacy policy. `sanitizeErrorEvent` below
is your application's filter and can return `null` to discard an event.

```ts
import * as Sentry from '@sentry/react-native';
import {crashReporting} from './crash-reporting';
import {sanitizeErrorEvent} from './your-privacy-filter';

Sentry.init({
    dsn: YOUR_SENTRY_DSN,
    integrations: [Sentry.reactNativeErrorHandlersIntegration({onerror: false})],
    beforeSend: async (event, hint) => {
        const clean = sanitizeErrorEvent(event);
        if (clean) await crashReporting.mirrorException(clean, hint);
        return clean;
    },
});
crashReporting.connectSentry(Sentry);
```

The native `onerror: false` override leaves Sentry's promise rejection tracking enabled and gives
the bridge ownership of the global fatal handler. Do not apply this override on web: retain Sentry's
normal browser error handling. A web host can export `createNoopCrashReportingBridge()`; it must never
load native Firebase modules.

Install/configure both native SDKs in the host and set these React Native Firebase options in its
`firebase.json`, then rebuild the native app:

```json
{
  "react-native": {
    "crashlytics_is_error_generation_on_js_crash_enabled": true,
    "crashlytics_javascript_exception_handler_chaining_enabled": false
  }
}
```

Native symbol and JavaScript source-map upload configuration belongs to the host's build pipeline.
This module does not install SDKs, change collection preferences or upload symbols.

## Behavior and limits

- Uncaught fatal JS errors reach Sentry first, then Firebase's fatal handler, even if Sentry fails
  or stalls. The native app terminates. Original React Native handling remains the fallback.
- Caught exceptions and promise rejections are mirrored as nonfatal reports. The mirror uses the
  supplied sanitized event, never the raw hint. Global fatal reports retain the original message
  and stack on the Firebase path; a Sentry filter alone does not redact that path.
- Grouping uses error type and failure location, including Hermes column offsets. Repeated events
  share an identity; different locations receive different identities. Firebase decides final
  grouping, and rebuilt bundles can move locations. Duplicate Sentry event IDs are bounded/deduped
  per bridge; distinct occurrences at the same location are still recorded.
- Firebase custom keys link reports to Sentry event IDs. Keys are session-wide and best-effort under
  concurrent errors. Collection-disabled hosts do not send Firebase reports.
- Native crashes/ANRs are captured independently by the SDKs. Browser/Electron renderer errors,
  historical Sentry imports, logs, traces and replay are outside this bridge. Crashlytics retains
  only the latest eight nonfatal reports; delivery may require relaunch. Exact event-count parity
  cannot be guaranteed. Firebase keeps JS bundle offsets; Sentry resolves uploaded source maps.

Before distributing another host, verify a release build with a handled exception, a rejected
promise, and fatal A/B/A crashes. Confirm both dashboards receive all five events, Firebase has
two fatal groups with two occurrences under A, and Sentry resolves original source locations.

Yify supplies its legacy `YifyReactNative` namespace, `yify.react_native.global` mechanism and Expo
release metadata through a thin host adapter. Its Android dashboard evidence and remaining iOS
verification status are recorded in the application's `docs/sentry.md`, outside this module.
