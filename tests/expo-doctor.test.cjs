const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtemp, mkdir, writeFile, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const {dirname, join} = require('node:path');
const helpers = import('../scripts/check-expo-doctor.mjs');
const pins = import('../scripts/check-dependency-pins.mjs');

const dependency = {packageName: 'react', actualVersion: '19.3.0', expectedVersionOrRange: '19.2.3'};
const policy = {sdkVersion: '57.0.0', packages: {react: {version: '19.3.0', expected: '19.2.3', reason: 'Match React DOM.'}}};
const structural = 'Check for app config fields that may not be synced in a non-CNG project';
const dependencyTitle = 'Check that packages match versions required by installed Expo SDK';
const expoVersion = '58.0.0-preview.6';
const expoPolicy = {version: expoVersion, expected: '~58.0.0-preview.7', reason: 'Keep validated native runtime.'};

function sdkReview(packages = {}, bundledNativeModules = {}, installedVersions = {}) {
    return {
        policy: {sdkVersion: '58.0.0', packages: {expo: expoPolicy, ...packages}},
        installedSdk: {
            expoVersion,
            bundledNativeModules,
            installedVersions: {expo: expoVersion, ...Object.fromEntries(Object.entries(packages).map(([name, entry]) => [name, entry.version])), ...installedVersions},
        },
    };
}

function result(failures = [], detail = '') {
    return {status: failures.length ? 1 : 0, stdout: `${18 - failures.length}/18 checks passed.\n${failures.map((name) => `✖ ${name}`).join('\n')}\n${detail}`, stderr: ''};
}

test('accepts a complete clean doctor result and reviewed structural failure', async () => {
    const {assessDoctor} = await helpers;
    assert.deepEqual(assessDoctor(result()), []);
    assert.deepEqual(assessDoctor(result([structural])), [structural]);
});

for (const [name, run] of [
    ['spawn failure', {error: new Error('ENOENT'), status: null}],
    ['timeout', {signal: 'SIGTERM', status: null}],
    ['unexpected exit', {status: 2, stdout: '18/18 checks passed.'}],
    ['network failure without check results', {status: 1, stderr: 'fetch failed'}],
    ['truncated success', {status: 0, stdout: ''}],
    ['zero completed checks', {status: 0, stdout: '0/0 checks passed.'}],
    ['unreported failure', {status: 1, stdout: '17/18 checks passed.'}],
    ['failure exit with passing summary', {status: 1, stdout: '18/18 checks passed.'}],
    ['success exit with failed checks', {...result([structural]), status: 0}],
    ['unknown failed check', result(['Check for duplicate dependencies'])],
]) test(`rejects ${name}`, async () => {
    const {assessDoctor} = await helpers;
    assert.throws(() => assessDoctor(run));
});

test('dependency failures require the exact reviewed package, recommendation and count', async () => {
    const {assessDoctor} = await helpers;
    const run = result([dependencyTitle], 'react  19.2.3  19.3.0\n1 package out of date.');
    assert.throws(() => assessDoctor(run), /unexpected failures/);
    assert.deepEqual(assessDoctor(run, {reviewedDependencies: [dependency]}), [dependencyTitle]);
    assert.throws(() => assessDoctor(result(), {reviewedDependencies: [dependency]}), /findings differ/);
    for (const detail of [
        'react  19.2.4  19.3.0\n1 package out of date.',
        'react  19.2.3  19.3.1\n1 package out of date.',
        'react  19.2.3  19.3.0\nother 1.0.0 2.0.0\n2 packages out of date.',
        'Dependency check could not complete.',
    ]) assert.throws(() => assessDoctor(result([dependencyTitle], detail), {reviewedDependencies: [dependency]}), /findings differ/);
});

test('ANSI output and a repeated verbose failure heading do not weaken the summary check', async () => {
    const {assessDoctor} = await helpers;
    const run = result([structural]);
    run.stdout = `\u001b[31m${run.stdout}✖ ${structural}\u001b[0m\n`;
    assert.deepEqual(assessDoctor(run), [structural]);
});

