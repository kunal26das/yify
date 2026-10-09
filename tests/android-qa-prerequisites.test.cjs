const assert = require('node:assert/strict');
const {test} = require('node:test');
const {mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync} = require('node:fs');
const {spawnSync} = require('node:child_process');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {createHash} = require('node:crypto');
const preflight = import('../scripts/android-qa/preflight.mjs');
const root = resolve(__dirname, '..');

function temporary(t) {
    const path = mkdtempSync(join(tmpdir(), 'yify-android-qa-test-'));
    t.after(() => rmSync(path, {recursive: true, force: true}));
    return path;
}

function put(root_, path, data = '', executable = false) {
    const full = join(root_, path);
    mkdirSync(require('node:path').dirname(full), {recursive: true});
    writeFileSync(full, data);
    if (executable) chmodSync(full, 0o755);
}

test('toolchain is derived from exact source pins and rejects drift or absent installed sources', async () => {
    const {toolchain: t, sourceProblems} = await preflight;
    const pkg = {dependencies: {expo: t.expo, 'react-native': t.reactNative}};
    const wrapper = `distributionUrl=https://services.gradle.org/distributions/gradle-${t.gradle}-bin.zip\ndistributionSha256Sum=${t.gradleSha256}`;
    const catalog = Object.entries({agp: t.agp, compileSdk: t.compileSdk, targetSdk: t.targetSdk,
        minSdk: t.minSdk, buildTools: t.buildTools, ndkVersion: t.ndk}).map(([k, v]) => `${k} = "${v}"`).join('\n');
    const react = `val cmakeVersion = System.getenv("CMAKE_VERSION") ?: "${t.reactNativeCmake}"`;
    assert.deepEqual(sourceProblems(pkg, wrapper, catalog, react), []);
    assert.match(sourceProblems(pkg, wrapper, null, null).join(';'), /version catalog is required/);
    assert.match(sourceProblems(pkg, wrapper.replace(t.gradleSha256, '0'.repeat(64)), catalog, react).join(';'), /checksum/);
    assert.match(sourceProblems(pkg, wrapper, catalog.replace(t.ndk, '27.3.13750724'), react).join(';'), /ndkVersion/);
    assert.match(sourceProblems(pkg, wrapper, catalog, react.replace(t.reactNativeCmake, '9.9.9')).join(';'), /CMake/);
});

test('SDK packages include both CMake requirements and no unrequested emulator download', async () => {
    const {sdkPackages} = await preflight;
    assert.deepEqual(sdkPackages(), ['platform-tools', 'platforms;android-37', 'build-tools;37.0.0',
        'ndk;27.1.12297006', 'cmake;3.22.1', 'cmake;3.30.5']);
    assert.deepEqual(sdkPackages(true).slice(-2), ['emulator', 'system-images;android-35;google_apis;x86_64']);
});

test('matching SDK directory alone never proves a package is usable', async t => {
    const {sdkPackageStatus} = await preflight;
    const sdk = temporary(t);
    mkdirSync(join(sdk, 'ndk/27.1.12297006'), {recursive: true});
    assert.equal(sdkPackageStatus(sdk, 'ndk;27.1.12297006').valid, false);
    put(sdk, 'ndk/27.1.12297006/source.properties', 'Pkg.Revision = 27.1.12297006\n');
    assert.equal(sdkPackageStatus(sdk, 'ndk;27.1.12297006').valid, false);
    put(sdk, 'ndk/27.1.12297006/toolchains/llvm/prebuilt/linux-x86_64/bin/clang', '', true);
    assert.equal(sdkPackageStatus(sdk, 'ndk;27.1.12297006').valid, true);
    put(sdk, 'ndk/27.1.12297006/source.properties', 'Pkg.Revision = 27.3.13750724\n');
    assert.equal(sdkPackageStatus(sdk, 'ndk;27.1.12297006').valid, false);
});

