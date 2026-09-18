const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {isWithinQuietHours} = loadTypeScript('domain/policies/newMoviesNotification.ts');
const {DEFAULT_NOTIFICATION_PREFERENCES} = loadTypeScript('domain/entities/NotificationPreferences.ts');

function fixture({platform = 'android', permission = 'granted', restricted = false, registered = false} = {}) {
    const calls = [];
    const listeners = new Set();
    const tasks = new Map();
    const scheduled = [];
    let preferences = {notifications: true, notify: {...DEFAULT_NOTIFICATION_PREFERENCES}};
    let permissions = {status: permission, granted: permission === 'granted', canAskAgain: true};
    let pending = [];
    let handler;
    let options;
    let refreshImpl;
    const coordinator = {
        invalidate() {calls.push(['invalidate']);},
        async refresh(...args) {
            calls.push(['refresh', ...args]);
            if (refreshImpl) await refreshImpl(options);
            return 0;
        },
        async check(force) {calls.push(['check', force]); return 0;},
    };
    const appState = {
        currentState: 'active',
        addEventListener(event, callback) {
            calls.push(['listener', event]);
            listeners.add(callback);
            return {remove: () => listeners.delete(callback)};
        },
    };
    const notifications = {
        AndroidImportance: {DEFAULT: 3},
        IosAuthorizationStatus: {PROVISIONAL: 3, EPHEMERAL: 4},
        SchedulableTriggerInputTypes: {DATE: 'date'},
        setNotificationHandler(value) {handler = value;},
        async setNotificationChannelAsync(...args) {calls.push(['channel', ...args]);},
        async getPermissionsAsync() {calls.push(['permission.read']); return permissions;},
        async requestPermissionsAsync(request) {
            calls.push(['permission.request', request]);
            permissions = {status: 'granted', granted: true, canAskAgain: true};
            return permissions;
        },
        async getAllScheduledNotificationsAsync() {return pending;},
        async cancelScheduledNotificationAsync(id) {calls.push(['cancel', id]);},
        async scheduleNotificationAsync(item) {
            calls.push(['schedule', item]);
            scheduled.push(item);
            return item.identifier;
        },
    };
    const service = loadTypeScript('data/services/NewMoviesNotifierImpl.ts', {
        'expo-notifications': notifications,
        'expo-background-task': {
            BackgroundTaskStatus: {Restricted: 'restricted', Available: 'available'},
            BackgroundTaskResult: {Success: 'success', Failed: 'failed'},
            async getStatusAsync() {return restricted ? 'restricted' : 'available';},
            async registerTaskAsync(...args) {calls.push(['background.register', ...args]); registered = true;},
            async unregisterTaskAsync(...args) {calls.push(['background.unregister', ...args]); registered = false;},
        },
        'expo-task-manager': {
            defineTask(name, callback) {tasks.set(name, callback);},
            async isTaskRegisteredAsync() {return registered;},
        },
        'react-native': {AppState: appState, Platform: {OS: platform}},
        '@/domain': {isWithinQuietHours},
        '../repositories/PreferencesRepositoryImpl': {
            PreferencesRepositoryImpl: class {getPreferences() {return preferences;}},
        },
        '../repositories/WatchlistRepositoryImpl': {
            WatchlistRepositoryImpl: class {getAll() {return [];}},
        },
        '../repositories/LibraryRepositoryImpl': {LibraryRepositoryImpl: class {}},
        '../datasources/storage/PersistentCache': {
            PersistentCache: class {constructor(namespace) {this.namespace = namespace;}},
        },
        '../repositories/MovieRepositoryImpl': {MovieRepositoryImpl: class {}},
        '../datasources/YtsApiDataSource': {YtsApiDataSource: class {}},
        './RemoteAppConfig': {RemoteAppConfig: class {}},
        './MovieNotificationCoordinator': {
            MovieNotificationCoordinator: class {constructor(value) {options = value; return coordinator;}},
        },
    });
    return {
        service, calls, scheduled, listeners, tasks, appState, notifications,
        options: () => options,
        preferences: () => preferences,
        setPreferences: value => {preferences = value;},
        setPermissions: value => {permissions = value;},
        setPending: value => {pending = value;},
        onRefresh: callback => {refreshImpl = callback;},
        handle: data => handler.handleNotification({request: {content: {data}}}),
        foreground: () => {
            appState.currentState = 'active';
            listeners.forEach(listener => listener('active'));
        },
    };
}

