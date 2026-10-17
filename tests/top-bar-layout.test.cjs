const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const flatten = value => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));

async function fixture(t, {width = 320, fontScale = 2} = {}) {
    let pathname = '/movies';
    let viewportWidth = width;
    const scrolls = [];
    const native = {
        View: 'View', ScrollView: 'ScrollView', TextInput: 'Input',
        Platform: {OS: 'web', select: x => x.web ?? x.default},
        StyleSheet: {create: x => x, hairlineWidth: 1},
        useWindowDimensions: () => ({width: viewportWidth, height: 800, fontScale}),
    };
    const destinations = loadTypeScript('presentation/movies/constants/destinations.ts', {
        'react-native': native,
        'expo-router': {useNavigation: () => ({getState: () => ({routes: []})})},
    });
    const {TopBar, useTopBarHeight} = loadTypeScript('presentation/movies/components/TopBar.tsx', {
        'react-native': native,
        'expo-router': {usePathname: () => pathname},
        '@expo/vector-icons/Ionicons': 'Icon', 'expo-image': {Image: 'Image'},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 20, bottom: 0})},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../components/motion': {PressableScale: 'Button'},
        '../../components/navigation-link': {NavigationLink: 'Link'},
        '../../hooks/use-palette': {usePalette: () => ({colors: new Proxy({}, {get: () => '#333'})})},
        '../../hooks/use-responsive': {useResponsive: () => ({width: viewportWidth, isPhone: viewportWidth < 600, gutter: 16})},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: () => () => {}})},
        '../constants/destinations': {...destinations, useGoTo: () => () => {}},
        './SearchOverlay': {SearchOverlay: 'SearchOverlay'}, './TopBarSlot': {useTopBarSlot: () => ({})},
        '../../di/DependenciesContext': {useSearchHistory: () => ({remember() {}})},
        '../../hooks/use-auth': {useAuth: () => ({account: null})},
        '../../hooks/use-subscriber-access': {useSubscriberAccess: () => ({status: 'allowed'})},
    });
    function Offset() {return React.createElement('Offset', {height: useTopBarHeight()});}
    const tree = () => React.createElement(React.Fragment, null, React.createElement(TopBar), React.createElement(Offset));
    let renderer;
    await act(async () => {renderer = create(tree(), {createNodeMock: node => node.type === 'ScrollView' ? {scrollTo: x => scrolls.push(x)} : {}});});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {renderer, scrolls, resize: async value => act(async () => {viewportWidth = value; renderer.update(tree());}), navigate: async value => act(async () => {pathname = value; renderer.update(tree());})};
}

for (const [width, fontScale] of [[320, 1], [320, 2], [768, 2], [1440, 1], [1440, 2]]) {
    test(`navigation content offset matches its rendered height at ${width}px scale ${fontScale}`, async t => {
        const f = await fixture(t, {width, fontScale});
        const row = f.renderer.root.findAllByType('View').find(x => flatten(x.props.style).flexDirection === 'row' && flatten(x.props.style).height >= 64);
        assert.ok(row);
        const stacked = f.renderer.root.findAllByType('ScrollView').find(x => flatten(x.props.style).height);
        const offset = f.renderer.root.findByType('Offset').props.height;
        assert.equal(offset, 20 + flatten(row.props.style).height + (stacked ? flatten(stacked.props.style).height : 0));
        assert.ok(flatten(row.props.style).height >= 34 * fontScale + 24);
        for (const href of ['/movies', '/shows', '/anime', '/watchlist']) {
            assert.equal(f.renderer.root.findAllByType('Link').filter(x => x.props.href === href).length, 1);
        }
    });
}

test('compact navigation reveals focused and newly selected offscreen destinations', async t => {
    const f = await fixture(t);
    const scroller = f.renderer.root.findByType('ScrollView');
    const links = f.renderer.root.findAllByType('Link').filter(x => ['/movies', '/shows', '/anime', '/watchlist'].includes(x.props.href));
    await act(async () => {
        links.forEach((link, index) => link.props.onLayout({nativeEvent: {layout: {x: index * 140, width: 130}}}));
        scroller.props.onLayout({nativeEvent: {layout: {width: 288}}});
        links.at(-1).props.onFocus();
    });
    assert.deepEqual(f.scrolls.at(-1), {x: 274, animated: false});
    await act(async () => links[0].props.onFocus());
    assert.deepEqual(f.scrolls.at(-1), {x: 0, animated: false});
    await f.navigate('/watchlist');
    assert.deepEqual(f.scrolls.at(-1), {x: 274, animated: false});
});


test('a remounted compact scroller reveals its active destination after a desktop resize', async t => {
    const f = await fixture(t);
    await f.navigate('/watchlist');
    const measure = async () => act(async () => {
        const links = f.renderer.root.findAllByType('Link').filter(x => ['/movies', '/shows', '/anime', '/watchlist'].includes(x.props.href));
        links.forEach((link, index) => link.props.onLayout({nativeEvent: {layout: {x: 16 + index * 140, width: 130}}}));
        const scroller = f.renderer.root.findByType('ScrollView');
        scroller.props.onLayout({nativeEvent: {layout: {width: 320}}});
        scroller.props.onContentSizeChange();
    });
    await measure();
    assert.deepEqual(f.scrolls.at(-1), {x: 258, animated: false});
    await f.resize(2000);
    assert.equal(f.renderer.root.findAllByType('ScrollView').length, 0);
    f.scrolls.length = 0;
    await f.resize(320);
    await measure();
    assert.deepEqual(f.scrolls.at(-1), {x: 258, animated: false});
});
