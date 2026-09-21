# Crash follow-up — 21 September 2026

## Regressed updates, ads and billing

- **YIFY-M:** the latest event reports an offline background device while the app's cached
  monitor still allowed an update check. The monitor now refreshes on foreground and before
  update work, deduplicates concurrent reads, bounds them to three seconds, and rejects late
  results. One corrective read handles a callback racing the snapshot. Failed update requests
  refresh connectivity before classification. Genuine online failures stay visible.
- **YIFY-X:** preserve as unresolved. Current 1.8.4 OTA events include online cellular
  `internal_error` failures across all three retry attempts. This release prevents known
  supporters from preloading ads, checks subscription state again after asynchronous work,
  cleans failed listeners and rejects stale callbacks. These are tested lifecycle fixes,
  but the available native event does not include the underlying AdMob response/cause.
  They do not establish that the provider's internal error is fixed.
- **YIFY-P / YIFY-9:** preserve as unresolved. A read-only Play API check on 21 September
  confirmed `remove_ads_monthly` / `p1m` is active in 171 regions, including Brazil and
  the Netherlands. The latest historical events have generic configuration errors without
  the store-level cause. Existing retry/cache fixes and the quiet period do not prove
  credential health or purchase eligibility on those devices. No product or price changed.

## Native crashes

Evidence was read from Sentry issue details, individual events, breadcrumbs and thread stacks.
An older app release alone is not evidence that a crash has been fixed.

