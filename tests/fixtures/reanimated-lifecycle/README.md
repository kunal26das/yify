The fixture compiles the installed NodesManager, Worklets AnimationFrameQueue,
ReactChoreographer, and ChoreographerProvider unchanged. In particular, real
ReactChoreographer owns its callbackQueues monitor while invoking frame callbacks.

It extracts the installed NativeProxy Kotlin invalidate body, NativeProxy C++
operation/event-query/cleanup delegates, and ReanimatedModuleProxy layout-flush
body into a small JNI boundary compiled with undefined-behavior sanitization.
The surrounding Android platform, Fabric, JSI runtime, and module implementation
are controlled stubs. This is a deterministic source-level lifecycle regression
test, not a full Android process or proof of causation for historical telemetry.

The source generator never patches NodesManager. Run it after the repository's
ordinary dependency installation and native source patch guard:

    node prepare.mjs --repo <repository> --output <private source directory>

Compile that output with the portable pinned Kotlin/JDK17/JNI runner and these
20 modes, requiring a successful exit, no DEADLOCK marker, and the expected
explicit callback assertions in Main.kt:

    active completed paused worklets-only frame-window queue-stopped
    event-window query-window direct-window arriving-frame queued-event
    pause-resume reentrant active-background lock-order cancel-lock-order
    inflight late-schedule duplicate draw-pass

The reverse-patched baseline control reproduces six native null-member calls.
Two separately tested negative controls add the lifecycle monitor around either
the full background event path or the whole invalidate method. Both produce a
detected monitor deadlock with real ReactChoreographer lock-held dispatch. These
unsafe mutations are private review controls; the regular fixture compiles only
the actual installed production source.

The covered boundary is NodesManager-owned callbacks, handlers, event queries,
and native operation delegates during background ReactHost module teardown.
Other NativeProxy consumers and synchronous same-thread teardown from inside
an active callback are outside this fix's proven scope.

Run `node scripts/check-reanimated-lifecycle.mjs` from the repository root with
JDK 17 and Clang available. The runner verifies SHA-256-pinned Kotlin compiler
artifacts before use, caches them, then checks all 20 installed-source cases and
the six baseline failures. Pass `--output <directory>` to retain receipts and logs.