test('doctor omits same-core prerelease rows while CLI policy still requires their exact approval', async () => {
    const {assessDoctor, reviewDeviations} = await helpers;
    const expo = {packageName: 'expo', actualVersion: '58.0.0-preview.6', expectedVersionOrRange: '~58.0.0-preview.7'};
    const reviewedPolicy = {sdkVersion: '58.0.0', packages: {expo: {
        version: expo.actualVersion, expected: expo.expectedVersionOrRange, reason: 'Keep validated native runtime.'
    }}};
    assert.throws(() => reviewDeviations([expo], {...reviewedPolicy, packages: {}}, '58.0.0'), /Unreviewed/);
    assert.equal(reviewDeviations([expo], reviewedPolicy, '58.0.0').length, 1);
    assert.throws(() => reviewDeviations([{...expo, actualVersion: '58.0.0-preview.5'}], reviewedPolicy, '58.0.0'), /Unreviewed/);
    assert.deepEqual(assessDoctor(result(), {reviewedDependencies: [expo]}), []);
    const run = result([dependencyTitle], 'react  19.2.3  19.3.0\n1 package out of date.');
    assert.deepEqual(assessDoctor(run, {reviewedDependencies: [dependency, expo]}), [dependencyTitle]);
    assert.throws(() => assessDoctor(result(), {reviewedDependencies: [dependency, expo]}), /findings differ/);
    assert.throws(() => assessDoctor(run, {reviewedDependencies: [dependency, {...expo, expectedVersionOrRange: '~58.0.1-preview.1'}]}), /findings differ/);
    assert.throws(() => assessDoctor(result([dependencyTitle], 'react 19.2.3 19.3.0\nother 1.0.0 2.0.0\n2 packages out of date.'),
        {reviewedDependencies: [dependency, expo]}), /findings differ/);
});

test('only exact, SDK-scoped policy entries permit dependency deviations', async () => {
    const {reviewDeviations} = await helpers;
    assert.match(reviewDeviations([dependency], policy, '57.0.0')[0], /React DOM/);
    assert.throws(() => reviewDeviations([dependency], policy, '58.0.0'), /installed SDK/);
    for (const change of [{actualVersion: '19.3.1'}, {expectedVersionOrRange: '19.2.4'}, {packageName: 'react-native'}]) {
        assert.throws(() => reviewDeviations([{...dependency, ...change}], policy, '57.0.0'), /Unreviewed/);
    }
    assert.throws(() => reviewDeviations([dependency], {...policy, packages: {react: {...policy.packages.react, reason: ''}}}, '57.0.0'), /Unreviewed/);
});

test('remote patch recommendations can advance while the exact reviewed installed version remains supported by its SDK bundle', async () => {
    const {reviewDeviations} = await helpers;
    const entry = {version: '58.0.6', expected: '~58.0.7', reason: 'Keep validated native runtime.'};
    const {policy, installedSdk} = sdkReview({'expo-constants': entry}, {'expo-constants': '~58.0.6'});
    const current = {packageName: 'expo-constants', actualVersion: entry.version, expectedVersionOrRange: '~58.0.8'};
    assert.match(reviewDeviations([current], policy, '58.0.0', installedSdk)[0], /satisfies bundled ~58.0.6.*now recommends ~58.0.8.*coordinated dependency update/);
    assert.throws(() => reviewDeviations([current], policy, '58.0.0'), /Unreviewed/);
    for (const expectedVersionOrRange of ['~58.1.0', '~59.0.0', '^58.0.8', '>=58.0.8', '~58.0.8 || ~59.0.0', '~58.0.8-preview.1', '~58.0.6']) {
        assert.throws(() => reviewDeviations([{...current, expectedVersionOrRange}], policy, '58.0.0', installedSdk), /Unreviewed/);
    }
    for (const bundled of ['~58.0.7', '~57.0.6', '~58.1.0', 'invalid']) {
        assert.throws(() => reviewDeviations([current], policy, '58.0.0', {...installedSdk, bundledNativeModules: {'expo-constants': bundled}}), /Unreviewed/);
    }
});

