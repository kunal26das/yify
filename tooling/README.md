# Tooling compatibility

The app uses TypeScript 7 for typechecking, Babel 8 for the test loader, and ESLint 10 for linting. Expo 57 and Worklets still compile application bundles with Babel 7. The Expo ESLint parser still needs the TypeScript 6 compiler API, which TypeScript 7 does not provide.

This private workspace keeps those build-time dependencies separate with scoped Yarn Classic `nohoist` rules. It contains no native runtime dependency. `babel.config.js` selects the single root Worklets plugin; its version remains identical to the native package selected by autolinking.

`scripts/apply-tooling-compatibility.mjs` handles two broad peer ranges that Yarn Classic otherwise resolves to incompatible root versions:

- Worklets 0.13.0's Babel plugin imports the Babel 7 adapter at `@yify/tooling/babel`.
- The isolated `ts-api-utils` 2.5.0 imports the TypeScript 6 adapter at `@yify/tooling/typescript`. Its root resolution is restricted to this tooling dependency tree.

The patch manifest checks the package version, complete original and patched SHA-256 hashes, and replacement count. Every target is verified before any file is changed. Repeated installation is safe; an unreviewed package or source change fails installation and requires reviewing the adapter again. Remove each adapter and its patch when the consuming tool supports the new major directly.

ESLint's official `@eslint/compat` adapter restores removed rule APIs while preserving Expo's rules and the app's import boundaries. Existing lint findings remain visible. The Babel 8 test transform handles TypeScript values, TSX, CommonJS interop, and deferred imports without applying the application's native Babel configuration.

Run `node --test tests/tooling-compatibility.test.cjs` after changing these files. It checks actual worklet execution and serialization, TypeScript/TSX and deferred imports, architecture and React lint failures, exact dependency pins, patch idempotency, and rejection of unexpected package versions or source changes. Then run the application and crash-reporting tests, typechecks, and web/native build checks appropriate to the dependency change.

Primary migration guidance: [TypeScript 7 compiler API compatibility](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Babel major-version compatibility](https://babeljs.io/docs/v8-migration#peer-dependency-requirements), [ESLint compatibility utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/), and [Yarn Classic workspace isolation](https://classic.yarnpkg.com/blog/2018/02/15/nohoist/).
