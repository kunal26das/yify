const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {isWithinQuietHours} = loadTypeScript('domain/policies/newMoviesNotification.ts');
const {localNotificationDateKey} = loadTypeScript('domain/policies/dailyMoviePicks.ts');
const {movieNotificationTarget} = loadTypeScript('domain/policies/movieNotificationTarget.ts');
const {DEFAULT_NOTIFICATION_PREFERENCES} = loadTypeScript('domain/entities/NotificationPreferences.ts');

function setGlobal(t, name, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});
    t.after(() => {
        if (original) Object.defineProperty(globalThis, name, original);
        else delete globalThis[name];
    });
}

function fixture(t, {browser = true, permission = 'granted', visibility = 'hidden', desktop = false} = {}) {
    t.mock.timers.enable({apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(2026, 8, 18, 18, 0).getTime()});
    const calls = [];
    const shown = [];
    const routes = [];
    const analytics = [];
    const stores = new Map();
    const listeners = new Map();
    let options;
    let refreshImpl;
    let preferences = {notifications: true, notify: {...DEFAULT_NOTIFICATION_PREFERENCES}};
    let permissionRequests = 0;
    const listen = (target, event, callback) => {
        const key = `${target}.${event}`;
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key).add(callback);
    };
    class NotificationMock {
        static permission = permission;
        static async requestPermission() {
            permissionRequests += 1;
            NotificationMock.permission = 'granted';
            return 'granted';
        }
        constructor(title, options) {
            this.title = title;
            this.options = options;
            this.closed = false;
            shown.push(this);
        }
        close() {this.closed = true;}
    }
    const documentMock = {
        visibilityState: visibility,
        addEventListener: (event, callback) => listen('document', event, callback),
    };
    const windowMock = {
        focus() {calls.push(['focus']);},
        addEventListener: (event, callback) => listen('window', event, callback),
        ...(desktop ? {yifyDesktop: {setNotificationSettings: value => calls.push(['desktop.settings', JSON.parse(value)])}} : {}),
    };
    setGlobal(t, 'window', browser ? windowMock : undefined);
    setGlobal(t, 'document', browser ? documentMock : undefined);
    setGlobal(t, 'Notification', browser ? NotificationMock : undefined);
    const coordinator = {
        invalidate() {calls.push(['invalidate']);},
        async refresh(...args) {
            calls.push(['refresh', ...args]);
            if (refreshImpl) await refreshImpl(options);
            return 0;
        },
        async check(force) {calls.push(['check', force]); return 0;},
    };
    const service = loadTypeScript('data/services/NewMoviesNotifierImpl.web.ts', {
        'expo-router': {router: {push: route => routes.push(route)}},
        '@/domain': {isWithinQuietHours, localNotificationDateKey, movieNotificationTarget},
        '../repositories/PreferencesRepositoryImpl': {
            PreferencesRepositoryImpl: class {getPreferences() {return preferences;}},
        },
        '../repositories/WatchlistRepositoryImpl': {WatchlistRepositoryImpl: class {getAll() {return [];}}},
        '../repositories/LibraryRepositoryImpl': {LibraryRepositoryImpl: class {}},
        '../datasources/storage/PersistentCache': {PersistentCache: class {
            constructor(namespace) {
                if (!stores.has(namespace)) stores.set(namespace, new Map());
                this.store = stores.get(namespace);
            }
            getString(key) {return this.store.get(key);}
            set(key, value) {this.store.set(key, value);}
        }},
        '../repositories/WebMovieRepositoryImpl': {WebMovieRepositoryImpl: class {}},
        '../datasources/WebCatalogClient': {WebCatalogClient: class {}},
        './MovieNotificationCoordinator': {
            MovieNotificationCoordinator: class {constructor(value) {options = value; return coordinator;}},
        },
    });
    new service.NewMoviesNotifierImpl({
        capture: (error, scope) => calls.push(['error', error, scope]),
        start: () => ({finish() {}, fail() {}}),
    }, {trackEvent: (...args) => analytics.push(args)});
    return {
        service, calls, shown, routes, analytics, stores, listeners,
        options: () => options,
        preferences: () => preferences,
        permissionRequests: () => permissionRequests,
        setPermission: value => {NotificationMock.permission = value;},
        setPreferences: value => {preferences = value;},
        setVisibility: value => {documentMock.visibilityState = value;},
        onRefresh: value => {refreshImpl = value;},
        emit: (event, value) => listeners.get(event)?.forEach(listener => listener(value)),
    };
}

