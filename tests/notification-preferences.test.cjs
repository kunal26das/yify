const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {PreferencesRepositoryImpl, parseSyncedPreferences} = loadTypeScript('data/repositories/PreferencesRepositoryImpl.ts');

function repository(initial = {}) {
    const values = new Map(Object.entries(initial));
    const store = {getString: key => values.get(key), set: (key, value) => values.set(key, value)};
    return {store, preferences: new PreferencesRepositoryImpl(store)};
}

test('fresh and existing notification settings default to a daily pick at 7 PM', () => {
    for (const initial of [{}, {notify: JSON.stringify({quality: '1080p', perTitle: true})}]) {
        const {preferences} = repository(initial);
        assert.equal(preferences.getNotificationPreferences().dailyPicks, true);
        assert.equal(preferences.getNotificationPreferences().dailyHour, 19);
    }
});

test('daily notification choices persist and sync without resetting old notification filters', () => {
    const {store, preferences} = repository({notify: JSON.stringify({quality: '1080p'})});
    preferences.setNotificationPreferences({...preferences.getNotificationPreferences(), dailyPicks: false, dailyHour: 6});
    assert.equal(new PreferencesRepositoryImpl(store).getNotificationPreferences().dailyPicks, false);
    assert.equal(new PreferencesRepositoryImpl(store).getNotificationPreferences().dailyHour, 6);
    assert.equal(preferences.getSynced().notify.dailyHour, 6);
    preferences.applyRemote(parseSyncedPreferences(JSON.stringify({notify: {dailyPicks: true, dailyHour: 23}})));
    assert.equal(preferences.getNotificationPreferences().dailyPicks, true);
    assert.equal(preferences.getNotificationPreferences().dailyHour, 23);
    assert.equal(preferences.getNotificationPreferences().quality, '1080p');
    preferences.applyRemote(parseSyncedPreferences(JSON.stringify({notify: {quality: '720p'}})));
    assert.equal(preferences.getNotificationPreferences().dailyHour, 23);
});

test('invalid daily fields are ignored in local storage and synced settings', () => {
    for (const dailyHour of [-1, 24, 7.5, '19', null]) {
        const notify = {dailyPicks: 'yes', dailyHour};
        const {preferences} = repository({notify: JSON.stringify(notify)});
        assert.equal(preferences.getNotificationPreferences().dailyPicks, true);
        assert.equal(preferences.getNotificationPreferences().dailyHour, 19);
        const incoming = parseSyncedPreferences(JSON.stringify({notify}));
        assert.equal(incoming.notify, undefined);
    }
    for (const dailyHour of [0, 23]) {
        const parsed = parseSyncedPreferences(JSON.stringify({notify: {dailyPicks: false, dailyHour}}));
        assert.deepEqual(parsed.notify, {dailyPicks: false, dailyHour});
    }
});

function viewModelFixture({status = 'denied', legacy = false} = {}) {
    const {preferences} = repository();
    const listeners = new Set();
    const events = [];
    let current;
    let requests = 0;
    let registrations = 0;
    let requestError;
    let registerError;
    let requestWait;
    const history = {getRecent: () => [], clear() {}};
    const notifier = {
        hasPermission: async () => status === 'granted',
        ...(legacy ? {} : {permissionStatus: async () => status}),
        requestPermission: async () => {
            requests += 1;
            if (requestError) throw requestError;
            if (requestWait) await requestWait;
            status = 'granted';
            return true;
        },
        register: async () => {
            registrations += 1;
            if (registerError) throw registerError;
        },
    };
    const {usePreferencesViewModel} = loadTypeScript('presentation/movies/usePreferencesViewModel.ts', {
        'expo-constants': {expoConfig: {version: '1.8.4'}},
        'react-native': {
            Platform: {OS: 'web'},
            AppState: {addEventListener: (_, callback) => {
                listeners.add(callback);
                return {remove: () => listeners.delete(callback)};
            }},
        },
        '@/presentation/analytics/events': {Analytics: {settingChanged: (...args) => events.push(args)}},
        '../di/DependenciesContext': {
            useSearchHistory: () => history,
            useNewMoviesNotifier: () => notifier,
            usePreferencesRepository: () => preferences,
            useWatchlistRepository: () => ({}),
        },
        '../hooks/use-preferences': {usePreferences: () => preferences.getPreferences()},
        './useWatchlist': {useWatchlist: () => []},
    });
    function Probe() {
        current = usePreferencesViewModel();
        return null;
    }
    return {
        Probe, preferences, events, listeners,
        current: () => current,
        requests: () => requests,
        registrations: () => registrations,
        setStatus: value => {status = value;},
        failRequest: error => {requestError = error;},
        failRegister: error => {registerError = error;},
        waitForRequest: promise => {requestWait = promise;},
        foreground: () => listeners.forEach(listener => listener('active')),
    };
}

