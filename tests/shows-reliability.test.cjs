const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};
const dependencies = {
    '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: () => noop})},
    '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess: noop},
};
const {useShowsViewModel} = loadTypeScript('presentation/movies/useShowsViewModel.ts', dependencies);
const episode = (id, season = 1) => ({
    id, title: `Episode ${id}`, season, episode: 1, seeds: 3, peers: 1,
    sizeBytes: 1_000_000, magnetUrl: '', releasedAt: new Date(),
});
const show = id => ({imdbId: String(id), imdbCode: `tt${id}`, title: `Series ${id}`, latestEpisode: episode(id)});
const result = (id, hasMore = false) => ({shows: id == null ? [] : [show(id)], hasMore, pageNumber: 1});
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};

async function mountHook(t, repository, artwork) {
    let current;
    let renderer;
    function Hook() {
        current = useShowsViewModel(repository, artwork);
        return null;
    }
    await act(async () => { renderer = create(React.createElement(Hook)); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {
        get value() { return current; },
        run: async action => { await act(async () => action(current)); },
        replace: async (nextRepository, nextArtwork = artwork) => {
            repository = nextRepository;
            artwork = nextArtwork;
            await act(async () => renderer.update(React.createElement(Hook)));
        },
        unmount: async () => { await act(async () => renderer.unmount()); },
    };
}

test('series failures, retry loading, and successful empty responses have distinct states', async t => {
    let fail = true;
    const pending = deferred();
    const hook = await mountHook(t, {
        async listShows() {
            if (fail) throw new Error('offline');
            return pending.promise;
        },
    });
    assert.equal(hook.value.status, 'unavailable');
    fail = false;
    await hook.run(model => model.reload());
    assert.equal(hook.value.status, 'loading');
    await act(async () => pending.resolve(result(null)));
    assert.equal(hook.value.status, 'empty');
    assert.equal(hook.value.refreshing, false);
});

test('failed pagination retains series and retries the missing page', async t => {
    const pages = [];
    let fail = true;
    const hook = await mountHook(t, {
        async listShows({page}) {
            pages.push(page);
            if (page === 2 && fail) throw new Error('offline');
            return result(page, page === 1);
        },
    });
    await hook.run(model => model.loadMore());
    assert.deepEqual(hook.value.shows.map(item => item.imdbId), ['1']);
    assert.equal(hook.value.error, 'more');
    assert.equal(hook.value.status, 'ready');
    assert.equal(hook.value.hasMore, true);
    fail = false;
    await hook.run(model => model.loadMore());
    assert.deepEqual(pages, [1, 2, 2]);
    assert.deepEqual(hook.value.shows.map(item => item.imdbId), ['1', '2']);
    assert.equal(hook.value.error, null);
});

test('failed refresh retains the existing list and can recover', async t => {
    let fail = false;
    const hook = await mountHook(t, {
        async listShows() {
            if (fail) throw new Error('offline');
            return result(1);
        },
    });
    fail = true;
    await hook.run(model => model.reload());
    assert.equal(hook.value.status, 'ready');
    assert.equal(hook.value.error, 'refresh');
    assert.equal(hook.value.shows[0].title, 'Series 1');
    fail = false;
    await hook.run(model => model.reload());
    assert.equal(hook.value.error, null);
});

test('a refresh supersedes an older response without clearing its loading state', async t => {
    const old = deferred();
    const latest = deferred();
    let calls = 0;
    const hook = await mountHook(t, {listShows: () => ++calls === 1 ? old.promise : latest.promise});
    await hook.run(model => model.reload());
    await act(async () => old.resolve(result(1, true)));
    assert.equal(hook.value.status, 'loading');
    assert.equal(hook.value.refreshing, true);
    await act(async () => latest.resolve(result(2)));
    assert.deepEqual(hook.value.shows.map(item => item.imdbId), ['2']);
});

test('artwork errors do not hide results or prevent later artwork lookups', async t => {
    const calls = [];
    const hook = await mountHook(t, {
        async listShows() { return {shows: [show(1), show(2)], hasMore: false}; },
    }, {
        async findByImdbCode(code) {
            calls.push(code);
            if (code === 'tt1') throw new Error('artwork offline');
            return {title: 'Decorated series', posterUrl: 'https://example.com/poster.jpg'};
        },
    });
    assert.equal(hook.value.status, 'ready');
    assert.deepEqual(calls, ['tt1', 'tt2']);
    assert.equal(hook.value.shows[0].title, 'Series 1');
    assert.equal(hook.value.shows[1].title, 'Decorated series');
});

test('unmounting cancels further empty-page requests', async t => {
    const pending = deferred();
    let requests = 0;
    const hook = await mountHook(t, {listShows: () => { requests += 1; return pending.promise; }});
    await hook.unmount();
    await act(async () => pending.resolve(result(null, true)));
    assert.equal(requests, 1);
});

test('replacing the series repository resets the visible feed before the replacement responds', async t => {
    const hook = await mountHook(t, {async listShows() { return result(1); }});
    assert.equal(hook.value.status, 'ready');
    assert.equal(hook.value.hasMore, false);
    const replacement = deferred();
    await hook.replace({listShows: () => replacement.promise});
    assert.deepEqual(hook.value.shows, []);
    assert.equal(hook.value.status, 'loading');
    assert.equal(hook.value.hasMore, true);
    assert.equal(hook.value.error, null);
    await act(async () => replacement.resolve(result(2)));
    assert.deepEqual(hook.value.shows.map(item => item.imdbId), ['2']);
    assert.equal(hook.value.status, 'ready');
});

const nativeMocks = {
    ...dependencies,
    'react-native': {
        ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', View: 'View',
        StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1},
        Platform: {OS: 'web', select: value => value.web ?? value.default},
    },
    '@expo/vector-icons/Ionicons': 'Icon',
    'expo-image': {Image: 'Image'},
    'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
    'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
    '@/domain': {showHistoryEntry: noop},
    '../components/motion': {PressableScale: 'PressableScale', enterFade: noop, enterRise: noop},
    '../components/linear-gradient': {LinearGradient: 'LinearGradient'},
    '../components/screen': {Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays)},
    '../components/themed-text': {ThemedText: 'Text'},
    '../hooks/use-palette': {usePalette: () => ({colors: new Proxy({}, {get: () => '#123456'})})},
    '../hooks/use-preferences': {usePreferences: () => ({historyPaused: true})},
    '../hooks/use-responsive': {useResponsive: () => ({width: 1000, gutter: 24, contentMaxWidth: 1000})},
    './useWatchHistory': {useRecordHistory: () => noop},
    './components/TorrentNoticeSheet': {TorrentNoticeSheet: 'TorrentNoticeSheet'},
    './components/WatchProviders': {WatchProviders: 'WatchProviders'},
};
const {ShowDetailsScreen} = loadTypeScript('presentation/movies/ShowDetailsScreen.tsx', nativeMocks);
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const hasText = (renderer, expected) => renderer.root.findAllByType('Text').some(node => nodeText(node) === expected);

