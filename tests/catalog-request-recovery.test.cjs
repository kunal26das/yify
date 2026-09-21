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
            body: {status: 'ok', data: {movies: [], movie_count: 0, page_number: 1, limit: 20}}};
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
    for (const [status, retryAfter, expected] of [[500, false, 2], [502, false, 2], [503, false, 2], [504, false, 2],
        [503, true, 1], [400, false, 1], [401, false, 1], [403, false, 1], [429, false, 1], [451, false, 1]]) {
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

test('a truncated JSON response is retried once and only the recovered result is cached', async t => {
    const {diagnostics, records} = recorder();
    const {read, body} = fixture('yts', diagnostics);
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
        calls++;
        assert.equal(init.method, 'GET');
        return calls === 1 ? new Response('{"status":"ok","data":', {status: 200})
            : Response.json(body);
    });
    const results = await Promise.all([read(), read()]);
    assert.deepEqual(results, [body, body]);
    await read();
    assert.equal(calls, 2);
    assert.equal(records.length, 1);
    assert.equal(records[0].outcome, 'ok');
    assert.equal(records[0].data.retry_count, 1);
});

test('repeated invalid JSON stays visible with safe decode diagnostics and can be retried later', async t => {
    const {diagnostics, records} = recorder();
    const {read, body} = fixture('yts', diagnostics);
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => ++calls <= 2
        ? new Response('<html>private upstream page</html>', {status: 200}) : Response.json(body));
    await assert.rejects(read(), {name: 'SyntaxError'});
    assert.equal(calls, 2);
    assert.equal(records.length, 1);
    assert.equal(records[0].outcome, 'error');
    assert.equal(records[0].data.error_code, 'invalid_json');
    assert.equal(records[0].data.stage, 'decode');
    assert.equal(records[0].data.status_code, 200);
    assert.equal(records[0].data.retry_count, 1);
    assert.doesNotMatch(JSON.stringify(records[0].data), /private|html/);
    await read();
    assert.equal(calls, 3);
});

test('JSON recovery respects Retry-After and the total request deadline', async t => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    t.mock.timers.enable({apis: ['setTimeout']});
    for (const retryAfter of [false, true]) {
        const {diagnostics, records} = recorder();
        let calls = 0;
        let decode;
        const pending = new Promise((_, reject) => { decode = reject; });
        const work = requestJson('https://private.example', {
            diagnostics, operation: 'api.yts.list_movies', provider: 'yts', timeoutMs: 100,
            fetcher: async () => {
                calls++;
                return {ok: true, status: 200, headers: new Headers(retryAfter ? {'Retry-After': '60'} : {}),
                    json: () => calls === 1 ? pending : new Promise(() => {})};
            },
            parse: body => body,
        });
        const failed = assert.rejects(work, {name: retryAfter ? 'SyntaxError' : 'TimeoutError'});
        await flush();
        t.mock.timers.tick(80);
        decode(new SyntaxError('Incomplete JSON'));
        await flush();
        assert.equal(calls, retryAfter ? 1 : 2);
        if (!retryAfter) t.mock.timers.tick(20);
        await failed;
        assert.equal(records.length, 1);
        assert.equal(records[0].outcome, retryAfter ? 'error' : 'timeout');
    }
});

test('recognized browser transport failures get one bounded retry without hiding persistent failures', async () => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const recovers of [true, false]) {
        const {diagnostics, records} = recorder();
        const failure = new TypeError('Failed to fetch');
        let calls = 0;
        const work = requestJson('https://private.example', {
            diagnostics, operation: 'api.tmdb.find', provider: 'tmdb', timeoutMs: 100,
            fetcher: async () => {
                if (++calls === 1 || !recovers) throw failure;
                return Response.json({movie_results: []});
            }, parse: body => body,
        });
        if (recovers) await work;
        else await assert.rejects(work, error => error === failure);
        assert.equal(calls, 2);
        assert.equal(records.length, 1);
        assert.equal(records[0].outcome, recovers ? 'ok' : 'error');
        if (!recovers) {
            assert.equal(records[0].error, failure);
            assert.equal(records[0].data.error_code, 'network_error');
        }
    }
});

test('unknown native and programming errors are neither retried nor suppressed', async () => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const failure of [new TypeError('Invalid URL'), Object.assign(new Error('private native response'), {code: 'ERR_UNEXPECTED'})]) {
        const {diagnostics, records} = recorder();
        let calls = 0;
        await assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.yts.list_movies', provider: 'yts', timeoutMs: 100,
            fetcher: async () => { calls++; throw failure; }, parse: body => body,
        }), error => error === failure);
        assert.equal(calls, 1);
        assert.equal(records[0].error, failure);
        assert.equal(records[0].outcome, 'error');
        assert.equal(records[0].data.error_code, failure.code ?? 'request_failed');
    }
});

test('caller cancellation is recorded separately from an expired request deadline', async () => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const failure of [new DOMException('Request aborted', 'AbortError'),
        Object.assign(new Error('Request cancelled'), {code: 'ERR_FETCH_REQUEST_CANCELED'})]) {
        const {diagnostics, records} = recorder();
        let calls = 0;
        await assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.eztv.torrents', provider: 'eztv', timeoutMs: 100,
            fetcher: async () => { calls++; throw failure; }, parse: body => body,
        }), error => error === failure);
        assert.equal(calls, 1);
        assert.equal(records[0].outcome, 'cancelled');
        assert.equal(records[0].data.error_code, 'request_cancelled');
        assert.equal(records[0].error, undefined);
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

