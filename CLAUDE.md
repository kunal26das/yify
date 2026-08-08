# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Yify is an Expo / React Native app (iOS, Android, web, Electron desktop) over the YTS catalog. `README.md` documents the product surface and feature set in detail — this file covers what you need to work in the tree.

## Commands

| Task | Command |
| --- | --- |
| Typecheck | `npx tsc --noEmit` |
| Tests | `yarn test` |
| Single test file | `node --test domain/policies/syncMerge.test.ts` |
| Single test by name | `node --test --test-name-pattern="tombstone" 'domain/**/*.test.ts'` |
| Dev server | `yarn start` (or `yarn dev` against an installed dev build) |
| Run native | `yarn ios` / `yarn android` |
| Scripted Android builds | `yarn android:debug` / `yarn android:release` |
| Web | `yarn web` |
| Desktop | `yarn desktop` |
| Regenerate native projects | `yarn prebuild` |
| Release console | `yarn release` |

`yarn` is the package manager (`yarn.lock` is committed; CI uses `--frozen-lockfile`).

### `yarn lint` is currently broken

The repo is pinned to `typescript@7.0.2` by deliberate choice, and `typescript-eslint` throws `typescript-eslint does not support TS 7.0` before any rule runs. **`yarn lint` fails at startup — it is not a signal about your code.** Use `npx tsc --noEmit` as the gate instead, and enforce the module boundaries below by reading imports rather than relying on ESLint to catch them.

Tests are `node --test` with native TypeScript type-stripping — no Jest, no transform step. Test files live next to their subject as `*.test.ts` and are excluded from `tsconfig.json` and ESLint.

## Architecture

Four layers, each with a single public barrel (`index.ts`), wired only at the composition root. The dependency rule:

> `domain` depends on nothing. `data` and `presentation` depend only on `domain`, never on each other. `app` may import `presentation`, `domain`, and **only** `data/di`.

`eslint.config.js` encodes this as `import/no-restricted-paths` zones — read that file for the exact allowed edges even though the lint run itself is broken. Cross-module imports go through the barrel (`@/domain`, `@/presentation`, `@/data`), never a deep path. `@/*` maps to the repo root.

- **`domain/`** — entities, repository/service *ports* (interfaces only), and pure policies. Zero dependencies, zero platform code. `domain/Dependencies.ts` is the port bag the whole app is wired from. Unit tests live here because this is the only layer that is trivially testable.
- **`data/`** — every implementation and every platform SDK. The only module allowed to name things `*Impl`. `data/index.ts` deliberately exports just two things: `createDependencies` and `bootstrap`. Keep it that way — widening this barrel is how `app` starts reaching into implementation detail.
  - `data/di/container.ts` — the composition root. A memoized singleton that constructs every `*Impl`, injects `PersistentCache` instances (namespaced per concern: `settings`, `watchlist`, `purchases`, `sync`, `search`), and returns a `Dependencies`.
  - `data/di/bootstrap.ts` — side-effectful startup: init remote config/auth/purchases, start sync, register the background notifier.
- **`presentation/`** — screens, view models (`use*ViewModel.ts`), shared UI. Receives ports through `DependenciesProvider`. `useDependencies()` in `presentation/di/DependenciesContext.tsx` is intentionally **not** exported; consumers use the narrow per-port hooks (`useMovieRepository()`, `useWatchlistRepository()`, …). Add a hook rather than exposing the bag.
- **`app/`** — `expo-router` routes only, thin adapters. `app/_layout.tsx` calls `createDependencies()` + `bootstrap()` at module scope and is the only place that touches `@/data`.

Adding a capability generally means: port in `domain/services` or `domain/repositories` → add to `Dependencies` → implement in `data/` → construct in `container.ts` → expose a hook in `DependenciesContext.tsx` → re-export from the relevant barrel.

### Platform splits

Metro resolves `Foo.web.ts(x)` over `Foo.ts(x)` on web. This is how the app keeps `Platform.OS` branching out of the layers — Firebase auth, RevenueCat, remote config, notifications, app updates, storage, and the YouTube player each have a `.web` twin implementing the identical port. When you change one side of a split, check the other; deleting a `.web` file silently breaks the web build (e.g. `react-native-youtube-iframe` cannot render on web at all, so `YoutubePlayer.web.tsx` is load-bearing).