test('an installed SDK default permits patch drift only for a known package with a matching installed version', async () => {
    const {reviewDeviations} = await helpers;
    const current = {packageName: 'expo-font', actualVersion: '58.0.2', expectedVersionOrRange: '~58.0.3'};
    const {policy, installedSdk} = sdkReview({}, {'expo-font': '~58.0.2'}, {'expo-font': current.actualVersion});
    assert.match(reviewDeviations([current], policy, '58.0.0', installedSdk)[0], /satisfies bundled ~58.0.2/);
    assert.throws(() => reviewDeviations([current], policy, '58.0.0', {...installedSdk, bundledNativeModules: {}}), /Unreviewed/);
    for (const change of [{packageName: 'unknown'}, {actualVersion: '58.0.1'}, {actualVersion: '58.0.3'}]) {
        assert.throws(() => reviewDeviations([{...current, ...change}], policy, '58.0.0', installedSdk), /Unreviewed/);
    }
});

test('bundled patch drift never relaxes reviewed actual versions or unsupported major and minor deviations', async () => {
    const {reviewDeviations} = await helpers;
    for (const [packageName, actualVersion, expected, expectedVersionOrRange] of [
        ['@sentry/react-native', '8.27.0', '~7.11.0', '~7.11.1'],
        ['react-native-worklets', '0.13.0', '0.12.2', '0.12.3'],
        ['react', '19.3.0', '19.2.3', '19.2.4'],
    ]) {
        const {policy, installedSdk} = sdkReview({[packageName]: {version: actualVersion, expected, reason: 'Validated deliberate deviation.'}}, {[packageName]: expected});
        assert.equal(reviewDeviations([{packageName, actualVersion, expectedVersionOrRange: expected}], policy, '58.0.0', installedSdk).length, 1);
        assert.throws(() => reviewDeviations([{packageName, actualVersion, expectedVersionOrRange}], policy, '58.0.0', installedSdk), /Unreviewed/);
    }
    const {policy, installedSdk} = sdkReview({'expo-constants': {version: '58.0.6', expected: '~58.0.7', reason: 'Keep validated native runtime.'}}, {'expo-constants': '~58.0.6'});
    const changedInstalled = {...installedSdk, installedVersions: {...installedSdk.installedVersions, 'expo-constants': '58.0.7'}};
    assert.throws(() => reviewDeviations([], policy, '58.0.0', changedInstalled), /Unreviewed installed Expo dependency/);
    assert.throws(() => reviewDeviations([], policy, '58.0.0', {...installedSdk, expoVersion: '58.0.0-preview.7'}), /installed SDK version/);
    assert.throws(() => reviewDeviations([], policy, '58.0.0', {...installedSdk, expoVersion: '59.0.0-preview.6'}), /installed SDK version/);
    assert.throws(() => reviewDeviations([], policy, '58.0.0', {...installedSdk, bundledNativeModules: null}), /installed SDK version/);
});

test('Expo recommendation drift is limited to progression within the exact reviewed prerelease core and channel', async () => {
    const {reviewDeviations} = await helpers;
    const {policy, installedSdk} = sdkReview();
    const current = {packageName: 'expo', actualVersion: expoVersion, expectedVersionOrRange: '~58.0.0-preview.8'};
    assert.match(reviewDeviations([current], policy, '58.0.0', installedSdk)[0], /now recommends ~58.0.0-preview.8.*coordinated SDK update/);
    for (const expectedVersionOrRange of ['~58.0.0-preview.5', '~58.0.0-preview.6', '~58.0.0-rc.1', '~58.0.0', '~58.0.1-preview.8', '~58.1.0-preview.8', '~59.0.0-preview.8', '^58.0.0-preview.8']) {
        assert.throws(() => reviewDeviations([{...current, expectedVersionOrRange}], policy, '58.0.0', installedSdk), /Unreviewed/);
    }
    assert.throws(() => reviewDeviations([{...current, actualVersion: '58.0.0-preview.7'}], policy, '58.0.0', installedSdk), /Unreviewed/);
    const upgradedVersion = '58.0.0-preview.7';
    const upgradedPolicy = {...policy, packages: {expo: {...expoPolicy, version: upgradedVersion}}};
    const upgradedSdk = {...installedSdk, expoVersion: upgradedVersion, installedVersions: {expo: upgradedVersion}};
    assert.match(reviewDeviations([{...current, actualVersion: upgradedVersion}], upgradedPolicy, '58.0.0', upgradedSdk)[0], /now recommends ~58.0.0-preview.8/);
});

