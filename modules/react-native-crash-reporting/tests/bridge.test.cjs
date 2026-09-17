const assert = require('node:assert/strict');
const {test} = require('node:test');
const ErrorStackParser = require('error-stack-parser');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {createCrashReportingBridge, createNoopCrashReportingBridge} = loadTypeScript('index.ts');
const eventId = value => value.toString(16).padStart(32, '0');
const sourceError = () => Object.assign(new TypeError('Unable to render'), {
    stack: 'TypeError: Unable to render\n    at render (index.android.bundle:1:100)\n    at browse (index.android.bundle:1:800)',
});
const eventFor = (error, id = 1, mechanism = {type: 'generic', handled: true}) => ({
    event_id: eventId(id),
    platform: 'javascript',
    exception: {values: [{type: error.name, value: error.message, mechanism, stacktrace: {frames:
        ErrorStackParser.parse(error).map(frame => ({
            filename: frame.fileName, function: frame.functionName,
            lineno: frame.lineNumber, colno: frame.columnNumber,
        })).reverse(),
    }}]},
});

function fixture({enabled = true, initializationFailure = false, metadataFailure, ...options} = {}) {
    const events = [];
    const attributes = {};
    const pending = [];
    const client = {isCrashlyticsCollectionEnabled: enabled};
    let current = (error, fatal) => events.push({kind: 'original', error, fatal});
    let sequence = 0;
    const errorUtils = {
        getGlobalHandler: () => current,
        setGlobalHandler: handler => { current = handler; },
    };
    const bridge = createCrashReportingBridge({
        errorUtils,
        metadataTimeoutMs: 10,
        fatalTimeoutMs: 30,
        ...options,
        loadCrashlytics() {
            events.push({kind: 'import'});
            current = async (error, fatal) => events.push({kind: 'fatal', error, fatal, attributes: {...attributes}});
            if (initializationFailure) throw new Error('Native SDK unavailable');
            return {
                getCrashlytics: () => client,
                recordError(instance, error) {
                    events.push({kind: 'nonfatal', instance, error, attributes: {...attributes}});
                },
                setAttributes(instance, values) {
                    assert.equal(instance, client);
                    events.push({kind: 'attributes', values});
                    if (metadataFailure === 'throw') throw new Error('Metadata unavailable');
                    if (metadataFailure === 'reject') return Promise.reject(new Error('Metadata unavailable'));
                    if (metadataFailure === 'hang') return new Promise(() => {});
                    Object.assign(attributes, values);
                },
            };
        },
    });
    const sentry = {
        captureException(error, hint) {
            events.push({kind: 'sentry', error, hint});
            const event = eventFor(error, ++sequence, hint.mechanism);
            pending.push(bridge.mirrorException(event, hint));
            return event.event_id;
        },
        async flush(timeout) {
            events.push({kind: 'flush', timeout});
            await Promise.all(pending);
            return true;
        },
    };
    return {bridge, sentry, events, client, invoke: (...args) => current(...args)};
}

test('factory captures the pre-import handler and permits Sentry to connect after Firebase initialization', async () => {
    const {bridge, sentry, events, invoke} = fixture();
    const beforeConnect = sourceError();
    await invoke(beforeConnect, true);
    assert.deepEqual(events.filter(event => event.kind !== 'attributes').map(event => event.kind), ['import', 'fatal', 'original']);
    assert.equal(events.at(-1).error, beforeConnect);
    assert.notEqual(events.find(event => event.kind === 'fatal').error, beforeConnect);

    events.length = 0;
    bridge.connectSentry(sentry);
    const afterConnect = sourceError();
    await invoke(afterConnect, true);
    assert.equal(events.filter(event => event.kind === 'sentry').length, 1);
    assert.equal(events.filter(event => event.kind === 'fatal').length, 1);
    assert.equal(events.filter(event => event.kind === 'nonfatal').length, 0);
    assert.equal(events.at(-1).kind, 'original');
    assert.equal(events.at(-1).error, afterConnect);
    const fatal = events.find(event => event.kind === 'fatal');
    assert.equal(fatal.attributes.sentry_event_id, eventId(1));
    assert.match(fatal.error.stack, /ReactNativeCrash\.[a-p]{16}\.render_TypeError/);
});

