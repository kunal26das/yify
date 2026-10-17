const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function fixture(t, {focused = true, strict = false} = {}) {
    let focus = focused;
    const listeners = new Set();
    const navigation = [];
    const {UpgradeScreen} = loadTypeScript('presentation/purchases/UpgradeScreen.tsx', {
        'react-native': {ScrollView: 'ScrollView', StyleSheet: {create: value => value}},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({bottom: 12})},
        'expo-router': {
            router: {push: path => navigation.push(path)},
            useIsFocused: () => React.useSyncExternalStore(listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }, () => focus),
        },
        '../components/screen': {Screen: 'Screen'},
        '../constants/theme': {Spacing: {xl: 24, xxl: 32}},
        '../hooks/use-responsive': {useResponsive: () => ({gutter: 20})},
        '../movies/components/TopBar': {useTopBarHeight: () => 64},
        './supporter-paywall': {SupporterMembership: props => React.createElement('Membership', props)},
    });
    const element = () => strict
        ? React.createElement(React.StrictMode, null, React.createElement(UpgradeScreen))
        : React.createElement(UpgradeScreen);
    let renderer;
    await act(async () => {renderer = create(element());});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {renderer, navigation,
        membership: () => renderer.root.findByType('Membership'),
        focus: value => act(async () => {focus = value; listeners.forEach(listener => listener());}),
        rerender: () => act(async () => renderer.update(element())),
        unmount: () => act(async () => renderer.unmount()),
    };
}

test('the membership page renders inline while unfocused and only marks it active on focus', async t => {
    const f = await fixture(t, {focused: false});
    assert.equal(f.membership().props.active, false);
    assert.equal(f.renderer.root.findAllByType('ScrollView').length, 1);
    assert.equal(f.renderer.root.findAllByType('Modal').length, 0);
    assert.equal(f.navigation.length, 0);
    const scroll = f.renderer.root.findByType('ScrollView');
    assert.equal(scroll.props.contentContainerStyle[1].paddingHorizontal, 20);
    assert.equal(scroll.props.contentContainerStyle[1].paddingBottom > 12, true);
    await f.focus(true);
    assert.equal(f.membership().props.active, true);
    await f.rerender();
    assert.equal(f.renderer.root.findAllByType('Membership').length, 1);
    assert.deepEqual(f.navigation, []);
});

test('member actions route to journal and requested insights without replacing membership', async t => {
    const f = await fixture(t);
    assert.equal(f.membership().props.active, true);
    await act(async () => f.membership().props.onOpenJournal());
    await act(async () => f.membership().props.onOpenInsights());
    assert.deepEqual(f.navigation, ['/journal', '/journal?tab=insights']);
    await f.focus(false);
    assert.equal(f.membership().props.active, false);
    await f.focus(true);
    assert.equal(f.membership().props.active, true);
    assert.equal(f.renderer.root.findAllByType('Membership').length, 1);
});

test('StrictMode and remounts never enqueue an automatic paywall or redirect', async t => {
    const f = await fixture(t, {strict: true});
    await f.rerender();
    assert.equal(f.renderer.root.findAllByType('Membership').length, 1);
    assert.deepEqual(f.navigation, []);
    await f.unmount();
    assert.deepEqual(f.navigation, []);
});
