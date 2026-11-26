# Yify

Movie and TV discovery with trailers, where to watch and a watch diary. Built with
Expo, React Native and TypeScript for Android and the web.

[Open Yify](https://yify.expo.app/) · [Get it on Google Play](https://play.google.com/store/apps/details?id=io.github.kunal26das.yify)

This branch rebuilds Yify as version 2.0.0. [`docs/v2/SPEC.md`](docs/v2/SPEC.md) is the
implementation contract and [`CLAUDE.md`](CLAUDE.md) lists the commands and rules. The v1 app
is at the `v1-baseline` tag.

## Run locally

Use Node.js 24 and Yarn Classic.

```sh
yarn install --frozen-lockfile
yarn web
```

## Checks

```sh
yarn check:pins
yarn typecheck
yarn lint
yarn test
yarn check:expo
```
