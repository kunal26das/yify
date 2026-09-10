const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {
    sanitizeBreadcrumb, sanitizeErrorEvent, sanitizeDiagnosticAttributes, sanitizeRoute,
    sanitizeSpan, sanitizeTransaction, sanitizeLog, sanitizeMetric, shouldCaptureErrorReplay, sanitizeFeedbackEvent,
} = loadTypeScript('instrumentation/sentry-privacy.ts');

const sdkMock = {
    breadcrumbsIntegration: options => ({name: 'Breadcrumbs', options}),
    expoRouterIntegration: options => ({name: 'ExpoRouter', options}),
    mobileReplayIntegration: options => ({name: 'MobileReplay', options}),
    feedbackIntegration: options => ({name: 'MobileFeedback', options}),
};
const {createSentryOptions} = loadTypeScript('instrumentation/sentry-config.ts', {'@sentry/react-native': sdkMock});

test('error request keeps the service origin and method without account paths or credentials', () => {
    const event = {
        event_id: 'event-id',
        exception: {values: [{type: 'TypeError', value: 'Unable to read response'}]},
        request: {
            url: 'https://user:password@firestore.googleapis.com/v1/projects/yify/documents/users/private-uid?key=secret#fragment',
            method: 'POST',
            headers: {Authorization: 'Bearer private-token', Referer: 'https://example.com/?private=query'},
            cookies: 'session=private-cookie',
            query_string: 'key=secret',
            data: {email: 'private@example.com'},
        },
    };
    const result = sanitizeErrorEvent(event);
    assert.deepEqual(result.request, {url: 'https://firestore.googleapis.com', method: 'POST'});
    assert.deepEqual(result.exception, event.exception);
    assert.equal(result.event_id, 'event-id');
    assert.equal(event.request.data.email, 'private@example.com');
});

test('HTTP breadcrumbs remove search text and API keys without losing status information', () => {
    for (const url of [
        'https://api.themoviedb.org/3/search/movie?api_key=secret&query=private-search',
        'https://movies-api.accel.li/api/v2/list_movies.json?query_term=private-search',
    ]) {
        const result = sanitizeBreadcrumb({
            category: 'fetch', type: 'http', timestamp: 123, level: 'error',
            message: `GET ${url}`,
            data: {url, method: 'GET', status_code: 500, headers: {secret: 'token'}, body: 'private'},
        });
        assert.deepEqual(result.data, {url: new URL(url).origin, method: 'GET', status_code: 500});
        assert.equal(result.message, undefined);
        assert.equal(result.timestamp, 123);
        assert.equal(result.level, 'error');
    }
});

test('merged breadcrumbs are sanitized again before sending and console content is removed', () => {
    const route = {category: 'expo.updates', message: 'Update downloaded', data: {updateId: 'ce786364-1f38-4926-b0d9-7a915ae854bd'}};
    const result = sanitizeErrorEvent({breadcrumbs: [
        {category: 'console', message: 'private account details'},
        {type: 'http', data: {url: 'https://example.com/users/private-uid', method: 'GET'}},
        route,
    ]});
    assert.equal(result.breadcrumbs.length, 2);
    assert.equal(result.breadcrumbs[0].data.url, 'https://example.com');
    assert.deepEqual(result.breadcrumbs[1], route);
});

test('invalid, relative, and non-HTTP request URLs are omitted instead of retained', () => {
    for (const url of ['not a url', '/users/private-uid?token=secret', 'file:///private/path', 'data:text/plain,secret', null]) {
        assert.equal(sanitizeErrorEvent({request: {url}}).request.url, undefined);
        assert.equal(sanitizeBreadcrumb({category: 'xhr', data: {url}}).data.url, undefined);
    }
    assert.doesNotThrow(() => sanitizeErrorEvent({}));
    assert.doesNotThrow(() => sanitizeBreadcrumb({type: 'http'}));
});

