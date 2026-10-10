const assert = require('node:assert/strict');
const {test} = require('node:test');
const vm = require('node:vm');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {getWebStartupScript, WebStartupPlaceholder} = loadTypeScript('presentation/components/web-startup-placeholder.web.tsx', {
    'react-native': {Platform: {OS: 'web', select: values => values.web}},
});
const {PRIVACY_NOTICE_VERSION} = loadTypeScript('domain/entities/PrivacyChoices.ts');
const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
const receipt = {adultConfirmed: true, analytics: false, youtube: false, noticeVersion: PRIVACY_NOTICE_VERSION,
    updatedAt: '2026-09-25T00:00:00.000Z'};

function run(raw, {theme = null, unavailable = false, pathname = '/', baseUrl = ''} = {}) {
    const attributes = new Map();
    const listeners = new Map();
    let timeout;
    let delay;
    let canceled = false;
    vm.runInNewContext(getWebStartupScript(baseUrl), {
        localStorage: {getItem(key) {
            if (unavailable) throw Error('Storage unavailable');
            return key === 'privacy:choices' ? raw : theme;
        }},
        document: {documentElement: {
            setAttribute: (key, value) => attributes.set(key, value),
            removeAttribute: key => attributes.delete(key),
            hasAttribute: key => attributes.has(key),
        }},
        window: {location: {pathname}, addEventListener: (name, listener) => listeners.set(name, listener)},
        setTimeout: (callback, milliseconds) => {timeout = callback; delay = milliseconds; return 1;},
        clearTimeout: () => {canceled = true;},
    });
    return {attributes, listeners, timeout, delay, canceled: () => canceled};
}

test('returning visual hint accepts the same dated current-notice adult receipts as the real gate', () => {
    for (const analytics of [false, true]) {
        for (const youtube of [false, true]) {
            const raw = JSON.stringify({...receipt, analytics, youtube});
            const privacy = new PrivacyPreferencesImpl({getString: () => raw});
            assert.equal(privacy.getChoices().adultConfirmed, true);
            const result = run(raw);
            assert.equal(result.attributes.get('data-yify-startup'), 'pending');
            assert.equal(result.delay, 12000);
        }
    }
});

test('missing, malformed, expired-notice and unavailable receipts leave the real gate visible', () => {
    const invalid = [null, '', 'null', '[]', '{}', 'invalid', JSON.stringify({...receipt, adultConfirmed: false}),
        JSON.stringify({...receipt, adultConfirmed: 'true'}), JSON.stringify({...receipt, noticeVersion: 'old'}),
        JSON.stringify({...receipt, analytics: undefined}), JSON.stringify({...receipt, analytics: 'false'}),
        JSON.stringify({...receipt, youtube: undefined}), JSON.stringify({...receipt, youtube: 1}),
        JSON.stringify({...receipt, updatedAt: null}), JSON.stringify({...receipt, updatedAt: '2026-09-25'}),
        JSON.stringify({...receipt, updatedAt: 'invalid'})];
    for (const raw of invalid) {
        assert.equal(new PrivacyPreferencesImpl({getString: () => raw}).getChoices().adultConfirmed, false);
        assert.equal(run(raw).attributes.size, 0);
        assert.equal(run(raw).timeout, undefined);
    }
    assert.equal(run(JSON.stringify(receipt), {unavailable: true}).attributes.size, 0);
});

test('visual hint follows persisted theme without writing privacy or revealing app content', () => {
    for (const theme of ['light', 'dark', 'system', null, 'invalid']) {
        const result = run(JSON.stringify(receipt), {theme});
        assert.equal(result.attributes.get('data-yify-startup-theme'), ['light', 'system'].includes(theme) ? theme : 'dark');
        assert.equal(result.attributes.size, 2);
    }
});

test('only the configured homepage receives a startup hint', () => {
    for (const baseUrl of ['', '/yify', '/yify/']) {
        const base = baseUrl.replace(/\/+$/, '');
        for (const pathname of [base || '/', `${base}/`]) {
            assert.equal(run(JSON.stringify(receipt), {baseUrl, pathname}).attributes.get('data-yify-startup'), 'pending');
        }
        for (const suffix of ['/privacy/', '/terms/', '/guide/', '/movies', '/api/catalog', '/missing']) {
            const result = run(JSON.stringify(receipt), {baseUrl, pathname: base + suffix});
            assert.equal(result.attributes.size, 0);
            assert.equal(result.timeout, undefined);
        }
        assert.equal(run(JSON.stringify(receipt), {baseUrl, pathname: '/another/'}).attributes.size, 0);
    }
    assert.equal(run(JSON.stringify(receipt), {baseUrl: '/yify', pathname: '/'}).attributes.size, 0);
});

test('slow or failed JavaScript gets a bounded fallback, and late real-gate reconciliation recovers', () => {
    const result = run(JSON.stringify(receipt));
    result.timeout();
    assert.equal(result.attributes.get('data-yify-startup'), 'failed');
    result.listeners.get('yify:startup-ready')();
    assert.equal(result.attributes.size, 0);
    assert.equal(result.canceled(), true);
});

test('successful reconciliation clears the visual hint and prevents a later fallback', () => {
    const result = run(JSON.stringify(receipt));
    result.listeners.get('yify:startup-ready')();
    result.timeout();
    assert.equal(result.attributes.size, 0);
    assert.equal(result.canceled(), true);
});

test('static pending skeleton is inaccessible and fallback links honor the hosting base path', () => {
    const html = renderToStaticMarkup(React.createElement(WebStartupPlaceholder, {baseUrl: '/yify'}));
    assert.match(html, /class="pending" aria-hidden="true"/);
    const pending = html.slice(html.indexOf('class="pending"'), html.indexOf('class="failure"'));
    assert.doesNotMatch(pending, /<(a|button|input|h[1-6])\b/);
    assert.doesNotMatch(pending, /https?:|src=|animation:/);
    assert.match(html, /Taking longer than usual/);
    assert.match(html, /href="\/yify\/privacy\/"/);
    assert.match(html, /href="\/yify\/guide\/"/);
});
