const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function eventTarget() {
    const listeners = new Map();
    return {
        addEventListener: (name, listener) => {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(listener);
        },
        removeEventListener: (name, listener) => listeners.get(name)?.delete(listener),
        emit: (name, event) => listeners.get(name)?.forEach(listener => listener(event)),
    };
}

async function fixture(t) {
    t.mock.timers.enable({apis: ['setTimeout']});
    const previous = {document: global.document, window: global.window};
    global.document = eventTarget();
    global.window = {...eventTarget(), innerWidth: 1200, innerHeight: 800};
    let desktop = true;
    let controller;
    let mounts = 0;
    let unmounts = 0;
    const analytics = [];
    const colors = new Proxy({}, {get: () => '#123456'});
    const {HoverCardHost, useHoverCard} = loadTypeScript('presentation/movies/components/HoverCard.web.tsx', {
        'react-native': {
            Animated: {Value: class {interpolate() {return 1;}}, View: 'AnimatedView', spring: () => ({start() {}})},
            Pressable: 'Pressable', View: 'View', StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1},
            Platform: {select: options => options.web ?? options.default},
        },
        '@expo/vector-icons/Ionicons': 'Icon', 'expo-image': {Image: 'Image'},
        'expo-router': {router: {push() {}}},
        '@/presentation/analytics/events': {Analytics: {posterHoverCard: movie => analytics.push(movie.id)}},
        '../useWatchlist': {useToggleWatchlist: () => () => {}, useIsInWatchlist: () => false},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../hooks/use-palette': {usePalette: () => ({colors, scheme: 'dark'})},
        '../../hooks/use-responsive': {useResponsive: () => ({isDesktop: desktop})},
        './TopTenContext': {useTopTenRank: () => null},
    });
    function Child() {
        controller = useHoverCard();
        const [value, setValue] = React.useState('draft');
        React.useEffect(() => {mounts++; return () => {unmounts++;};}, []);
        return React.createElement('input', {value, onChange: setValue});
    }
    let renderer;
    const render = async key => {
        await act(async () => {
            const tree = React.createElement(HoverCardHost, {resetKey: key}, React.createElement(Child));
            if (renderer) renderer.update(tree);
            else renderer = create(tree);
        });
    };
    await render('initial');
    t.after(async () => {
        await act(async () => renderer.unmount());
        for (const key of ['document', 'window']) {
            if (previous[key] === undefined) delete global[key];
            else global[key] = previous[key];
        }
    });
    const anchor = {isConnected: true, parentElement: null, getBoundingClientRect: () => ({top: 100, left: 100, width: 160, height: 240})};
    const movie = id => ({id, title: `Movie ${id}`, posterUrls: [], genres: [], rating: 0, runtimeMinutes: 100, year: 2026});
    return {
        render, renderer, anchor, analytics,
        get controller() {return controller;},
        get mounts() {return mounts;}, get unmounts() {return unmounts;},
        setDesktop: value => {desktop = value;},
        open: async id => {await act(async () => controller.open(movie(id), anchor, 'test'));},
        tick: async milliseconds => {await act(async () => t.mock.timers.tick(milliseconds));},
        visible: () => renderer.root.findAllByType('Pressable').filter(node => /^View Movie /.test(node.props.accessibilityLabel ?? '')).map(node => node.props.accessibilityLabel),
        movie,
    };
}

test('changing result scope dismisses a shown preview without remounting children or reviving it on return', async t => {
    const f = await fixture(t);
    await act(async () => f.renderer.root.findByType('input').props.onChange('Interstellar'));
    await f.open(1);
    await f.tick(480);
    assert.deepEqual(f.visible(), ['View Movie 1']);
    await f.render('search:Interstellar');
    assert.deepEqual(f.visible(), []);
    assert.equal(f.renderer.root.findByType('input').props.value, 'Interstellar');
    assert.equal(f.mounts, 1);
    assert.equal(f.unmounts, 0);
    await f.render('initial');
    assert.deepEqual(f.visible(), []);
});

test('scope changes cancel pending opens and stale controllers cannot open old results', async t => {
    const f = await fixture(t);
    const stale = f.controller;
    await f.open(1);
    await f.tick(200);
    await f.render('no-results');
    await act(async () => stale.open(f.movie(1), f.anchor, 'old'));
    await f.tick(1000);
    assert.deepEqual(f.visible(), []);
    assert.deepEqual(f.analytics, []);
    await f.open(2);
    await act(async () => stale.close());
    await f.tick(480);
    assert.deepEqual(f.visible(), ['View Movie 2']);
});

test('a pending dismissal from the previous scope cannot dismiss its replacement', async t => {
    const f = await fixture(t);
    await f.open(1);
    await f.tick(480);
    await act(async () => global.document.emit('pointermove', {clientX: 1100, clientY: 750}));
    await f.render('new-results');
    await f.open(2);
    await f.tick(480);
    assert.deepEqual(f.visible(), ['View Movie 2']);
    await f.tick(1000);
    assert.deepEqual(f.visible(), ['View Movie 2']);
});

test('detached anchors and non-desktop layouts cannot leave a delayed preview visible', async t => {
    const f = await fixture(t);
    await f.open(1);
    f.anchor.isConnected = false;
    await f.tick(480);
    assert.deepEqual(f.visible(), []);
    f.anchor.isConnected = true;
    await f.open(2);
    await f.tick(480);
    assert.deepEqual(f.visible(), ['View Movie 2']);
    f.setDesktop(false);
    await f.render('initial');
    assert.deepEqual(f.visible(), []);
    await f.open(3);
    await f.tick(480);
    assert.deepEqual(f.visible(), []);
});