test('separate hosts retain independent grouping namespaces, global mechanisms and event histories', async () => {
    const first = fixture({groupingNamespace: 'FirstApp', globalMechanism: 'first_app.global'});
    const second = fixture({groupingNamespace: 'SecondApp', globalMechanism: 'second_app.global'});
    const event = eventFor(sourceError());
    for (const host of [first, second]) {
        await host.bridge.mirrorException(event);
        await host.bridge.mirrorException(event);
        host.bridge.connectSentry(host.sentry);
        await host.invoke(sourceError(), true);
    }
    for (const [host, namespace, mechanism] of [[first, 'FirstApp', 'first_app.global'], [second, 'SecondApp', 'second_app.global']]) {
        const nonfatal = host.events.filter(value => value.kind === 'nonfatal');
        assert.equal(nonfatal.length, 1);
        const fatal = host.events.filter(value => value.kind === 'fatal');
        assert.equal(fatal.length, 1);
        assert.ok(nonfatal[0].error.stack.includes(namespace + '.'));
        assert.ok(fatal[0].error.stack.includes(namespace + '.'));
        assert.equal(host.events.find(value => value.kind === 'sentry').hint.mechanism.type, mechanism);
    }
});

test('per-event correlation replaces stale optional metadata while retaining host attributes', async () => {
    const host = fixture({attributes: {application: 'example', channel: 'production'}});
    const first = eventFor(sourceError());
    Object.assign(first, {
        release: 'example@1.0.0', environment: 'production',
        tags: {'diagnostics.operation': 'account.refresh'},
    });
    await host.bridge.mirrorException(first);
    const second = eventFor(sourceError(), 2);
    delete second.exception.values[0].mechanism;
    await host.bridge.mirrorException(second);
    const records = host.events.filter(event => event.kind === 'nonfatal');
    assert.equal(records.length, 2);
    assert.equal(records[0].attributes.sentry_release, 'example@1.0.0');
    assert.equal(records[1].attributes.sentry_event_id, eventId(2));
    for (const key of ['sentry_release', 'sentry_environment', 'sentry_mechanism', 'sentry_handled', 'diagnostics.operation']) {
        assert.equal(records[1].attributes[key], '', key);
    }
    assert.equal(records[1].attributes.application, 'example');
    assert.equal(records[1].attributes.channel, 'production');
});

test('failed or stalled metadata cannot drop mirrored reports or prevent fatal persistence', async () => {
    for (const metadataFailure of ['throw', 'reject', 'hang']) {
        const host = fixture({metadataFailure});
        await host.bridge.mirrorException(eventFor(sourceError()));
        assert.equal(host.events.filter(event => event.kind === 'nonfatal').length, 1, metadataFailure);
        host.bridge.connectSentry(host.sentry);
        await host.invoke(sourceError(), true);
        assert.equal(host.events.filter(event => event.kind === 'fatal').length, 1, metadataFailure);
        assert.equal(host.events.at(-1).kind, 'original');
    }
});

test('unavailable and disabled Firebase preserve Sentry reporting and the original React Native fallback', async () => {
    for (const configuration of [{initializationFailure: true}, {enabled: false}]) {
        const host = fixture({...configuration, attributes: {application: 'example'}});
        host.bridge.connectSentry(host.sentry);
        await host.bridge.mirrorException(eventFor(sourceError()));
        const original = sourceError();
        await host.invoke(original, true);
        assert.deepEqual(host.events.map(event => event.kind), ['import', 'sentry', 'flush', 'original']);
        assert.equal(host.events.at(-1).error, original);
        assert.equal(host.events.at(-1).fatal, true);
    }
});

test('web-compatible no-op bridge does not invoke either SDK even when receiving a real error event', async () => {
    const bridge = createNoopCrashReportingBridge();
    bridge.connectSentry(new Proxy({}, {get() { assert.fail('No SDK access is allowed'); }}));
    const event = eventFor(sourceError());
    const before = structuredClone(event);
    await assert.doesNotReject(bridge.mirrorException(event));
    assert.deepEqual(event, before);
});