test('monitoring initializes in release app runtimes with the correct environment, never development or static web export', () => {
    const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
        for (const {dev, platform, browser, channel, environment, expected} of [
            {dev: true, platform: 'android', browser: false, expected: 0},
            {dev: false, platform: 'web', browser: false, expected: 0},
            {dev: false, platform: 'android', browser: false, channel: 'Production', environment: 'production', expected: 1},
            {dev: false, platform: 'android', browser: false, channel: 'Staging', environment: 'preview', expected: 1},
            {dev: false, platform: 'ios', browser: false, channel: 'Staging', environment: 'preview', expected: 1},
            {dev: false, platform: 'android', browser: false, channel: null, environment: 'production', expected: 1},
            {dev: false, platform: 'web', browser: true, channel: null, environment: 'production', expected: 1},
        ]) {
            Object.defineProperty(globalThis, '__DEV__', {value: dev, configurable: true});
            if (browser) Object.defineProperty(globalThis, 'window', {value: {}, configurable: true});
            else delete globalThis.window;
            const calls = [];
            loadTypeScript('instrumentation/sentry.ts', {
                'react-native': {Platform: {OS: platform}},
                'expo-updates': {channel},
                '@sentry/react-native': {
                    ...sdkMock,
                    init: options => calls.push(options),
                },
            });
            assert.equal(calls.length, expected, `${platform}, development=${dev}, browser=${browser}`);
            if (calls.length) {
                assert.equal(calls[0].environment, environment);
                assert.equal(calls[0].sendDefaultPii, false);
                assert.equal(calls[0].integrations[0].options.console, false);
                assert.equal(calls[0].tracesSampleRate, 0.1);
                assert.equal(calls[0].profilesSampleRate, platform === 'web' ? undefined : 0.1);
                assert.equal(calls[0].enableLogs, true);
                assert.equal(calls[0].enableAutoConsoleLogs, false);
                assert.equal(calls[0].logsOrigin, 'js');
                assert.equal(calls[0].replaysSessionSampleRate, undefined);
                assert.equal(calls[0].replaysOnErrorSampleRate, undefined);
                assert.deepEqual(calls[0].tracePropagationTargets, []);
                assert.equal(calls[0].beforeSend.name, 'sanitizeErrorEvent');
                assert.equal(calls[0].beforeSendTransaction.name, 'sanitizeTransaction');
                assert.equal(calls[0].beforeSendSpan.name, 'sanitizeSpan');
                assert.equal(calls[0].beforeSendLog.name, 'sanitizeLog');
                assert.equal(calls[0].beforeSendMetric.name, 'sanitizeMetric');
                assert.equal(calls[0].defaultIntegrations, undefined);
                assert.equal(calls[0].release, undefined);
                assert.equal(calls[0].dist, undefined);
            }
        }
    } finally {
        if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev);
        else delete globalThis.__DEV__;
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else delete globalThis.window;
    }
});

test('diagnostics attributes retain operation outcomes while excluding content, identifiers and uncontrolled strings', () => {
    assert.deepEqual(sanitizeDiagnosticAttributes({
        'diagnostics.operation': 'api.yts.list_movies', 'diagnostics.outcome': 'failed',
        provider: 'tmdb', method: 'GET', status_code: 503, duration_ms: 23.4, count: 2, available: false,
        title: 'Private title', movie_id: 123, user_id: 'private-uid', query: 'Private search',
        body: {token: 'secret'}, extra: 'private', error_code: 'https://host.test/private',
        reason: 'private@example.com', stage: 'contains spaces', retry_count: Infinity, attempt: -1,
    }), {
        'diagnostics.operation': 'api.yts.list_movies', 'diagnostics.outcome': 'failed',
        provider: 'tmdb', method: 'GET', status_code: 503, duration_ms: 23.4, count: 2, available: false,
    });
});

