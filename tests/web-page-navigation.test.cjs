const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function navigation(platform = 'web') {
    const {NavigationLink} = loadTypeScript('presentation/components/navigation-link.tsx', {
        'react-native': {Platform: {OS: platform}},
        'expo-router': {Link: 'Link'},
        './motion': {PressableScale: 'PressableScale'},
    });
    let navigations = 0;
    const element = NavigationLink({href: '/movies?genre=action', onNavigate: () => navigations++, children: 'Action'});
    return {element, get count() {return navigations;}, press: element.props.children.props.onPress};
}

function event(overrides = {}) {
    return {defaultPrevented: false, button: 0, preventDefault() {this.defaultPrevented = true;}, ...overrides};
}

test('crawlable navigation keeps existing navigation behavior for an ordinary click', () => {
    const f = navigation();
    assert.equal(f.element.props.href, '/movies?genre=action');
    assert.equal(f.element.props.asChild, true);
    const click = event();
    f.press(click);
    assert.equal(f.count, 1);
    assert.equal(click.defaultPrevented, true);
});

test('modified clicks and previously cancelled events keep their browser behavior', () => {
    for (const modifier of [{metaKey: true}, {ctrlKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}, {button: 2}]) {
        const f = navigation();
        const click = event(modifier);
        f.press(click);
        assert.equal(f.count, 0);
        assert.equal(click.defaultPrevented, false);
    }
    const f = navigation();
    f.press(event({defaultPrevented: true}));
    assert.equal(f.count, 0);
});

test('native links continue through the existing navigation callback once', () => {
    const f = navigation('android');
    const press = event();
    delete press.button;
    f.press(press);
    assert.equal(f.count, 1);
    assert.equal(press.defaultPrevented, true);
});

test('utility page robots reset when navigating back to a public page', t => {
    const nodes = new Map();
    const document = {
        title: '',
        createElement: tag => ({tag, setAttribute(name, value) {this[name] = value;}}),
        head: {
            querySelector: selector => nodes.get(selector),
            appendChild: node => nodes.set(`meta[${node.name ? 'name' : 'property'}="${node.name ?? node.property}"]`, node),
        },
    };
    const prior = globalThis.document;
    globalThis.document = document;
    t.after(() => prior === undefined ? delete globalThis.document : globalThis.document = prior);
    let focus;
    const {usePageMeta} = loadTypeScript('presentation/hooks/use-page-meta.web.ts', {
        react: {useCallback: callback => callback},
        'expo-router': {useFocusEffect: callback => {focus = callback; callback();}},
    });
    const robots = () => nodes.get('meta[name="robots"]').content;
    usePageMeta({title: 'Preferences', robots: 'noindex,follow'});
    assert.equal(robots(), 'noindex,follow');
    usePageMeta({title: 'Movies'});
    const focusMovies = focus;
    assert.equal(robots(), 'index,follow');
    usePageMeta({title: 'History', robots: 'noindex,follow'});
    assert.equal(robots(), 'noindex,follow');
    focusMovies();
    assert.equal(robots(), 'index,follow');
    assert.equal(document.title, 'Movies');
    assert.equal([...nodes.keys()].filter(key => key === 'meta[name="robots"]').length, 1);
    delete globalThis.document;
    assert.doesNotThrow(() => usePageMeta({title: 'Server render'}));
});
