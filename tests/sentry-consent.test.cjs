const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {OptionalTelemetryConsent} = loadTypeScript('instrumentation/optional-telemetry.ts');
const {filterSentryEnvelope, sentryConsentIntegration, CONSENT_REVISION} = loadTypeScript('instrumentation/sentry-consent.ts');
const {createSentryOptions} = loadTypeScript('instrumentation/sentry-config.ts', {
    '@sentry/react-native': {
        breadcrumbsIntegration: () => ({name: 'Breadcrumbs'}),
        reactNativeErrorHandlersIntegration: () => ({name: 'ReactNativeErrorHandlers'}),
        feedbackIntegration: () => ({name: 'Feedback'}),
    },
});

function fixture() {
    let choices = {adultConfirmed: false, analytics: false};
    const listeners = new Set();
    const consent = new OptionalTelemetryConsent();
    const privacy = {
        getChoices: () => choices,
        subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
    };
    return {consent, bind: () => consent.bind(privacy),
        change(adultConfirmed, analytics) {
            choices = {adultConfirmed, analytics};
            for (const listener of listeners) listener();
        }};
}

const log = {message: 'player.prepare', level: 'info', attributes: {'diagnostics.operation': 'player.prepare'}};
const metric = {name: 'yify.operation.count', value: 1, type: 'counter', attributes: log.attributes};

function serialized(value) {
    return {...value, attributes: Object.fromEntries(Object.entries(value.attributes).map(([key, value]) =>
        [key, {type: typeof value === 'number' ? 'integer' : 'string', value}]))};
}

function batch(type, ...items) {
    return [{}, [[{type, item_count: items.length}, {items}]]];
}

test('optional consent fails closed before hydration, for nonadults, and after any withdrawal', () => {
    const f = fixture();
    const options = createSentryOptions({native: true, environment: 'production', consent: f.consent});
    for (const update of [() => {}, () => f.bind(), () => f.change(false, true)]) {
        update();
        assert.equal(options.tracesSampler({}), 0);
        assert.equal(options.beforeSendLog(log), null);
        assert.equal(options.beforeSendMetric(metric), null);
    }
    f.change(true, true);
    const token = f.consent.token();
    assert.equal(options.tracesSampler({}), 0.1);
    assert.notEqual(options.beforeSendLog(log), null);
    assert.notEqual(options.beforeSendMetric(metric), null);
    f.change(true, false);
    assert.equal(f.consent.permits(token), false);
    f.change(true, true);
    assert.equal(f.consent.permits(token), false);
});

test('buffered logs and metrics are dropped after withdrawal even when consent is granted again', () => {
    const f = fixture();
    f.bind();
    f.change(true, true);
    const options = createSentryOptions({native: false, environment: 'production', consent: f.consent});
    const oldLog = serialized(options.beforeSendLog(log));
    const oldMetric = serialized(options.beforeSendMetric(metric));
    f.change(true, false);
    assert.equal(filterSentryEnvelope(batch('log', structuredClone(oldLog)), f.consent)[1].length, 0);
    f.change(true, true);
    assert.equal(filterSentryEnvelope(batch('trace_metric', oldMetric), f.consent)[1].length, 0);
    const freshLog = serialized(options.beforeSendLog(log));
    const filtered = filterSentryEnvelope(batch('log', oldLog, freshLog), f.consent);
    assert.equal(filtered[1][0][0].item_count, 1);
    assert.equal(filtered[1][0][1].items.length, 1);
    assert.equal(CONSENT_REVISION in filtered[1][0][1].items[0].attributes, false);
});

test('transaction hooks and transport reject traces from before consent or an earlier consent interval', () => {
    const f = fixture();
    f.bind();
    f.change(true, true);
    const options = createSentryOptions({native: false, environment: 'production', consent: f.consent});
    const event = {type: 'transaction', transaction: 'player.prepare', contexts: {trace: {
        trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), op: 'yify.player.prepare',
        data: {[CONSENT_REVISION]: f.consent.token()},
    }}};
    const span = options.beforeSendSpan({op: 'yify.player.prepare', description: 'player.prepare', data: event.contexts.trace.data});
    assert.equal(span.data[CONSENT_REVISION], f.consent.token());
    assert.notEqual(options.beforeSendTransaction(event), null);
    assert.equal(options.beforeSendTransaction({type: 'transaction'}), null);
    const envelope = [{}, [[{type: 'transaction'}, options.beforeSendTransaction(event)]]];
    f.change(true, false);
    f.change(true, true);
    assert.equal(options.beforeSendTransaction(event), null);
    assert.equal(filterSentryEnvelope(envelope, f.consent)[1].length, 0);
});