test('navigation keeps structural route names and strips every concrete parameter', () => {
    for (const route of ['/movie/123?query=private', 'movie/[id]', '/yify/movie/private-title#token']) {
        assert.equal(sanitizeRoute(route), '/movie/[id]');
    }
    assert.equal(sanitizeRoute('/show/tt123456?user=private'), '/show/[imdbId]');
    assert.equal(sanitizeRoute('/preferences?search=private'), '/preferences');
    assert.equal(sanitizeRoute('/users/private-uid'), undefined);
    const result = sanitizeBreadcrumb({category: 'navigation', message: 'private search', data: {
        from: '/movie/123', to: '/show/tt123456?private=query', params: {id: 123},
        'route.name': '/movie/123', 'route.params': {id: 123}, href: '/private',
    }});
    assert.deepEqual(result.data, {'route.name': '/movie/[id]', from: '/movie/[id]', to: '/show/[imdbId]'});
    assert.equal(result.message, undefined);
});

test('event scrubbing removes user and arbitrary context without damaging fatal frames, debug IDs or release identity', () => {
    const id = 'ce7863641f384926b0d97a915ae854bd';
    const frame = {filename: 'index.android.bundle', function: 'anonymous', lineno: 1, colno: 17231, vars: {token: 'private'}};
    const event = {
        event_id: id, level: 'fatal', release: 'io.github.kunal26das.yify@1.7.7+79', dist: '79',
        debug_meta: {images: [{type: 'sourcemap', code_file: 'index.android.bundle', debug_id: id}]},
        user: {id: 'private-uid', email: 'private@example.com'}, extra: {search: 'private'},
        server_name: 'private-device-name',
        exception: {values: [{type: 'TypeError', value: 'Cannot read response',
            mechanism: {type: 'onerror', handled: false, data: {token: 'private'}},
            stacktrace: {frames: [frame]},
        }]},
        contexts: {
            trace: {trace_id: id, span_id: '1234567890abcdef', op: 'yify.api.load', data: {'diagnostics.operation': 'api.load', body: 'private'}},
            profile: {profile_id: id}, replay: {replay_id: id},
            device: {model: 'Pixel 8', name: 'Private phone', id: 'private-device-id', memory_size: 123},
            ota_updates: {runtime_version: '1.7.7', channel: 'production', update_id: id, emergency_launch_reason: 'private'},
            account: {email: 'private@example.com'}, route: {name: '/movie/123', params: {id: 123}},
        },
        tags: {'expo.updates.runtime_version': '1.7.7', hermes: true, search: 'private', user_id: 'private'},
    };
    const result = sanitizeErrorEvent(event);
    for (const field of ['event_id', 'level', 'release', 'dist', 'debug_meta']) assert.deepEqual(result[field], event[field]);
    assert.deepEqual(result.exception.values[0].stacktrace.frames[0], {filename: frame.filename, function: 'anonymous', lineno: 1, colno: 17231});
    assert.equal(result.exception.values[0].mechanism.handled, false);
    assert.equal(result.exception.values[0].mechanism.data, undefined);
    assert.equal(result.contexts.trace.trace_id, id);
    assert.deepEqual(result.contexts.trace.data, {'diagnostics.operation': 'api.load'});
    assert.deepEqual(result.contexts.profile, {profile_id: id});
    assert.deepEqual(result.contexts.replay, {replay_id: id});
    assert.deepEqual(result.contexts.device, {model: 'Pixel 8', memory_size: 123});
    assert.deepEqual(result.contexts.route, {name: '/movie/[id]'});
    assert.equal(JSON.stringify(result).includes('private'), false);
    assert.equal(event.exception.values[0].stacktrace.frames[0].vars.token, 'private');
});

test('error messages scrub credentials, email addresses and query-bearing URLs while retaining useful failures', () => {
    const result = sanitizeErrorEvent({exception: {values: [{type: 'Error', value:
        'GET https://user:secret@api.test/users/private?token=secret failed for private@example.com Bearer secret-token api_key=secret',
    }]}});
    assert.equal(result.exception.values[0].value, 'GET https://api.test failed for [email] [credential] [private]');
});

