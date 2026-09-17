const assert = require('node:assert/strict');
const {test} = require('node:test');
const StackTrace = require('stacktrace-js');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {createSentryCrashlyticsMirror} = loadTypeScript('instrumentation/sentry-crashlytics.ts');
const {sanitizeErrorEvent} = loadTypeScript('instrumentation/sentry-privacy.ts');
const id = value => value.toString(16).padStart(32, '0');
const eventAt = (column = 100, eventId = 1, mechanism = {type: 'generic', handled: true}) => ({
    event_id: id(eventId),
    platform: 'javascript',
    exception: {values: [{type: 'TypeError', value: 'Playback failed', mechanism, stacktrace: {frames: [
        {filename: 'index.android.bundle', function: 'onPress', lineno: 1, colno: 800},
        {filename: 'index.android.bundle', function: 'anonymous', lineno: 1, colno: column},
    ]}}]},
});
const framesOf = error => StackTrace.fromError(error, {offline: true});

function harness() {
    const calls = [];
    let enabled = true;
    const mirror = createSentryCrashlyticsMirror({
        recordError: (error, metadata) => { calls.push({error, metadata}); },
        isEnabled: () => enabled,
    });
    return {calls, mirror, setEnabled: value => { enabled = value; }};
}

test('A/B/A occurrences preserve distinct Hermes locations and group repeated crashes without dropping them', async () => {
    const {calls, mirror} = harness();
    for (const [column, eventId] of [[100, 1], [101, 2], [100, 3]]) await mirror(eventAt(column, eventId), {});
    assert.equal(calls.length, 3);
    const frames = await Promise.all(calls.map(call => framesOf(call.error)));
    assert.notEqual(frames[0][0].functionName, frames[1][0].functionName);
    assert.equal(frames[0][0].functionName, frames[2][0].functionName);
    assert.deepEqual(frames.map(value => value[0].columnNumber), [100, 101, 100]);
    assert.ok(frames.every(value => value.length === 2 && value[1].functionName === 'onPress'));
    assert.ok(frames.every(value => value[0].fileName === 'index.android.bundle'));
});

test('promise rejections, handled boundaries and manual exceptions all reach the nonfatal recorder', async () => {
    const {calls, mirror} = harness();
    const mechanisms = ['onunhandledrejection', 'expo_router_error_boundary', 'generic'];
    for (const [index, type] of mechanisms.entries()) {
        await mirror(eventAt(100, index + 1, {type, handled: true}), {});
    }
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map(call => call.metadata.sentry_mechanism), mechanisms);
    assert.ok(calls.every(call => call.metadata.sentry_handled === 'true'));
});

test('global-handler exceptions are excluded regardless of level or handled flag', async () => {
    const {calls, mirror} = harness();
    for (const handled of [true, false]) {
        const event = eventAt(100, handled ? 1 : 2, {type: 'yify.react_native.global', handled});
        event.level = handled ? 'error' : 'fatal';
        await mirror(event, {});
    }
    assert.deepEqual(calls, []);
});

test('non-exceptions, transactions and native-only events do not create JavaScript crash reports', async () => {
    const {calls, mirror} = harness();
    const events = [{message: 'A log entry'}, {exception: {values: []}}];
    for (const type of ['transaction', 'feedback', 'profile', 'replay_event', 'log']) {
        events.push({...eventAt(), type});
    }
    for (const platform of ['java', 'cocoa', 'native', 'csharp']) {
        events.push({...eventAt(), platform});
        const event = eventAt();
        for (const frame of event.exception.values[0].stacktrace.frames) frame.platform = platform;
        events.push(event);
    }
    for (const event of events) await mirror(event, {});
    assert.deepEqual(calls, []);
});

test('source frames are reversed without mutating the event and native frames are excluded', async () => {
    const {calls, mirror} = harness();
    const event = eventAt();
    event.exception.values[0].stacktrace.frames.unshift({platform: 'java', filename: 'Bridge.java', lineno: 20});
    const snapshot = structuredClone(event);
    await mirror(event, {});
    assert.deepEqual(event, snapshot);
    const frames = await framesOf(calls[0].error);
    assert.equal(frames[0].columnNumber, 100);
    assert.equal(frames[1].columnNumber, 800);
    assert.equal(frames.length, 2);
    assert.equal(calls[0].error.name, 'TypeError');
    assert.equal(calls[0].error.message, 'Playback failed');
});

test('original exception remains primary when Sentry includes a linked cause', async () => {
    const {calls, mirror} = harness();
    const event = eventAt();
    event.exception.values.unshift({type: 'Error', value: 'Linked cause', stacktrace: {frames: [
        {filename: 'cause.js', function: 'cause', lineno: 55, colno: 2},
    ]}});
    await mirror(event, {});
    assert.equal(calls[0].error.message, 'Playback failed');
    assert.equal((await framesOf(calls[0].error))[0].columnNumber, 100);
});

