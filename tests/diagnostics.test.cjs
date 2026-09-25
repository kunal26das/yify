const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function fixture(overrides = {}) {
    const calls = {spans: [], captures: [], breadcrumbs: [], logs: [], counts: [], durations: []};
    let active;
    let time = 100;
    const sdk = {
        startInactiveSpan(options) {
            const span = {options, ended: 0, parent: active,
                setAttributes(data) { this.data = data; },
                setStatus(status) { this.status = status; },
                end() { this.ended++; }};
            calls.spans.push(span);
            return span;
        },
        withActiveSpan(span, work) {
            const previous = active;
            active = span;
            try { return work(); } finally { active = previous; }
        },
        captureException(error, options) {
            calls.captures.push({error, options, active});
            return `event-${calls.captures.length}`;
        },
        addBreadcrumb(value) { calls.breadcrumbs.push(value); },
        logger: {info: (...args) => calls.logs.push(args), warn: (...args) => calls.logs.push(args)},
        metrics: {count: (...args) => calls.counts.push(args), distribution: (...args) => calls.durations.push(args)},
        getClient: () => ({}), showFeedbackForm: () => {},
        ...overrides,
    };
    const {SentryDiagnostics} = loadTypeScript('data/services/SentryDiagnostics.ts', {'@sentry/react-native': {}});
    return {diagnostics: new SentryDiagnostics(sdk, () => time), calls, sdk, advance: (ms) => { time += ms; }};
}

test('trace preserves results and correlates nested work with one finished span and metrics', async () => {
    const {diagnostics, calls, advance} = fixture();
    const result = {};
    assert.equal(await diagnostics.trace('api.tmdb.find', async () => {
        const child = diagnostics.start('api.tmdb.decode');
        child.finish();
        advance(125);
        return result;
    }, {provider: 'tmdb', query: 'private search', account_id: 'private-id'}), result);
    assert.equal(calls.spans.length, 2);
    assert.equal(calls.spans[1].parent, calls.spans[0]);
    assert.equal(calls.spans[0].ended, 1);
    assert.equal(calls.durations[1][0], 'yify.operation.duration');
    assert.equal(calls.durations[1][1], 125);
    assert.equal(calls.counts[1][0], 'yify.operation.count');
    assert.equal(calls.counts[1][2].attributes['diagnostics.outcome'], 'ok');
    assert.doesNotMatch(JSON.stringify(calls), /private search|private-id/);
});

test('handled errors retain frames, redact raw messages, correlate with span, and deduplicate same Error', async () => {
    const {diagnostics, calls} = fixture();
    const original = new TypeError('purchase secret@example.com token=private');
    original.stack = 'TypeError: purchase secret@example.com token=private\n    at purchase (purchase.ts:31:9)\n    at checkout (checkout.ts:22:7)';
    await assert.rejects(diagnostics.trace('purchases.purchase', async () => { throw original; },
        {provider: 'revenuecat', error_code: 'store_problem'}), error => error === original);
    assert.equal(diagnostics.capture(original, 'purchases.restore'), 'event-1');
    assert.equal(calls.captures.length, 1);
    assert.equal(calls.captures[0].active, calls.spans[0]);
    const {error, options} = calls.captures[0];
    assert.notEqual(error, original);
    assert.equal(error.name, 'TypeError');
    assert.equal(error.message, 'purchases.purchase failed (store_problem)');
    assert.match(error.stack, /at purchase \(purchase.ts:31:9\)/);
    assert.doesNotMatch(error.stack, /secret@example.com|private/);
    assert.deepEqual(options.fingerprint, ['{{ default }}', 'purchases.purchase']);
    assert.equal(calls.spans[0].status.code, 2);
});

test('SDK context errors before or after callback never repeat, swallow, or replace application work', async () => {
    for (const mode of ['before', 'after', 'twice']) {
        const {diagnostics, calls} = fixture({withActiveSpan(_span, work) {
            if (mode === 'before') throw new Error('telemetry failure');
            work();
            if (mode === 'twice') work();
            throw new Error('telemetry failure');
        }});
        let executions = 0;
        const result = {mode};
        assert.equal(await diagnostics.trace('api.yts.list_movies', async () => { executions++; return result; }), result);
        assert.equal(executions, 1);
        const failure = new Error('original');
        await assert.rejects(diagnostics.trace('api.yts.list_movies', async () => { executions++; throw failure; }), error => error === failure);
        assert.equal(executions, 2);
        assert.equal(calls.captures.length, 1);
    }
});

test('every telemetry sink can throw without affecting results or the original rejection', async () => {
    const fail = () => { throw new Error('SDK unavailable'); };
    const {diagnostics} = fixture({startInactiveSpan: fail, captureException: fail, addBreadcrumb: fail,
        logger: {info: fail, warn: fail}, metrics: {count: fail, distribution: fail}});
    assert.equal(await diagnostics.trace('auth.sign_in', async () => 42), 42);
    const failure = new Error('original rejection');
    await assert.rejects(diagnostics.trace('auth.sign_in', async () => { throw failure; }), error => error === failure);
    const hostile = new Proxy({}, {ownKeys: fail});
    const span = diagnostics.start('auth.sign_in', hostile);
    assert.doesNotThrow(() => span.fail(failure, hostile));
    assert.doesNotThrow(() => diagnostics.event('auth.sign_in', hostile));
});