async function settle() {
    await new Promise(resolve => setImmediate(resolve));
}

test('native startup never prompts and explicit Android permission creates its channel before requesting', async () => {
    const f = fixture({permission: 'undetermined'});
    assert.equal(f.calls.length, 0);
    await f.service.registerNewMoviesTask();
    assert.equal(f.calls.some(call => call[0] === 'permission.request'), false);
    assert.equal(f.listeners.size, 1);
    assert.equal(await f.service.requestNotificationPermission(), true);
    const channel = f.calls.findIndex(call => call[0] === 'channel');
    const request = f.calls.findIndex(call => call[0] === 'permission.request');
    assert.ok(channel >= 0 && channel < request);
    assert.deepEqual(f.calls[channel].slice(1), ['movie-recommendations', {
        name: 'Movie recommendations', importance: 3, sound: null, enableVibrate: false,
    }]);
});

test('provisional and ephemeral iOS authorization permit delivery without another prompt', async () => {
    for (const status of [3, 4]) {
        const f = fixture({platform: 'ios', permission: 'undetermined'});
        f.setPermissions({status: 'undetermined', granted: false, canAskAgain: false, ios: {status}});
        assert.equal(await f.service.notificationPermissionStatus(), 'granted');
        assert.equal(await f.service.requestNotificationPermission(), true);
        assert.equal(f.calls.some(call => call[0] === 'permission.request'), false);
        assert.equal(f.calls.some(call => call[0] === 'channel'), false);
    }
});

test('permanently denied permission stays denied without attempting another prompt', async () => {
    const f = fixture({permission: 'denied'});
    f.setPermissions({status: 'denied', granted: false, canAskAgain: false});
    assert.equal(await f.service.requestNotificationPermission(), false);
    assert.equal(await f.service.notificationPermissionStatus(), 'denied');
    assert.equal(f.calls.some(call => call[0] === 'permission.request'), false);
});

test('daily alerts stay quiet while active and may display in the background', async () => {
    const f = fixture();
    assert.deepEqual(await f.handle({kind: 'daily-pick', movieId: 42}), {
        shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false,
    });
    f.appState.currentState = 'background';
    assert.deepEqual(await f.handle({kind: 'daily-pick', movieId: 42}), {
        shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    });
    f.appState.currentState = 'active';
    assert.equal((await f.handle({movieId: 42})).shouldShowBanner, true);
});

test('master off and quiet hours suppress native notification banners and lists', async t => {
    t.mock.timers.enable({apis: ['Date'], now: new Date(2026, 8, 18, 23, 0).getTime()});
    const f = fixture();
    f.appState.currentState = 'background';
    f.setPreferences({...f.preferences(), notifications: false});
    assert.equal((await f.handle({kind: 'daily-pick', movieId: 42})).shouldShowBanner, false);
    f.setPreferences({notifications: true, notify: {...f.preferences().notify, quietHours: true, quietStartHour: 22, quietEndHour: 8}});
    const quiet = await f.handle({kind: 'daily-pick', movieId: 42});
    assert.equal(quiet.shouldShowBanner, false);
    assert.equal(quiet.shouldShowList, false);
});

test('notification handler tolerates native notifications without custom data', async () => {
    const f = fixture();
    assert.equal((await f.handle(undefined)).shouldShowBanner, true);
});

