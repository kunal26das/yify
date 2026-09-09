# Yify

A movie and TV catalog browser with trailers, watchlists, and history. Built with
Expo, React Native, and TypeScript for Android, iOS, and web, with an Electron desktop app.

[Open Yify](https://yify.expo.app/) · [Get it on Google Play](https://play.google.com/store/apps/details?id=io.github.kunal26das.yify)

## Run locally

Use Node.js 24 and Yarn Classic.

```sh
yarn install --frozen-lockfile
yarn web
```

For Android, iOS, desktop, and service configuration, see the
[development guide](docs/development.md).

## Checks

```sh
npx tsc --noEmit
yarn test
```

## Documentation

- [Development](docs/development.md) — setup, commands, and code structure.
- [Releases](docs/releases.md) — Android builds, Expo OTA updates, and web deployment.
- [RevenueCat operations](docs/revenuecat-operations.md) — subscriptions, ad tracking, and integrations.
