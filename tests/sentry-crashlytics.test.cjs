const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {createSentryCrashlyticsMirror} = loadTypeScript('modules/react-native-crash-reporting/index.ts');
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

function harness() {
    const calls = [];
    let enabled = true;
    const mirror = createSentryCrashlyticsMirror({
        recordError: (error, metadata) => { calls.push({error, metadata}); },
        isEnabled: () => enabled,
    });
    return {calls, mirror, setEnabled: value => { enabled = value; }};
}

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