## Conventions

### Never use `^` or `~` in a dependency version

Every dependency is pinned to an exact version. `"react-native": "0.86.2"`, never `"^0.86.2"` or `"~0.86.2"`. This applies to `dependencies`, `devDependencies`, and `resolutions`, in the root `package.json` and in `release/package.json`.

`expo install`, `yarn add`, and `npm install` all write a caret range by default, and Dependabot PRs may carry one in. **Strip the range immediately after any command that touches `package.json`**, then re-run the install so the lockfile matches. Never leave a range in a commit.

The `resolutions` in `release/package.json` are security overrides that force a transitive dep above a vulnerable version. They are exact pins like everything else, so **a new CVE floor there is a manual bump** — `yarn install` will no longer drift upward on its own.

Expect `yarn install` in `release/` to print `warning Resolution field "x@N" is incompatible with requested version "x@M"` for several of them. That is yarn noting a forced resolution does not satisfy some dependent's declared range — which is the entire point of the override, and is exactly what these pins are for. Yarn only emits this check for exact resolution values, so the warnings appeared when the carets were converted; they are cosmetic and the resolved tree is unchanged. **Do not silence them by reintroducing `^`.**

- **No comments.** This codebase carries zero code comments by standing preference. Put the reasoning in the commit message.
- One DTO per file in `data/models`, one entity per file in `domain/entities`.
- Reuse the primitives (`ThemedText`, `ThemedView`, `LiquidGlassView`, `MovieRail`) instead of new styled one-offs.
- Home shelves are configuration — add a rail by appending to `presentation/movies/constants/homeShelves.ts`.
- The YTS base URL and TMDB key come from Firebase Remote Config at runtime; `data` stays Firebase-agnostic by taking them as injected providers (`() => string`).

## Native builds and releases

`android/` and `ios/` sources are **tracked in git**, but `yarn prebuild` regenerates them from `app.json` + `app.config.js` + `plugins/`. Consequences:

- Never hand-edit `android/` or `ios/` — the change belongs in a config plugin under `plugins/` (`withAndroidRelease`, `withGradleJvmArgs`, `withoutAdId`, `withGwpAsan`) or in `app.json`.
- `expo prebuild` deletes the gitignored `android/keystore.properties`; it must be restored before a signed build.
- Native builds need **JDK 17** — Android Studio's bundled JBR 25 fails with a misleading CMake error. The `scripts/run-android-*.sh` helpers resolve `JAVA_HOME` for you.

`app.config.js` derives version metadata from `package.json`: `version` → `expo.version` **and** `runtimeVersion`; `versionCode` → Android `versionCode` and iOS `buildNumber`. Because `runtimeVersion` is the declared package version rather than a fingerprint, **bump `version` whenever native code changes**, or shipped binaries will accept an OTA update they cannot run. `EXPO_UPDATE_CHANNEL` (`Production` / `Staging`) is baked in at prebuild time.

EAS commands route through `scripts/eas.sh`, which reuses the release console's `EXPO_TOKEN` from `~/.yify-release.json` — do not invoke `eas` directly. `release/` is a separate workspace (its own `package.json`, `node_modules`, and TypeScript version) holding the clean-architecture release console; `release/releases.json` is the ledger of what actually shipped, and the update flow refuses to publish for a runtime version with no store release.

Web has two distinct exports: `yarn export:web` builds with `baseUrl=/yify` into `dist/` for GitHub Pages (auto-deployed on push to `main`), and `yarn export:hosting` builds with a root `baseUrl` into `dist-hosting/` for EAS Hosting. `EXPO_PUBLIC_*` values are baked in at export time and supplied by GitHub Actions secrets in CI — a change to `.env` needs `--clear` or the export silently reuses the old values. An `expo export` that succeeds does not prove the page renders; load the build before calling a web deploy done.

`.env` is optional — with no keys the app falls back to the default API URL and hides the account section. See `.env.example`.

## Other agent configs

This repo contains a `.codex/` directory. If you want its user-level items (MCP servers, slash commands, subagents, skills, instructions) available in Claude Code, reply `/import` to scan and list what's importable, then `/import --yes=<digest>` with the digest from the scan output to apply it. If `/import` isn't available on this surface, run `claude import` from a terminal.
