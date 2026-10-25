const assert = require('node:assert/strict');
const {test} = require('node:test');
const {spawnSync} = require('node:child_process');
const {mkdtemp, mkdir, copyFile, realpath, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const path = require('node:path');

test('a clean checkout validates manifests before install and requires the installed graph afterward', async t => {
    const root = path.resolve(__dirname, '..');
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'yify-install-order-')));
    t.after(() => rm(directory, {recursive: true, force: true}));
    for (const filename of [
        'scripts/check-dependency-pins.mjs', 'scripts/check-firebase-compat.mjs',
        'scripts/expo-native-compat.mjs', 'scripts/firebase-compatibility.json',
        'package.json', 'crashreporting/package.json', 'release/package.json',
        'tooling/package.json', 'app.json', 'firebase.json',
    ]) {
        const target = path.join(directory, filename);
        await mkdir(path.dirname(target), {recursive: true});
        await copyFile(path.join(root, filename), target);
    }
    const command = path.join(directory, 'scripts/check-dependency-pins.mjs');
    const before = spawnSync(process.execPath, [command, '--manifests-only'], {encoding: 'utf8'});
    assert.equal(before.status, 0, before.stderr);
    const after = spawnSync(process.execPath, [command], {encoding: 'utf8'});
    assert.equal(after.status, 1);
    assert.match(after.stderr, /node_modules\/@react-native-firebase\/app\/package.json: ENOENT/);
});
