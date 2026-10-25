#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
STATE=${1:?Expected external evidence directory}
mkdir -p "$STATE"
STATE=$(cd "$STATE" && pwd)
case "$STATE/" in "$ROOT/"*) echo 'Guard evidence must be outside the source checkout' >&2; exit 1 ;; esac
FIXTURE=$(mktemp -d "$STATE/guard-fixture.XXXXXX")
trap 'rm -rf "$FIXTURE"' EXIT
GUARD=${YIFY_QA_GUARD_SCRIPT:-$ROOT/scripts/android-qa/compile-only.gradle}
GRADLE=${YIFY_QA_GUARD_GRADLE:-$ROOT/android/gradlew}
mkdir -p "$FIXTURE/app"
printf "rootProject.name = 'compile-only-guard-regression'\ninclude ':app'\n" > "$FIXTURE/settings.gradle"
cat > "$FIXTURE/app/build.gradle" <<'GRADLE'
def uploads = [
    'createBundleReleaseJsAndAssets_SentryUpload_fixture@1+1_1',
    'uploadCrashlyticsSymbolFileRelease',
    'uploadCrashlyticsMappingFileRelease'
]
tasks.configureEach {
    if (uploads.contains(name)) enabled = false
}
uploads.each { name ->
    tasks.register(name) {
        enabled = true
        onlyIf { true }
        doLast { file("${name}.executed").text = 'unexpected telemetry action' }
    }
}
def compile = tasks.register('compileFixture') {
    dependsOn(uploads[1..2])
    finalizedBy(uploads[0])
    doLast {
        def verifyVersions = gradle.ext.yifyVerifyToolchainVersions
        def expected = [kotlin: '2.4.21', r8: '9.2.14']
        def capturedR8 = '9.2.14 (build b159b01e1cdc38c1106be42aeebfb7f44397dad1 from go/r8bot (luci-r8-custom-ci-archive-0-vv1n))'
        verifyVersions(expected, '2.4.21', capturedR8)
        verifyVersions(expected, '2.4.21', '9.2.14')
        ['9.2.13', '9.2.140', '9.2.14-dev', '9.2.14 unexpected',
         '9.2.14 (build fixture)\ninjected', null].each { actual ->
            def refused = false
            try {
                verifyVersions(expected, '2.4.21', actual)
            } catch (GradleException failure) {
                assert failure.message.contains('unaudited R8 version')
                refused = true
            }
            assert refused : "Unexpectedly accepted R8 version ${actual}"
        }
        def refusedKotlin = false
        try {
            verifyVersions(expected, '2.2.10', capturedR8)
        } catch (GradleException failure) {
            assert failure.message.contains('effective Kotlin version')
            refusedKotlin = true
        }
        assert refusedKotlin
        file('compile.executed').text = 'compiled'
    }
}
def forbidden = ['uploadUnknownDestination', 'publishFixture', 'deployFixture', 'submitFixture']
forbidden.each { name ->
    tasks.register(name) {
        enabled = !providers.gradleProperty('lateUnknownTask').isPresent()
        doLast { file("${name}.executed").text = 'unexpected external action' }
    }
}
if (providers.gradleProperty('unknownTasks').isPresent()) {
    compile.configure { dependsOn(forbidden) }
}
if (providers.gradleProperty('lateUnknownTask').isPresent()) {
    compile.configure { dependsOn(providers.gradleProperty('lateUnknownTask').get()) }
}
gradle.taskGraph.whenReady {
    if (providers.gradleProperty('lateEnable').isPresent()) {
        uploads.each { tasks.named(it).get().enabled = true }
    }
    if (providers.gradleProperty('lateUnknownTask').isPresent()) {
        tasks.named(providers.gradleProperty('lateUnknownTask').get()).get().enabled = true
    }
}
GRADLE
SENTRY_DISABLE_AUTO_UPLOAD=true "$GRADLE" --no-daemon --offline --no-configuration-cache \
    -p "$FIXTURE" -I "$GUARD" -PlateEnable :app:compileFixture > "$STATE/guard-known-uploads.log" 2>&1
test -f "$FIXTURE/app/compile.executed"
test "$(find "$FIXTURE" -name '*.executed' | wc -l)" -eq 1
grep -F 'Verified compile-only task graph:' "$STATE/guard-known-uploads.log"
rm "$FIXTURE/app/compile.executed"
if SENTRY_DISABLE_AUTO_UPLOAD=true "$GRADLE" --no-daemon --offline --no-configuration-cache \
    -p "$FIXTURE" -I "$GUARD" -PunknownTasks :app:compileFixture > "$STATE/guard-unknown-tasks.log" 2>&1; then
    echo 'Guard incorrectly allowed unknown external tasks' >&2
    exit 1
fi
grep -F 'Compile-only QA refuses externally mutating tasks:' "$STATE/guard-unknown-tasks.log"
for task in uploadUnknownDestination publishFixture deployFixture submitFixture; do
    grep -F ":app:$task" "$STATE/guard-unknown-tasks.log" >/dev/null
done
test -z "$(find "$FIXTURE" -name '*.executed' -print -quit)"
for task in uploadUnknownDestination publishFixture deployFixture submitFixture; do
    if SENTRY_DISABLE_AUTO_UPLOAD=true "$GRADLE" --no-daemon --offline --no-configuration-cache \
        --stacktrace -p "$FIXTURE" -I "$GUARD" "-PlateUnknownTask=$task" :app:compileFixture > "$STATE/guard-late-$task.log" 2>&1; then
        echo "Guard incorrectly allowed late-enabled task $task" >&2
        exit 1
    fi
    grep -F "Compile-only QA refuses externally mutating task execution: :app:$task" "$STATE/guard-late-$task.log"
    test -z "$(find "$FIXTURE" -name '*.executed' -print -quit)"
done
printf '%s\n' 'Compile-only guard regression PASS: audited Kotlin/R8 accepted; wrong versions refused; late re-enabled telemetry tasks skipped; enabled and late-enabled unknown external tasks rejected before any action'