| Issue | Evidence | Action and remaining limit |
| --- | --- | --- |
| [YIFY-1K](https://kudos-labs.sentry.io/issues/YIFY-1K) | Two Android JNI aborts. Latest event `f262b95c3e9b49a38250fb9b17d756c5`, 1.8.3 (85), 18 September 19:28:59 UTC. `NativeProxy::getAnimationTimestamp` calls Java with a null target from a Reanimated animation frame. `Restarting for update` was recorded at 19:28:57.956. The other event reports runtime 1.8.1. | Android downloads updates without reloading the active React runtime; Expo applies them on the next cold start. This removes the observed update-reload trigger. It does not repair the native animation library or establish that all activity recreation is safe. |
| [YIFY-J](https://kudos-labs.sentry.io/issues/YIFY-J) | One Android SIGSEGV, event `f1a41c94861e408482ad23be4621c2a1`, 1.7.7 (79), 10 September 15:45:21.413 UTC. Reanimated `executeLayoutAnimationsRequests` fails during a container copy. `Restarting for update` immediately precedes it at 15:45:20.712. | The same next-start update policy removes the observed trigger on runtimes receiving the patch. The event does not prove a separate layout-animation root cause has been fixed. Older binaries without this JavaScript update remain exposed. |
| [YIFY-15](https://kudos-labs.sentry.io/issues/YIFY-15) | One background ANR, event `523a12ea0bc04ec9a6959bbd297e20eb`, 1.8.3 (85), Android 11, 17 September 15:11:49 UTC. Main thread is inside a Worklets frame callback; main and JS threads both reach ART's `ConditionVariable::WaitHoldingLocks` through JNI. Intermediate native frames are unresolved. There is no update reload in the breadcrumb trail. | Keep open. No causal lock owner or application operation is established by this snapshot. The event has no attached original ANR trace. Reproduce navigation/background transitions on a low-memory Android 11 release build and collect a native/system trace before selecting a fix. |
| [YIFY-V](https://kudos-labs.sentry.io/issues/YIFY-V) | One SIGSEGV, event `92bfc03b17dc40693b82e9a97c2c5139`, 1.7.9 (81), 10 September. The stack is `strcmp` → ART `MarmotUnpacker::InitUnpackDirs` / `DumpClinitDexFiles`, without an identified Yify frame. | Keep open. The stack points into the device's ART unpacking implementation; the available evidence does not establish an app fix. Do not exclude this device or suppress its reports to claim resolution. |

The update notice now explains that the downloaded update applies on the next app start and
does not offer an Android live-restart button. It can wrap at narrow widths or large text sizes.
iOS and web retain their existing restart action. Service-level tests must also verify that
Android's explicit and automatic paths never call `Updates.reloadAsync`.

### Native dependency boundary

The checked-in Reanimated **4.5.5** still releases `NativeProxy.javaPart_` during invalidation
while callbacks can reference it, and its timestamp call has no null guard. The corresponding
[upstream teardown fix](https://github.com/software-mansion/react-native-reanimated/pull/9449)
was still open when checked. Its proposed safeguards are not proof that a locally invented patch
is safe: native callback ownership and teardown concurrency need release-device verification.

[Worklets 0.11.4](https://github.com/software-mansion/react-native-reanimated/releases/tag/worklets-0.11.4),
already used by this repository, includes a background-pause fix. The later
[frame-queue invalidation change](https://github.com/software-mansion/react-native-reanimated/pull/10278)
ships in Worklets 0.12.2; Reanimated 4.5's published compatibility metadata supports Worklets
0.10/0.11. No native dependency version is changed by the update mitigation, and none of these
native changes can be delivered through OTA alone. Keep the Android guard until a compatible
new binary survives repeated animated reloads and background transitions on real devices.

Seer analysis of YIFY-15 returned HTTP 409 because no repository was connected to the project.
No analysis result or verified ANR fix was produced.

## Handled catalog failures

These events have `handled: yes`; they are catalog failures reported to Sentry, not evidence
that the process terminated. The changes preserve reports for persistent online failures,
unexpected errors, invalid payloads, HTTP 451 restrictions and exhausted upstream retries.

| Issue | Evidence and change | Status recommendation after release verification |
| --- | --- | --- |
| [YIFY-1H](https://kudos-labs.sentry.io/issues/YIFY-1H), regressed | Latest event `e8223edea80d45388521d499b145ddfc`, 18 September 15:49:54 UTC, used old 1.8.3 OTA `01a0b45d-6b94-7301-a796-fbc1e9d81af9`. JSON decoding failed after HTTP 200 with zero retries. The existing recovery patch retries malformed JSON once within the original deadline and respects `Retry-After`. | Close the verified missing-recovery regression. Persistent invalid JSON still produces a report; this does not establish that the provider always returns valid JSON. See release evidence below. |
| [YIFY-1Q](https://kudos-labs.sentry.io/issues/YIFY-1Q) | Sixteen movie-details validation events; latest `5616111dc77e4212950b4b75341d2af0`, 20 September 19:11:21 UTC, on current 1.8.4 OTA. A live read reproduced YTS returning HTTP 200 with `data.movie.id: 0` and `title: null` for missing IDs. That exact sentinel now produces a readable missing-movie state, including safe public/subscriber HTTP 404 responses, without retries or cached failures. | Close after the deployed missing-movie path is verified, noting that the original event payload was intentionally not collected. The reproduced sentinel reaches the reported validator branch; malformed real movies still fail and now include a bounded validation reason. |
| [YIFY-H](https://kudos-labs.sentry.io/issues/YIFY-H), [YIFY-C](https://kudos-labs.sentry.io/issues/YIFY-C), [YIFY-D](https://kudos-labs.sentry.io/issues/YIFY-D), [YIFY-14](https://kudos-labs.sentry.io/issues/YIFY-14) | Native fetch errors had zero retries. Expo's `FetchError` preserves the native stack but discards its error code. The latest H event explicitly records `online: false`; C/D/14 snapshots report online. Known wrapped transport messages now receive one retry; a refreshed offline snapshot produces a readable unavailable result. Exact wrapped cancellations are classified separately. Connectivity is wired into normal and notification catalog requests. | Keep open for remaining online transport failures. The retry, cancellation and offline-classification gaps are fixed, but those changes do not establish that every grouped CodedError had the same cause. |
| [YIFY-8](https://kudos-labs.sentry.io/issues/YIFY-8), [YIFY-1B](https://kudos-labs.sentry.io/issues/YIFY-1B) | Latest events record EZTV HTTP 451, including a current 1.8.4 event. | Keep open as an upstream restriction. No retry, alternate origin or bypass was added. |
| [YIFY-13](https://kudos-labs.sentry.io/issues/YIFY-13) | The latest web shows request failed with HTTP 502 after its bounded retry. | Keep open: the dependency remained unavailable after recovery was attempted. |
| [YIFY-1N](https://kudos-labs.sentry.io/issues/YIFY-1N) | EZTV returned HTTP 200 without a valid torrent collection or zero-count marker. Live empty-result probes returned the valid numeric zero shape, so the reported malformed response was not reproduced. | Keep open. A bounded `torrents_count` validation reason was added; malformed responses are neither accepted nor silently cached as empty results. |
| [YIFY-1M](https://kudos-labs.sentry.io/issues/YIFY-1M), [YIFY-1P](https://kudos-labs.sentry.io/issues/YIFY-1P), [YIFY-1J](https://kudos-labs.sentry.io/issues/YIFY-1J) | Browser TypeErrors occur during fetch with `request_failed`; original messages were removed by privacy sanitization. | Keep open: the evidence cannot distinguish a transport outage from an unexpected fetch/programming error. Unknown TypeErrors remain reportable. |
| [YIFY-W](https://kudos-labs.sentry.io/issues/YIFY-W), [YIFY-B](https://kudos-labs.sentry.io/issues/YIFY-B) | Old YTS/TMDB implementations reported HTTP 504 immediately; current requests use the tested bounded recovery helper. | Keep open conservatively: the recovery gap is addressed, but no evidence establishes that a retry would have recovered these specific upstream outages. |
| [YIFY-S](https://kudos-labs.sentry.io/issues/YIFY-S), [YIFY-11](https://kudos-labs.sentry.io/issues/YIFY-11), [YIFY-T](https://kudos-labs.sentry.io/issues/YIFY-T) | Legacy web code collapsed failures into a generic exception. Latest S has no status, 11 has HTTP 200, and T has HTTP 502. Current code retains safe stage/status/retry diagnostics and the original error stack. | Keep open unless a specific original failure is established. Replacing the generic handler and seeing only old releases is insufficient proof of these causes. |

### YIFY-1H release evidence

The event's old OTA was published at **11:53:36 UTC on 18 September**, from commit
`4a0adec45f26ec6cbc6538cf6d742964253fef2c`, whose decoder had no malformed-JSON recovery.
[PR #853](https://github.com/kunal26das/yify/pull/853) added that recovery in
`88cb25163e77e6d08e72c4bf018dc6e8190e07bc`; the 1.8.3 compatibility source
`d85a488c6c20ad2d7d8283eb1bfcbcea8faf4dba` contains the same decoder change.
Saved production manifest/deployment receipts in
`.expo/deployments/20260918-sentry-fixes/summary.json` verify:

- Android 1.8.3: update `01a0b50a-ad9e-7e1a-aa46-ce49d6b0b08c`, verified at 15:04:58 UTC; Sentry deployment `159820063`.
- Android 1.8.4: update `01a0b50a-c07c-7d56-a262-24dc8c98c8d3`, verified at 15:08:13 UTC; Sentry deployment `159820090`.

Thus the 15:49 regression occurred **after publication, while the device still ran the old
OTA**, rather than demonstrating failure of the new decoder. Current tests reproduce
truncated JSON followed by recovery, persistent malformed JSON, `Retry-After`, deadlines,
cancellation and failed-cache eviction. Publication does not prove every device applied an OTA.

### Validation and limits

The focused catalog suite passed **111 tests**, and TypeScript checking passed before
integration. Tests exercise the installed Expo `FetchError` wrapper, offline/reconnection
behavior, unknown/TLS/redirect failures remaining visible, strict missing-movie detection,
public/subscriber authorization boundaries, no raw error-body exposure and unchanged HTTP
451/rate-limit behavior. Live provider probes inspected response shapes only; no movie
titles, queries, identifiers or response bodies were added to telemetry. Existing error
fingerprints remain unchanged; validation reasons come from a fixed allowlist.