test('transaction and span hooks remove URL paths, route parameters, payloads and links while preserving timing', () => {
    const span = {
        span_id: '1234567890abcdef', trace_id: 'ce7863641f384926b0d97a915ae854bd',
        start_timestamp: 123, timestamp: 124, op: 'http.client',
        description: 'GET https://api.test/users/private?token=secret',
        data: {'http.method': 'GET', 'url.full': 'https://api.test/users/private?token=secret', 'http.response.status_code': 503, body: 'private', headers: {secret: 'private'}},
        links: [{attributes: {account: 'private'}}],
    };
    const result = sanitizeTransaction({type: 'transaction', transaction: '/movie/123?search=private',
        contexts: {trace: {trace_id: span.trace_id, span_id: span.span_id, op: 'navigation', data: {'route.name': '/movie/123', 'route.params': {id: 123}}}},
        spans: [span], user: {email: 'private@example.com'}, extra: {search: 'private'},
    });
    assert.equal(result.transaction, '/movie/[id]');
    assert.equal(result.spans[0].description, 'GET https://api.test');
    assert.equal(result.spans[0].start_timestamp, 123);
    assert.equal(result.spans[0].timestamp, 124);
    assert.equal(result.spans[0].span_id, span.span_id);
    assert.equal(result.spans[0].links, undefined);
    assert.equal(JSON.stringify(result).includes('private'), false);
    assert.equal(sanitizeSpan({...span, op: 'yify.api.yts.list_movies', description: 'api.yts.list_movies'}).description, 'api.yts.list_movies');
});

test('logs and metrics accept only application diagnostics and strip automatic user and message parameters', () => {
    const attributes = {'diagnostics.operation': 'api.yts.list_movies', 'diagnostics.outcome': 'success',
        'sentry.release': 'io.github.kunal26das.yify@1.7.7+79', 'user.email': 'private@example.com',
        'sentry.message.parameter.0': 'private', query: 'private', 'diagnostics.duration_ms': 12,
    };
    const log = sanitizeLog({level: 'info', message: 'api.yts.list_movies', attributes});
    assert.equal(log.attributes['sentry.release'], attributes['sentry.release']);
    assert.equal(log.attributes['diagnostics.duration_ms'], 12);
    assert.equal(JSON.stringify(log).includes('private'), false);
    assert.equal(sanitizeLog({level: 'error', message: 'private account failure', attributes}), null);
    assert.equal(sanitizeLog({level: 'info', message: 'api.yts.list_movies', attributes: {}}), null);
    const metric = sanitizeMetric({name: 'yify.operation.duration', type: 'distribution', value: 12, unit: 'millisecond', attributes});
    assert.equal(metric.unit, 'millisecond');
    assert.equal(JSON.stringify(metric).includes('private'), false);
    assert.equal(sanitizeMetric({...metric, name: 'yify.private_account_123'}), null);
    assert.equal(sanitizeMetric({...metric, value: Infinity}), null);
});

test('shipping configuration keeps replay off, and controlled native verification keeps visual and network masking', () => {
    const shipping = createSentryOptions({native: true, environment: 'production'});
    assert.equal(shipping.integrations.some(item => item.name === 'MobileReplay'), false);
    assert.equal(shipping.replaysOnErrorSampleRate, undefined);
    const verification = createSentryOptions({native: true, environment: 'preview', replayEnabled: true});
    assert.equal(verification.replaysSessionSampleRate, 0);
    assert.equal(verification.replaysOnErrorSampleRate, 0.1);
    const replay = verification.integrations.find(item => item.name === 'MobileReplay').options;
    for (const key of ['maskAllText', 'maskAllImages', 'maskAllVectors']) assert.equal(replay[key], true);
    for (const key of ['captureSurfaceViews', 'networkCaptureBodies']) assert.equal(replay[key], false);
    for (const key of ['networkDetailAllowUrls', 'networkDetailDenyUrls', 'networkRequestHeaders', 'networkResponseHeaders']) assert.deepEqual(replay[key], []);
    const web = createSentryOptions({native: false, environment: 'production', replayEnabled: true});
    assert.equal(web.replaysOnErrorSampleRate, undefined);
    assert.equal(web.profilesSampleRate, undefined);
    assert.equal(web.integrations.some(item => item.name === 'MobileReplay'), false);
    assert.equal(shipping.integrations.filter(item => item.name === 'ExpoRouter').length, 1);
    assert.equal(shipping.integrations.find(item => item.name === 'ExpoRouter').options.enableTimeToInitialDisplay, true);
    const feedback = shipping.integrations.find(item => item.name === 'MobileFeedback').options;
    for (const key of ['showName', 'showEmail', 'isNameRequired', 'isEmailRequired', 'enableScreenshot', 'enableTakeScreenshot', 'enableShakeToReport']) assert.equal(feedback[key], false);
});

