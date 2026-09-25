const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function fixture(t, {focused = true, strict = false} = {}) {
    let focus = focused;
    const listeners = new Set();
    const requests = [];
    const active = new Set();
    const navigation = [];
    const showPaywall = (placement, onClose) => {
        const request = {placement, onClose};
        requests.push(request);
        active.add(request);
        return () => active.delete(request);
    };
    const {UpgradeScreen} = loadTypeScript('presentation/purchases/UpgradeScreen.tsx', {
        'react-native': {Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: {create: value => value},
            Platform: {OS: 'web', select: options => options.web ?? options.default}},
        'expo-router': {
            router: {replace: path => navigation.push(path)},
            useIsFocused: () => React.useSyncExternalStore(listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }, () => focus),
        },
        '../components/themed-text': {ThemedText: 'Text'},
        '../components/screen': {Screen: 'Screen'},
        '../hooks/use-palette': {usePalette: () => ({colors: {textMuted: '#777'}})},
        '../movies/components/TopBar': {useTopBarHeight: () => 64},
        './supporter-paywall': {useSupporterPaywall: () => showPaywall},
    });
    const element = () => strict
        ? React.createElement(React.StrictMode, null, React.createElement(UpgradeScreen))
        : React.createElement(UpgradeScreen);
    let renderer;
    await act(async () => { renderer = create(element()); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return {
        renderer, requests, active, navigation,
        focus: async value => act(async () => { focus = value; listeners.forEach(listener => listener()); }),
        rerender: async () => act(async () => renderer.update(element())),
        unmount: async () => act(async () => renderer.unmount()),
    };
}

test('an unfocused upgrade route waits to open and ordinary rerenders do not queue another paywall', async t => {
    const f = await fixture(t, {focused: false});
    assert.equal(f.requests.length, 0);
    await f.focus(true);
    await f.rerender();
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].placement, 'supporter_page');
    assert.equal(f.active.size, 1);
    f.requests[0].onClose(false);
    assert.deepEqual(f.navigation, ['/watchlist']);
});

test('StrictMode effect replay opens only one request', async t => {
    const f = await fixture(t, {strict: true});
    assert.equal(f.requests.length, 1);
    assert.equal(f.active.size, 1);
    await f.unmount();
    assert.equal(f.active.size, 0);
});

test('browser back or route blur cancels ownership and refocusing starts one fresh request', async t => {
    const f = await fixture(t);
    const oldRequest = f.requests[0];
    await f.focus(false);
    assert.equal(f.active.size, 0);
    oldRequest.onClose(true);
    assert.deepEqual(f.navigation, []);
    await f.focus(true);
    assert.equal(f.requests.length, 2);
    assert.equal(f.active.size, 1);
    oldRequest.onClose(false);
    assert.deepEqual(f.navigation, []);
    f.requests[1].onClose(false);
    assert.deepEqual(f.navigation, ['/watchlist']);
});

test('unmounting cancels the request and a late completion cannot navigate away from the new route', async t => {
    const f = await fixture(t);
    await f.unmount();
    assert.equal(f.active.size, 0);
    f.requests[0].onClose(true);
    assert.deepEqual(f.navigation, []);
});