test('delivery forwards stable identifiers, silent content, dates, and Android channel', async () => {
    const f = fixture();
    const date = new Date(2026, 8, 19, 19);
    const content = {title: 'Tonight’s pick', body: 'Arrival', data: {kind: 'daily-pick', movieId: 42}};
    await f.options().delivery.schedule({identifier: 'yify-daily-pick:2026-09-19', date, content});
    assert.deepEqual(f.scheduled, [{
        identifier: 'yify-daily-pick:2026-09-19',
        content: {...content, sound: false},
        trigger: {type: 'date', date, channelId: 'movie-recommendations'},
    }]);
    assert.ok(f.calls.findIndex(call => call[0] === 'channel') < f.calls.findIndex(call => call[0] === 'schedule'));
    await f.options().delivery.cancel('yify-daily-pick:2026-09-19');
    assert.ok(f.calls.some(call => call[0] === 'cancel' && call[1] === 'yify-daily-pick:2026-09-19'));
    await f.options().delivery.schedule({identifier: 'yify-new-movies:42', content});
    assert.deepEqual(f.scheduled[1].trigger, {channelId: 'movie-recommendations'});
});

test('pending schedules include only current identifiers and legacy Yify alerts', async () => {
    const f = fixture();
    f.setPending([
        {identifier: 'yify-daily-pick:2026-09-19', content: {title: 'Tonight’s pick'}},
        {identifier: 'yify-new-movies:42', content: {title: 'New movie added'}},
        {identifier: 'legacy-single', content: {title: 'New movie added', data: {movieId: 42}}},
        {identifier: 'legacy-batch', content: {title: '4 new movies', data: {count: 4}}},
        {identifier: 'foreign', content: {title: 'Account notice', data: {movieId: 1}}},
        {identifier: 'missing-data', content: {title: 'New movie added'}},
        {identifier: 'invalid-data', content: {title: '3 new movies', data: {count: '3'}}},
        {identifier: 'foreign-prefix', content: {title: 'Your daily reminder', data: {}}},
    ]);
    assert.deepEqual(await f.options().delivery.pending(), [
        'yify-daily-pick:2026-09-19', 'yify-new-movies:42', 'legacy-single', 'legacy-batch',
    ]);
});

test('changing settings invalidates and reconciles schedules and master off unregisters background work', async () => {
    const f = fixture({registered: true});
    const original = f.preferences();
    f.service.publishNotificationSettings(original);
    await settle();
    assert.equal(f.calls.filter(call => call[0] === 'invalidate').length, 1);
    assert.equal(f.calls.filter(call => call[0] === 'refresh').length, 1);
    f.service.publishNotificationSettings({...original, notify: {...original.notify}});
    await settle();
    assert.equal(f.calls.filter(call => call[0] === 'invalidate').length, 1);
    f.setPreferences({...original, notify: {...original.notify, dailyHour: 9}});
    f.service.publishNotificationSettings(f.preferences());
    await settle();
    assert.equal(f.calls.filter(call => call[0] === 'invalidate').length, 2);
    f.setPreferences({...f.preferences(), notifications: false});
    f.service.publishNotificationSettings(f.preferences());
    await settle();
    assert.equal(f.calls.filter(call => call[0] === 'invalidate').length, 3);
    assert.equal(f.calls.filter(call => call[0] === 'refresh').length, 3);
    assert.deepEqual(f.calls.filter(call => call[0] === 'background.unregister'), [
        ['background.unregister', f.service.NEW_MOVIES_TASK],
    ]);
});

test('restricted background execution still permits local schedules and a single foreground listener', async () => {
    const f = fixture({restricted: true});
    f.onRefresh(async ({delivery}) => delivery.schedule({
        identifier: 'yify-daily-pick:2026-09-19',
        date: new Date(2026, 8, 19, 19),
        content: {title: 'Tonight’s pick', body: 'Arrival', data: {kind: 'daily-pick', movieId: 42}},
    }));
    await f.service.registerNewMoviesTask();
    await f.service.registerNewMoviesTask();
    assert.equal(f.listeners.size, 1);
    assert.equal(f.scheduled.length, 2);
    assert.equal(f.calls.some(call => call[0] === 'background.register'), false);
    assert.equal(f.calls.some(call => call[0] === 'permission.request'), false);
    f.foreground();
    await settle();
    assert.equal(f.scheduled.length, 3);
    assert.equal(f.calls.filter(call => call[0] === 'refresh' && call[1] === true).length, 3);
});
