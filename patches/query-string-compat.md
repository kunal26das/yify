# Query-string decoder compatibility

Expo Router 57.0.23 uses CommonJS `query-string` 7.1.3, whose decoder range resolves to vulnerable `decode-uri-component` 0.2.2. [GHSA-vcc3-ghjq-m6fr](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr) identifies excessive CPU usage from malformed URL input and fixes it in 0.5.0.

The exact resolution is scoped to `query-string` consumers. Version 0.5.0 exports an ES module default function, so `scripts/query-string-compat.mjs` changes the single CommonJS import to select that default. The adapter reuses the existing source-hash and replacement-count guard, validates both installed package versions before writing, and runs after each installation. It does not modify the upstream decoder algorithm.

Remove the resolution and adapter together when Expo Router uses a query parser that natively supports a patched decoder. Revalidate deep-link parsing and web/native bundles when changing either dependency. `tests/query-string-compat.test.cjs` exercises the actual Expo route parser, Unicode and malformed queries, repeated values, one-pass decoding, bounded processing of large malformed input, idempotency, and refusal to patch an unreviewed package version or source.
