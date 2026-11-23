# Design

## Context

Main is `f2b91eba72ce0f55662760c2efaec0b079f6ada1` with runtime 1.8.31/code 113. Expo build `083adda6-e58c-4a40-9bc7-442ec8b7ff87` produced that binary but it was never submitted; Android 1.8.29/code 111 is the latest Play submission. All eleven open Dependabot PRs share main as their base.

## Decisions

Integrate in one branch because the proposals overlap in `yarn.lock` and share the doctor and runner failures. Keep every proposed version except where Expo has since moved: Expo 58.0.26 replaces the proposed 58.0.25 set, because the online check now recommends its module versions and `expo-web-browser` ~58.1.0. Firebase JavaScript stays at 13.1.0 because React Native Firebase 27.1.1 still depends on exactly 13.1.0.

Guarded internals follow the lowest published versions that satisfy every installed dependent, iterated until no requested range is unsatisfied. Every guarded source that changed is compared with the previously installed bytes from the published tarballs before its hash moves.

Reanimated 4.8.0 still keeps NodesManager callbacks, events and frames across native teardown, so the callback-cleanup patch is rebased rather than retired. 4.8.0 replaces the custom event emitter and name resolver with a nullable `EventHandler` and a static `resolveCustomEventName`; the rebased patch resets the handler to `null` where it previously installed `NoopEventHandler`, and is otherwise the same transformation. The lifecycle fixture compiles the installed `EventNames.kt`, stubs the new handler type, models the native proxy's self-reference that releases its Java part, and resumes the Worklets frame queue, which now starts paused, before each case.

The Babel lockfile entries are the deduplicated 8.1.2 graph from #1086. The maintenance workflow had regenerated #1076 and #1077 from scratch; their unrelated record churn is not carried, only their own package entries.

Advance runtime/build to 1.8.32/114 because native modules change. Never resubmit 113.

## Risks / Trade-offs

Native changes can compile and still fail at runtime. PR CI covers the Android graph and compile-only Android QA; a signed-AAB check precedes Play submission. Modules core 58.1.0 changes iOS app-context ownership and the Android headless loader's running check; Worklets 0.14 delays its frame loop until the host resumes. On-device startup, background notification work, live purchases and sign-in are not verified in this task. iOS needs its own simulator builds before any iOS release.

## Migration Plan

Merge after required CI passes on the final head, verify web delivery from main CI, then build and submit Android 1.8.32/114 from final main. Close the eleven proposals as superseded after confirming each pin on main. Roll back by reverting the squash commit. Never send this native graph as an OTA to older runtimes.
