# Sentry follow-up — 25 September 2026

The audit covers all 32 unresolved issues returned for project Yify, including regressed
YIFY-5 and YIFY-X. A handled operation failure is not evidence of a terminated process.
Issue closure follows deployed verification of a concrete fix; older release numbers or a
quiet period alone do not establish resolution.

## Changes

- **YIFY-5:** reproduced React hydration error 418 on the current web export when Movies
  starts with saved browse defaults or URL filters/search. The server and first browser render
  now use the same visible defaults; after hydration the existing saved/URL state appears.
  Requests keep the intended filters. Historical events have scrubbed markup diffs, so this
  fixes the demonstrated path rather than proving every historical hydration cause.
- **YIFY-1N:** reproduced EZTV's exhausted episode page with a positive overall total,
  valid page/limit, and no torrent collection. Accept only a mathematically exhausted page;
  keep rejecting missing collections within the available range and malformed pagination.
- **YIFY-1S:** reproduced YTS suggestions with movie_count zero and exactly one
  id-zero/title-null placeholder. Normalize only that empty-result shape, preserving strict
  validation of genuine movies and other malformed results.
- **YIFY-1V:** all three recorded events occurred offline. Remote Config uses saved/default
  settings while offline, retries after reconnection or a later read, and bounds native fetch
  time. Failed initialization no longer permanently memoizes an unsuccessful attempt.
  Concurrent readers share one fetch; the startup deadline does not start overlapping work.
  Unexpected online/configuration failures remain reportable.