async function mount(t, fixture) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(fixture.Probe));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

test('permission is read on mount and foreground without showing a permission prompt', async t => {
    const f = viewModelFixture();
    const renderer = await mount(t, f);
    assert.equal(f.current().permissionBlocked, true);
    assert.equal(f.requests(), 0);
    f.setStatus('granted');
    await act(async () => f.foreground());
    assert.equal(f.current().permissionBlocked, false);
    assert.equal(f.current().permissionStatus, 'granted');
    assert.equal(f.requests(), 0);
    await act(async () => renderer.unmount());
    assert.equal(f.listeners.size, 0);
});

test('unrequested and legacy permission states are not falsely shown as blocked', async t => {
    for (const options of [{status: 'undetermined'}, {status: 'undetermined', legacy: true}]) {
        const f = viewModelFixture(options);
        await mount(t, f);
        assert.equal(f.current().permissionBlocked, false);
        assert.equal(f.current().permissionStatus, 'undetermined');
        assert.equal(f.requests(), 0);
    }
});

test('only enabling alerts requests permission and registers successful permission', async t => {
    const f = viewModelFixture({status: 'undetermined'});
    await mount(t, f);
    await act(async () => f.current().toggleNotifications(false));
    assert.equal(f.requests(), 0);
    assert.equal(f.preferences.areNotificationsEnabled(), false);
    await act(async () => f.current().toggleNotifications(true));
    assert.equal(f.requests(), 1);
    assert.equal(f.registrations(), 1);
    assert.equal(f.current().permissionStatus, 'granted');
    assert.equal(f.preferences.areNotificationsEnabled(), true);
});

test('permission and registration failures are contained and can be retried', async t => {
    const f = viewModelFixture({status: 'undetermined'});
    await mount(t, f);
    f.failRequest(new Error('prompt unavailable'));
    await act(async () => f.current().toggleNotifications(true));
    assert.equal(f.registrations(), 0);
    assert.equal(f.current().notificationError, 'Could not enable alerts. Please try again.');
    f.failRequest(undefined);
    f.failRegister(new Error('scheduler unavailable'));
    await act(async () => f.current().toggleNotifications(true));
    assert.equal(f.current().permissionStatus, 'granted');
    assert.equal(f.current().notificationError, 'Could not enable alerts. Please try again.');
    f.failRegister(undefined);
    await act(async () => f.current().toggleNotifications(true));
    assert.equal(f.current().notificationError, null);
});

test('turning alerts off while permission is pending does not register notifications', async t => {
    const f = viewModelFixture({status: 'undetermined'});
    await mount(t, f);
    let grant;
    f.waitForRequest(new Promise(resolve => {grant = resolve;}));
    await act(async () => {
        const enabling = f.current().toggleNotifications(true);
        await f.current().toggleNotifications(false);
        grant();
        await enabling;
    });
    assert.equal(f.preferences.areNotificationsEnabled(), false);
    assert.equal(f.registrations(), 0);
});

test('foreground permission refresh during a user permission request does not skip registration', async t => {
    const f = viewModelFixture({status: 'undetermined'});
    await mount(t, f);
    let grant;
    f.waitForRequest(new Promise(resolve => {grant = resolve;}));
    await act(async () => {
        const enabling = f.current().toggleNotifications(true);
        f.setStatus('granted');
        f.foreground();
        grant();
        await enabling;
    });
    assert.equal(f.current().permissionStatus, 'granted');
    assert.equal(f.registrations(), 1);
});

test('daily mode and delivery changes preserve filters and report distinct analytics keys', async t => {
    const f = viewModelFixture({status: 'granted'});
    await mount(t, f);
    await act(async () => {
        f.current().setNotificationPreference('dailyPicks', false);
        f.current().setNotificationPreference('dailyHour', 9);
    });
    assert.equal(f.preferences.getNotificationPreferences().dailyPicks, false);
    assert.equal(f.preferences.getNotificationPreferences().dailyHour, 9);
    assert.equal(f.preferences.getNotificationPreferences().quality, '2160p');
    assert.deepEqual(f.events, [
        ['notifications_daily_picks', 'false'],
        ['notifications_daily_hour', '9'],
    ]);
});
