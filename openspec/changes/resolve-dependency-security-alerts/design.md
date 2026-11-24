# Design

## Decisions

None of the advisories has a backport for the installed majors, so each vulnerable copy moves to the first fixed major. Overrides are exact and scoped to the consumers that install a vulnerable copy (`**/<consumer>/<package>`). Unscoped overrides would also replace the minimatch 3 copies used by ESLint 9 and glob 7, and the EAS `minimatch` 5.1.9 pin, all of which call the default export as a function.

Minimatch 11 removes `makeRe()`, `Minimatch#regexp`, the `AST` class, the `debug` option and internal helpers; glob 14 adopts minimatch 11 and changes walker internals and leading-slash `ignore` handling. Every overridden consumer was read and calls only retained entry points: `minimatch()`, `new Minimatch()` with `match`, `negate`, `pattern` and `set`, and `glob()`, `globSync()` or `sync()`. Electron Builder's file selection was replayed against both minimatch versions with its own filter and this repository's packaging patterns.

`eas-cli/minimatch` stays at 5.1.9: EAS CLI 27.11.0 still calls `__importDefault(require('minimatch')).default`, and minimatch 11's CommonJS build sets `__esModule` without a `default` export. 5.1.9 is below the vulnerable range.

`@grpc/grpc-js` moves to 1.14.7 within major 1. Its only consumer is Firestore's Node build in the Firebase JavaScript SDK; the app reaches Firestore through REST endpoints, and Firebase JavaScript stays at 13.1.0 for React Native Firebase.

The Babel 7 regexp helper, regexpu-core and regjsparser advance together because helper 7.29.14 requires regexpu-core ^6.5.4, which requires regjsparser ^0.14.0. Babel 8 and regjsparser 1.0 stay out of range. The watcher's review policy records the exact candidates and consumers for every retained older major, so a newer release or consumer change reopens #921. The detailed review is in `docs/dependency-pin-review.md`.

## Risks / Trade-offs

Forced majors can change behavior in untested paths. The replayed Electron Builder selection, both web exports, Android regeneration, the release console's EAS tests and the full test suites cover the consumers that run in this repository; macOS universal packaging, which would use `@electron/universal`, is not configured.

## Migration Plan

Merge after #1106 with required CI, then build runtime 1.8.33 from main. GitHub closes the alerts when its lockfile scan finds no vulnerable version, and the watcher closes #921 on its next run with zero findings. Roll back by reverting the squash commit.
