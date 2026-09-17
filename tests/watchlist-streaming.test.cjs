const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
const flush = () => new Promise(setImmediate);
const movies = count => Array.from({length: count}, (_, index) => ({id: index + 1, imdbCode: `tt${10000 + index}`, title: `Movie ${index + 1}`}));
const offer = (selectionId, type = 'subscription', name = selectionId) => ({selectionId, serviceId: selectionId.split(':')[0], serviceName: name,
    type, url: `https://example.com/title`, ...(type === 'addon' ? {addonName: 'Extra channel'} : {})});
const result = (country, offers = []) => ({country, status: 'ready', offers, checkedAt: Date.now()});

async function fixture(t, options = {}) {
    const listeners = new Set();
    let preferences = {watchRegion: 'US', streamingServices: {US: ['netflix']}, ...options.preferences};
    const cache = new Map();
    const calls = [];
    const repository = {
        getCatalog: async () => {throw new Error('Watchlist must not load the catalog');},
        getCachedAvailability: (id, country) => cache.get(`${id}:${country}`) ?? null,
        getAvailability: async (id, country) => {calls.push({id, country}); return options.lookup ? options.lookup(id, country) : result(country, [offer('netflix')]);},
    };
    for (const [id, value] of Object.entries(options.cache ?? {})) cache.set(`${id}:${value.country}`, value);
    const {useWatchlistStreaming} = loadTypeScript('presentation/movies/useWatchlistStreaming.ts', {
        '../di/DependenciesContext': {useStreamingRepository: () => repository},
        '../hooks/use-preferences': {usePreferences: () => React.useSyncExternalStore(
            listener => {listeners.add(listener); return () => listeners.delete(listener);}, () => preferences)},
        './components/watchRegion': {deviceRegion: () => 'US'},
    });
    let current;
    const Probe = ({items}) => {current = useWatchlistStreaming(items); return null;};
    let renderer;
    await act(async () => {renderer = create(React.createElement(Probe, {items: options.movies ?? movies(3)}));});
    let unmounted = false;
    const unmount = async () => {if (!unmounted) {unmounted = true; await act(async () => renderer.unmount());}};
    t.after(unmount);
    return {calls, cache, get: () => current, unmount,
        preferences: async update => {await act(async () => {preferences = {...preferences, ...update}; listeners.forEach(listener => listener());});},
        movies: async items => {await act(async () => renderer.update(React.createElement(Probe, {items})));},
    };
}

test('watchlist mounting, filtering and scrolling-sized list changes do not issue availability requests', async t => {
    const f = await fixture(t, {cache: {tt10000: result('US', [offer('netflix')])}});
    assert.equal(f.get().checkedCount, 1);
    assert.equal(f.get().visible.length, 3);
    await act(async () => f.get().setOnlySelected(true));
    assert.deepEqual(f.get().visible.map(movie => movie.id), [1]);
    assert.equal(f.get().uncheckedCount, 2);
    await f.movies(movies(40));
    assert.equal(f.calls.length, 0);
});

test('availability checks cap each batch at twenty titles and two simultaneous requests', async t => {
    const first = deferred();
    let active = 0;
    let peak = 0;
    const f = await fixture(t, {movies: movies(45), lookup: async (_id, country) => {
        active += 1; peak = Math.max(peak, active);
        await first.promise;
        active -= 1;
        return result(country, [offer('netflix')]);
    }});
    let checking;
    await act(async () => {checking = f.get().checkNext(); await flush();});
    assert.equal(f.calls.length, 2);
    assert.equal(f.get().busy, true);
    await act(async () => {first.resolve(); await checking;});
    assert.equal(peak, 2);
    assert.equal(f.calls.length, 20);
    assert.equal(f.get().checkedCount, 20);
    assert.equal(f.get().uncheckedCount, 25);
    assert.equal(f.get().nextCount, 20);
    await act(async () => f.get().checkNext());
    assert.equal(f.calls.length, 40);
    assert.equal(f.get().nextCount, 5);
});

test('service changes reuse availability and distinguish channel subscriptions from rentals', async t => {
    const f = await fixture(t, {cache: {
        tt10000: result('US', [offer('prime:hbo', 'addon', 'Prime Video')]),
        tt10001: result('US', [offer('prime', 'rent', 'Prime Video')]),
        tt10002: result('US', [offer('prime', 'subscription', 'Prime Video')]),
    }, preferences: {streamingServices: {US: ['prime']}}});
    await act(async () => f.get().setOnlySelected(true));
    assert.deepEqual(f.get().visible.map(movie => movie.id), [3]);
    await f.preferences({streamingServices: {US: ['prime:hbo']}});
    assert.deepEqual(f.get().visible.map(movie => movie.id), [1]);
    await f.preferences({streamingServices: {US: []}});
    assert.equal(f.get().filterActive, false);
    assert.equal(f.get().visible.length, 3);
    assert.equal(f.calls.length, 0);
});