test('platform API metadata, platform jar, and exact build tools executables are mandatory', async t => {
    const {sdkPackageStatus} = await preflight;
    const sdk = temporary(t);
    put(sdk, 'platforms/android-37/source.properties', 'Pkg.Revision=2\nAndroidVersion.ApiLevel=36\n');
    put(sdk, 'platforms/android-37/android.jar');
    assert.equal(sdkPackageStatus(sdk, 'platforms;android-37').valid, false);
    put(sdk, 'platforms/android-37/source.properties', 'Pkg.Revision=2\nAndroidVersion.ApiLevel=37\n');
    assert.equal(sdkPackageStatus(sdk, 'platforms;android-37').valid, true);
    put(sdk, 'build-tools/37.0.0/source.properties', 'Pkg.Revision=37.0.0\n');
    for (const binary of ['aapt2', 'apksigner', 'zipalign']) put(sdk, `build-tools/37.0.0/${binary}`, '', true);
    assert.equal(sdkPackageStatus(sdk, 'build-tools;37.0.0').valid, true);
    chmodSync(join(sdk, 'build-tools/37.0.0/aapt2'), 0o644);
    assert.equal(sdkPackageStatus(sdk, 'build-tools;37.0.0').valid, false);
});

test('CMake revision and compiler helpers cannot be replaced by an empty installation', async t => {
    const {sdkPackageStatus} = await preflight;
    const sdk = temporary(t);
    put(sdk, 'cmake/3.30.5/source.properties', 'Pkg.Revision = 3.30.5\n');
    put(sdk, 'cmake/3.30.5/bin/cmake', '', true);
    assert.equal(sdkPackageStatus(sdk, 'cmake;3.30.5').valid, false);
    put(sdk, 'cmake/3.30.5/bin/ninja', '', true);
    assert.equal(sdkPackageStatus(sdk, 'cmake;3.30.5').valid, true);
});

test('saved prerequisites are reusable only while both current checks and the exact environment fingerprint match', async () => {
    const {reusable} = await preflight;
    const receipt = {schemaVersion: 1, mode: 'build', passed: true, sourceSha: 'a'.repeat(40),
        fingerprint: {files: {lock: 'abc'}, packages: [{revision: '2'}]}};
    assert.equal(reusable(receipt, {...receipt, sourceSha: 'b'.repeat(40)}), true);
    assert.equal(reusable(receipt, {...receipt, passed: false}), false);
    assert.equal(reusable(receipt, {...receipt, mode: 'connected'}), false);
    assert.equal(reusable(receipt, {...receipt, fingerprint: {files: {lock: 'changed'}}}), false);
    assert.equal(reusable({...receipt, mode: 'audit'}, receipt), false);
    assert.equal(reusable(null, receipt), false);
});

test('ignored dotenv, SDK and signing overrides block an otherwise clean checkout', async t => {
    const {localOverrides} = await preflight;
    const checkout = temporary(t);
    put(checkout, '.env.example');
    assert.deepEqual(localOverrides(checkout), []);
    for (const file of ['.env', '.env.production', '.env.sentry-build-plugin', 'android/keystore.properties', 'android/local.properties']) put(checkout, file);
    assert.deepEqual(localOverrides(checkout).sort(), ['.env', '.env.production', '.env.sentry-build-plugin',
        'android/keystore.properties', 'android/local.properties'].sort());
});

test('setup fails on capacity and license preflight before installation and never accepts licenses', () => {
    const setup = readFileSync(join(root, 'scripts/android-qa/setup-cloud.sh'), 'utf8');
    assert.ok(setup.indexOf('bootstrap >') < setup.indexOf('--install'));
    assert.match(setup, /--install "\$\{PACKAGES\[@\]\}" <\/dev\/null/);
    assert.doesNotMatch(setup, /--licenses|\byes\s*\||\bsudo\b/);
    assert.match(setup, /--frozen-lockfile --non-interactive/);
});

