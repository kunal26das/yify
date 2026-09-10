const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function recorder() {
    const spans = [];
    const events = [];
    return {spans, events, diagnostics: {
        start(operation, attributes) {
            const record = {operation, attributes};
            spans.push(record);
            return {
                finish(outcome = 'ok', attributes) { if (!record.outcome) Object.assign(record, {outcome, finishAttributes: attributes}); },
                fail(error, attributes) { if (!record.outcome) Object.assign(record, {outcome: 'error', error, finishAttributes: attributes}); },
            };
        },
        event(operation, attributes) { events.push({operation, attributes}); },
        capture() {},
    }};
}

for (const provider of ['yts', 'tmdb', 'eztv']) {
    test(`${provider} shared requests produce one diagnostic and cache events exclude request data`, async (t) => {
        const {diagnostics, spans, events} = recorder();
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        let requests = 0;
        t.mock.method(global, 'fetch', async () => {
            requests++;
            await pending;
            return {ok: true, status: 200, json: async () => ({status: 'ok', torrents: []})};
        });
        let read;
        if (provider === 'yts') {
            const {YtsApiDataSource} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
            const api = new YtsApiDataSource(() => 'https://private.example/api', diagnostics);
            read = () => api.listMovies({page: 1, query: 'private search'});
        } else if (provider === 'tmdb') {
            const {TmdbApiDataSource} = loadTypeScript('data/datasources/TmdbApiDataSource.ts');
            const api = new TmdbApiDataSource(() => 'secret-key', undefined, diagnostics);
            read = () => api.findByImdbId('tt123456');
        } else {
            const {EztvApiDataSource} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
            const api = new EztvApiDataSource(undefined, diagnostics);
            read = () => api.getTorrents({imdb_id: '123456', page: 1});
        }
        const first = read();
        const second = read();
        release();
        await Promise.all([first, second]);
        await read();
        assert.equal(requests, 1);
        assert.equal(spans.length, 1);
        assert.equal(spans[0].outcome, 'ok');
        assert.equal(spans[0].finishAttributes.status_code, 200);
        assert.equal(events.length, 2);
        assert.doesNotMatch(JSON.stringify({spans, events}), /private|secret-key|123456|https:/);
    });
}

test('a shared failed request records its original error once and leaves retry behavior intact', async (t) => {
    const {TmdbApiDataSource} = loadTypeScript('data/datasources/TmdbApiDataSource.ts');
    const {diagnostics, spans} = recorder();
    const error = new Error('private SDK response');
    let attempt = 0;
    t.mock.method(global, 'fetch', async () => {
        if (++attempt === 1) throw error;
        return {ok: true, status: 200, json: async () => ({movie_results: []})};
    });
    const api = new TmdbApiDataSource(() => 'secret-key', undefined, diagnostics);
    const results = await Promise.allSettled([api.findByImdbId('tt123'), api.findByImdbId('tt123')]);
    assert.ok(results.every(result => result.status === 'rejected' && result.reason === error));
    assert.equal(spans.length, 1);
    assert.equal(spans[0].error, error);
    await api.findByImdbId('tt123');
    assert.equal(spans.length, 2);
    assert.equal(spans[1].outcome, 'ok');
});

test('OTA check failures remain recoverable while recording the owning operation', async () => {
    const failure = new Error('native private message');
    const {diagnostics, spans} = recorder();
    const {ExpoAppUpdates} = loadTypeScript('data/services/ExpoAppUpdates.ts', {
        'react-native': {AppState: {addEventListener() {}}},
        'expo-updates': {isEnabled: true, channel: 'production', checkForUpdateAsync: async () => { throw failure; }},
    });
    const updates = new ExpoAppUpdates(diagnostics);
    await updates.sync();
    assert.equal(updates.getStatus().state, 'idle');
    assert.equal(spans.length, 1);
    assert.equal(spans[0].operation, 'updates.check');
    assert.equal(spans[0].error, failure);
});

test('remote config retains defaults after a fetch failure and reports it only once', async (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const previousDev = global.__DEV__;
    global.__DEV__ = false;
    t.after(() => { if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev; });
    const failure = new Error('remote config failed with private details');
    const {diagnostics, spans} = recorder();
    const {RemoteAppConfig} = loadTypeScript('data/services/RemoteAppConfig.ts', {
        '@react-native-firebase/remote-config': {
            getRemoteConfig: () => ({}), setConfigSettings: async () => {}, setDefaults: async () => {},
            fetchAndActivate: async () => { throw failure; }, getString: () => '',
        },
    });
    const config = new RemoteAppConfig(diagnostics);
    await Promise.all([config.ready(), config.ready()]);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].error, failure);
    assert.match(config.getApiBaseUrl(), /^https:\/\//);
});
