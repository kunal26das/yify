const assert = require('node:assert/strict');
const {test} = require('node:test');
const firebase = require('../../firebase.json');

const DENIED_DEFAULTS = [
    'analytics_auto_collection_enabled',
    'analytics_default_allow_analytics_storage',
    'analytics_default_allow_ad_storage',
    'analytics_default_allow_ad_user_data',
    'analytics_default_allow_ad_personalization_signals',
    'google_analytics_adid_collection_enabled',
    'google_analytics_ssaid_collection_enabled',
    'google_analytics_automatic_screen_reporting_enabled',
    'analytics_idfv_collection_enabled',
    'google_analytics_registration_with_ad_network_enabled',
];

test('analytics and ad collection stay off until consent', () => {
    const defaults = firebase['react-native'];
    assert.deepEqual(Object.keys(defaults).sort(), [...DENIED_DEFAULTS].sort());
    for (const key of DENIED_DEFAULTS) assert.equal(defaults[key], false, key);
});

test('no Crashlytics setting remains and Firestore keeps its rules file', () => {
    assert.equal(Object.keys(firebase['react-native']).some((key) => key.startsWith('crashlytics_')), false);
    assert.equal(firebase.firestore.rules, 'firestore.rules');
});
