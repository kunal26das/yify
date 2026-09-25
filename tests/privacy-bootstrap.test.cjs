const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

test('startup services wait for an adult declaration and start only once', async () => {
    const calls = [];
    let adultConfirmed = false;
    const record = name => () => { calls.push(name); return Promise.resolve(); };
    const {bootstrap} = loadTypeScript('data/di/bootstrap.ts', {
        '../services/NewMoviesNotifierImpl': {
            publishNotificationSettings: record('notification-settings'),
            refreshMovieNotificationContent: record('notification-content'),
        },
        './container': {getAccountLink: () => ({start: record('account-link')})},
    });
    const deps = {
        privacy: {getChoices: () => ({adultConfirmed, analytics: false})},
        appConfig: {init: record('config')},
        auth: {init: record('auth')},
        purchases: {init: record('purchases')},
        ads: {init: record('ads')},
        accountSync: {start: record('sync')},
        storeServices: {start: record('store')},
        appUpdates: {start: record('updates')},
        newMovies: {register: record('notifications')},
        preferences: {getPreferences: () => ({}), subscribe: record('preferences-subscribe')},
        watchlist: {subscribe: record('watchlist-subscribe')},
        library: {subscribe: record('library-subscribe')},
        availabilityAlerts: {start: record('alerts')},
        journal: {start: record('journal')},
        diagnostics: {capture: record('diagnostics')},
    };
    bootstrap(deps);
    assert.deepEqual(calls, []);
    adultConfirmed = true;
    bootstrap(deps);
    assert.ok(calls.includes('auth'));
    assert.ok(calls.includes('purchases'));
    assert.ok(calls.includes('ads'));
    const started = [...calls];
    bootstrap(deps);
    assert.deepEqual(calls, started);
});
