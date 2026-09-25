const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LEGAL_LINKS = [
    {label: 'Privacy policy', url: 'https://yify.expo.app/privacy/'},
    {label: 'Terms and conditions', url: 'https://yify.expo.app/terms/'},
];

async function fixture(t, {platform = 'web', confirmed = false, pathname = '/'} = {}) {
    const values = new Map();
    const store = {
        getString: key => values.get(key),
        set: (key, value) => values.set(key, value),
        delete: key => values.delete(key),
    };
    const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
    const privacy = new PrivacyPreferencesImpl(store);
    if (confirmed) privacy.updateChoices({adultConfirmed: true, analytics: false});
    const opened = [];
    const usePrivacyChoices = () => React.useSyncExternalStore(
        listener => privacy.subscribe(listener), () => privacy.getChoices(), () => privacy.getChoices());
    const {PrivacyGate} = loadTypeScript('presentation/components/privacy-gate.tsx', {
        'react-native': {
            Platform: {OS: platform, select: values => values[platform] ?? values.default},
            Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', View: 'View',
            StyleSheet: {create: value => value, absoluteFill: {}, absoluteFillObject: {}},
        },
        'expo-router': {Link: 'Link', usePathname: () => pathname},
        'expo-router/head': 'Head',
        '../di/DependenciesContext': {usePrivacyPreferences: () => privacy},
        '../hooks/use-privacy-choices': {usePrivacyChoices},
        '../hooks/use-palette': {usePalette: () => ({scheme: 'dark', colors: new Proxy({}, {get: () => '#24211D'})})},
        '../constants/legal': {LEGAL_LINKS, openLegalPage: async url => {opened.push(url);}},
        './themed-text': {ThemedText: 'Text'},
        './privacy-home-backdrop': {PrivacyHomeBackdrop: 'PrivacyHomeBackdrop'},
    });
    let mounted = 0;
    let starts = 0;
    function Application() {
        React.useEffect(() => {mounted++; starts++; return () => {mounted--;};}, []);
        return React.createElement('ApplicationContent');
    }
    let renderer;
    await act(async () => {renderer = create(React.createElement(PrivacyGate, null, React.createElement(Application)));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {
        renderer, privacy, store, values, opened,
        counts: () => ({mounted, starts}),
        toggle: async (label, value) => act(async () => renderer.root.findByProps({accessibilityLabel: label}).props.onValueChange(value)),
        continueButton: () => renderer.root.findAllByType('Pressable').find(node => node.props.accessibilityRole === 'button'),
        continue: async () => act(async () => renderer.root.findAllByType('Pressable')
            .find(node => node.props.accessibilityRole === 'button').props.onPress()),
    };
}

for (const platform of ['web', 'android', 'ios']) {
    test(`${platform}: the welcome overlay never mounts the app before a required adult declaration`, async t => {
        const f = await fixture(t, {platform});
        assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
        assert.equal(f.renderer.root.findByProps({accessibilityLabel: 'I am 18 or older'}).props.value, false);
        assert.equal(f.renderer.root.findByProps({accessibilityLabel: 'Optional usage analytics'}).props.value, false);
        assert.equal(f.continueButton().props.disabled, true);
        assert.equal(f.continueButton().props.accessibilityState.disabled, true);
        await f.continue();
        assert.equal(f.values.size, 0);
        await f.toggle('Optional usage analytics', true);
        await f.continue();
        assert.equal(f.values.size, 0);
        assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
    });

    test(`${platform}: accepting the age declaration works with optional analytics either off or explicitly on`, async t => {
        for (const analytics of [false, true]) {
            const f = await fixture(t, {platform});
            await f.toggle('I am 18 or older', true);
            if (analytics) await f.toggle('Optional usage analytics', true);
            assert.equal(f.continueButton().props.disabled, false);
            assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
            await f.continue();
            assert.equal(f.privacy.getChoices().adultConfirmed, true);
            assert.equal(f.privacy.getChoices().analytics, analytics);
            assert.equal(f.privacy.getChoices().youtube, false);
            assert.equal(JSON.parse(f.values.get('choices')).analytics, analytics);
            assert.deepEqual(f.counts(), {mounted: 1, starts: 1});
            assert.equal(f.renderer.root.findAllByType('PrivacyHomeBackdrop').length, 0);
            assert.equal(f.renderer.root.findAllByType('ApplicationContent').length, 1);
        }
    });

    test(`${platform}: rejected and silently lost privacy writes leave the app unmounted and the choice recoverable`, async t => {
        for (const write of [() => {throw new Error('Storage blocked');}, () => {}]) {
            const f = await fixture(t, {platform});
            const originalSet = f.store.set;
            f.store.set = write;
            await f.toggle('I am 18 or older', true);
            await f.toggle('Optional usage analytics', true);
            await f.continue();
            assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
            assert.equal(f.privacy.getChoices().adultConfirmed, false);
            assert.equal(f.privacy.getChoices().analytics, false);
            assert.match(JSON.stringify(f.renderer.root.findByProps({accessibilityRole: 'alert'}).children), /Could not save/);
            f.store.set = originalSet;
            await f.continue();
            assert.deepEqual(f.counts(), {mounted: 1, starts: 1});
        }
    });

    test(`${platform}: a saved declaration skips the overlay and removing it immediately unmounts the app`, async t => {
        const f = await fixture(t, {platform, confirmed: true});
        assert.deepEqual(f.counts(), {mounted: 1, starts: 1});
        assert.equal(f.renderer.root.findAllByType('PrivacyHomeBackdrop').length, 0);
        await act(async () => {f.values.clear(); f.privacy.refreshFromStorage();});
        assert.deepEqual(f.counts(), {mounted: 0, starts: 1});
        assert.equal(f.renderer.root.findAllByType('ApplicationContent').length, 0);
        assert.equal(f.continueButton().props.disabled, true);
    });
}

test('web: legal and public navigation links remain available without unlocking or mounting the app', async t => {
    const f = await fixture(t, {pathname: '/upgrade'});
    const links = f.renderer.root.findAllByType('Link');
    for (const href of ['privacy/', 'terms/', 'movies', 'shows', 'guide/', 'support/']) {
        assert.ok(links.some(node => node.props.href === `https://yify.expo.app/${href}`));
    }
    for (const link of LEGAL_LINKS) {
        const node = links.find(node => node.props.href === link.url);
        assert.equal(node.props.target, '_blank');
        assert.equal(node.props.rel, 'noopener noreferrer');
    }
    assert.equal(f.renderer.root.findByType('title').children.join(''), 'Supporter options — Yify');
    assert.equal(f.renderer.root.findByProps({name: 'robots'}).props.content, 'noindex,follow');
    assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
});

test('native: opening legal information does not accept the welcome choices', async t => {
    for (const platform of ['android', 'ios']) {
        const f = await fixture(t, {platform});
        const links = f.renderer.root.findAllByType('Pressable').filter(node => node.props.accessibilityRole === 'link');
        assert.equal(links.length, 2);
        for (const link of links) await act(async () => link.props.onPress());
        assert.deepEqual(f.opened, LEGAL_LINKS.map(link => link.url));
        assert.equal(f.privacy.getChoices().adultConfirmed, false);
        assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
    }
});

test('the homepage backdrop stays outside interaction and accessibility while the welcome card remains scrollable', async t => {
    for (const platform of ['web', 'android', 'ios']) {
        const f = await fixture(t, {platform});
        const backdrop = f.renderer.root.findByType('PrivacyHomeBackdrop');
        const ancestors = [];
        for (let node = backdrop; node; node = node.parent) ancestors.push(node);
        assert.ok(ancestors.some(node => node.props.pointerEvents === 'none'));
        assert.ok(ancestors.some(node => node.props.accessibilityElementsHidden === true));
        assert.ok(ancestors.some(node => node.props.importantForAccessibility === 'no-hide-descendants'));
        assert.ok(ancestors.some(node => node.props['aria-hidden'] === true));
        assert.equal(f.renderer.root.findAllByType('ScrollView').length, 1);
        const dialogs = f.renderer.root.findAllByType('View').filter(node => node.props.accessibilityViewIsModal);
        assert.equal(dialogs.length, 1);
        if (platform === 'web') {
            assert.equal(dialogs[0].props.role, 'dialog');
            assert.equal(dialogs[0].props['aria-modal'], true);
        }
        assert.deepEqual(f.counts(), {mounted: 0, starts: 0});
    }
});
