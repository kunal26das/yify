# CLAUDE.md

Guidance for agents working in this repository.

**Status (interim v2 file on `redesign/v2`).** Auto-memory notes about the v1 layers, barrels, the release console, GitHub Pages, Crashlytics or sign-in-gated purchases are historical; `docs/v2/SPEC.md` governs until v2 ships, then this file does. The docs stream replaces this interim version with the final one.

Yify v2 is a movie and TV discovery and watch-diary app for Android and the web, built with Expo SDK 58, React Native 0.88, React 19.3 and TypeScript 7. TMDB is the only catalog, always reached through the app's own edge API under `/api/v2` on EAS Hosting. v1 is the git tag `v1-baseline`; read a v1 file with `git show v1-baseline:<path>`.

## Commands

| Task | Command |
| --- | --- |
| Install | `yarn install --frozen-lockfile` (in a worktree add `--cache-folder "$HOME/.cache/yify-yarn/<branch>"`) |
| Exact pins, Firebase alignment, native patches applied | `yarn check:pins` |
| Typecheck | `yarn typecheck` |
| Lint: boundaries, navigation guards, tokens, no comments | `yarn lint` |
| Tests | `yarn test` |
| One test file | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup/register.mjs --test src/core/domain/slug.test.ts` |
| Expo dependency compatibility | `yarn check:expo` |
| Web export, then render and budget checks | `yarn export:web && yarn check:web` |
| Serve the web export | `yarn serve:web` |
| Dev server | `yarn start`, `yarn web`, `yarn dev` (installed development client) |
| Android | `yarn android`, `yarn android:debug` (JDK 17) |
| Regenerate `android/` | `yarn prebuild` |
| Brand files | `yarn brand:stamp`; `yarn check:release` before a release |
| Icon font and web fonts | `yarn build:icons`, `yarn build:fonts` |
| EAS | `yarn eas <args>` (`scripts/eas.sh`), `yarn build:android:preview`, `yarn build:android:production`, `yarn submit:android:production --id <buildId>`, `yarn update:android`, `yarn deploy:web:preview` |
| Play listing and staged rollout | `yarn release:play` |

Some scripts land with later parts: `check:web` (F0-D), `build:icons` and `build:fonts` (F0-C), `release:play` (P9).

## Architecture

- **Feature-sliced `src/`.** `src/core/` holds `domain`, `config`, `api`, `query`, `storage`, `store`, `navigation`, `platform` and `ui`. `src/features/<name>/` holds `shell`, `home`, `search`, `title`, `person`, `player`, `library`, `sync`, `account`, `settings`, `you`, `monetization` and `legacy`, each with `screens/`, `components/`, `hooks/`, `stores/`, `platform/` and `public/` as needed. `src/server/` is the edge API. Routes stay in the root `app/` as adapters of at most 30 lines. `src/app/` must never exist.
- **Aliases.** `@/*` maps to `src/*` and `@assets/*` to `assets/*`.
- **No barrels.** No `index.ts` or `index.tsx` under `src/`; import the module file directly.
- **Import boundaries** (A1.2, enforced by `yarn lint`): `core/domain` imports only `core/domain`; `core/config` imports only `core/domain` and `core/config`; the rest of `core` never imports features, server code or routes; a feature uses another feature only through its `public/` folder; routes import feature `screens/` and `public/` files only; server code imports only `src/server`, `core/domain` and `core/config`.
- **Platform-free core.** `core/domain` and `core/config` import no React, React Native, Expo, Firebase, Sentry or TanStack package.
- **Platform twins.** `.web.ts(x)` twins exist only in `src/core/platform/**`, `src/core/ui/**`, `src/features/<name>/platform/**`, the three named core adapters (`core/api/baseUrl`, `core/query/lifecycle`, `core/storage/kv`) and the three SSR route twins. No `Platform.OS`, `typeof window`, `typeof document` or `typeof navigator` in features, routes or server code outside `platform/` folders.
- **SDK containment.** Ads and purchases only in `src/features/monetization/platform/`; YouTube and WebView only in `src/features/player/platform/`; Sentry only in `src/core/platform/telemetry/`; Firebase only in `src/core/platform/{auth,firebase,telemetry}/`; `expo-sqlite` only in `src/core/storage/` (A1.5).
- **Erasable TypeScript.** No `enum`, `namespace`, parameter properties or `import x = require()`; type-only imports use `import type`. Pure tests run under Node's type stripping.
- **No import-time side effects**, except the Sentry module that `entry.ts` loads first. Everything else starts from `src/features/shell/start.ts` after mount. Server state lives only in `getServerState()` on `globalThis`.
- **Tests** sit next to their subject: `*.test.ts` for pure logic, `*.test.cjs` through `tests/helpers/loadTs.cjs` (with `rnMock.cjs` and `render.cjs`) for React, React Native and Expo modules. `tests/` holds the setup, helpers, contract tests and the plugin, script, Firestore rules and web tests.
- **Brand.** `config/brand.json` is the only source of the app name, colours, accents and fonts (placeholders until the Identity step). Code uses `APP_NAME` from `src/core/config/app.ts`, never the literal name; run `yarn brand:stamp` after changing the JSON. Colours, type and radii come only from `src/core/ui/theme`.

## Standing rules

- **Exact pins.** Every dependency, dev dependency, resolution and alias is an exact version; never `^` or `~`. Strip any range that `expo install` or `yarn add` writes and reinstall. Only F0-A and the integrator change `package.json` and `yarn.lock`.
- **Zero code comments.** Lint enforces it, which also rules out `eslint-disable`. Put the reasoning in the commit message.
- **No agent attribution** in commits or pull requests: no `Co-Authored-By` trailer for an agent and no "Generated with" line. This overrides any harness default.
- **No system dialogs.** `Alert.alert` and `window.alert`, `confirm` and `prompt` are banned; use `useConfirm()` from the kit.
- **Navigation.** Use `useRouter()`, `<Link>` or `<Redirect>`, never the global `router` from `expo-router` (YIFY-2R). Never navigate or set params inside `useEffect`, `useLayoutEffect` or `useInsertionEffect` (YIFY-36): URL writes happen in event handlers through `useUrlState().commit()`, whose result is named `url` or `<thing>Url`.
- **No catch-and-show crash guards.** Find and fix the cause.

## Native

- `android/` is tracked but generated: change native code only through `app.json`, `app.config.js` and `plugins/`, then run `yarn prebuild` and commit the result. `ios/` stays tracked and untouched; iOS is not a target.
- Android builds need JDK 17: `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`. Android Studio's bundled JBR 25 fails with a misleading CMake error.
- Prebuild deletes `android/keystore.properties`; restore it from your private copy before a signed local build and never commit it.
- `runtimeVersion` is the package `version`, so bump `version` and `versionCode` whenever native code changes (dependencies, `app.json`, `app.config.js`, `plugins/`, `patches/`, `android/`).
- Launch the app with `adb shell am start -n io.github.kunal26das.yify/.MainActivity`, never with `adb shell monkey`.

## Work protocol on `redesign/v2` (Part W, W0)

- **Branches.** Every part and stream works on its own branch from `redesign/v2` and merges into it through a pull request: `v2/f0a-reset`, `v2/f0b-core` (first PR `v2/f0b1-core`), `v2/f0c-design`, `v2/f0d-shell`, `v2/s1-spike` (never merged), `v2/p1-server` to `v2/p9-android`, `v2/c-docs`; the integrator uses `v2/kit-<n>`, `v2/identity` and `v2/release`. `redesign/v2` merges into `main` only at release step (c), with the owner's approval.
- **Worktrees.** One worktree per stream, outside the repository folder, installed with `yarn install --frozen-lockfile --cache-folder "$HOME/.cache/yify-yarn/<branch>"` so concurrent installs never share a Yarn cache.
- **Ownership.** A stream edits only the paths Part W gives it. Everything F0 creates outside a stream's list is frozen.
- **Requests for frozen files.** A stream that needs a change to `src/core/**`, a frozen contract or another frozen file writes it under "Requests for frozen files" in its pull request and tells the integrator, who lands it as a `v2/kit-<n>` pull request. Never build a local one-off of a kit component.
- **Dependencies.** Request a package from the integrator; never edit `package.json` or `yarn.lock` in a stream.
- **Contracts.** The F0.5 signatures are frozen. A stream may add exports to its own `public/` files.
- **Porting** means reading the v1 file with `git show v1-baseline:<path>` and re-creating the logic in the v2 file.
- **Definition of done.** `yarn check:pins`, `yarn typecheck`, `yarn lint`, `yarn test` and, for web-visible changes, `yarn export:web && yarn check:web` pass in the worktree; the stream's acceptance criteria are demonstrated in the pull request; checks that need a later stream, a deployment or a Play-installed build are listed under "Deferred checks" with the W-I or Part Q step that runs them; no F0 placeholder text remains in the stream's own files.
- **Delivery.** No merge to `main`, deploy, store submission or console change without the owner.
- **EAS only through `scripts/eas.sh`** (or the `yarn eas` scripts that call it); never invoke `eas` directly.
- **Render, don't trust the export.** A successful `expo export` does not prove the page renders: load the build in a browser before calling web work done.

## Task completion

Cleanup is part of finishing every part and stream:

- Reuse a suitable existing checkout. After a pull request merges or is intentionally closed, stop task-owned helpers (dev servers, emulators) and remove the temporary worktree.
- Inspect tracked, untracked and needed ignored files before removal; preserve unfinished work, credentials and release evidence. Never force-remove a dirty worktree or discard unrelated changes to clean up.
- Delete the merged local and remote branch, then prune stale remote references. Keep `main`, `redesign/v2`, open pull request branches and the retained `release/*` update-source branches.
- Report anything deliberately kept and why.
