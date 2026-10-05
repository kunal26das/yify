# Expo route query parsing

Runtime 1.8.7 adapted query-string 7.1.3 to the patched decode-uri-component 0.5.0 release for [GHSA-vcc3-ghjq-m6fr](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr).

Expo Router 58.0.13 now uses URL search parameters directly and no longer installs query-string. Runtime 1.8.14 removes the obsolete adapter and decoder resolution together. The router regression tests still exercise Unicode, malformed escapes, repeated values, one-pass decoding and bounded processing of large malformed input. URL parsing represents invalid UTF-8 with the Unicode replacement character and bare query keys as empty strings.
