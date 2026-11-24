# Proposal

## Why

GitHub reports seven open Dependabot security alerts on main, all on transitive packages: `@grpc/grpc-js` 1.9.16 (high and low, GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4), `joi` 18.2.9 in the release console (high, GHSA-4528-x5fx-h6hg), and `minimatch` 9.0.9/10.2.6 and `glob` 10.5.0/13.0.6/13.0.7 in both installations (medium, GHSA-g3hv-75wg-m249 and GHSA-3g3m-2fjr-6pw4). [Issue #921](https://github.com/kunal26das/yify/issues/921), the dependency watcher's tracking issue, also lists ten pinned overrides and aliases needing review.

## What Changes

- Move every vulnerable copy to its first fixed release line with exact overrides scoped to its consumers: `@grpc/grpc-js` 1.14.7, `joi` 18.3.2, `minimatch` 11.0.9 and `glob` 14.0.6.
- Advance #921's pins within compatible majors: the Babel 7 regexp helper 7.29.14 with regexpu-core 6.5.4 and regjsparser 0.14.1, Material Symbols 0.4.54, Electron-to-Chromium 1.5.493, the Babel 7 alias 7.29.13, parse-duration 2.1.11 and tar 7.5.23.
- Record exact reviews for the older majors that stay: Babel 7 for the alias and regexp helper, regjsparser 0.14 and the `eas-cli/minimatch` 5.1.9 compatibility pin.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is dependency maintenance; the change declares `skip_specs: true`.

## Impact

Root and release-console lockfiles, resolution overrides, the Babel 7 alias, the watcher's review policy and its tests. The overridden packages are build, packaging, release-console and Node-only Firestore tooling; no native module changes. The JavaScript bundle is compiled with the updated Babel 7 alias and regexp helpers, so these changes ship with runtime 1.8.33.