test('changing country hides old matches and cancels queued work while ignoring late responses', async t => {
    const delayed = deferred();
    const f = await fixture(t, {movies: movies(25), lookup: async (_id, country) => country === 'US' ? delayed.promise : result(country, [offer('bbc')]),
        preferences: {streamingServices: {US: ['netflix'], GB: ['bbc']}},
        cache: {tt10024: result('US', [offer('netflix')])}});
    await act(async () => f.get().setOnlySelected(true));
    assert.deepEqual(f.get().visible.map(movie => movie.id), [25]);
    let checking;
    await act(async () => {checking = f.get().checkNext(); await flush();});
    await f.preferences({watchRegion: 'GB'});
    assert.equal(f.get().visible.length, 0);
    assert.equal(f.get().checkedCount, 0);
    assert.equal(f.get().busy, false);
    await act(async () => {delayed.resolve(result('US', [offer('netflix')])); await checking;});
    assert.equal(f.calls.length, 2);
    assert.equal(f.get().checkedCount, 0);
    await act(async () => f.get().checkNext());
    assert.equal(f.get().checkedCount, 20);
    assert.ok(f.get().visible.every(movie => movie.id <= 20));
});

test('returning to a country with an interrupted batch allows a new check', async t => {
    const delayed = deferred();
    const f = await fixture(t, {lookup: async () => delayed.promise});
    let checking;
    await act(async () => {checking = f.get().checkNext(); await flush();});
    await f.preferences({watchRegion: 'GB'});
    await f.preferences({watchRegion: 'US'});
    assert.equal(f.get().busy, false);
    await act(async () => {delayed.resolve(result('US')); await checking;});
    await act(async () => f.get().checkNext());
    assert.equal(f.get().checkedCount, 3);
});

test('failed lookups stay retryable and unchecked titles are processed before retrying failures', async t => {
    let fail = true;
    const f = await fixture(t, {movies: movies(21), lookup: async (_id, country) => {
        if (fail) throw new Error('offline');
        return result(country, [offer('netflix')]);
    }});
    await act(async () => f.get().checkNext());
    assert.equal(f.get().failedCount, 20);
    assert.equal(f.get().checkedCount, 0);
    assert.equal(f.get().visible.length, 21);
    fail = false;
    await act(async () => f.get().checkNext());
    assert.equal(f.calls[20].id, 'tt10020');
    assert.equal(f.get().nextCount, 20);
    await act(async () => f.get().checkNext());
    assert.equal(f.get().checkedCount, 21);
    assert.equal(f.get().failedCount, 0);
});

test('unmounting ends queued work without making additional requests', async t => {
    const delayed = deferred();
    const f = await fixture(t, {movies: movies(30), lookup: () => delayed.promise});
    let checking;
    await act(async () => {checking = f.get().checkNext(); await flush();});
    await f.unmount();
    delayed.resolve(result('US'));
    await checking;
    assert.equal(f.calls.length, 2);
});

test('cached responses for another country and old in-memory results never count as current matches', async t => {
    const f = await fixture(t, {lookup: async () => result('GB', [offer('netflix')]),
        cache: {tt10001: {...result('US', [offer('netflix')]), checkedAt: Date.now() - 86_400_001}}});
    assert.equal(f.get().checkedCount, 0);
    await act(async () => f.get().checkNext());
    assert.equal(f.get().checkedCount, 0);
    assert.equal(f.get().failedCount, 3);
});

test('unsupported country results stop the batch and explain coverage instead of claiming no matches', async t => {
    const f = await fixture(t, {movies: movies(40), lookup: async (_id, country) => ({country, status: 'unsupported-country', offers: []})});
    await act(async () => f.get().checkNext());
    assert.equal(f.calls.length, 2);
    assert.equal(f.get().unsupportedCountry, true);
    assert.equal(f.get().uncheckedCount, 0);
    assert.equal(f.get().nextCount, 0);
    assert.equal(f.get().visible.length, 40);
});

test('badges distinguish unchecked, unavailable, unsupported and selected channel offers', async t => {
    const {WatchlistStreamingBadge} = loadTypeScript('presentation/movies/components/WatchlistStreamingBadge.tsx', {
        'react-native': {StyleSheet: {create: value => value}, Platform: {select: values => values.default}},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        './moviePosterLayout': {POSTER_GAP: 16},
    });
    let renderer;
    const draw = async availability => {await act(async () => {
        const element = React.createElement(WatchlistStreamingBadge, {country: 'US', services: ['prime:hbo'], validId: true, availability});
        if (renderer) renderer.update(element); else renderer = create(element);
    }); return renderer.root.findByType('Text').children.join('');};
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.equal(await draw(undefined), 'Not checked');
    assert.equal(await draw({country: 'US', status: 'unavailable', offers: []}), 'Couldn’t check availability');
    assert.equal(await draw({country: 'US', status: 'unsupported-country', offers: []}), 'Country not covered');
    assert.equal(await draw(result('US', [offer('prime:hbo', 'addon', 'Prime Video')])), 'On Prime Video · Extra channel');
    assert.equal(await draw(result('US', [offer('prime', 'rent', 'Prime Video')])), 'Not listed on your services');
});
