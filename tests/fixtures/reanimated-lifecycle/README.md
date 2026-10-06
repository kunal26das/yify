The fixture compiles the installed NodesManager, Worklets AnimationFrameQueue,
ReactChoreographer, and ChoreographerProvider unchanged. In particular, real
ReactChoreographer owns its callbackQueues monitor while invoking frame callbacks.

It extracts the installed NativeProxy Kotlin admission guard, operation and
event-query wrappers, render callback wrapper and invalidate body, NativeProxy
C++ operation/event-query/cleanup delegates, and ReanimatedModuleProxy layout-flush
body into a small JNI boundary compiled with undefined-behavior sanitization.
The surrounding Android platform, Fabric, JSI runtime, and module implementation
are controlled stubs. This is a deterministic source-level lifecycle regression
test, not a full Android process or proof of causation for historical telemetry.

The source generator never patches NodesManager. Run it after the repository's
ordinary dependency installation and native source patch guard:

    node prepare.mjs --repo <repository> --output <private source directory>

Compile that output with the portable pinned Kotlin/JDK17/JNI runner and these
23 modes, requiring a successful exit, no DEADLOCK marker, and the expected
explicit callback assertions in Main.kt:

    active completed paused worklets-only frame-window queue-stopped
    event-window query-window direct-window arriving-frame queued-event
    pause-resume reentrant active-background lock-order cancel-lock-order
    inflight late-schedule duplicate draw-pass
    upstream-disposed upstream-inflight upstream-trylock

The reverse-patched baseline control uses unmodified Reanimated 4.7.1 NodesManager
with the same upstream NativeProxy guard. Six teardown cases prove native calls
are rejected while stale Nodes callbacks, events or scheduled frames remain.
The installed patch cancels that work. Three direct NativeProxy cases also run
in both variants, independently of the Nodes monitor: an admitted reader delays
native reset, a held teardown writer never blocks UI readers, and disposed
operations, queries and queued rendering are skipped.

The covered boundary is NodesManager-owned callbacks, handlers, event queries,
native operation delegates and NativeProxy rendering during background ReactHost
module teardown. Other NativeProxy consumers and synchronous same-thread
teardown from inside an active callback are outside this fixture's proven scope.

Run `node scripts/check-reanimated-lifecycle.mjs` from the repository root with
JDK 17 and Clang available. The runner verifies SHA-256-pinned Kotlin compiler
artifacts before use, caches them, then checks all 23 installed-source cases and
ten upstream controls. Pass `--output <directory>` to retain receipts and logs.