- **YIFY-1T:** the crashed thread is Sampling Profil, aborting in pthread_getcpuclockid
  with invalid pthread_t. Disable Android sampling profiling to remove that observed
  trigger, following the matching [upstream investigation](https://github.com/getsentry/sentry-java/issues/2604).
  Native crashes/ANRs, transaction tracing, and the Firebase mirror remain active. This does
  not establish a general fix for all Android thread-lifetime defects.
- **Cache recovery:** an evicted YTS request failing late could delete a newer successful
  response for the same URL. Eviction now checks request identity. The regression test fails
  without this guard and preserves the newer cached result with it.

## Investigated, with remaining limits

- **YIFY-X:** Ads SDK 17 exposes structured reason/phase and adapter causes, but the app read
  only the legacy code. Both formats now work. Diagnostics retain fixed categories and bounded
  numeric adapter error codes/counts, excluding response IDs, creative IDs and raw messages.
  Genuine online internal errors still report. This is a compatibility/diagnostic improvement,
  not proof that an AdMob provider failure is fixed; keep the issue open.
- **YIFY-1Z:** the original Google sign-in cause was reduced to unknown. Preserve documented
  Google status categories and the failing stage; concurrent taps share the existing sign-in
  flow, and synchronous configuration faults are handled. The original scrubbed event cannot
  prove which cause occurred, so keep the issue open.
- **YIFY-P / YIFY-9:** read-only checks confirmed RevenueCat's current offering contains only
  the monthly package and the correct Android/Web monthly products. Play's p1m base plan is
  ACTIVE in 171 regions, including the reported Netherlands and Brazil. No price, product or
  entitlement changed. Successful configuration reads do not prove purchase eligibility or
  credential health on the original devices; keep these issues open.
- **YIFY-15:** background ANR has main/JS threads waiting in JNI/ART with a Worklets callback;
  the available snapshot lacks the causal lock owner or original system trace. Current Worklets
  already includes queue invalidation. Keep open pending a reproducible native trace.
- **YIFY-V:** the only stack is device ART MarmotUnpacker/strcmp, without an identified app
  frame. There is no established application fix. Keep open; do not suppress the device.
- **YIFY-22 / YIFY-23:** local preview-only API 404s during the SDK migration, not production
  endpoint failures. Current production movies and shows endpoints returned HTTP 200 with valid
  JSON metadata. Local tests now block external telemetry and provide their intended API fixture.

## Catalogue issue evidence

The catalogue parser and cache changes passed 181 focused tests, including server public/private
response boundaries. The complete app suite passed 1,678 tests and the crash-reporting workspace
passed 51 tests; app/workspace typechecking and exact dependency-pin checks passed. The web
hydration check uses a fresh Hosting export and blocks external telemetry during local tests.
JavaScript backports must preserve each shipped binary's native dependency tree; they cannot use
the current Expo 58 bundle with an older runtime label.

| Issue | Latest event release | Last seen (UTC) | Latest event | Finding / status recommendation |
| --- | --- | --- | --- | --- |
| YIFY-22 | Yify@1.8.8 | 2026-09-25T02:46:34.000Z | 4d041edafc454794b9592b723cb1fd66 | Preview-only 404 on local static server; current production endpoint GET returns 200. No new client fix; verify preview hosting setup. |
| YIFY-23 | Yify@1.8.8 | 2026-09-25T02:46:41.000Z | f60fd1bf5c7c459cb8e807420f1d2766 | Preview-only 404 on local static server; current production endpoint GET returns 200. No new client fix; verify preview hosting setup. |
| YIFY-1B | io.github.kunal26das.yify@1.8.8+90 | 2026-09-25T05:15:50.000Z | 4e41c2ed9c8b404696fb4aa38ef872dd | Latest native 1.8.8 HTTP403; upstream refusal remains real. No bypass or suppression. Keep open. |
| YIFY-8 | io.github.kunal26das.yify@1.8.3+85 | 2026-09-19T01:09:00.000Z | 9acc325133c94e77ab3ca99c05e5438d | Historical HTTP451 restriction; no provider fix established. Keep open. |
| YIFY-H | io.github.kunal26das.yify@1.8.4+86 | 2026-09-24T15:05:06.000Z | c6b22b80bf8d40e88d1cb8952022db4f | Latest old embedded 1.8.4 offline with request_failed. Existing connectivity recovery helps, but original fetch cause was scrubbed; keep open. |
| YIFY-C | io.github.kunal26das.yify@1.8.6+88 | 2026-09-24T15:04:00.000Z | 2e59f305c59e4d4b9dc708eae5e0dfba | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-D | io.github.kunal26das.yify@1.8.4+86 | 2026-09-19T00:53:13.000Z | c7befe8dbea54c7193a1e3690351eae2 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-14 | io.github.kunal26das.yify@1.8.4+86 | 2026-09-19T02:52:42.000Z | a80e8d0ba05b470286e4d7fd3398dda7 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-13 | Yify@1.8.7 | 2026-09-25T01:25:14.000Z | cd355e12a10f471a84407054d343fc7c | HTTP502 after one retry; no successful recovery evidence for failed request. Keep open. |
| YIFY-1R | io.github.kunal26das.yify@1.8.6+88 | 2026-09-23T22:00:11.000Z | 6a0458228d7746cf82570ff7b3ecfa1d | HTTP502 after one retry; no successful recovery evidence for failed request. Keep open. |
| YIFY-1N | io.github.kunal26das.yify@1.8.6+88 | 2026-09-24T12:58:08.000Z | 1fb70e271d934ec8bd0c35b7bae0e780 | Reproduced normal exhausted EZTV pages with positive total and omitted collection. Narrow parser fix plus repository regression test; candidate to resolve after release verification. |
| YIFY-1S | io.github.kunal26das.yify@1.8.4+86 | 2026-09-22T04:53:17.000Z | 13735fd47fcf4d289a98cb2f2a71ee10 | Reproduced zero-count YTS suggestions with one id=0/title=null sentinel. Narrow normalization to empty list plus repository regression test; candidate to resolve after release verification. |
| YIFY-1J | Yify@1.8.7 | 2026-09-25T01:25:15.000Z | 8cc17a18df0b403db5cd8366c8e87e0e | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-1X | Yify@1.8.7 | 2026-09-24T22:42:41.000Z | 0ccc9b9ff12848d582d45712fcdc67ca | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-1Y | Yify@1.8.8 | 2026-09-25T04:26:36.000Z | f7c3556296eb4b099bb2c50e1dd4b327 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-1M | Yify@1.8.5 | 2026-09-22T01:04:36.000Z | 40ad4192796e4eb899021bb565672868 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-1P | Yify@1.8.4 | 2026-09-19T18:42:56.000Z | 659967d06be543bc98555b7ebfcd22f9 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-1W | io.github.kunal26das.yify@1.8.4+86 | 2026-09-23T07:50:16.000Z | c01e5d3027a74b9c962414e9e004f606 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-S | Yify@1.8.2 | 2026-09-15T18:58:48.000Z | b9e68945adc74b578575ef3fa1c4ba59 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-11 | Yify@1.8.1 | 2026-09-15T04:32:18.000Z | 2d99a82cf6c74ee78bd794865ae24a09 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-T | Yify@1.8.1 | 2026-09-14T21:01:59.000Z | 19a60fe7e21543a2b0deba6ecc24defb | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-W | io.github.kunal26das.yify@1.8.1+83 | 2026-09-14T21:27:15.000Z | b6cf92be486d47119a98b9ed24dfb394 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
| YIFY-B | io.github.kunal26das.yify@1.7.7+79 | 2026-09-10T01:36:14.000Z | 2c4ce8bbb2e546c2a3dbc75fa105d9b1 | No new causal fix established from available sanitized event. Existing retry/validation diagnostics retained; keep open. |