test('real Expo wrapped transport failures retry once while online and retain persistent errors', async () => {
    const {FetchError} = loadTypeScript('node_modules/expo/src/winter/fetch/FetchErrors.ts');
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const recovers of [true, false]) {
        const {diagnostics, records} = recorder();
        const failure = FetchError.createFromError(Object.assign(new Error('Unable to resolve host "private.example": No address associated with hostname'),
            {name: 'CodedError', code: 'ERR_UNEXPECTED'}));
        assert.equal(failure.code, undefined, 'Expo discards the native code');
        let calls = 0;
        const work = requestJson('https://private.example', {
            diagnostics, operation: 'api.yts.list_movies', provider: 'yts', timeoutMs: 100,
            network: {isOnline: () => true, refresh: async () => true},
            fetcher: async () => {
                if (++calls === 1 || !recovers) throw failure;
                return Response.json({value: 1});
            }, parse: body => body,
        });
        if (recovers) assert.deepEqual(await work, {value: 1});
        else await assert.rejects(work, error => error === failure);
        assert.equal(calls, 2);
        assert.equal(records.length, 1);
        assert.equal(records[0].outcome, recovers ? 'ok' : 'error');
        if (!recovers) assert.equal(records[0].data.error_code, 'network_error');
    }
});

test('Expo programming, redirect, TLS and context failures are never retried as transport outages', async () => {
    const {FetchError} = loadTypeScript('node_modules/expo/src/winter/fetch/FetchErrors.ts');
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const message of ['Invalid URL', 'Redirect is not allowed when redirect mode is \'error\'',
        'java.security.cert.CertPathValidatorException: Trust anchor for certification path not found.',
        'The Android context has been lost']) {
        const {diagnostics, records} = recorder();
        const failure = new FetchError(message);
        let calls = 0;
        await assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.yts.list_movies', provider: 'yts', timeoutMs: 100,
            fetcher: async () => { calls++; throw failure; }, parse: body => body,
        }), error => error === failure);
        assert.equal(calls, 1);
        assert.equal(records[0].error, failure);
    }
});

test('Expo wraps native cancellation without its code and is still recorded as cancellation', async () => {
    const {FetchError} = loadTypeScript('node_modules/expo/src/winter/fetch/FetchErrors.ts');
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const message of ['Fetch request has been canceled', 'The operation was aborted.']) {
        const {diagnostics, records} = recorder();
        let calls = 0;
        const failure = FetchError.createFromError(Object.assign(new Error(message), {code: 'ERR_FETCH_REQUEST_CANCELED'}));
        await assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.yts.list_movies', provider: 'yts', timeoutMs: 100,
            fetcher: async () => { calls++; throw failure; }, parse: body => body,
        }), error => error === failure);
        assert.equal(calls, 1);
        assert.equal(records[0].outcome, 'cancelled');
        assert.equal(records[0].error, undefined);
    }
});

test('confirmed offline requests avoid transport and recover after the monitor reports reconnection', async () => {
    const {diagnostics, records} = recorder();
    const {YtsApiDataSource} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    let online = false;
    let calls = 0;
    const source = new YtsApiDataSource(undefined, diagnostics, {
        network: {isOnline: () => false, refresh: async () => online},
        fetch: async () => {
            calls++;
            return Response.json({status: 'ok', data: {movie_count: 0, page_number: 1, limit: 20}});
        },
    });
    await assert.rejects(source.listMovies({page: 1}), {name: 'OfflineRequestError'});
    assert.equal(calls, 0);
    assert.equal(records[0].outcome, 'unavailable');
    assert.equal(records[0].data.error_code, 'network_offline');
    online = true;
    await source.listMovies({page: 1});
    assert.equal(calls, 1);
    assert.equal(records[1].outcome, 'ok');
});

test('a stale online snapshot is refreshed after a transport failure without hiding unknown errors', async () => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    for (const unknown of [false, true]) {
        const {diagnostics, records} = recorder();
        const failure = unknown ? new TypeError('Invalid URL') : new TypeError('Failed to fetch');
        let calls = 0;
        let refreshes = 0;
        await assert.rejects(requestJson('https://private.example', {
            diagnostics, operation: 'api.catalog.movies', provider: 'catalog', timeoutMs: 100,
            network: {isOnline: () => true, refresh: async () => { refreshes++; return false; }},
            fetcher: async () => { calls++; throw failure; }, parse: body => body,
        }), unknown ? error => error === failure : {name: 'OfflineRequestError'});
        assert.equal(calls, 1);
        assert.equal(refreshes, unknown ? 0 : 1);
        assert.equal(records[0].outcome, unknown ? 'error' : 'unavailable');
    }
});

test('unknown connectivity and unavailable monitors do not suppress errors or extend the request deadline', async t => {
    const {requestJson} = loadTypeScript('data/datasources/JsonRequest.ts');
    const {diagnostics, records} = recorder();
    let calls = 0;
    await assert.rejects(requestJson('https://private.example', {
        diagnostics, operation: 'api.catalog.movies', provider: 'catalog', timeoutMs: 100,
        network: {isOnline: () => true, refresh: async () => { throw new Error('Native monitor unavailable'); }},
        fetcher: async () => { calls++; throw new TypeError('Failed to fetch'); }, parse: body => body,
    }), {name: 'TypeError'});
    assert.equal(calls, 2);
    assert.equal(records[0].outcome, 'error');

    t.mock.timers.enable({apis: ['setTimeout']});
    const pending = assert.rejects(requestJson('https://private.example', {
        diagnostics, operation: 'api.catalog.movies', provider: 'catalog', timeoutMs: 100,
        network: {isOnline: () => false, refresh: () => new Promise(() => {})},
        fetcher: () => assert.fail('offline transport started'), parse: body => body,
    }), {name: 'TimeoutError'});
    t.mock.timers.tick(100);
    await pending;
});
