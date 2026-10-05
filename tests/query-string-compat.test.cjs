const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {test} = require('node:test');

const root = path.resolve(__dirname, '..');

test('Expo query parsing preserves Unicode, malformed escapes, repeated keys and one decoding pass', () => {
    const {getStateFromPath} = require('expo-router/build/fork/getStateFromPath');
    const parsed = getStateFromPath('/movies?q=hello+world&unicode=%F0%9F%98%80&malformed=%E2%82%AC%ZZ&literal=%252F&tag=a&tag=b&empty=&flag').routes[0].params;
    assert.deepEqual({...parsed}, {
        q: 'hello world', unicode: '😀', malformed: '€%ZZ', literal: '%2F',
        tag: ['a', 'b'], empty: '', flag: '',
    });
    const query = new URLSearchParams({q: 'a+b & 😀'}).toString();
    assert.deepEqual(getStateFromPath('/movies?' + query).routes[0].params, {q: 'a+b & 😀'});
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
        const {getStateFromPath} = require('expo-router/build/fork/getStateFromPath');
        const input = '%FF'.repeat(8192);
        assert.equal(getStateFromPath('/movies?query=' + input).routes[0].params.query, '\uFFFD'.repeat(8192));
    `], {cwd: root, encoding: 'utf8', timeout: 5000});
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
});
