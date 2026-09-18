const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {MovieNotificationCoordinator} = loadTypeScript('data/services/MovieNotificationCoordinator.ts');
const {DEFAULT_PREFERENCES, Quality, localNotificationDateKey} = loadTypeScript('domain/index.ts');

function movie(id) {
    return {
        id, imdbCode: `tt${id}`, title: `Movie ${id}`, titleLong: `Movie ${id}`, year: 2026,
        rating: 8, runtimeMinutes: 100, genres: ['Drama'], summary: '', language: 'en',
        mpaRating: 'PG', posterUrls: [],
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
}

function fixture(options = {}) {
    const values = new Map();
    const store = {
        getString: key => values.get(key),
        set: (key, value) => values.set(key, value),
        delete: key => values.delete(key),
    };
    const state = {
        preferences: {...DEFAULT_PREFERENCES, notify: {...DEFAULT_PREFERENCES.notify, quality: Quality.All, ...options.notify}},
        now: new Date(2026, 8, 18, 10),
        movies: Array.from({length: 16}, (_, i) => movie(i + 1)),
        watchlist: [],
        watched: new Set(),
        permission: true,
        pending: new Map(),
        scheduled: [],
        cancelled: [],
        fetches: [],
        events: [],
        fetch: null,
        schedule: null,
    };
    const delivery = {
        async hasPermission() {state.events.push('permission'); return state.permission;},
        async pending() {state.events.push('pending'); return [...state.pending.keys()];},
        async cancel(id) {state.events.push(`cancel:${id}`); state.cancelled.push(id); state.pending.delete(id);},
        async schedule(item) {
            state.events.push(`schedule:${item.identifier}`);
            if (state.schedule) await state.schedule(item);
            state.pending.set(item.identifier, item);
            state.scheduled.push(item);
        },
    };
    const coordinatorOptions = {
        store, delivery, preferences: () => state.preferences,
        fetchMovies: async quality => {
            state.events.push('fetch');
            state.fetches.push(quality);
            return state.fetch ? state.fetch(quality) : state.movies;
        },
        watchlist: () => state.watchlist,
        watched: () => ({isWatched: id => state.watched.has(id)}),
        now: () => state.now,
    };
    const coordinator = new MovieNotificationCoordinator(coordinatorOptions);
    return {state, store, values, coordinator, coordinatorOptions};
}

function setNotify(f, patch) {
    f.state.preferences = {...f.state.preferences, notify: {...f.state.preferences.notify, ...patch}};
    f.coordinator.invalidate();
}

async function seedLegacy(f) {
    f.state.movies = [movie(1)];
    assert.equal(await f.coordinator.check(), 0);
    f.state.movies = [movie(1), movie(2), movie(3)];
}

test('disabled notifications cancel all owned pending requests before permission or fetching', async () => {
    const f = fixture();
    f.state.preferences.notifications = false;
    f.state.permission = false;
    f.state.pending.set('yify-daily-pick:2026-09-18', {});
    f.state.pending.set('yify-new-movies:old', {});
    f.state.pending.set('legacy-owned-identifier', {});
    assert.equal(await f.coordinator.check(), 0);
    assert.equal(f.state.pending.size, 0);
    assert.equal(f.state.fetches.length, 0);
    assert.ok(!f.state.events.includes('permission'));
});

test('disabling during a fetch prevents scheduling and cancels the existing queue', async () => {
    const f = fixture();
    const started = deferred();
    const network = deferred();
    f.state.pending.set('yify-daily-pick:2026-09-19', {});
    f.state.fetch = () => {started.resolve(); return network.promise;};
    const checking = f.coordinator.check();
    await started.promise;
    f.state.preferences = {...f.state.preferences, notifications: false};
    f.coordinator.invalidate();
    network.resolve(f.state.movies);
    assert.equal(await checking, 0);
    assert.equal(f.state.pending.size, 0);
    assert.equal(f.state.scheduled.length, 0);
});

test('a preferences change during scheduling cancels the just-created request', async () => {
    const f = fixture();
    const started = deferred();
    const scheduling = deferred();
    f.state.schedule = () => {started.resolve(); return scheduling.promise;};
    const checking = f.coordinator.check();
    await started.promise;
    setNotify(f, {dailyHour: 20});
    scheduling.resolve();
    assert.equal(await checking, 0);
    assert.equal(f.state.scheduled.length, 1);
    assert.ok(f.state.cancelled.includes(f.state.scheduled[0].identifier));
    assert.equal(f.state.pending.size, 0);
});

test('daily checks schedule future picks only, cancel legacy requests and reconcile unchanged plans', async () => {
    const f = fixture();
    f.state.pending.set('yify-new-movies:old', {});
    assert.equal(await f.coordinator.check(), 7);
    assert.ok(f.state.cancelled.includes('yify-new-movies:old'));
    assert.ok(f.state.scheduled.every(item => item.identifier.startsWith('yify-daily-pick:') && item.date > f.state.now));
    const before = f.state.scheduled.length;
    assert.equal(await f.coordinator.check(), 0);
    assert.equal(await f.coordinator.refresh(), 0);
    assert.equal(f.state.scheduled.length, before);
    assert.equal(f.state.fetches.length, 1);
});

test('permission denial skips catalog work and daily scheduling', async () => {
    const f = fixture();
    f.state.permission = false;
    assert.equal(await f.coordinator.check(true), 0);
    assert.equal(f.state.fetches.length, 0);
    assert.equal(f.state.scheduled.length, 0);
});

test('legacy force checks still defer to the end of quiet hours', async () => {
    const f = fixture({notify: {dailyPicks: false, quietHours: true, quietStartHour: 22, quietEndHour: 8}});
    await seedLegacy(f);
    f.state.now = new Date(2026, 8, 18, 23, 15);
    assert.equal(await f.coordinator.check(true), 2);
    assert.equal(f.state.scheduled.length, 1);
    assert.equal(f.state.scheduled[0].date.getTime(), new Date(2026, 8, 19, 8).getTime());
});

test('legacy partial failure retains successful titles and retries only failed titles', async () => {
    const f = fixture({notify: {dailyPicks: false, perTitle: true}});
    await seedLegacy(f);
    let fail = true;
    f.state.schedule = item => {
        if (item.content.data.movieId === 3 && fail) throw new Error('delivery failed');
    };
    await assert.rejects(f.coordinator.check(true), /delivery failed/);
    assert.deepEqual(f.state.scheduled.map(item => item.content.data.movieId), [2]);
    assert.equal(f.store.getString('last-run-date'), undefined);
    assert.ok(!JSON.parse(f.store.getString('cached-ids')).includes(3));
    fail = false;
    assert.equal(await f.coordinator.check(), 1);
    assert.deepEqual(f.state.scheduled.map(item => item.content.data.movieId), [2, 3]);
    assert.equal(f.store.getString('last-run-date'), localNotificationDateKey(f.state.now));
});

test('daily partial failure retries its missing slot without rescheduling successful future picks', async () => {
    const f = fixture();
    let fail = true;
    f.state.schedule = item => {
        if (item.identifier.endsWith('2026-09-20') && fail) throw new Error('daily failed');
    };
    await assert.rejects(f.coordinator.check(), /daily failed/);
    assert.equal(f.state.pending.size, 6);
    const old = new Map(f.state.pending);
    fail = false;
    assert.equal(await f.coordinator.check(), 1);
    assert.equal(f.state.pending.size, 7);
    for (const [id, item] of old) assert.equal(f.state.pending.get(id), item);
});

test('concurrent checks serialize catalog and scheduling work without duplicate requests', async () => {
    const f = fixture();
    const gate = deferred();
    const started = deferred();
    f.state.fetch = () => {started.resolve(); return gate.promise;};
    const first = f.coordinator.check();
    const second = f.coordinator.check();
    await started.promise;
    gate.resolve(f.state.movies);
    assert.deepEqual(await Promise.all([first, second]), [7, 0]);
    assert.equal(f.state.fetches.length, 1);
    assert.equal(new Set(f.state.scheduled.map(item => item.identifier)).size, 7);
});

test('refreshing after an app visit cancels today and keeps later existing picks stable', async () => {
    const f = fixture();
    await f.coordinator.check();
    const today = `yify-daily-pick:${localNotificationDateKey(f.state.now)}`;
    const tomorrow = 'yify-daily-pick:2026-09-19';
    const retained = f.state.pending.get(tomorrow);
    const refresh = f.coordinator.refresh(true);
    assert.equal(f.store.getString('daily-last-active-date'), localNotificationDateKey(f.state.now));
    await refresh;
    assert.ok(!f.state.pending.has(today));
    assert.equal(f.state.pending.get(tomorrow), retained);
    assert.equal(await f.coordinator.refresh(true), 0);
    assert.equal(f.state.fetches.length, 1);
});

test('visited-day cancellation works with permission denied', async () => {
    const f = fixture();
    await f.coordinator.check();
    f.state.permission = false;
    await f.coordinator.refresh(true);
    assert.ok(!f.state.pending.has(`yify-daily-pick:${localNotificationDateKey(f.state.now)}`));
    assert.equal(f.state.fetches.length, 1);
});

test('watched picks are removed and replaced without counting their future cancellation as a recommendation', async () => {
    const f = fixture();
    await f.coordinator.check();
    const today = `yify-daily-pick:${localNotificationDateKey(f.state.now)}`;
    const first = f.state.pending.get(today).content.data.movieId;
    f.state.watched.add(first);
    f.coordinator.invalidate();
    await f.coordinator.refresh();
    assert.ok([...f.state.pending.values()].every(item => item.content.data.movieId !== first));
    const history = JSON.parse(f.store.getString('daily-pick-history'));
    assert.ok(history.every(item => item.movieId !== first));
    f.state.watched.delete(first);
    setNotify(f, {dailyHour: 20});
    await f.coordinator.refresh();
    assert.ok([...f.state.pending.values()].some(item => item.content.data.movieId === first));
});

test('elapsed picks become recent while unchanged future reservations remain stable', async () => {
    const f = fixture();
    await f.coordinator.check();
    const firstId = f.state.pending.get('yify-daily-pick:2026-09-18').content.data.movieId;
    const retained = f.state.pending.get('yify-daily-pick:2026-09-19');
    f.state.pending.delete('yify-daily-pick:2026-09-18');
    f.state.now = new Date(2026, 8, 19, 10);
    await f.coordinator.check();
    assert.equal(f.state.pending.get('yify-daily-pick:2026-09-19'), retained);
    assert.ok([...f.state.pending.values()].every(item => item.content.data.movieId !== firstId));
    const fresh = new MovieNotificationCoordinator(f.coordinatorOptions);
    assert.equal(await fresh.check(), 0);
    assert.ok([...f.state.pending.values()].every(item => item.content.data.movieId !== firstId));
});

test('offline daily refresh uses the persisted catalog and saved movies', async () => {
    const f = fixture();
    await f.coordinator.check();
    f.state.now = new Date(2026, 8, 18, 17);
    f.state.fetch = () => {throw new Error('offline');};
    f.state.watchlist = [movie(100)];
    setNotify(f, {dailyHour: 20});
    const fresh = new MovieNotificationCoordinator(f.coordinatorOptions);
    assert.equal(await fresh.refresh(), 7);
    assert.ok([...f.state.pending.values()].some(item => item.content.data.movieId === 100));
    assert.ok([...f.state.pending.values()].some(item => item.content.data.movieId < 100));
});

test('offline first run can schedule watchlist picks without marking a legacy catalog as seen', async () => {
    const f = fixture();
    f.state.fetch = () => {throw new Error('offline');};
    f.state.watchlist = [movie(100)];
    assert.equal(await f.coordinator.check(), 1);
    assert.equal(f.state.scheduled[0].content.data.movieId, 100);
    assert.equal(f.store.getString('cached-ids'), undefined);
});

test('catalog cache is separated by quality and refreshed after six hours', async () => {
    const f = fixture();
    await f.coordinator.check();
    setNotify(f, {minimumRating: 7});
    await f.coordinator.refresh();
    assert.deepEqual(f.state.fetches, [Quality.All]);
    setNotify(f, {quality: Quality.P1080});
    await f.coordinator.refresh();
    assert.deepEqual(f.state.fetches, [Quality.All, Quality.P1080]);
    f.state.now = new Date(2026, 8, 18, 16);
    await f.coordinator.check();
    assert.deepEqual(f.state.fetches, [Quality.All, Quality.P1080, Quality.P1080]);
});

test('switching to legacy cancels daily requests before fetching and seeds quietly', async () => {
    const f = fixture();
    await f.coordinator.check();
    setNotify(f, {dailyPicks: false});
    assert.equal(await f.coordinator.refresh(), 0);
    assert.equal(f.state.pending.size, 0);
    assert.equal(f.state.scheduled.length, 7);
    assert.equal(f.store.getString('last-run-date'), localNotificationDateKey(f.state.now));
});

test('turning notifications off cancels queued reminders while an older fetch is still unresolved', {timeout: 1000}, async () => {
    const f = fixture();
    const started = deferred();
    const network = deferred();
    const cancelled = deferred();
    f.state.pending.set('yify-daily-pick:2026-09-19', {});
    f.state.fetch = () => {started.resolve(); return network.promise;};
    const originalCancel = f.coordinatorOptions.delivery.cancel;
    f.coordinatorOptions.delivery.cancel = async id => {await originalCancel(id); cancelled.resolve();};
    const checking = f.coordinator.check();
    await started.promise;
    f.state.preferences = {...f.state.preferences, notifications: false};
    const refreshing = f.coordinator.refresh();
    await cancelled.promise;
    assert.equal(f.state.pending.size, 0, 'cancellation must not wait for the in-flight network response');
    network.resolve(f.state.movies);
    assert.deepEqual(await Promise.all([checking, refreshing]), [0, 0]);
    assert.equal(f.state.scheduled.length, 0);
});

test('permission revocation cancels future owned requests without fetching', async () => {
    const f = fixture();
    f.state.pending.set('yify-daily-pick:2026-09-19', {});
    f.state.pending.set('yify-new-movies:old', {});
    f.state.permission = false;
    assert.equal(await f.coordinator.check(), 0);
    assert.equal(f.state.pending.size, 0);
    assert.equal(f.state.fetches.length, 0);
    assert.equal(f.state.scheduled.length, 0);
});

test('a slow daily fetch that crosses the delivery hour cannot schedule the now-past slot', async () => {
    const f = fixture();
    f.state.now = new Date(2026, 8, 18, 18, 59);
    f.state.fetch = async () => {
        f.state.now = new Date(2026, 8, 18, 19, 1);
        return f.state.movies;
    };
    assert.equal(await f.coordinator.check(), 7);
    assert.ok(f.state.scheduled.every(item => item.date > f.state.now));
    assert.ok(!f.state.pending.has('yify-daily-pick:2026-09-18'));
});

test('a slow legacy fetch uses the current quiet period and current local run date', async () => {
    const f = fixture({notify: {dailyPicks: false, quietHours: true, quietStartHour: 22, quietEndHour: 8}});
    await seedLegacy(f);
    f.state.now = new Date(2026, 8, 18, 21, 59);
    f.state.fetch = async () => {
        f.state.now = new Date(2026, 8, 19, 0, 1);
        return f.state.movies;
    };
    assert.equal(await f.coordinator.check(true), 2);
    assert.equal(f.state.scheduled[0].date.getTime(), new Date(2026, 8, 19, 8).getTime());
    assert.equal(f.store.getString('last-run-date'), '2026-09-19');
});

test('visiting today cancels its pending reminder before an older fetch completes', {timeout: 1000}, async () => {
    const f = fixture();
    await f.coordinator.check();
    const today = `yify-daily-pick:${localNotificationDateKey(f.state.now)}`;
    const started = deferred();
    const network = deferred();
    const cancelled = deferred();
    f.state.fetch = () => {started.resolve(); return network.promise;};
    const originalCancel = f.coordinatorOptions.delivery.cancel;
    f.coordinatorOptions.delivery.cancel = async id => {
        await originalCancel(id);
        if (id === today) cancelled.resolve();
    };
    const checking = f.coordinator.check(true);
    await started.promise;
    const refreshing = f.coordinator.refresh(true);
    await cancelled.promise;
    assert.ok(!f.state.pending.has(today));
    network.resolve(f.state.movies);
    await Promise.all([checking, refreshing]);
    assert.ok(!f.state.pending.has(today));
});

test('a changed preference snapshot stops obsolete work even without explicit invalidation', async () => {
    const f = fixture();
    const started = deferred();
    const network = deferred();
    f.state.fetch = () => {started.resolve(); return network.promise;};
    const checking = f.coordinator.check();
    await started.promise;
    f.state.preferences = {...f.state.preferences, notify: {...f.state.preferences.notify, quality: Quality.P1080}};
    network.resolve(f.state.movies);
    assert.equal(await checking, 0);
    assert.equal(f.state.scheduled.length, 0);
    f.state.fetch = null;
    assert.equal(await f.coordinator.check(), 7);
    assert.deepEqual(f.state.fetches, [Quality.All, Quality.P1080]);
});

test('recent delivery history expires after thirty days so a small catalog is not exhausted forever', async () => {
    const f = fixture();
    f.state.movies = [movie(1)];
    assert.equal(await f.coordinator.check(), 1);
    f.state.pending.clear();
    f.state.now = new Date(2026, 8, 19, 10);
    assert.equal(await f.coordinator.check(), 0);
    f.state.now = new Date(2026, 9, 20, 10);
    assert.equal(await f.coordinator.check(), 1);
    assert.equal(f.state.scheduled.at(-1).content.data.movieId, 1);
});

test('an off-cancellation failure does not block other cancellations and remains retryable', async () => {
    const f = fixture();
    f.state.preferences.notifications = false;
    f.state.pending.set('yify-daily-pick:2026-09-19', {});
    f.state.pending.set('yify-new-movies:old', {});
    const originalCancel = f.coordinatorOptions.delivery.cancel;
    let fail = true;
    f.coordinatorOptions.delivery.cancel = async id => {
        if (fail && id.startsWith('yify-daily-pick:')) throw new Error('cancel failed');
        await originalCancel(id);
    };
    await assert.rejects(f.coordinator.check(), /cancel failed/);
    assert.ok(f.state.pending.has('yify-daily-pick:2026-09-19'));
    assert.ok(!f.state.pending.has('yify-new-movies:old'));
    fail = false;
    assert.equal(await f.coordinator.check(), 0);
    assert.equal(f.state.pending.size, 0);
    assert.equal(f.state.fetches.length, 0);
});
