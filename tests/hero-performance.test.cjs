const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {useHomeScrollVisibility} = loadTypeScript('presentation/movies/useHomeScrollVisibility.ts');

function animatedValue() {
    let nextId = 0;
    const listeners = new Map();
    const removed = [];
    return {
        listeners,
        removed,
        addListener(listener) {
            const id = String(++nextId);
            listeners.set(id, listener);
            return id;
        },
        removeListener(id) {
            removed.push(id);
            listeners.delete(id);
        },
        emit(value) {
            for (const listener of listeners.values()) listener({value});
        },
    };
}

async function mountVisibility(t, scrollY, heroHeight) {
    let value;
    let renders = 0;
    let renderer;
    function Probe(props) {
        renders++;
        value = useHomeScrollVisibility(props.scrollY, props.heroHeight);
        return null;
    }
    await act(async () => { renderer = create(React.createElement(Probe, {scrollY, heroHeight})); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {
        get value() { return value; },
        get renders() { return renders; },
        emit: async (offset) => { await act(async () => scrollY.emit(offset)); },
        resize: async (height) => {
            await act(async () => renderer.update(React.createElement(Probe, {scrollY, heroHeight: height})));
        },
        unmount: async () => { await act(async () => renderer.unmount()); },
    };
}

function appStateFixture(initial = 'active') {
    const listeners = new Set();
    return {
        currentState: initial,
        listeners,
        addEventListener(event, listener) {
            assert.equal(event, 'change');
            listeners.add(listener);
            return {remove: () => listeners.delete(listener)};
        },
        emit(state) {
            this.currentState = state;
            for (const listener of listeners) listener(state);
        },
    };
}

function timerFixture(t) {
    let nextId = 0;
    let now = 0;
    const pending = new Map();
    t.mock.method(global, 'setTimeout', (callback, delay = 0, ...args) => {
        const id = ++nextId;
        pending.set(id, {callback: () => callback(...args), delay, at: now + delay});
        return id;
    });
    t.mock.method(global, 'clearTimeout', (id) => pending.delete(id));
    return {
        get size() { return pending.size; },
        get delays() { return [...pending.values()].map((timer) => timer.delay).sort((a, b) => a - b); },
        async fireDelay(delay) {
            const entry = [...pending.entries()].find(([, timer]) => timer.delay === delay);
            assert.ok(entry, `expected a pending ${delay} ms timer`);
            pending.delete(entry[0]);
            await act(async () => entry[1].callback());
        },
        async advance(ms) {
            const end = now + ms;
            let fired = 0;
            while (true) {
                const entry = [...pending.entries()].filter(([, timer]) => timer.at <= end)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!entry) break;
                assert.ok(++fired < 1000, 'timer scheduler did not settle');
                now = entry[1].at;
                pending.delete(entry[0]);
                await act(async () => entry[1].callback());
            }
            now = end;
        },
    };
}

function movie(id) {
    return {
        id, title: `Movie ${id}`, year: 2026, rating: 8, runtimeMinutes: 120,
        genres: ['Drama'], posterUrls: [`https://images.invalid/${id}.jpg`],
        ytTrailerCode: `trailer-${id}`, summary: '', mpaRating: 'PG',
    };
}

async function mountHero(t, {visible = true, focused = true, foreground = 'active'} = {}) {
    const timers = timerFixture(t);
    const appState = appStateFixture(foreground);
    const Focus = React.createContext(true);
    const events = [];
    const requests = [];
    const scrolls = [];
    const video = {mounts: 0, unmounts: 0};
    const palette = {colors: {}, gradients: {accent: ['red', 'orange']}};
    const preferences = {playback: {autoplayTrailers: true, trailerCaptions: false}};
    const {HeroBillboard} = loadTypeScript('presentation/movies/components/HeroBillboard.tsx', {
        '@expo/vector-icons/Ionicons': 'Icon',
        'expo-image': {Image: 'Image'},
        'expo-router': {
            useIsFocused: () => React.useContext(Focus),
            router: {push: () => assert.fail('test must not navigate')},
        },
        'react-native': {
            View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', AppState: appState,
            StyleSheet: {create: (styles) => styles, absoluteFill: {}, hairlineWidth: 1},
        },
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
        '../../components/motion': {
            Duration: {base: 0}, PressableScale: 'PressableScale',
            enterFade: () => undefined, enterPop: () => undefined, enterRise: () => undefined,
        },
        '../../constants/theme': {FontFamily: {}, Radius: {}, Spacing: {xl: 16, xxl: 24, sm: 4}},
        '../../hooks/use-palette': {usePalette: () => palette},
        '../../hooks/use-preferences': {usePreferences: () => preferences},
        '../../hooks/use-responsive': {useResponsive: () => ({isDesktop: false})},
        '../../hooks/use-reduce-motion': {useReduceMotion: () => false},
        '../../components/linear-gradient': {LinearGradient: 'LinearGradient'},
        '../../components/themed-text': {ThemedText: 'Text'},
        '@/presentation/analytics/events': {
            Analytics: new Proxy({}, {get: (_target, name) => (...args) => events.push({name, args})}),
        },
        '../useWatchlist': {useIsInWatchlist: () => false, useToggleWatchlist: () => () => false},
        './TopTenContext': {useTopTenRank: () => null},
        './Thumbnail': {Thumbnail: 'Thumbnail'},
        './format': {thumbFor: (item) => item.posterUrls[0], thumbPlaceholder: () => null},
        './YoutubePlayer': {
            YoutubePlayer(props) {
                React.useEffect(() => {
                    video.mounts++;
                    return () => { video.unmounts++; };
                }, []);
                return React.createElement('YoutubePlayer', props);
            },
        },
    });
    let props = {
        visible, movies: [movie(1), movie(2)], width: 400, height: 500,
        onRequestTrailer: (id) => requests.push(id),
    };
    let renderer;
    const element = () => React.createElement(Focus.Provider, {value: focused}, React.createElement(HeroBillboard, props));
    await act(async () => {
        renderer = create(element(), {createNodeMock: (node) =>
            node.type === 'ScrollView' ? {scrollTo: (options) => scrolls.push(options)} : null,
        });
    });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {
        timers, appState, events, requests, scrolls, video,
        get players() { return renderer.root.findAllByType('YoutubePlayer'); },
        get layers() { return renderer.root.findAll((node) => node.type.name === 'HeroTrailerLayer'); },
        async update(next) {
            props = {...props, ...next};
            await act(async () => renderer.update(element()));
        },
        async focus(next) {
            focused = next;
            await act(async () => renderer.update(element()));
        },
        async state(next) { await act(async () => appState.emit(next)); },
        async scroll(x) {
            await act(async () => renderer.root.findAllByType('ScrollView')[0].props.onScroll({
                nativeEvent: {contentOffset: {x}},
            }));
        },
        async unmount() { await act(async () => renderer.unmount()); },
    };
}

test('home scroll changes React state only when top or hero visibility thresholds cross', async (t) => {
    const scrollY = animatedValue();
    const hook = await mountVisibility(t, scrollY, 400);
    assert.deepEqual(hook.value, {atTop: true, heroVisible: true});
    const initial = hook.renders;
    await hook.emit(8);
    assert.equal(hook.renders, initial);
    await hook.emit(9);
    assert.deepEqual(hook.value, {atTop: false, heroVisible: true});
    assert.equal(hook.renders, initial + 1);
    await hook.emit(299);
    assert.equal(hook.renders, initial + 1);
    await hook.emit(300);
    assert.deepEqual(hook.value, {atTop: false, heroVisible: false});
    const offscreenRenders = hook.renders;
    // Flush each event separately so React batching cannot mask redundant updates.
    for (let offset = 301; offset <= 480; offset++) await hook.emit(offset);
    assert.equal(hook.renders, offscreenRenders, '180 offscreen scroll events must cause zero renders');
    await hook.emit(299);
    assert.deepEqual(hook.value, {atTop: false, heroVisible: true});
    await hook.emit(8);
    assert.deepEqual(hook.value, {atTop: true, heroVisible: true});
    assert.equal(hook.renders, offscreenRenders + 2);
});

test('resizing rechecks the saved scroll offset and replaces then removes the listener', async (t) => {
    const scrollY = animatedValue();
    const hook = await mountVisibility(t, scrollY, 400);
    await hook.emit(350);
    assert.equal(hook.value.heroVisible, false);
    await hook.resize(600);
    assert.deepEqual(hook.value, {atTop: false, heroVisible: true});
    assert.equal(scrollY.listeners.size, 1);
    assert.deepEqual(scrollY.removed, ['1']);
    await hook.resize(400);
    assert.equal(hook.value.heroVisible, false);
    assert.equal(scrollY.listeners.size, 1);
    assert.deepEqual(scrollY.removed, ['1', '2']);
    await hook.unmount();
    assert.equal(scrollY.listeners.size, 0);
    assert.deepEqual(scrollY.removed, ['1', '2', '3']);
});

test('preview activity requires visibility, navigation focus, and foreground state and unsubscribes', async (t) => {
    const appState = appStateFixture(null);
    const Focus = React.createContext(true);
    const {usePreviewActive} = loadTypeScript('presentation/hooks/use-preview-active.ts', {
        'react-native': {AppState: appState},
        'expo-router': {useIsFocused: () => React.useContext(Focus)},
    });
    let active;
    let renderer;
    function Probe({visible}) { active = usePreviewActive(visible); return null; }
    const render = async (visible, focused = true) => {
        const element = React.createElement(Focus.Provider, {value: focused}, React.createElement(Probe, {visible}));
        await act(async () => { if (renderer) renderer.update(element); else renderer = create(element); });
    };
    t.after(async () => { await act(async () => renderer.unmount()); });
    await render(true);
    assert.equal(active, true, 'unknown initial AppState permits the initial focused preview');
    assert.equal(appState.listeners.size, 1);
    await render(false);
    assert.equal(active, false);
    await render(true, false);
    assert.equal(active, false);
    await render(true);
    assert.equal(active, true);
    await act(async () => appState.emit('inactive'));
    assert.equal(active, false);
    await act(async () => appState.emit('background'));
    assert.equal(active, false);
    await act(async () => appState.emit('active'));
    assert.equal(active, true);
    await act(async () => renderer.unmount());
    assert.equal(appState.listeners.size, 0);
});

test('a background transition during AppState subscription cannot leave the preview active', async (t) => {
    const appState = appStateFixture();
    const subscribe = appState.addEventListener.bind(appState);
    appState.addEventListener = (event, listener) => {
        appState.currentState = 'background';
        return subscribe(event, listener);
    };
    const {usePreviewActive} = loadTypeScript('presentation/hooks/use-preview-active.ts', {
        'react-native': {AppState: appState},
        'expo-router': {useIsFocused: () => true},
    });
    let active;
    let renderer;
    function Probe() { active = usePreviewActive(true); return null; }
    await act(async () => { renderer = create(React.createElement(Probe)); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    assert.equal(active, false, 'the current snapshot must be rechecked after subscribing');
    assert.equal(appState.listeners.size, 1);
});

test('an initially hidden hero requests no details or impressions and starts only when visible', async (t) => {
    const hero = await mountHero(t, {visible: false});
    assert.equal(hero.timers.size, 0);
    assert.equal(hero.layers.length, 0);
    assert.equal(hero.players.length, 0);
    assert.deepEqual(hero.requests, []);
    assert.deepEqual(hero.events, []);
    await hero.update({movies: [movie(11), movie(12)]});
    await hero.scroll(400);
    await hero.timers.advance(60000);
    assert.equal(hero.timers.size, 0);
    assert.deepEqual(hero.requests, []);
    assert.deepEqual(hero.events, []);
    await hero.update({visible: true});
    assert.deepEqual(hero.requests, [11]);
    assert.deepEqual(hero.events.map((event) => event.name), ['heroImpression']);
    assert.equal(hero.events[0].args[0].id, 11);
    assert.deepEqual(hero.timers.delays, [2400, 6500]);
    await hero.timers.fireDelay(2400);
    assert.equal(hero.layers.length, 1);
    assert.equal(hero.players.length, 1);
    assert.equal(hero.players[0].props.videoId, 'trailer-11');
});

test('hiding a playing hero removes its video and clears rotation, autoplay, settle and reposition timers', async (t) => {
    const hero = await mountHero(t);
    await hero.timers.fireDelay(2400);
    assert.equal(hero.players.length, 1);
    assert.deepEqual(hero.timers.delays, [30000]);
    await hero.timers.fireDelay(30000);
    await hero.scroll(0);
    assert.deepEqual(hero.timers.delays, [90, 520, 30000]);
    await hero.update({visible: false});
    assert.equal(hero.layers.length, 0);
    assert.equal(hero.players.length, 0);
    assert.equal(hero.video.unmounts, 1);
    assert.equal(hero.timers.size, 0);
    const counts = [hero.requests.length, hero.events.length, hero.scrolls.length];
    await hero.scroll(400);
    await hero.timers.advance(120000);
    assert.deepEqual([hero.requests.length, hero.events.length, hero.scrolls.length], counts);
    await hero.update({visible: true});
    assert.deepEqual(hero.timers.delays, [2400, 6500]);
    await hero.timers.fireDelay(2400);
    assert.equal(hero.players.length, 1);
    assert.equal(hero.players[0].props.muted, true);
    assert.equal(hero.video.mounts, 2);
    assert.equal(hero.events.filter((event) => event.name === 'heroImpression').length, 1);
    await hero.unmount();
    assert.equal(hero.timers.size, 0);
    assert.equal(hero.appState.listeners.size, 0);
    assert.equal(hero.video.unmounts, 2);
});

test('navigation blur and backgrounding stop hero previews until focus and foreground both return', async (t) => {
    const hero = await mountHero(t);
    await hero.focus(false);
    assert.equal(hero.timers.size, 0, 'blur before autoplay must cancel the startup and rotation timers');
    assert.equal(hero.players.length, 0);
    await hero.timers.advance(60000);
    assert.equal(hero.events.filter((event) => event.name === 'heroTrailerAutoplay').length, 0);
    await hero.focus(true);
    await hero.timers.fireDelay(2400);
    assert.equal(hero.players.length, 1);
    await hero.state('background');
    assert.equal(hero.players.length, 0);
    assert.equal(hero.timers.size, 0);
    await hero.focus(false);
    await hero.state('active');
    assert.equal(hero.players.length, 0);
    assert.equal(hero.timers.size, 0, 'foreground alone must not restart an unfocused screen');
    await hero.focus(true);
    assert.deepEqual(hero.timers.delays, [2400, 6500]);
    await hero.timers.fireDelay(2400);
    assert.equal(hero.players.length, 1);
    await hero.state('inactive');
    assert.equal(hero.players.length, 0);
    assert.equal(hero.timers.size, 0);
});