test('compile-only runner isolates environment and disables telemetry uploads without changing source ABIs', () => {
    const script = readFileSync(join(root, 'scripts/android-qa/run-compile-only.sh'), 'utf8');
    const guard = readFileSync(join(root, 'scripts/android-qa/compile-only.gradle'), 'utf8');
    assert.match(script, /exec env -i/);
    assert.match(script, /SENTRY_DISABLE_AUTO_UPLOAD=true/);
    assert.match(script, /EXPO_NO_DOTENV=1/);
    assert.match(script, /-Pandroid.builder.sdkDownload=false/);
    assert.match(script, /-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64/);
    assert.match(script, /:app:assembleRelease :app:bundleRelease/);
    assert.match(guard, /nativeSymbolUploadEnabled = false/);
    assert.match(guard, /task.enabled = false/);
    assert.match(guard, /gradle.taskGraph.whenReady/);
    assert.doesNotMatch(script, /eas\.sh|submit:|play-upload|adb /);
});

test('mocked QA rejects live fetch and socket connections before loading application fixtures', () => {
    const guard = join(root, 'scripts/android-qa/deny-network.cjs');
    for (const source of ['fetch("https://example.invalid")', 'require("node:net").connect(443, "example.invalid")']) {
        const result = spawnSync(process.execPath, ['--require', guard, '-e', source], {encoding: 'utf8'});
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /refuses live network access/);
    }
});

test('HSDP regression keeps the independently reviewed real-bytecode harness unchanged', () => {
    for (const [file, expected] of Object.entries({
        'HsdpNullExtrasHarness.java': '45ef2d52314903f5cc5cd005f868b2dacb91474ab5318d3ea3902044bac59149',
        'run-hsdp-regression.sh': '639e60975b1536a3def1dc0d4bc435ca2f5be95d1cbf75bf4d7bf972e7ce7c79',
    })) assert.equal(createHash('sha256').update(readFileSync(join(root, 'scripts/android-qa', file))).digest('hex'), expected);
});

test('connected preflight remains unconditionally blocked until test-service isolation is implemented', () => {
    const script = readFileSync(join(root, 'scripts/android-qa/preflight.mjs'), 'utf8');
    for (const check of ['connected-test-service-routing', 'sandbox-accounts', 'device-egress-policy']) {
        assert.match(script, new RegExp(`add\\('${check}', false`));
    }
});

test('patch-only compatibility changes invalidate the saved prerequisite fingerprint', async t => {
    const {setupInputs, setupInputHashes} = await preflight;
    const checkout = temporary(t);
    for (const file of setupInputs) put(checkout, file, 'original');
    put(checkout, 'patches/expo-native/manifest.json', 'original manifest');
    put(checkout, 'patches/expo-native/native.patch', 'original patch');
    const before = setupInputHashes(checkout);
    put(checkout, 'patches/expo-native/native.patch', 'updated patch');
    assert.notDeepEqual(setupInputHashes(checkout), before);
    put(checkout, 'patches/expo-native/native.patch', 'original patch');
    put(checkout, 'tooling/compatibility-patches.json', 'updated tooling patches');
    assert.notDeepEqual(setupInputHashes(checkout), before);
});

test('fresh setup workflow can validate an unmerged same-repository PR at its exact head without service secrets', () => {
    const workflow = readFileSync(join(root, '.github/workflows/android-compile-only-qa.yml'), 'utf8');
    assert.match(workflow, /pull_request:\n    paths:/);
    assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
    assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| inputs\.source_sha \}\}/);
    assert.match(workflow, /SOURCE_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| inputs\.source_sha \}\}/);
    assert.match(workflow, /contents: read/);
    assert.match(workflow, /persist-credentials: false/);
    assert.doesNotMatch(workflow, /pull_request_target|secrets\.|contents: write|actions: write|sudo/);
});
