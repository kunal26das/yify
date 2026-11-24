# Evidence

## Alerts, 2026-11-24

`gh api repos/kunal26das/yify/dependabot/alerts?state=open` returned:

| Alert | Severity | Package | Lockfile | Vulnerable | Fixed |
| --- | --- | --- | --- | --- | --- |
| 115 | high | `@grpc/grpc-js` | `yarn.lock` | < 1.13.6 | 1.13.6 |
| 114 | low | `@grpc/grpc-js` | `yarn.lock` | < 1.13.6 | 1.13.6 |
| 139 | high | `joi` | `release/yarn.lock` | 18.0.0–18.3.0 | 18.3.1 |
| 143 | medium | `minimatch` | `yarn.lock` | 7.0.0–11.0.0 | 11.0.1 |
| 142 | medium | `minimatch` | `release/yarn.lock` | 7.0.0–11.0.0 | 11.0.1 |
| 140 | medium | `glob` | `yarn.lock` | 9.0.0–14.0.1 | 14.0.2 |
| 137 | medium | `glob` | `release/yarn.lock` | 9.0.0–14.0.1 | 14.0.2 |

The advisories list no backport for minimatch 9 or 10, glob 10 or 13, or grpc-js 1.9. Before the fix the vulnerable copies were: root minimatch 9.0.9 (`@electron/universal`) and 10.2.6 (`@expo/fingerprint`, `@typescript-eslint/typescript-estree`, `app-builder-lib`, glob 13), root glob 13.0.6 (`@sentry/bundler-plugins`), root grpc-js 1.9.16 (`@firebase/firestore` 4.19.0), release minimatch 9.0.9 (glob 10) and 10.2.6 (`@oclif/core`, glob 13), release glob 10.5.0 (`@expo/config-plugins` 10.1.2, `@expo/config` 11.0.13, sucrase) and 13.0.7 (`@expo/config-plugins` 55, `@expo/config` 55), and release joi 18.2.9 from the existing override.

## Compatibility

Consumer code read under `node_modules`: `@electron/universal` and `@typescript-eslint/typescript-estree` call the named `minimatch()`; `@expo/fingerprint` and `app-builder-lib` construct `Minimatch` and use `match`, `negate`, `pattern` and `set`; `@sentry/bundler-plugins` calls `glob(patterns, {absolute, nodir})`; `@expo/config-plugins` calls `globSync()`; `@expo/config` calls `glob.sync()`; `@oclif/core` does not call minimatch in its library code. Glob 14.0.6 exports `glob`, `sync`, `globSync`, `globIterate` and `globStream`; minimatch 11.0.9 exports `minimatch`, `Minimatch`, `filter`, `match`, `braceExpand`, `defaults` and `GLOBSTAR` and no `default`.

EAS CLI 27.11.0 `build/credentials/ios/validators/validateProvisioningProfile.js` calls `(0, minimatch_1.default)(expectedBundleIdentifier, actualBundleIdentifier)` after `__importDefault(require("minimatch"))`, so its 5.1.9 pin stays.

Electron Builder's own `createFilter` and `hasMagic`, with this repository's `files`, build-resource, output and default exclusion patterns, evaluated 38,049 real paths with minimatch 10.2.6 and 11.0.9: 9 included paths and 0 differing decisions.

## Local checks

After `yarn install` in both installations, frozen installs leave both lockfiles unchanged; postinstall reports `Expo RN 0.88.1 compatibility: 2 applied, 105 verified.` and the tooling and Firebase policies pass. Neither lockfile contains a version inside any advisory range; remaining copies are minimatch 3.1.5, 5.1.9 and 11.0.9, glob 6.0.4 (release), 7.2.3 (root) and 14.0.6, grpc-js 1.14.7 and joi 18.3.2.

Exact pins, typecheck, `yarn test` (2,475 of 2,476 app tests with the existing skip and 51 workspace tests), update channel, the reviewed Expo doctor, both web export checks, `expo prebuild --platform android --no-install --clean` with no `android/` diff, the release console's typecheck, 151 tests and build, and the local dependency watcher (`0 findings, 0 incomplete checks`) pass. The watcher tests follow the refreshed review records.