async function mountDetails(t, props) {
    let renderer;
    await act(async () => { renderer = create(React.createElement(ShowDetailsScreen, props)); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return renderer;
}

test('episode failures show a retry instead of a successful empty result', async t => {
    let fail = true;
    const renderer = await mountDetails(t, {
        imdbId: '1',
        shows: {
            async listShows() { return result(1); },
            async listEpisodes() { if (fail) throw new Error('offline'); return []; },
        },
        artwork: {async findByImdbCode() { return null; }},
    });
    assert.ok(hasText(renderer, 'Episode releases couldn’t load'));
    assert.equal(hasText(renderer, 'No episode releases are listed for this series.'), false);
    fail = false;
    const retry = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'Retry episode releases');
    await act(async () => retry.props.onPress());
    assert.ok(hasText(renderer, 'No episode releases are listed for this series.'));
});

test('episodes remain available when series information and artwork fail', async t => {
    const renderer = await mountDetails(t, {
        imdbId: '1',
        shows: {
            async listShows() { throw new Error('offline'); },
            async listEpisodes() { return [episode(1)]; },
        },
        artwork: {async findByImdbCode() { throw new Error('artwork offline'); }},
    });
    assert.ok(hasText(renderer, 'Episode 1'));
    assert.ok(hasText(renderer, 'Series information couldn’t load.'));
});

test('changing series clears old data and ignores late catalog and artwork responses', async t => {
    const oldEpisodes = deferred();
    const oldArtwork = deferred();
    const nextEpisodes = deferred();
    const nextShow = deferred();
    const props = {
        imdbId: '1',
        shows: {
            listShows: ({imdbId}) => imdbId === '1' ? Promise.resolve(result(1)) : nextShow.promise,
            listEpisodes: imdbId => imdbId === '1' ? oldEpisodes.promise : nextEpisodes.promise,
        },
        artwork: {findByImdbCode: code => code === 'tt0000001' ? oldArtwork.promise : Promise.resolve(null)},
    };
    const renderer = await mountDetails(t, props);
    assert.ok(hasText(renderer, 'Series 1'));
    await act(async () => renderer.update(React.createElement(ShowDetailsScreen, {...props, imdbId: '2'})));
    assert.equal(hasText(renderer, 'Series 1'), false);
    assert.ok(hasText(renderer, 'Loading episode releases…'));
    await act(async () => {
        nextShow.resolve(result(2));
        nextEpisodes.resolve([episode(2, 5)]);
        oldEpisodes.resolve([episode(1)]);
        oldArtwork.resolve({title: 'Old artwork title', posterUrl: 'https://example.com/old.jpg'});
    });
    assert.ok(hasText(renderer, 'Series 2'));
    assert.ok(hasText(renderer, 'Episode 2'));
    assert.equal(hasText(renderer, 'Episode 1'), false);
    assert.equal(hasText(renderer, 'Old artwork title'), false);
});

test('season expansion and the episode notice reset when retrying details', async t => {
    let retrying = false;
    const pending = deferred();
    const episodes = [episode(1, 1), episode(2, 2)];
    const renderer = await mountDetails(t, {
        imdbId: '1',
        shows: {
            async listShows() { if (!retrying) throw new Error('offline'); return result(1); },
            listEpisodes: () => retrying ? pending.promise : Promise.resolve(episodes),
        },
        artwork: {async findByImdbCode() { return null; }},
    });
    assert.ok(hasText(renderer, 'Episode 2'));
    assert.equal(hasText(renderer, 'Episode 1'), false);
    const episodeRow = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'S02E01 Episode 2');
    await act(async () => episodeRow.props.onPress());
    assert.ok(renderer.root.findByType('TorrentNoticeSheet').props.torrent);
    const seasonButton = number => renderer.root.findAllByType('PressableScale').find(node => nodeText(node).startsWith(`Season ${number}`));
    await act(async () => seasonButton(2).props.onPress());
    assert.equal(hasText(renderer, 'Episode 2'), false);
    await act(async () => seasonButton(1).props.onPress());
    assert.ok(hasText(renderer, 'Episode 1'));
    retrying = true;
    const retry = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'Retry series information');
    await act(async () => retry.props.onPress());
    assert.equal(renderer.root.findByType('TorrentNoticeSheet').props.torrent, null);
    assert.equal(hasText(renderer, 'Episode 1'), false);
    assert.ok(hasText(renderer, 'Loading episode releases…'));
    await act(async () => pending.resolve(episodes));
    assert.ok(hasText(renderer, 'Episode 2'));
    assert.equal(hasText(renderer, 'Episode 1'), false);
});

