const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {PreferencesRepositoryImpl, parseSyncedPreferences} = loadTypeScript('data/repositories/PreferencesRepositoryImpl.ts');

function fixture(initial = {}) {
    const values = new Map(Object.entries(initial));
    const store = {getString: key => values.get(key), set: (key, value) => values.set(key, value)};
    return {values, store, preferences: new PreferencesRepositoryImpl(store)};
}

test('streaming selections persist independently by country and canonicalize service and add-on IDs', () => {
    const {store, preferences} = fixture();
    assert.deepEqual(preferences.getPreferences().streamingServices, {});
    preferences.setStreamingServices('US', ['prime:hbo', 'netflix', 'prime:hbo']);
    preferences.setStreamingServices('IN', ['zee5', 'hotstar']);
    assert.deepEqual(preferences.getPreferences().streamingServices, {
        IN: ['hotstar', 'zee5'], US: ['netflix', 'prime:hbo'],
    });
    preferences.setWatchRegion('GB');
    assert.deepEqual(new PreferencesRepositoryImpl(store).getSynced().streamingServices, {
        IN: ['hotstar', 'zee5'], US: ['netflix', 'prime:hbo'],
    });
    preferences.setStreamingServices('IN', []);
    assert.deepEqual(preferences.getPreferences().streamingServices, {US: ['netflix', 'prime:hbo']});
});

test('equivalent choices do not trigger preference writes and snapshots do not retain caller arrays', () => {
    const {preferences} = fixture();
    let notifications = 0;
    preferences.subscribe(() => notifications += 1);
    const selected = ['prime', 'netflix'];
    preferences.setStreamingServices('US', selected);
    selected.push('hulu');
    preferences.setStreamingServices('US', ['netflix', 'prime', 'netflix']);
    assert.equal(notifications, 1);
    const synced = preferences.getSynced();
    synced.streamingServices.US.push('hulu');
    assert.deepEqual(preferences.getPreferences().streamingServices.US, ['netflix', 'prime']);
});

test('missing selections from old payloads preserve choices and explicit empty maps clear them', () => {
    const {preferences, store} = fixture();
    preferences.setStreamingServices('US', ['netflix']);
    const older = parseSyncedPreferences('{"theme":"light"}');
    assert.equal(older.streamingServices, undefined);
    preferences.applyRemote(older);
    assert.deepEqual(preferences.getPreferences().streamingServices, {US: ['netflix']});
    assert.equal(preferences.getPreferences().theme, 'light');
    preferences.applyRemote(parseSyncedPreferences('{"streamingServices":{}}'));
    assert.deepEqual(new PreferencesRepositoryImpl(store).getPreferences().streamingServices, {});
});

test('new remote selections replace the previous map and reset restores an empty selection map', () => {
    const {preferences} = fixture();
    preferences.setStreamingServices('US', ['netflix']);
    preferences.applyRemote(parseSyncedPreferences('{"streamingServices":{"GB":["prime","bbc","bbc"]}}'));
    assert.deepEqual(preferences.getPreferences().streamingServices, {GB: ['bbc', 'prime']});
    preferences.applyRemote(preferences.getDefaultSynced());
    assert.deepEqual(preferences.getPreferences().streamingServices, {});
});

test('malformed remote selections cannot erase stored choices', () => {
    const {preferences} = fixture();
    preferences.setStreamingServices('US', ['netflix']);
    for (const streamingServices of [null, [], 'netflix', {us: ['netflix']}, {US: 'netflix'},
        {US: [1]}, {US: ['']}, {US: ['a'.repeat(129)]}, {US: ['new service']},
        {US: ['netflix'], invalid: ['prime']}, JSON.parse('{"__proto__":["netflix"]}')]) {
        const parsed = parseSyncedPreferences(JSON.stringify({streamingServices}));
        assert.equal(parsed.streamingServices, undefined, JSON.stringify(streamingServices));
        preferences.applyRemote(parsed);
        preferences.applyRemote({...preferences.getSynced(), streamingServices});
        assert.deepEqual(preferences.getPreferences().streamingServices, {US: ['netflix']});
    }
    assert.equal(parseSyncedPreferences('[]'), null);
});

test('invalid local changes and oversized selections preserve all current country choices', () => {
    const {preferences} = fixture();
    preferences.setStreamingServices('US', ['netflix']);
    preferences.setStreamingServices('IND', ['prime']);
    preferences.setStreamingServices('US', ['prime', null]);
    preferences.setStreamingServices('GB', Array.from({length: 65}, (_, i) => `service${i}`));
    preferences.setStreamingServices('GB', Array.from({length: 24}, (_, i) => `${i}${'a'.repeat(126)}`));
    assert.deepEqual(preferences.getPreferences().streamingServices, {US: ['netflix']});
    assert.equal(parseSyncedPreferences(JSON.stringify({streamingServices: Object.fromEntries(
        Array.from({length: 251}, (_, i) => [String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26), []])
    )})).streamingServices, undefined);
});

test('bounded selections remain within the preference sync budget', () => {
    const {preferences} = fixture();
    const services = Array.from({length: 21}, (_, i) => `${i}${'a'.repeat(126)}`);
    preferences.setStreamingServices('US', services);
    assert.equal(preferences.getPreferences().streamingServices.US.length, 21);
    assert.ok(JSON.stringify(preferences.getSynced()).length <= 4000);
});

test('corrupt persisted selections recover safely without losing other local preferences', () => {
    for (const raw of ['{', 'null', '[]', '{"US":"netflix"}']) {
        const {preferences} = fixture({streamingServices: raw, theme: 'light', watchRegion: 'US'});
        assert.deepEqual(preferences.getPreferences().streamingServices, {});
        assert.equal(preferences.getPreferences().theme, 'light');
        assert.equal(preferences.getPreferences().watchRegion, 'US');
    }
});
