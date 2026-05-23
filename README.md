<div align="center">

# 🎬 Yify

**A buttery-smooth, liquid-glass movie browser built with Expo + React Native.**

Browse the YTS catalog, dig into rich movie details, watch trailers inline, and filter
thousands of titles — all wrapped in iOS 26 liquid-glass UI and a strict
clean-architecture core.

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.85.3-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Architecture](https://img.shields.io/badge/architecture-clean-success)](#-architecture)
[![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Web-lightgrey)](#-get-started)

</div>

---

## ✨ Features

- 🖼️ **Infinite-scroll poster grid** — responsive column count that adapts to viewport width, page-size-50 pagination, pull-to-refresh.
- 🔍 **Debounced search** — 400 ms debounce, instant clear, no jank.
- 🧊 **Liquid glass everywhere** — native `expo-glass-effect` on iOS 26, graceful `BlurView` fallback on older iOS and Android.
- 🎚️ **Native filter sheet** — quality / rating / genre / sort, in a device-corner-radius bottom sheet that looks identical on iOS and Android.
- 🎥 **Movie details + inline trailer** — full metadata, cast, screenshots, parental guides, and an embedded YouTube trailer player.
- ☁️ **Firebase Remote Config** — API base URL is fetched at runtime, so the backend can move without an app update.
- 🧭 **Scroll affordances** — scroll-to-top, a live "visible index / total" indicator, all in a glass bottom bar.

---

## 🏛️ Architecture

Yify follows **clean architecture** — the same module shape you'd build with Gradle
modules on Android. Three independent layers, each with a single public barrel
(`index.ts`), wired together only at the `app` composition root.

```mermaid
flowchart TD
    subgraph app["📱 app — composition root"]
        L["_layout.tsx"]
        I["index.tsx"]
        M["movie/[id].tsx"]
    end

    subgraph presentation["🎨 presentation"]
        VM["useMoviesViewModel / useMovieDetailsViewModel"]
        UI["MoviesScreen / MovieDetailsScreen"]
    end

    subgraph domain["🧠 domain"]
        E["entities: Movie · MovieDetails · Torrent · CastMember"]
        R["MovieRepository (interface)"]
    end

    subgraph data["💾 data"]
        DS["YtsApiDataSource"]
        IMPL["MovieRepositoryImpl"]
        DTO["DTO models"]
    end

    app --> presentation
    app --> data
    presentation --> domain
    data --> domain
    IMPL -. implements .-> R
    DS --> DTO
    IMPL --> DS

    classDef domainCls fill:#1f6feb,stroke:#0d419d,color:#fff
    classDef dataCls fill:#238636,stroke:#196127,color:#fff
    classDef presCls fill:#a371f7,stroke:#6e40c9,color:#fff
    classDef appCls fill:#db6d28,stroke:#9e4112,color:#fff
    class E,R domainCls
    class DS,IMPL,DTO dataCls
    class VM,UI presCls
    class L,I,M appCls
```

### The one rule that matters

> **`domain` depends on nothing. `data` and `presentation` depend only on `domain`. They may never import each other.**

This is **enforced by ESLint** (`import/no-restricted-paths` in `eslint.config.js`) — an
illegal cross-module import fails `npm run lint`. Cross-module imports must go through a
module's barrel (`@/domain`), never a deep path.

```mermaid
graph LR
    domain["🧠 domain"]:::ok
    data["💾 data"]:::ok
    presentation["🎨 presentation"]:::ok
    app["📱 app"]:::ok

    data -->|allowed| domain
    presentation -->|allowed| domain
    app -->|allowed| domain
    app -->|allowed| data
    app -->|allowed| presentation
    data -. ESLint error .-> presentation
    presentation -. ESLint error .-> data

    classDef ok fill:#0d1117,stroke:#30363d,color:#c9d1d9
    linkStyle 5,6 stroke:#f85149,stroke-width:2px,stroke-dasharray:5 5
```

---

## 🔄 How a movie loads

From tap to pixels — the request path through every layer:

```mermaid
sequenceDiagram
    autonumber
    participant U as 👆 User
    participant VM as useMoviesViewModel
    participant Repo as MovieRepositoryImpl
    participant DS as YtsApiDataSource
    participant RC as Remote Config
    participant API as YTS API

    U->>VM: scroll / search / filter
    VM->>Repo: listMovies(params)
    Repo->>DS: request(ListMovies, query)
    DS->>RC: getApiBaseUrl()
    RC-->>DS: base_url_yify (or DEFAULT_BASE_URL)
    DS->>API: GET /list_movies.json
    API-->>DS: raw DTO envelope
    DS-->>Repo: YtsListMoviesResponse
    Repo->>Repo: map DTO to Movie, rewrite image URLs via wsrv.nl
    Repo-->>VM: ListMoviesResult (domain entities)
    VM-->>U: render poster grid
```

---

## 🗂️ Project layout

```
yify/
├─ app/                      # 📱 expo-router entry points (composition root)
│  ├─ _layout.tsx            #    Stack, theming, Firebase init
│  ├─ index.tsx              #    Home — wires data → presentation
│  └─ movie/[id].tsx         #    Movie details route
├─ data/                     # 💾 YTS API + DTO → entity mapping
│  ├─ datasources/           #    YtsApiDataSource, YtsEndpoint enum
│  ├─ models/                #    one DTO per file
│  └─ repositories/          #    MovieRepositoryImpl
├─ domain/                   # 🧠 pure interfaces & entities (zero deps)
│  ├─ entities/
│  └─ repositories/
├─ presentation/             # 🎨 screens, view models, shared UI
│  ├─ movies/                #    MoviesScreen, MovieDetailsScreen, view models
│  ├─ components/            #    LiquidGlassView, ThemedText/View
│  └─ hooks/                 #    color scheme, theme color, corner radius
├─ lib/                      # 🔌 Firebase + Remote Config (native + .web split)
├─ config/                   # 🔥 google-services.json / GoogleService-Info.plist
└─ scripts/                  # 🛠️ android debug/release build helpers
```

---

## 🚀 Get started

```bash
# 1. install
npm install

# 2. (optional) Firebase — copy and fill in your keys
cp .env.example .env

# 3. start the dev server
npm start
```

### Run on a platform

| Command | What it does |
| --- | --- |
| `npm run ios` | iOS simulator (needs Xcode at `/Applications/Xcode.app`) |
| `npm run android` | Android emulator / connected device |
| `npm run android:debug` | Scripted Android **debug** build |
| `npm run android:release` | Scripted Android **release** build (standalone APK) |
| `npm run web` | Browser |
| `npm run lint` | ESLint **+ module-boundary enforcement** |
| `npm run prebuild` | Regenerate native `ios/` & `android/` |

> 💡 Release builds embed the JS bundle — no Metro required. Unplug and go.

---

## 🧰 Tech stack

```mermaid
mindmap
  root((Yify))
    Runtime
      Expo SDK 56
      React Native 0.85.3
      React 19
      TypeScript strict
    Navigation
      expo-router
    UI
      expo-glass-effect
      expo-blur
      reanimated + worklets
      expo-ui native sheets
    Media
      react-native-webview
      react-native-youtube-iframe
      expo-image
    Backend
      YTS API
      Firebase Remote Config
```

> ⚠️ **Version ceiling:** React Native is pinned to **0.85.3**. RN 0.86 breaks Expo SDK 56/57
> native modules (the JSI `Runtime` → `IRuntime` ABI change) and crashes at launch.

---

## 🔥 Firebase Remote Config

The YTS API base URL is **not hardcoded** — it's resolved at runtime from Remote Config
key `base_url_yify`, falling back to the data module's `DEFAULT_BASE_URL`. Native uses
`@react-native-firebase/remote-config`; web uses the Firebase JS SDK (gated on
`isSupported()`). The `data` module stays completely Firebase-agnostic — the base URL is
injected as a `() => string` provider from `app/index.tsx`.

Firebase degrades gracefully: with no `.env` keys, the app simply uses the default URL.

---

## 🤝 Contributing

1. Keep the layers honest — if `npm run lint` fails on an `import/no-restricted-paths`
   rule, you crossed a module boundary. Route it through a barrel or rethink the dependency.
2. One DTO / entity per file.
3. Reuse `ThemedText` / `ThemedView` / `LiquidGlassView` instead of new styled primitives.

---

<div align="center">

Built with 🎥 and a lot of liquid glass.

</div>
