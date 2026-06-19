# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start               # Start Expo dev server
npm run ios             # Run on iOS simulator (requires Xcode at /Applications/Xcode.app; adjust DEVELOPER_DIR in package.json if installed elsewhere)
npm run ios:start       # Start Expo with iOS flag (same Xcode path requirement)
npm run android         # Run on Android emulator
npm run android:debug   # Debug build via script
npm run android:release # Release build via script
npm run web             # Run in browser
npm run lint            # Run ESLint over app + the data/domain/presentation modules (enforces module boundaries)
npm run prebuild        # Generate native project files
```

No test suite is configured.

## Architecture

This is a React Native / Expo movie browsing app (TypeScript, strict mode) following clean architecture with three layers:

**Data → Domain → Presentation**

`data`, `domain`, and `presentation` are independent modules (plain folders, each with an `index.ts` barrel as its public API, resolved via the `@/*` alias). The dependency graph mirrors Gradle modules and is **enforced by ESLint** (`import/no-restricted-paths` in `eslint.config.js`): `domain` depends on nothing; `data` and `presentation` each depend only on `domain`; they may not import each other; `app` is the composition root and may depend on all of them. An illegal cross-module import fails `npm run lint`. Cross-module imports must go through a module's barrel (e.g. `@/domain`), never a deep path.

### Data Layer (`/data`)

- `YtsApiDataSource` — HTTP client for the YTS movie API. Base URL is injected via a `() => string` provider
  (defaults to `DEFAULT_BASE_URL`; the app wires Firebase Remote Config's `getApiBaseUrl` in); endpoint paths come
  from the `YtsEndpoint` enum; 15s AbortController timeout. The data module stays Firebase-agnostic.
- `MovieRepositoryImpl` — Transforms raw API responses into domain `Movie` entities. Rewrites image URLs through `wsrv.nl` (which both enforces HTTPS and resizes on the fly).
- `models/` — Raw API response DTOs, one per file (`YtsMovieDto`, `YtsTorrentDto`, `YtsCastMemberDto`,
  `YtsParentalGuideDto`, the generic `YtsApiResponse<T>` envelope, and a per-endpoint `Yts*Response.ts`), re-exported
  via `models/index.ts`. These are the intermediate types `MovieRepositoryImpl` maps from; add new fields here. The data
  source covers `list_movies`, `movie_details`, `movie_suggestions`, and `movie_parental_guides`.

### Domain Layer (`/domain`)
- Plain interfaces split into `entities/Movie.ts` (`Movie`) and `repositories/MovieRepository.ts` (`MovieRepository`, `ListMoviesParams`, `ListMoviesResult`). No logic here.

### Presentation Layer (`/presentation/movies`)
- `useMoviesViewModel` — Central state hook. Manages search (400ms debounce via ref), infinite scroll pagination (page size 50), filter state (quality/rating/genre/sort), pull-to-refresh, and loading guards using refs to prevent race conditions.
- `MoviesScreen` — FlatList grid with dynamic column count based on viewport width. Liquid glass search bar overlay at top; liquid glass bottom bar with scroll-to-top, scroll position indicator (visible item index / total count), and filter button.
- `presentation/movies/components/MovieFilterModal` — `@expo/ui` BottomSheet for filter selection.
- `presentation/movies/components/MoviePosterItem` — Stacked layers for small/medium/large URLs; in dev all higher-res layers are hidden for 2000ms (revealing the load order) then shown at once; in production all layers are visible immediately.

### Components (`/components`)
- `LiquidGlassView` / `LiquidGlassGroup` / `isNativeLiquidGlass` — `LiquidGlassView` wraps `expo-glass-effect` with a `BlurView` fallback on iOS < 26 and Android. `LiquidGlassGroup` wraps multiple views in a `GlassContainer` so iOS 26 merges them into one native surface; wraps children in a plain `<View>` on Android, web, and iOS < 26. `isNativeLiquidGlass` is an exported boolean constant for conditional branching — use it instead of inline platform checks.
- `ThemedText` / `ThemedView` — Theme-aware wrappers; reuse these instead of creating new styled primitives.

### Hooks (`/hooks`)
- `use-color-scheme` — Platform-specific color scheme detection.
- `use-theme-color` — Resolves a color token against the active theme.
- `use-device-corner-radius` — Returns the device's native corner radius; use this instead of hardcoding values.

### Entry Points
- `app/_layout.tsx` — Root layout; initializes GestureHandler, SafeAreaProvider, theming, and optional Firebase.
- `app/index.tsx` — Home screen; constructs `YtsApiDataSource → MovieRepositoryImpl`, passes to `useMoviesViewModel`, renders `MoviesScreen`.

### Firebase

- `/lib/firebase.ts` — optional Firebase JS (web) SDK app init; degrades gracefully if `.env` keys are absent (copy
  `.env.example` → `.env`).
- `/lib/remote-config.ts` (+ `.web.ts`) — Remote Config provider for the API base URL. Native uses
  `@react-native-firebase/remote-config`; web uses the Firebase JS SDK (gated on `isSupported()`). Exposes
  `initRemoteConfig()` (called once at the top of `app/_layout.tsx`) and `getApiBaseUrl()`, which is injected into
  `YtsApiDataSource` from `app/index.tsx`. Both fall back to the data module's `DEFAULT_BASE_URL`. Remote Config
  parameter key: `base_url_yify` (the data source strips any trailing slash from the value). Native Firebase config (
  both wired in `app.config.js`): `config/android/google-services.json` (registers both the `io.github.kunal26das.yify`
  and `.debug` packages) and `config/ios/GoogleService-Info.plist`. Debug builds use the `.debug` Android package,
  covered by the same json. `expo-build-properties` sets iOS `useFrameworks: static` (required by
  `@react-native-firebase`).

### Path Alias
`@/*` maps to the project root (configured in `tsconfig.json`).