test('a bundled React Native prerelease permits only newer recommendations in its exact core and channel', async () => {
    const {reviewDeviations} = await helpers;
    const current = {packageName: 'react-native', actualVersion: '0.88.0-rc.1', expectedVersionOrRange: '0.88.0-rc.2'};
    const {policy, installedSdk} = sdkReview({}, {'react-native': '0.88.0-rc.1'}, {'react-native': current.actualVersion});
    assert.match(reviewDeviations([current], policy, '58.0.0', installedSdk)[0], /satisfies bundled 0.88.0-rc.1.*now recommends 0.88.0-rc.2/);
    for (const expectedVersionOrRange of ['0.88.0-rc.0', '0.88.0-rc.1', '0.88.0-preview.2', '0.88.0', '0.88.1-rc.2', '0.89.0-rc.2', '1.88.0-rc.2', '~0.88.0-rc.2']) {
        assert.throws(() => reviewDeviations([{...current, expectedVersionOrRange}], policy, '58.0.0', installedSdk), /Unreviewed/);
    }
    for (const bundled of ['~0.88.0-rc.1', '^0.88.0-rc.1', '0.88.0-rc.0', '0.88.0']) {
        assert.throws(() => reviewDeviations([current], policy, '58.0.0', {...installedSdk, bundledNativeModules: {'react-native': bundled}}), /Unreviewed/);
    }
    const changed = {...current, actualVersion: '0.88.0-rc.2', expectedVersionOrRange: '0.88.0-rc.3'};
    const changedInstalled = {...installedSdk, installedVersions: {...installedSdk.installedVersions, 'react-native': changed.actualVersion}};
    assert.throws(() => reviewDeviations([changed], policy, '58.0.0', changedInstalled), /Unreviewed/);
    assert.throws(() => reviewDeviations([{...current, packageName: 'unknown-native'}], policy, '58.0.0', installedSdk), /Unreviewed/);
});