test('missing stacks use the sanitized exception identity instead of capturing the forwarding helper', async () => {
    const {calls, mirror} = harness();
    for (const [index, message] of ['First failure', 'Second failure', 'First failure'].entries()) {
        await mirror({event_id: id(index + 1), exception: {values: [{type: 'Error', value: message}]}}, {});
    }
    const frames = await Promise.all(calls.map(call => framesOf(call.error)));
    assert.notEqual(frames[0][0].functionName, frames[1][0].functionName);
    assert.equal(frames[0][0].functionName, frames[2][0].functionName);
    assert.ok(frames.every(value => value.length === 1 && value[0].fileName === 'react-native-crash'));
});

test('only allowlisted bounded metadata and sanitized messages cross the bridge, never raw hints', async () => {
    const {calls, mirror} = harness();
    const source = eventAt();
    Object.assign(source, {
        release: 'io.github.kunal26das.yify@1.8.0+80', environment: 'production',
        tags: {'diagnostics.operation': 'purchases.purchase', account_id: 'private-account'},
        extra: {password: 'private-password'}, user: {email: 'private@example.com'},
    });
    source.exception.values[0].value = 'Failed for private@example.com token=private-token';
    source.exception.values[0].stacktrace.frames[1].vars = {password: 'private-password'};
    const event = sanitizeErrorEvent(source);
    const hint = new Proxy({}, {get() { throw new Error('Raw hints must not be read'); }});
    await mirror(event, hint);
    assert.deepEqual(calls[0].metadata, {
        sentry_event_id: id(1), sentry_release: source.release, sentry_environment: 'production',
        sentry_mechanism: 'generic', sentry_handled: 'true', 'diagnostics.operation': 'purchases.purchase',
    });
    assert.equal(calls[0].error.message, 'Failed for [email] [private]');
    assert.doesNotMatch(JSON.stringify({metadata: calls[0].metadata, stack: calls[0].error.stack}), /private-|private@/);
    assert.equal(source.exception.values[0].value, 'Failed for private@example.com token=private-token');

    const invalid = eventAt(100, 2);
    Object.assign(invalid, {release: 'Bearer private-token', environment: 'x'.repeat(200),
        tags: {'diagnostics.operation': 'purchases.' + 'x'.repeat(200)}});
    invalid.exception.values[0].mechanism = {type: 'secret=private-token', handled: false};
    await mirror(invalid, {});
    assert.deepEqual(calls[1].metadata, {sentry_event_id: id(2), sentry_handled: 'false'});
});

test('duplicate event IDs are suppressed while distinct IDs sharing the same original error remain separate', async () => {
    const {calls, mirror} = harness();
    const originalException = new Error('Raw data is irrelevant');
    await mirror(eventAt(), {originalException});
    await mirror(eventAt(), {originalException});
    await mirror(eventAt(100, 2), {originalException});
    assert.equal(calls.length, 2);
    await mirror({exception: {values: [{type: 'Error', value: 'No ID'}]}}, {originalException});
    await mirror({exception: {values: [{type: 'Error', value: 'No ID'}]}}, {originalException});
    assert.equal(calls.length, 4);
});

test('concurrent duplicate IDs share one delivery', async () => {
    let finish;
    let attempts = 0;
    const pending = new Promise(resolve => { finish = resolve; });
    const mirror = createSentryCrashlyticsMirror({isEnabled: () => true, recordError: () => {
        attempts += 1;
        return pending;
    }});
    const first = mirror(eventAt(), {});
    const second = mirror(eventAt(), {});
    await Promise.resolve();
    assert.equal(attempts, 1);
    finish();
    await Promise.all([first, second]);
});

test('failed recording is isolated from Sentry and the same event can retry', async () => {
    for (const failure of [() => { throw new Error('Unavailable'); }, () => Promise.reject(new Error('Unavailable'))]) {
        let attempts = 0;
        const mirror = createSentryCrashlyticsMirror({isEnabled: () => true, recordError: () => {
            attempts += 1;
            if (attempts === 1) return failure();
        }});
        await assert.doesNotReject(mirror(eventAt(), {}));
        await mirror(eventAt(), {});
        await mirror(eventAt(), {});
        assert.equal(attempts, 2);
    }
});

test('disabled collection neither records nor consumes event IDs and preference failures stay isolated', async () => {
    const {calls, mirror, setEnabled} = harness();
    setEnabled(false);
    await mirror(eventAt(), {});
    assert.equal(calls.length, 0);
    setEnabled(true);
    await mirror(eventAt(), {});
    assert.equal(calls.length, 1);
    const unavailable = createSentryCrashlyticsMirror({
        isEnabled() { throw new Error('SDK unavailable'); }, recordError() { assert.fail('Should not record'); },
    });
    await assert.doesNotReject(unavailable(eventAt(), {}));
});

test('event history is bounded without suppressing later occurrences by stack signature', async () => {
    const {calls, mirror} = harness();
    for (let eventId = 1; eventId <= 129; eventId += 1) await mirror(eventAt(100, eventId), {});
    await mirror(eventAt(100, 129), {});
    assert.equal(calls.length, 129);
    await mirror(eventAt(100, 1), {});
    assert.equal(calls.length, 130);
});
