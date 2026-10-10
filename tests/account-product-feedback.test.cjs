const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {DEFAULT_PREFERENCES} = loadTypeScript('domain/entities/Preferences.ts');
const textOf = node => typeof node === 'string' ? node : node.children?.map(textOf).join('') ?? '';
const deferred = () => {
    let resolve;
    const promise = new Promise(done => {resolve = done;});
    return {promise, resolve};
};

async function fixture(t, options = {}) {
    let session = {ready: true, available: true, signingIn: false, account: {uid: 'fixture-account', name: 'Test account'}, error: null};
    const listeners = new Set();
    const update = patch => {session = {...session, ...patch}; listeners.forEach(listener => listener());};
    const calls = {signOut: 0, delete: 0, remote: 0, pause: 0, resume: 0, confirmations: [], toasts: [], events: [], browsers: [], privacy: 0};
    const auth = {
        getSession: () => session,
        async signOut() {calls.signOut++; await options.signOut?.(); update({account: null});},
        async deleteAccount() {
            calls.delete++;
            const deleted = options.deleteAccount ? await options.deleteAccount() : true;
            if (deleted) update({account: null});
            return deleted;
        },
    };
    const vm = {...DEFAULT_PREFERENCES, appInfo: {version: 'test'}, watchlistCount: 1, searchHistoryCount: 0};
    const colors = new Proxy({}, {get: () => '#123456'});
    const {PreferencesScreen} = loadTypeScript('presentation/movies/PreferencesScreen.tsx', {
        'react-native': {
            View: 'View', ScrollView: 'ScrollView', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator',
            StyleSheet: {create: value => value}, Platform: {OS: options.platform ?? 'android', select: value => value.default},
            Linking: {openURL: async () => {}},
        },
        '@expo/vector-icons/Ionicons': 'Icon',
        'expo-image': {Image: 'Image'},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}, LayoutAnimationConfig: 'LayoutAnimationConfig'},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 0})},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: (_, name) => (...args) => calls.events.push([name, ...args])})},
        '../components/confirm-dialog': {useConfirm: () => value => calls.confirmations.push(value)},
        '../components/toast': {useToast: () => message => calls.toasts.push(message)},
        '../components/motion': {PressableScale: 'Pressable', Duration: {}, enterFade() {}, enterRise() {}, exitFade() {}},
        '../components/screen': {Screen: 'Screen'},
        '../components/themed-text': {ThemedText: 'Text'},
        '../hooks/use-palette': {usePalette: () => ({colors})},
        '../hooks/use-privacy-choices': {usePrivacyChoices: () => ({adultConfirmed: true, analytics: false, youtube: false})},
        '../hooks/use-responsive': {useResponsive: () => ({gutter: 16, contentMaxWidth: 900})},
        './constants/destinations': {useGoTo: () => () => {}},
        'expo-web-browser': {openBrowserAsync: async url => {calls.browsers.push(url); await options.openBrowser?.();}},
        './components/PlayStoreButton': {openPlayStore: async () => {}, PlayStoreButton: 'PlayStoreButton'},
        './components/ChipBar': {ChipBar: 'ChipBar'},
        './components/MyStreamingServices': {MyStreamingServices: 'MyStreamingServices'},
        './components/TopBar': {useTopBarHeight: () => 0},
        './usePreferencesViewModel': {usePreferencesViewModel: () => vm},
        '../hooks/use-auth': {useAuth: () => React.useSyncExternalStore(listener => {
            listeners.add(listener); return () => listeners.delete(listener);
        }, () => session)},
        '../hooks/use-purchases': {usePurchases: () => ({available: true, ready: true, adsRemoved: false})},
        '../purchases/supporter-paywall': {useSupporterPaywall: () => () => {}},
        '../hooks/use-sync-status': {useSyncStatus: () => ({state: 'idle'})},
        '../hooks/use-availability-alerts': {useAvailabilityAlertSettings: () => ({})},
        '../di/DependenciesContext': {
            useAuthRepository: () => auth,
            useAccountSync: () => ({
                async pause() {calls.pause++; await options.pause?.();},
                async deleteRemote() {calls.remote++; return options.deleteRemote ? options.deleteRemote() : true;},
                setAccount() {}, resume() {calls.resume++;},
            }),
            useAdGateway: () => ({privacyOptionsRequired: () => true, async showPrivacyOptions() {
                calls.privacy++; await options.privacy?.();
            }}),
            useAppConfig: () => ({getSupportUrl: () => 'https://example.test/support'}),
            usePrivacyPreferences: () => ({}), useDisplayAds: () => ({}), useDiagnostics: () => ({}),
        },
    });
    let renderer;
    await act(async () => {renderer = create(React.createElement(PreferencesScreen));});
    t.after(() => act(async () => renderer.unmount()));
    const button = label => renderer.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label);
    const press = async label => {
        const node = button(label);
        assert.ok(node, label);
        assert.equal(Boolean(node.props.disabled), false, `${label} is enabled`);
        await act(async () => {node.props.onPress();});
    };
    const confirmDelete = async () => {
        await press('Delete account');
        await act(async () => {calls.confirmations.at(-1).onConfirm();});
    };
    return {renderer, calls, button, press, confirmDelete, session: () => session,
        update: patch => act(async () => update(patch)),
        text: () => renderer.root.findAllByType('Text').map(textOf).join('\n')};
}