test('unrelated release and type updates still run full network doctor when remote SDK recommendations advance', async (t) => {
    const {main} = await helpers;
    const root = await mkdtemp(join(tmpdir(), 'expo-doctor-recommendation-drift-'));
    t.after(() => rm(root, {recursive: true, force: true}));
    const {policy, installedSdk} = sdkReview({'expo-constants': {version: '58.0.6', expected: '~58.0.7', reason: 'Keep validated native runtime.'}}, {'expo-constants': '~58.0.6'});
    installedSdk.bundledNativeModules['react-native'] = '0.88.0-rc.1';
    const pkg = {dependencies: {expo: expoVersion, 'expo-constants': '58.0.6', 'react-native': '0.88.0-rc.1'}, devDependencies: {'@types/node': '26.0.0'}};
    const save = async (path, value) => {
        await mkdir(dirname(join(root, path)), {recursive: true});
        await writeFile(join(root, path), JSON.stringify(value));
    };
    await Promise.all([
        save('package.json', pkg),
        save('scripts/expo-dependency-policy.json', policy),
        save('node_modules/expo/package.json', {version: expoVersion}),
        save('node_modules/expo/bundledNativeModules.json', installedSdk.bundledNativeModules),
        save('node_modules/expo-constants/package.json', {version: '58.0.6'}),
        save('node_modules/react-native/package.json', {version: '0.88.0-rc.1'}),
        save('node_modules/@types/node/package.json', {version: '26.0.0'}),
        save('node_modules/expo-doctor/bin/expo-doctor.js', {}),
        save('release/package.json', {dependencies: {vite: '8.0.0'}}),
    ]);
    const bypasses = ['EXPO_OFFLINE', 'EXPO_NO_DEPENDENCY_VALIDATION', 'EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK', 'EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS'];
    const previousEnv = Object.fromEntries(bypasses.map((name) => [name, process.env[name]]));
    t.after(() => {
        for (const [name, value] of Object.entries(previousEnv)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });
    for (const name of bypasses) process.env[name] = '1';
    for (const patch of [7, 8]) {
        if (patch === 8) {
            pkg.devDependencies['@types/node'] = '26.0.1';
            await Promise.all([
                save('package.json', pkg),
                save('node_modules/@types/node/package.json', {version: '26.0.1'}),
                save('release/package.json', {dependencies: {vite: '8.0.1'}}),
            ]);
        }
        const findings = [
            {packageName: 'expo', actualVersion: expoVersion, expectedVersionOrRange: `~58.0.0-preview.${patch}`},
            {packageName: 'expo-constants', actualVersion: '58.0.6', expectedVersionOrRange: `~58.0.${patch}`},
        ];
        if (patch === 8) findings.push({packageName: 'react-native', actualVersion: '0.88.0-rc.1', expectedVersionOrRange: '0.88.0-rc.2'});
        const calls = [];
        const logs = [];
        await main({root, log: (line) => logs.push(line), spawn: (command, args, options) => {
            calls.push({command, args, options});
            return calls.length === 1 ? {status: 1, stdout: JSON.stringify({upToDate: false, dependencies: findings})} :
                result([dependencyTitle], `expo-constants  ~58.0.${patch}  58.0.6\n1 package out of date.`);
        }});
        assert.equal(calls.length, 2);
        assert.equal(calls[0].command, process.execPath);
        assert.deepEqual(calls[0].args.slice(1), ['install', '--check', '--json']);
        assert.match(calls[1].args[0], /expo-doctor\/bin\/expo-doctor.js$/);
        assert.equal(calls[1].args.length, 1);
        for (const {options} of calls) {
            assert.equal(options.env.CI, '1');
            for (const name of bypasses) assert.equal(Object.hasOwn(options.env, name), false);
        }
        assert.match(logs.join('\n'), /Expo checks passed/);
        if (patch === 8) assert.match(logs.join('\n'), /now recommends ~58.0.8/);
    }
});

test('dependency JSON must agree with process status and package findings', async () => {
    const {readDependencyCheck} = await helpers;
    assert.deepEqual(readDependencyCheck({status: 1, stdout: JSON.stringify({upToDate: false, dependencies: [dependency]})}), [dependency]);
    assert.deepEqual(readDependencyCheck({status: 0, stdout: 'env: loaded .env\n' + JSON.stringify({upToDate: true, dependencies: []})}), []);
    for (const run of [
        {status: 1, stderr: 'network error'},
        {status: null, error: new Error('ENOENT')},
        {status: 0, stdout: JSON.stringify({upToDate: false, dependencies: [dependency]})},
        {status: 1, stdout: JSON.stringify({upToDate: true, dependencies: []})},
        {status: 1, stdout: JSON.stringify({upToDate: false, dependencies: [{}]})},
        {status: 1, stdout: JSON.stringify({upToDate: false, dependencies: []})},
    ]) assert.throws(() => readDependencyCheck(run));
});

test('dependency and security override versions remain exact', async () => {
    const {checkPins} = await pins;
    checkPins({dependencies: {a: '1.2.3'}, devDependencies: {b: '2.0.0-beta.1'}, resolutions: {c: '3.4.5'}}, 'package.json');
    for (const version of ['^1.2.3', '~1.2.3', '*', 'latest', '>=1.2.3', '1.2', 'workspace:*']) {
        for (const section of ['dependencies', 'devDependencies', 'resolutions']) {
            assert.throws(() => checkPins({[section]: {a: version}}, 'release/package.json'), /exact version/);
        }
    }
});

test('a stale or missing installed dependency cannot validate a changed manifest', async (t) => {
    const {verifyInstalledDependencies} = await helpers;
    const root = await mkdtemp(join(tmpdir(), 'expo-installed-dependencies-'));
    t.after(() => rm(root, {recursive: true, force: true}));
    await mkdir(join(root, 'node_modules/react'), {recursive: true});
    await writeFile(join(root, 'node_modules/react/package.json'), JSON.stringify({version: '19.3.0'}));
    await verifyInstalledDependencies({dependencies: {react: '19.3.0'}}, root);
    await assert.rejects(() => verifyInstalledDependencies({dependencies: {react: '19.3.1'}}, root), /does not match package.json/);
    await assert.rejects(() => verifyInstalledDependencies({devDependencies: {'expo-doctor': '1.20.4'}}, root), /Cannot read installed/);
});