test('error replay only starts for unhandled errors and skips routine handled failures', () => {
    assert.equal(shouldCaptureErrorReplay({exception: {values: [{mechanism: {handled: false}}]}}), true);
    assert.equal(shouldCaptureErrorReplay({exception: {values: [{mechanism: {handled: true}}]}}), false);
    assert.equal(shouldCaptureErrorReplay({type: 'transaction'}), false);
    assert.equal(shouldCaptureErrorReplay({message: 'Routine failure'}), false);
});

test('player operations retain provider, frame data, and native display measurements on root and child spans', () => {
    const data = {'diagnostics.operation': 'player.prepare', 'diagnostics.provider': 'youtube', profile_id: 'ce7863641f384926b0d97a915ae854bd',
        'diagnostics.duration_ms': 1200, 'frames.total': 72, 'frames.slow': 4, 'frames.frozen': 0, 'frames.delay': 123,
    };
    const measurements = {time_to_initial_display: {value: 12, unit: 'millisecond'}, frames_total: {value: 72, unit: 'none'}};
    const result = sanitizeTransaction({type: 'transaction', transaction: 'player.prepare', measurements,
        contexts: {trace: {trace_id: 'ce7863641f384926b0d97a915ae854bd', span_id: '1234567890abcdef', op: 'yify.player.prepare', data}},
        spans: [{op: 'yify.player.prepare', description: 'player.prepare', span_id: '1234567890abcdea', start_timestamp: 10, data}],
    });
    assert.equal(result.transaction, 'player.prepare');
    assert.equal(result.contexts.trace.op, 'yify.player.prepare');
    assert.deepEqual(result.contexts.trace.data, data);
    assert.deepEqual(result.spans[0].data, data);
    assert.equal(result.spans[0].description, 'player.prepare');
    assert.deepEqual(result.measurements, measurements);
});

test('feedback strips hidden account autofill and inherited attachments while retaining submitted text and error link', () => {
    const id = 'ce7863641f384926b0d97a915ae854bd';
    const event = {type: 'feedback', user: {email: 'private@example.com'}, extra: {account: 'private'},
        contexts: {feedback: {message: 'Playback never starts.', associated_event_id: id, name: 'private',
            contact_email: 'private@example.com', url: 'https://example.test/private?token=private'}, account: {id: 'private'}},
    };
    const result = sanitizeFeedbackEvent(event);
    assert.deepEqual(result.contexts.feedback, {message: 'Playback never starts.', associated_event_id: id});
    assert.equal(JSON.stringify(result).includes('private'), false);
    const options = createSentryOptions({native: true, environment: 'production'});
    const integration = options.integrations.find(item => item.name === 'YifyFeedbackPrivacy');
    const hint = {attachments: [{filename: 'private.txt', data: 'private'}]};
    assert.deepEqual(integration.processEvent(event, hint), result);
    assert.deepEqual(hint.attachments, []);
    const error = {exception: {values: [{value: 'Existing fatal'}]}};
    assert.equal(integration.processEvent(error, {}), error);
});
