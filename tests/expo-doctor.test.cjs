const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtemp, mkdir, writeFile, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const helpers = import('../scripts/check-expo-doctor.mjs');
const pins = import('../scripts/check-dependency-pins.mjs');

const dependency = {packageName: 'react', actualVersion: '19.3.0', expectedVersionOrRange: '19.2.3'};
const policy = {sdkVersion: '57.0.0', packages: {react: {version: '19.3.0', expected: '19.2.3', reason: 'Match React DOM.'}}};
const structural = 'Check for app config fields that may not be synced in a non-CNG project';
const dependencyTitle = 'Check that packages match versions required by installed Expo SDK';

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
