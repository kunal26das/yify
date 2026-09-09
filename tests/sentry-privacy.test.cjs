const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {sanitizeBreadcrumb, sanitizeErrorEvent} = loadTypeScript('instrumentation/sentry-privacy.ts');

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
    const route = {category: 'expo.updates', message: 'Update downloaded', data: {updateId: 'update-id'}};
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
                    init: options => calls.push(options),
                    breadcrumbsIntegration: options => ({name: 'Breadcrumbs', options}),
                },
            });
            assert.equal(calls.length, expected, `${platform}, development=${dev}, browser=${browser}`);
            if (calls.length) {
                assert.equal(calls[0].environment, environment);
                assert.equal(calls[0].sendDefaultPii, false);
                assert.equal(calls[0].integrations[0].options.console, false);
                assert.equal(calls[0].tracesSampleRate, undefined);
                assert.equal(calls[0].enableLogs, undefined);
                assert.equal(calls[0].replaysSessionSampleRate, undefined);
            }
        }
    } finally {
        if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev);
        else delete globalThis.__DEV__;
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else delete globalThis.window;
    }
});
