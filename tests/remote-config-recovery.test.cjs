const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, options = {}) {
    const previousDev = global.__DEV__;
    global.__DEV__ = false;
    t.after(() => { global.__DEV__ = previousDev; });
    t.mock.timers.enable({apis: ['setTimeout', 'Date']});
    const spans = [];
    const events = [];
    const rc = {settings: {fetchTimeoutMillis: 60000}, defaultConfig: {}};
    let online = options.online ?? true;
    let subscriber;
    let fetches = 0;
    const network = {
        isOnline: () => online,
        refresh: async () => online,
        subscribe: listener => { subscriber = listener; return () => {}; },
    };
    const {RemoteAppConfig} = loadTypeScript('data/services/RemoteAppConfig.ts', {
        '@react-native-firebase/remote-config': {
            getRemoteConfig: () => {
                if (options.configurationError) throw options.configurationError;
                return rc;
            },
            getString: (_, key) => rc.defaultConfig[key] ?? '',
            fetchAndActivate: async () => {
                fetches++;
                if (options.fetch) return options.fetch();
                if (options.failure) throw options.failure;
                return true;
            },
        },
    });
    const config = new RemoteAppConfig({event(operation, attributes) {events.push({operation, attributes});}, start() {
        const span = {};
        spans.push(span);
        return {
            finish(outcome, attributes) { if (!span.outcome) Object.assign(span, {outcome, attributes}); },
            fail(error, attributes) { if (!span.outcome) Object.assign(span, {outcome: 'error', error, attributes}); },
        };
    }}, network);
    return {config, rc, spans, events, options, fetches: () => fetches,
        connect(value) { online = value; subscriber(); },
        setOnline(value) { online = value; },
    };
}

test('offline startup uses defaults and reconnects without restarting the app', async t => {
    const f = fixture(t, {online: false});
    await f.config.ready();
    assert.equal(f.fetches(), 0);
    assert.equal(f.spans[0].outcome, 'unavailable');
    assert.equal(f.config.error(), null);
    assert.match(f.config.getApiBaseUrl(), /^https:/);
    assert.equal(f.rc.settings.fetchTimeoutMillis, 4000);
    f.connect(true);
    await f.config.ready();
    assert.equal(f.fetches(), 1);
    assert.equal(f.spans[1].outcome, 'ok');
});

test('online failure is reported once, throttled, and recovers on a later read', async t => {
    const failure = new Error('private response');
    const f = fixture(t, {failure});
    await Promise.all([f.config.ready(), f.config.ready()]);
    assert.equal(f.fetches(), 1);
    assert.equal(f.spans[0].error, failure);
    assert.doesNotMatch(f.config.error(), /private/);
    f.options.failure = null;
    await f.config.ready();
    assert.equal(f.fetches(), 1);
    t.mock.timers.tick(30000);
    await f.config.ready();
    assert.equal(f.fetches(), 2);
    assert.equal(f.config.error(), null);
    assert.equal(f.spans[1].outcome, 'ok');
});

test('readiness deadline allows startup without overlapping an unfinished native fetch', async t => {
    let finish;
    const f = fixture(t, {fetch: () => new Promise(resolve => { finish = resolve; })});
    const ready = f.config.ready();
    await tick();
    t.mock.timers.tick(4000);
    await ready;
    assert.equal(f.spans[0].outcome, undefined);
    assert.deepEqual(f.events, [{operation: 'config.readiness', attributes: {provider: 'firebase', outcome: 'timeout'}}]);
    t.mock.timers.tick(60000);
    await f.config.ready();
    assert.equal(f.fetches(), 1);
    finish(true);
    await tick();
    await f.config.ready();
    assert.equal(f.fetches(), 1);
    assert.equal(f.spans[0].outcome, 'ok');
});

test('online failures after the startup deadline remain reportable and retryable', async t => {
    let reject;
    const error = new Error('late native failure');
    const f = fixture(t, {fetch: () => new Promise((_, fail) => { reject = fail; })});
    const ready = f.config.ready();
    await tick();
    t.mock.timers.tick(4000);
    await ready;
    reject(error);
    await tick();
    assert.equal(f.spans[0].outcome, 'error');
    assert.equal(f.spans[0].error, error);
    f.options.fetch = null;
    t.mock.timers.tick(30000);
    await f.config.ready();
    assert.equal(f.fetches(), 2);
    assert.equal(f.spans[1].outcome, 'ok');
});

test('a connection lost during fetch is recoverable while configuration faults stay reportable', async t => {
    const f = fixture(t);
    f.options.fetch = async () => { f.setOnline(false); throw new Error('network failed'); };
    await f.config.ready();
    assert.equal(f.spans[0].outcome, 'unavailable');
    f.options.fetch = null;
    f.connect(true);
    await f.config.ready();
    assert.equal(f.spans[1].outcome, 'ok');
});

test('configuration faults are still reported on an offline device', async t => {
    const error = new Error('bad setup');
    const f = fixture(t, {online: false, configurationError: error});
    await f.config.ready();
    assert.equal(f.spans[0].error, error);
    assert.deepEqual(f.spans[0].attributes, {stage: 'configure'});
});