function daily(identifier = 'yify-daily-pick:2026-09-18', delay = 1000) {
    const date = new Date(Date.now() + delay);
    return {
        identifier, date,
        content: {title: 'Tonight’s pick', body: 'Arrival', data: {kind: 'daily-pick', movieId: 42, dateKey: localNotificationDateKey(date)}},
    };
}

test('a daily timer displays only with granted permission while the page is hidden', async t => {
    const f = fixture(t, {visibility: 'visible'});
    await f.options().delivery.schedule(daily('visible'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 0);
    f.setVisibility('hidden');
    f.setPermission('denied');
    await f.options().delivery.schedule(daily('denied'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 0);
    f.setPermission('granted');
    await f.options().delivery.schedule(daily('allowed'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 1);
    assert.equal(f.shown[0].options.tag, 'allowed');
    assert.equal(f.shown[0].options.silent, true);
    assert.deepEqual(await f.options().delivery.pending(), []);
});

test('master off, daily mode off, quiet hours, and stale dates block delivery without consuming the day', async t => {
    const f = fixture(t);
    const original = f.preferences();
    f.setPreferences({...original, notifications: false});
    await f.options().delivery.schedule(daily('master-off'));
    t.mock.timers.tick(1000);
    f.setPreferences({...original, notify: {...original.notify, dailyPicks: false}});
    await f.options().delivery.schedule(daily('daily-off'));
    t.mock.timers.tick(1000);
    f.setPreferences({...original, notify: {...original.notify, quietHours: true, quietStartHour: 18, quietEndHour: 20}});
    await f.options().delivery.schedule(daily('quiet'));
    t.mock.timers.tick(1000);
    f.setPreferences(original);
    await f.options().delivery.schedule(daily('stale', -24 * 60 * 60 * 1000));
    t.mock.timers.tick(0);
    assert.equal(f.shown.length, 0);
    assert.equal(f.stores.get('notification-delivery').get('last-daily-date'), undefined);
    await f.options().delivery.schedule(daily('valid'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 1);
});

test('pending timers can be replaced and cancelled without later showing stale notifications', async t => {
    const f = fixture(t);
    await f.options().delivery.schedule(daily('same', 1000));
    const replacement = daily('same', 3000);
    replacement.content.body = 'Dune';
    await f.options().delivery.schedule(replacement);
    assert.deepEqual(await f.options().delivery.pending(), ['same']);
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 0);
    await f.options().delivery.cancel('same');
    assert.deepEqual(await f.options().delivery.pending(), []);
    t.mock.timers.tick(3000);
    assert.equal(f.shown.length, 0);
    await f.options().delivery.schedule(daily('replacement'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 1);
});

test('different identifiers cannot show more than one daily pick per local day', async t => {
    const f = fixture(t);
    await f.options().delivery.schedule(daily('first'));
    await f.options().delivery.schedule(daily('second'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 1);
    assert.equal(f.stores.get('notification-delivery').get('last-daily-date'), localNotificationDateKey(new Date()));
    t.mock.timers.tick(24 * 60 * 60 * 1000);
    await f.options().delivery.schedule(daily('tomorrow'));
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 2);
});

test('daily notification clicks focus Yify, open the movie, and report the notification kind', async t => {
    const f = fixture(t);
    await f.options().delivery.schedule(daily());
    t.mock.timers.tick(1000);
    f.shown[0].onclick();
    assert.deepEqual(f.routes, ['/movie/42']);
    assert.deepEqual(f.analytics, [['notification_open', {notification_kind: 'daily-pick', movie_id: 42}]]);
    assert.equal(f.calls.filter(call => call[0] === 'focus').length, 1);
    assert.equal(f.shown[0].closed, true);
});

test('legacy count notifications open the catalogue with new-release analytics', async t => {
    const f = fixture(t);
    f.setPreferences({...f.preferences(), notify: {...f.preferences().notify, dailyPicks: false}});
    await f.options().delivery.schedule({
        identifier: 'yify-new-movies:batch',
        content: {title: '3 new movies', body: 'Arrival, Dune, Alien', data: {count: 3}},
    });
    assert.equal(f.shown.length, 1);
    f.shown[0].onclick();
    assert.deepEqual(f.routes, ['/movies']);
    assert.deepEqual(f.analytics, [['notification_open', {notification_kind: 'new-release'}]]);
});

test('startup and foreground refreshes never prompt or show daily alerts to an active user', async t => {
    const f = fixture(t, {visibility: 'visible', permission: 'default'});
    f.onRefresh(async ({delivery}) => delivery.schedule({...daily('active'), date: undefined}));
    await f.service.registerNewMoviesTask();
    await f.service.registerNewMoviesTask();
    assert.equal(f.permissionRequests(), 0);
    assert.equal(f.shown.length, 0);
    assert.equal(f.listeners.get('document.visibilitychange').size, 1);
    assert.equal(f.listeners.get('window.focus').size, 1);
    assert.equal(f.listeners.get('window.storage').size, 1);
    assert.equal(await f.service.notificationPermissionStatus(), 'undetermined');
    assert.equal(await f.service.requestNotificationPermission(), true);
    assert.equal(f.permissionRequests(), 1);
    f.emit('window.focus');
    f.emit('document.visibilitychange');
    t.mock.timers.tick(60 * 60 * 1000);
    await Promise.resolve();
    assert.equal(f.shown.length, 0);
    assert.equal(f.permissionRequests(), 1);
    f.setPermission('denied');
    assert.equal(await f.service.requestNotificationPermission(), false);
    assert.equal(f.permissionRequests(), 1);
});

test('server rendering does not bind DOM listeners, refresh schedules, or request permission', async t => {
    const f = fixture(t, {browser: false});
    assert.equal(await f.service.notificationPermissionStatus(), 'unavailable');
    assert.equal(await f.service.hasNotificationPermission(), false);
    assert.equal(await f.service.requestNotificationPermission(), false);
    await f.service.registerNewMoviesTask();
    f.service.publishNotificationSettings(f.preferences());
    f.service.refreshMovieNotificationContent();
    t.mock.timers.tick(2 * 60 * 60 * 1000);
    assert.equal(f.permissionRequests(), 0);
    assert.equal(f.listeners.size, 0);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(await f.options().delivery.pending(), []);
});

test('desktop bridge receives renderer ownership and suppresses duplicate legacy web alerts', async t => {
    const f = fixture(t, {desktop: true});
    f.service.publishNotificationSettings(f.preferences());
    const settings = f.calls.find(call => call[0] === 'desktop.settings')[1];
    assert.equal(settings.dailyPicks, true);
    assert.equal(settings.rendererDailyDelivery, true);
    await f.options().delivery.schedule({
        identifier: 'yify-new-movies:batch',
        content: {title: '2 new movies', body: 'Arrival, Dune', data: {count: 2}},
    });
    assert.equal(f.shown.length, 0);
    await f.options().delivery.schedule(daily());
    t.mock.timers.tick(1000);
    assert.equal(f.shown.length, 1);
    f.setPermission('denied');
    f.service.publishNotificationSettings(f.preferences());
    assert.equal(f.calls.filter(call => call[0] === 'desktop.settings').at(-1)[1].rendererDailyDelivery, false);
});