test('finish is one-shot, cancellation and timeouts do not become issues, invalid operations are ignored', async () => {
    const {diagnostics, calls} = fixture();
    const span = diagnostics.start('ads.load');
    span.finish('empty', {error_code: 'no_fill'});
    span.fail(new Error('late callback'));
    span.finish('error');
    assert.equal(calls.spans[0].ended, 1);
    const abort = new Error('network aborted');
    abort.name = 'AbortError';
    await assert.rejects(diagnostics.trace('api.tmdb.find', async () => { throw abort; }), error => error === abort);
    diagnostics.start('auth.sign_in').finish('cancelled');
    assert.equal(calls.captures.length, 0);
    assert.equal(calls.spans[1].data['diagnostics.outcome'], 'timeout');
    assert.equal(await diagnostics.trace('https://private.test?q=search', async () => true), true);
    diagnostics.capture(new Error('ignore'), 'invalid');
    diagnostics.event('private user value');
    assert.equal(calls.spans.length, 3);
});

test('feedback reports availability and handles SDK errors without inventing a submission', async () => {
    let shown = 0;
    assert.equal(await fixture({showFeedbackForm: () => { shown++; }}).diagnostics.showFeedback(), true);
    assert.equal(shown, 1);
    assert.equal(await fixture({getClient: () => undefined}).diagnostics.showFeedback(), false);
    assert.equal(await fixture({showFeedbackForm: () => { throw new Error('not mounted'); }}).diagnostics.showFeedback(), false);
    const {NOOP_DIAGNOSTICS} = loadTypeScript('data/services/NoopDiagnostics.ts');
    assert.equal(await NOOP_DIAGNOSTICS.showFeedback(), false);
});

test('native error codes survive redaction while unsafe values and getters remain private', () => {
    const {diagnostics, calls} = fixture();
    diagnostics.capture(Object.assign(new Error('private network detail'), {code: 'ERR_NETWORK'}), 'api.yts.list_movies');
    assert.equal(calls.captures[0].error.message, 'api.yts.list_movies failed (ERR_NETWORK)');
    assert.equal(calls.captures[0].options.contexts.diagnostics['diagnostics.error_code'], 'ERR_NETWORK');
    diagnostics.capture(Object.assign(new Error('original'), {code: 'ERR_UNKNOWN'}), 'api.yts.list_movies', {error_code: 'network'});
    assert.equal(calls.captures[1].error.message, 'api.yts.list_movies failed (network)');
    for (const code of ['https://private.example/token', 'secret@example.com', {token: 'private'}, 123]) {
        diagnostics.capture(Object.assign(new Error('private'), {code}), 'api.yts.list_movies');
        assert.equal(calls.captures.at(-1).error.message, 'api.yts.list_movies failed');
    }
    const hostile = Object.defineProperty(new Error('private'), 'code', {get() { throw new Error('private'); }});
    assert.doesNotThrow(() => diagnostics.capture(hostile, 'api.yts.list_movies'));
    assert.equal(calls.captures.at(-1).error.message, 'api.yts.list_movies failed');
});

test('billing stage and SDK code enrich the existing issue without changing its fingerprint or exposing SDK payloads', () => {
    const {diagnostics, calls} = fixture();
    for (const stage of ['billing_check', 'offering_fetch']) {
        const error = Object.assign(new Error('private billing response customer@example.test'), {
            code: '2', userInfo: {underlyingErrorMessage: 'private details'},
        });
        diagnostics.start('purchases.offerings', {provider: 'revenuecat'}).fail(error,
            {stage, error_code: 'store_problem', purchases_error_code: 2});
        const capture = calls.captures.at(-1);
        assert.deepEqual(capture.options.fingerprint, ['{{ default }}', 'purchases.offerings']);
        assert.equal(capture.error.message, 'purchases.offerings failed (store_problem)');
        assert.deepEqual(capture.options.contexts.diagnostics, {
            'diagnostics.provider': 'revenuecat', 'diagnostics.operation': 'purchases.offerings',
            'diagnostics.stage': stage, 'diagnostics.error_code': 'store_problem', 'diagnostics.purchases_error_code': 2,
        });
        assert.equal(capture.error.userInfo, undefined);
        assert.doesNotMatch(capture.error.stack, /private|customer@example.test/);
    }
});

test('native update categories preserve the original update issue fingerprint and exclude log payloads', () => {
    const {diagnostics, calls} = fixture();
    const original = Object.assign(new Error('Failed to download asset https://assets.test/private'), {code: 'ERR_UPDATES_FETCH'});
    diagnostics.start('updates.download', {provider: 'expo'}).fail(original, {
        error_code: original.code, updates_log_status: 'captured', updates_log_code: 'AssetsFailedToLoad',
        updates_phase: 'asset', updates_message: 'Private response', updates_asset_id: 'private',
    });
    assert.equal(calls.captures.length, 1);
    const capture = calls.captures[0];
    assert.deepEqual(capture.options.fingerprint, ['{{ default }}', 'updates.download']);
    assert.equal(capture.error.message, 'updates.download failed (ERR_UPDATES_FETCH)');
    assert.equal(capture.options.contexts.diagnostics['diagnostics.updates_log_code'], 'AssetsFailedToLoad');
    assert.doesNotMatch(JSON.stringify(calls), /Private|private|assets\.test/);
});