test('transport sends errors and voluntary feedback, drops empty optional batches, and stamps live spans', async () => {
    const f = fixture();
    f.bind();
    const sent = [];
    let onSpan;
    const transport = {send: envelope => {sent.push(envelope); return Promise.resolve({});}};
    sentryConsentIntegration(f.consent).setup({getTransport: () => transport, on(name, callback) {
        assert.equal(name, 'spanStart');
        onSpan = callback;
    }});
    await transport.send(batch('log', serialized({...log, attributes: {...log.attributes, [CONSENT_REVISION]: 0}})));
    assert.equal(sent.length, 0);
    for (const type of ['session', 'sessions', 'profile', 'replay_event', 'replay_recording', 'span', 'client_report']) {
        await transport.send([{}, [[{type}, {}]]]);
    }
    assert.equal(sent.length, 0);
    for (const type of ['event', 'feedback']) await transport.send([{}, [[{type}, {message: 'Diagnostic'}]]]);
    assert.equal(sent.length, 2);
    const attributes = {};
    const span = {setAttribute: (key, value) => {attributes[key] = value;}};
    onSpan(span);
    assert.deepEqual(attributes, {});
    f.change(true, true);
    onSpan(span);
    assert.equal(attributes[CONSENT_REVISION], f.consent.token());
});

test('failed choice reads revoke the old consent and rebinding unsubscribes the previous source', () => {
    const consent = new OptionalTelemetryConsent();
    let refresh;
    let readsFail = false;
    let unsubscribed = 0;
    const source = {getChoices() {
        if (readsFail) throw new Error('Storage unavailable');
        return {adultConfirmed: true, analytics: true};
    }, subscribe(listener) {refresh = listener; return () => {unsubscribed++;};}};
    consent.bind(source);
    const token = consent.token();
    readsFail = true;
    refresh();
    assert.equal(consent.token(), undefined);
    readsFail = false;
    refresh();
    assert.equal(consent.permits(token), false);
    consent.bind(source);
    assert.equal(unsubscribed, 1);
});

test('installed Sentry SDK drops withdrawn buffers and in-flight traces while still delivering crashes', async () => {
    const core = require('@sentry/core');
    const {BrowserClient, logger, metrics} = require('@sentry/browser');
    const f = fixture();
    f.bind();
    f.change(true, true);
    const options = createSentryOptions({native: false, environment: 'production', consent: f.consent});
    const sent = [];
    const client = new BrowserClient({...options, stackParser: () => [], tracesSampler: () => f.consent.token() === undefined ? 0 : 1,
        integrations: [sentryConsentIntegration(f.consent)],
        transport: () => ({send(envelope) {sent.push(envelope); return Promise.resolve({});}, flush: () => Promise.resolve(true)}),
    });
    client.init();
    try {
        await core.withScope(async scope => {
            scope.setClient(client);
            logger.info(log.message, log.attributes);
            metrics.count(metric.name, 1, {attributes: metric.attributes});
            const beforeWithdrawal = core.startInactiveSpan({name: 'player.prepare', op: 'yify.player.prepare'});
            f.change(true, false);
            f.change(true, true);
            beforeWithdrawal.end();
            await client.flush(500);
            assert.equal(sent.length, 0);
            logger.info(log.message, log.attributes);
            metrics.count(metric.name, 1, {attributes: metric.attributes});
            core.startInactiveSpan({name: 'player.prepare', op: 'yify.player.prepare'}).end();
            await client.flush(500);
            const types = sent.flatMap(envelope => envelope[1].map(item => item[0].type));
            assert.deepEqual([...types].sort(), ['log', 'trace_metric', 'transaction']);
            assert.equal(JSON.stringify(sent).includes(CONSENT_REVISION), false);
            sent.length = 0;
            f.change(true, false);
            core.captureException(new Error('Renderer failed'));
            await client.flush(500);
            assert.deepEqual(sent.flatMap(envelope => envelope[1].map(item => item[0].type)), ['event']);
        });
    } finally {
        await client.close(500);
    }
});
