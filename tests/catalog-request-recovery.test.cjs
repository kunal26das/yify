const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function recorder() {
    const records = [];
    return {records, diagnostics: {
        start(operation, attributes) {
            const record = {operation, attributes};
            records.push(record);
            return {
                finish(outcome, data) { Object.assign(record, {outcome, data}); },
                fail(error, data) { Object.assign(record, {outcome: 'error', error, data}); },
            };
        },
        event() {},
    }};
}

function fixture(provider, diagnostics) {
    if (provider === 'yts') {
        const {YtsApiDataSource} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
        const source = new YtsApiDataSource(undefined, diagnostics);
        return {read: () => source.listMovies({page: 1}), timeout: 15_000,
            body: {status: 'ok', data: {movies: []}}};
    }
    if (provider === 'eztv') {
        const {EztvApiDataSource} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
        const source = new EztvApiDataSource(undefined, diagnostics);
        return {read: () => source.getTorrents({page: 1}), timeout: 12_000, body: {torrents: []}};
    }
    if (provider === 'tmdb') {
        const {TmdbApiDataSource} = loadTypeScript('data/datasources/TmdbApiDataSource.ts');
        const source = new TmdbApiDataSource(() => 'private-key', undefined, diagnostics);
        return {read: () => source.findByImdbId('tt123'), timeout: 10_000, body: {movie_results: []}};
    }
    const {WebCatalogClient} = loadTypeScript('data/datasources/WebCatalogClient.ts');
    const source = new WebCatalogClient(diagnostics);
    return {read: () => source.listMovies({page: 1}), timeout: 30_000,
        body: {movies: [], pageNumber: 1, movieCount: 0, hasMore: false}};
}

async function flush() {
    for (let count = 0; count < 12; count++) await Promise.resolve();
}

for (const provider of ['yts', 'eztv', 'tmdb', 'catalog']) {
    for (const stage of ['fetch', 'body']) {
        test(`${provider} bounds ${stage} reads and classifies Expo cancellation as a timeout`, async t => {
            t.mock.timers.enable({apis: ['setTimeout']});
            const {diagnostics, records} = recorder();
            const {read, timeout, body} = fixture(provider, diagnostics);
            let signal;
            let calls = 0;
            t.mock.method(globalThis, 'fetch', async (_url, init) => {
                calls++;
                signal = init.signal;
                if (calls > 1) return {ok: true, status: 200, json: async () => body};
                const pending = () => new Promise((_, reject) => signal.addEventListener('abort', () =>
                    reject(Object.assign(new Error('Native request cancelled'), {name: 'CodedError', code: 'ERR_FETCH_REQUEST_CANCELED'}))));
                return stage === 'fetch' ? pending() : {ok: true, status: 200, json: pending};
            });
            const failed = Promise.allSettled([read(), read()]);
            await flush();
            assert.equal(calls, 1);
            t.mock.timers.tick(timeout);
            const results = await failed;
            assert.ok(results.every(result => result.status === 'rejected' && /timed out/i.test(result.reason.message)));
            assert.equal(signal.aborted, true);
            assert.equal(records.length, 1);
            assert.equal(records[0].outcome, 'timeout');
            assert.equal(records[0].error, undefined);
            assert.equal(records[0].data.error_code, 'request_timeout');
            await read();
            assert.equal(calls, 2);
            assert.equal(records[1].outcome, 'ok');
        });
    }
}

for (const stage of ['fetch', 'body']) {
    test(`deadline releases a ${stage} promise that ignores cancellation without accepting a late response`, async t => {
        t.mock.timers.enable({apis: ['setTimeout']});
        const {diagnostics, records} = recorder();
        const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
        let complete;
        let parses = 0;
        const response = {ok: true, status: 200, json: async () => ({value: 1})};
        const pending = new Promise(resolve => { complete = resolve; });
        const failed = assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.yts.list_movies', provider: 'yts', timeoutMs: 100,
            fetcher: async () => stage === 'fetch' ? pending : {...response, json: () => pending},
            parse: body => { parses++; return body; },
        }), {name: 'TimeoutError'});
        await flush();
        t.mock.timers.tick(100);
        await failed;
        complete(stage === 'fetch' ? response : {value: 1});
        await flush();
        assert.equal(parses, 0);
        assert.equal(records.length, 1);
        assert.equal(records[0].outcome, 'timeout');
    });
}

test('transient HTTP recovery keeps one deadline and only reports the final attempt', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const {diagnostics, records} = recorder();
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    const signals = [];
    let first;
    const pending = new Promise(resolve => { first = resolve; });
    const failed = assert.rejects(requestJson('https://private.example', {
        diagnostics, operation: 'api.eztv.torrents', provider: 'eztv', timeoutMs: 100,
        fetcher: async (_url, init) => {
            signals.push(init.signal);
            return signals.length === 1 ? pending : new Promise(() => {});
        },
        parse: body => body,
    }), {name: 'TimeoutError'});
    t.mock.timers.tick(80);
    first({ok: false, status: 503});
    await flush();
    assert.equal(signals.length, 2);
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
    t.mock.timers.tick(20);
    await failed;
    assert.equal(signals[1].aborted, true);
    assert.equal(records[0].outcome, 'timeout');
    assert.equal(records[0].data.retry_count, 1);
    assert.equal(records[0].data.status_code, undefined);
});

test('retries are bounded and respect authentication failures and Retry-After', async () => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const [status, retryAfter, expected] of [[502, false, 2], [503, false, 2], [504, false, 2],
        [503, true, 1], [400, false, 1], [401, false, 1], [403, false, 1], [429, false, 1]]) {
        const {diagnostics, records} = recorder();
        let calls = 0;
        await assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.catalog.movies', provider: 'catalog', timeoutMs: 100,
            fetcher: async () => {
                calls++;
                return {ok: false, status, headers: new Headers(retryAfter ? {'Retry-After': '60'} : {})};
            },
            parse: body => body,
        }));
        assert.equal(calls, expected);
        assert.equal(records.length, 1);
        assert.equal(records[0].outcome, 'error');
        assert.equal(records[0].data.status_code, status);
        assert.equal(records[0].data.retry_count, expected - 1);
    }
});

test('web failures retain the original cause for diagnostics and a safe message for the screen', async t => {
    const failure = Object.assign(new Error('private upstream response'), {name: 'CodedError', code: 'ERR_BODY'});
    for (const stage of ['fetch', 'body']) {
        const {diagnostics, records} = recorder();
        const {read} = fixture('catalog', diagnostics);
        let calls = 0;
        t.mock.method(globalThis, 'fetch', async () => {
            calls++;
            if (stage === 'fetch') throw failure;
            return {ok: true, status: 200, json: async () => { throw failure; }};
        });
        await assert.rejects(read(), {message: 'The catalog is unavailable. Please try again.'});
        assert.equal(calls, 1);
        assert.equal(records[0].error, failure);
    }
});