test('replacing detail sources for the same series hides earlier data until new responses arrive', async t => {
    const renderer = await mountDetails(t, {
        imdbId: '1',
        shows: {async listShows() { return result(1); }, async listEpisodes() { return [episode(1)]; }},
        artwork: {async findByImdbCode() { return {title: 'Previous title'}; }},
    });
    assert.ok(hasText(renderer, 'Previous title'));
    const nextShow = deferred();
    const nextEpisodes = deferred();
    await act(async () => renderer.update(React.createElement(ShowDetailsScreen, {
        imdbId: '1',
        shows: {listShows: () => nextShow.promise, listEpisodes: () => nextEpisodes.promise},
        artwork: {async findByImdbCode() { return null; }},
    })));
    assert.equal(hasText(renderer, 'Previous title'), false);
    assert.equal(hasText(renderer, 'Episode 1'), false);
    assert.ok(hasText(renderer, 'Loading episode releases…'));
    await act(async () => {nextShow.resolve(result(1)); nextEpisodes.resolve([episode(2)]);});
    assert.ok(hasText(renderer, 'Series 1'));
    assert.ok(hasText(renderer, 'Episode 2'));
});

const {ShowsScreen} = loadTypeScript('presentation/movies/ShowsScreen.tsx', {
    ...nativeMocks,
    'react-native': {...nativeMocks['react-native'], FlatList: 'FlatList', RefreshControl: 'RefreshControl'},
    './components/ScrollProgress': {ScrollProgress: 'ScrollProgress'},
    './components/PosterSkeleton': {SkeletonBlock: 'SkeletonBlock'},
    './components/TopBar': {useTopBarHeight: () => 60},
    './components/TopBarSlot': {TopBarSlot: 'TopBarSlot'},
    './constants/destinations': {useGoTo: () => noop},
});

for (const [status, heading] of [['unavailable', 'Shows couldn’t load'], ['empty', 'No series listed yet']]) {
    test(`${status} series screen gives an accurate message and a working retry`, async t => {
        let retries = 0;
        let renderer;
        await act(async () => {
            renderer = create(React.createElement(ShowsScreen, {viewModel: {
                shows: [], status, refreshing: false, loadingMore: false, hasMore: false,
                error: null, loadMore: noop, reload: () => { retries += 1; },
            }}));
        });
        t.after(async () => { await act(async () => renderer.unmount()); });
        assert.ok(hasText(renderer, heading));
        assert.equal(hasText(renderer, 'COMING SOON'), false);
        const retry = renderer.root.findAllByType('PressableScale').find(node => node.props.accessibilityLabel === 'Retry series loading');
        await act(async () => retry.props.onPress());
        assert.equal(retries, 1);
    });
}
