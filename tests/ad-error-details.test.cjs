const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {adErrorCode, adErrorDetails} = loadTypeScript('data/services/AdMobFailure.ts');
const {adErrorFromNativeEvent} = loadTypeScript('node_modules/react-native-google-mobile-ads/src/internal/adErrorFromNativeEvent.ts');
const {sanitizeDiagnosticAttributes, sanitizeErrorEvent} = loadTypeScript('instrumentation/sentry-privacy.ts');

test('installed Ads SDK structured failures retain bounded native cause metadata through privacy sanitization', () => {
    const error = adErrorFromNativeEvent({code: 'internal-error', message: 'private SDK message', phase: 'load',
        responseInfoJson: JSON.stringify({responseId: 'private-response-id', extras: {creativeId: 'private-creative-id'},
            adapterResponses: [{outcome: 'error', adSourceId: 'private-source-id', adError: {
                code: 2, domain: 'com.google.android.gms.ads', message: 'private connection details',
            }}, {outcome: 'success', adError: null}]})}, 'googleMobileAds');
    const expected = {stage: 'load', ad_adapter_count: 2, ad_adapter_error_count: 1,
        ad_adapter_error_code: 2, ad_error_domain: 'admob'};
    assert.equal(adErrorCode(error), 'internal_error');
    assert.deepEqual(adErrorDetails(error), expected);
    assert.deepEqual(sanitizeDiagnosticAttributes(adErrorDetails(error)), expected);
    const event = sanitizeErrorEvent({contexts: {diagnostics: adErrorDetails(error)}});
    assert.deepEqual(event.contexts.diagnostics, expected);
    assert.doesNotMatch(JSON.stringify(event), /private|responseId|creativeId|message/);
});

test('structured SDK reasons work without deprecated codes and take precedence over legacy codes', () => {
    assert.equal(adErrorCode({reason: 'network-error', code: 'googleMobileAds/internal-error'}), 'network_error');
    assert.equal(adErrorCode({reason: 'no-fill'}), 'no_fill');
    assert.equal(adErrorCode({reason: 'server-error'}), 'server_error');
    assert.equal(adErrorCode({reason: 'new-sdk-reason', code: 'googleMobileAds/internal-error'}), 'internal_error');
    assert.equal(adErrorCode({code: 'googleMobileAds/error-code-no-fill'}), 'no_fill');
    assert.equal(adErrorCode({code: 'googleMobileAds/error-code-internal-error'}), 'internal_error');
    for (const reason of ['toString', '__proto__', 'private@example.com', 'new-provider-error']) {
        assert.equal(adErrorCode({reason}), 'unknown');
    }
    assert.equal(adErrorCode({code: 'unrelated-sdk/network-error'}), 'unknown');
});

test('malformed SDK metadata cannot add arbitrary domains, phases, strings or unbounded numbers', () => {
    for (const error of [null, undefined, 42, {responseInfo: {}}, {responseInfo: {adapterResponses: 'private'}},
        {get reason() {throw Error('private');}, get responseInfo() {throw Error('private');}}]) {
        assert.deepEqual(adErrorDetails(error), {});
        assert.equal(adErrorCode(error), 'unknown');
    }
    const responseInfo = {adapterResponses: [
        {outcome: 'error', adError: {domain: 'private-domain', code: Infinity}},
        {outcome: 'error', adError: {domain: 'private-domain', code: -1}},
        {outcome: 'error', adError: {domain: 'private-domain', code: 'private'}},
        {outcome: 'error', adError: {domain: 'private-domain', code: 17}},
    ]};
    const actual = adErrorDetails({phase: 'private-phase', responseInfo});
    assert.deepEqual(actual, {ad_adapter_count: 4, ad_adapter_error_count: 4,
        ad_adapter_error_code: 17, ad_error_domain: 'other'});
    assert.deepEqual(sanitizeDiagnosticAttributes({ad_error_domain: 'private-domain', ad_adapter_error_code: 65536,
        ad_adapter_count: 101, ad_adapter_error_count: 1.5}), {});
    assert.deepEqual(sanitizeDiagnosticAttributes({'diagnostics.ad_error_domain': 'admob_mediation',
        'diagnostics.ad_adapter_error_code': 0, 'diagnostics.ad_adapter_count': 100}),
    {'diagnostics.ad_error_domain': 'admob_mediation', 'diagnostics.ad_adapter_error_code': 0, 'diagnostics.ad_adapter_count': 100});
    assert.deepEqual(adErrorDetails({responseInfo: {adapterResponses: Array(101).fill({outcome: 'error',
        adError: {code: 3, domain: 'com.google.android.gms.ads.mediation'}})}}), {
        ad_adapter_count: 100, ad_adapter_error_count: 100, ad_adapter_error_code: 3, ad_error_domain: 'admob_mediation',
    });
});
