const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flattenStyle = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

async function fixture(t, {supported = true, ready = true, adsRemoved = false} = {}) {
    let purchaseState = {ready, adsRemoved};
    const purchaseListeners = new Set();
    const subscribe = listener => {
        purchaseListeners.add(listener);
        return () => purchaseListeners.delete(listener);
    };
    const getState = () => purchaseState;
    const attachments = [];
    const ads = {
        supported,
        attach(id, onStateChange) {
            const attachment = {id, onStateChange, cleanups: 0};
            attachments.push(attachment);
            return () => { attachment.cleanups++; };
        },
    };
    const {WebAdvertisement} = loadTypeScript('presentation/components/WebAdvertisement.web.tsx', {
        'react-native': {View: 'View', StyleSheet: {create: styles => styles}},
        '../di/DependenciesContext': {useDisplayAds: () => ads},
        '../hooks/use-purchases': {
            usePurchases: () => React.useSyncExternalStore(subscribe, getState, getState),
        },
        '../hooks/use-palette': {usePalette: () => ({colors: {textMuted: '#999999'}})},
        './themed-text': {ThemedText: 'Text'},
    });
    let renderer;
    let props = {gutter: 16};
    let unmounted = false;
    const element = () => React.createElement(WebAdvertisement, props);
    await act(async () => { renderer = create(element()); });
    const unmount = async () => {
        if (unmounted) return;
        unmounted = true;
        await act(async () => renderer.unmount());
    };
    t.after(unmount);
    return {
        renderer, ads, attachments, purchaseListeners, unmount,
        get container() { return renderer.root.findAllByType('View')[0]; },
        get host() { return renderer.root.findAllByType('View').find(node => node.props.nativeID); },
        async updatePurchase(patch) {
            await act(async () => {
                purchaseState = {...purchaseState, ...patch};
                for (const listener of [...purchaseListeners]) listener();
            });
        },
        async rerender(patch = {}) {
            props = {...props, ...patch};
            await act(async () => renderer.update(element()));
        },
        async report(state) {
            await act(async () => attachments.at(-1).onStateChange(state));
        },
    };
}

test('web placement does not attach while entitlement is pending or supporter access is active', async t => {
    const f = await fixture(t, {ready: false});
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.attachments.length, 0);
    await f.updatePurchase({ready: true, adsRemoved: true});
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.attachments.length, 0);
    await f.updatePurchase({adsRemoved: false});
    assert.equal(f.attachments.length, 1);
    assert.ok(f.host);
    assert.equal(f.host.props.nativeID, f.attachments[0].id);
});

test('unsupported environments render no ad host and never attach', async t => {
    const f = await fixture(t, {supported: false});
    assert.equal(f.renderer.toJSON(), null);
    await f.updatePurchase({ready: true, adsRemoved: false});
    await f.rerender({gutter: 32});
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.attachments.length, 0);
});

test('ordinary rerenders preserve the same ad host and attachment', async t => {
    const f = await fixture(t);
    const originalId = f.host.props.nativeID;
    assert.equal(f.attachments.length, 1);
    await f.rerender({gutter: 32});
    await f.updatePurchase({refreshing: true});
    await f.updatePurchase({refreshing: false, offers: []});
    await f.report('filled');
    await f.rerender();
    assert.equal(f.attachments.length, 1);
    assert.equal(f.attachments[0].cleanups, 0);
    assert.equal(f.host.props.nativeID, originalId);
    assert.equal(flattenStyle(f.container.props.style).paddingHorizontal, 32);
});

test('supporter activation and unmount each release their active attachment exactly once', async t => {
    const f = await fixture(t);
    assert.equal(f.attachments.length, 1);
    await f.updatePurchase({adsRemoved: true});
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.attachments[0].cleanups, 1);
    await f.rerender();
    await f.updatePurchase({ready: false});
    assert.equal(f.attachments.length, 1);
    assert.equal(f.attachments[0].cleanups, 1);
    await f.updatePurchase({ready: true, adsRemoved: false});
    assert.equal(f.attachments.length, 2);
    assert.notEqual(f.attachments[0].id, f.attachments[1].id);
    await f.unmount();
    assert.deepEqual(f.attachments.map(attachment => attachment.cleanups), [1, 1]);
    assert.equal(f.purchaseListeners.size, 0);
});

test('loading remains visible and empty states hide without detaching optimized content', async t => {
    const f = await fixture(t);
    const id = f.host.props.nativeID;
    assert.notEqual(flattenStyle(f.container.props.style).display, 'none');
    assert.equal(flattenStyle(f.host.props.style).width, '100%');
    assert.equal(f.renderer.root.findByType('Text').children.join(''), 'Advertisement');
    for (const state of ['unfilled', 'blocked', 'disabled']) {
        await f.report(state);
        assert.equal(flattenStyle(f.container.props.style).display, 'none', state);
        assert.equal(f.host.props.nativeID, id);
        await f.report('unfill-optimized');
        assert.notEqual(flattenStyle(f.container.props.style).display, 'none');
        assert.equal(f.host.props.nativeID, id);
        assert.equal(f.attachments.length, 1);
        assert.equal(f.attachments[0].cleanups, 0);
    }
    await f.report('filled');
    assert.notEqual(flattenStyle(f.container.props.style).display, 'none');
});

test('losing entitlement readiness cleans up instead of displaying ads during identity resolution', async t => {
    const f = await fixture(t);
    await f.report('filled');
    await f.updatePurchase({ready: false});
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.attachments[0].cleanups, 1);
    await f.updatePurchase({adsRemoved: true, ready: true});
    assert.equal(f.renderer.toJSON(), null);
    assert.equal(f.attachments.length, 1);
});