for (const platform of ['android', 'web']) {
    test(`${platform} failed sign-out keeps the account visible and retry confirms success`, async t => {
        let failing = true;
        const f = await fixture(t, {platform, signOut: async () => {if (failing) throw Error('private response');}});
        await f.press('Sign out');
        assert.match(f.text(), /Sign-out could not be completed/);
        assert.doesNotMatch(f.text(), /private response/);
        assert.ok(f.session().account);
        failing = false;
        await f.press('Sign out');
        assert.equal(f.session().account, null);
        assert.deepEqual(f.calls.toasts, ['Signed out.']);
    });

    test(`${platform} incomplete deletion reports partial data deletion and can finish on retry`, async t => {
        let deleted = false;
        const f = await fixture(t, {platform, deleteAccount: async () => deleted});
        await f.confirmDelete();
        assert.match(f.calls.confirmations[0].message, /does not cancel a subscription/);
        assert.match(f.text(), /synced data was deleted, but your account is still active/);
        assert.equal(f.calls.toasts.length, 0);
        assert.ok(f.session().account);
        deleted = true;
        await f.confirmDelete();
        assert.equal(f.session().account, null);
        assert.deepEqual(f.calls.toasts, ['Your account was deleted.']);
        assert.equal(f.calls.resume, 2);
    });

    test(`${platform} remote deletion failure retains the account and offers another attempt`, async t => {
        let cleared = false;
        const f = await fixture(t, {platform, deleteRemote: async () => cleared});
        await f.confirmDelete();
        assert.match(f.text(), /account could not be deleted/);
        assert.equal(f.calls.delete, 0);
        assert.ok(f.session().account);
        cleared = true;
        await f.confirmDelete();
        assert.equal(f.calls.delete, 1);
    });
}

test('pending deletion blocks sign-out and repeated deletion, including stale callbacks', async t => {
    const pending = deferred();
    const f = await fixture(t, {pause: () => pending.promise});
    const signOut = f.button('Sign out').props.onPress;
    await f.confirmDelete();
    assert.equal(f.button('Sign out').props.disabled, true);
    assert.equal(f.button('Delete account').props.disabled, true);
    await act(async () => {signOut(); f.calls.confirmations[0].onConfirm();});
    assert.equal(f.calls.signOut, 0);
    assert.equal(f.calls.pause, 1);
    await act(async () => {pending.resolve();});
    assert.equal(f.calls.delete, 1);
});

test('account changes while deletion pauses do not delete the replacement account', async t => {
    const pending = deferred();
    const f = await fixture(t, {pause: () => pending.promise});
    await f.confirmDelete();
    await f.update({account: {uid: 'replacement', name: 'Replacement account'}});
    await act(async () => {pending.resolve();});
    assert.equal(f.calls.delete, 0);
    assert.equal(f.calls.remote, 0);
    assert.match(f.text(), /account changed before deletion finished/);
});

test('support, website and ad privacy failures show feedback and each action remains retryable', async t => {
    let failing = true;
    const reject = async () => {if (failing) throw Error('private response');};
    const f = await fixture(t, {openBrowser: reject, privacy: reject});
    await f.press('Buy me a coffee');
    await f.press('Ad privacy choices');
    await f.press('About');
    await f.press('Open Yify on the web');
    assert.deepEqual(f.calls.toasts, [
        'Could not open the support page. Please try again.',
        'Could not open ad privacy choices. Please try again.',
        'Could not open the website. Please try again.',
    ]);
    failing = false;
    await f.press('Buy me a coffee');
    await f.press('Ad privacy choices');
    await f.press('Open Yify on the web');
    assert.equal(f.calls.toasts.length, 3);
    assert.equal(f.calls.browsers.length, 4);
    assert.equal(f.calls.privacy, 2);
});

test('Preferences exposes actual section headings without turning ordinary rows into headings', async t => {
    const f = await fixture(t);
    const headings = f.renderer.root.findAllByType('Text').filter(node => node.props.accessibilityRole === 'header').map(textOf);
    for (const title of ['Account', 'Yify', 'General', 'Privacy', 'About']) assert.ok(headings.includes(title));
    assert.equal(headings.includes('Test account'), false);
    await f.press('Watchlist');
    assert.match(f.text(), /Ask before removing a title from your watchlist/);
    assert.doesNotMatch(f.text(), /✕ on a poster/);
});
