const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {tmpdir} = require('node:os');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');

const root = path.resolve(__dirname, '..');

test('patched query parsing preserves Unicode, malformed escapes, repeated keys and one decoding pass', () => {
    const queryString = require('query-string');
    const parsed = queryString.parse('q=hello+world&unicode=%F0%9F%98%80&malformed=%E2%82%AC%ZZ&literal=%252F&tag=a&tag=b&empty=&flag');
    assert.deepEqual({...parsed}, {
        q: 'hello world', unicode: '😀', malformed: '€%ZZ', literal: '%2F',
        tag: ['a', 'b'], empty: '', flag: null,
    });
    assert.deepEqual({...queryString.parse(queryString.stringify({q: 'a+b & 😀'}))}, {q: 'a+b & 😀'});
});

test('Expo Router preserves deep-link query decoding after router upgrades', () => {
    const {getStateFromPath} = require('expo-router/build/fork/getStateFromPath');
    const state = getStateFromPath('/movies?query=hello%20world&genre=%E2%82%AC%ZZ&literal=%252F');
    assert.equal(state.routes[0].name, 'movies');
    assert.deepEqual(state.routes[0].params, {query: 'hello world', genre: '€%ZZ', literal: '%2F'});
});

test('large malformed query input finishes within a bounded subprocess deadline', () => {
    const result = spawnSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        const queryString = require('query-string');
        const input = '%FF'.repeat(8192);
        assert.equal(queryString.parse('query=' + input).query, input);
    `], {cwd: root, encoding: 'utf8', timeout: 5000});
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
});

test('decoder adapter is idempotent and rejects changed versions or source before writing', async t => {
    const {applyQueryStringCompatibility} = await import('../scripts/query-string-compat.mjs');
    const patch = require('../patches/query-string-compat.json');
    const temporary = await fs.mkdtemp(path.join(tmpdir(), 'yify-query-string-'));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    await fs.mkdir(path.join(temporary, 'patches'));
    await fs.writeFile(path.join(temporary, 'patches/query-string-compat.json'), JSON.stringify(patch));
    const directory = path.join(temporary, patch.package);
    const decoderDirectory = path.join(directory, 'node_modules/decode-uri-component');
    await fs.mkdir(decoderDirectory, {recursive: true});
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({version: patch.version}));
    await fs.writeFile(path.join(decoderDirectory, 'package.json'), JSON.stringify({version: patch.decoderVersion}));
    await fs.writeFile(path.join(decoderDirectory, 'index.js'), 'module.exports = {};');
    const filename = path.join(directory, patch.file);
    const installed = await fs.readFile(require.resolve('query-string'), 'utf8');
    const original = installed.replace(patch.replace, patch.find);
    await fs.writeFile(filename, original);
    assert.equal(await applyQueryStringCompatibility(temporary), true);
    assert.equal(await applyQueryStringCompatibility(temporary), false);
    await fs.writeFile(filename, original);
    await fs.writeFile(path.join(decoderDirectory, 'package.json'), JSON.stringify({version: '0.2.2'}));
    await assert.rejects(applyQueryStringCompatibility(temporary), /expected 7\.1\.3\/0\.5\.0/);
    assert.equal(await fs.readFile(filename, 'utf8'), original);
    await fs.writeFile(path.join(decoderDirectory, 'package.json'), JSON.stringify({version: patch.decoderVersion}));
    await fs.writeFile(filename, `${original}\n`);
    await assert.rejects(applyQueryStringCompatibility(temporary), /source hash changed/);
    assert.equal(await fs.readFile(filename, 'utf8'), `${original}\n`);
});
