const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {Portal, PortalProvider} = require('@gorhom/portal');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture({platform = 'android', isLarge = false, removalFails = false} = {}) {
    const calls = {removed: [], announced: [], blurred: 0};
    const SheetContext = React.createContext(false);
    const SheetProvider = ({children}) => React.createElement(SheetContext.Provider, {value: true},
        React.createElement(PortalProvider, null, children));
    const Sheet = React.forwardRef((props, ref) => {
        assert.equal(React.useContext(SheetContext), true, 'Sheet must have a modal provider');
        const [visible, setVisible] = React.useState(false);
        const latest = React.useRef(props);
        latest.current = props;
        React.useImperativeHandle(ref, () => ({
            present: () => setVisible(true),
            dismiss: () => {setVisible(false); latest.current.onDismiss?.();},
        }), []);
        return visible ? React.createElement(Portal, null, React.createElement('Sheet', props)) : null;
    });
    const mocks = {
        'react-native': {
            View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput',
            AccessibilityInfo: {announceForAccessibility: message => calls.announced.push(message)},
            Platform: {OS: platform, select: options => options[platform] ?? options.default},
            StyleSheet: {create: value => value, hairlineWidth: 1},
        },
        '@gorhom/bottom-sheet': {
            BottomSheetModalProvider: SheetProvider, BottomSheetModal: Sheet,
            BottomSheetBackdrop: 'Backdrop', BottomSheetView: 'SheetView',
            BottomSheetScrollView: 'SheetScrollView', BottomSheetTextInput: 'NativeSheetInput',
        },
        'expo-router': {usePathname: () => '/watchlist'},
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 24})},
        'react-native-reanimated': {__esModule: true, default: {View: 'AnimatedView'}},
    };
    for (const prefix of ['../', '../../']) {
        mocks[`${prefix}hooks/use-palette`] = {usePalette: () => ({colors: {}, scheme: 'dark'})};
        mocks[`${prefix}hooks/use-responsive`] = {useResponsive: () => ({isLarge})};
        mocks[`${prefix}hooks/use-android-back`] = {useAndroidBackHandler: () => {}};
        mocks[`${prefix}hooks/use-haptics`] = {useHaptics: () => ({select: () => {}})};
    }
    const motion = {PressableScale: 'Button', enterPop: () => undefined, enterRise: () => undefined};
    const text = {ThemedText: 'Text'};
    mocks['./motion'] = mocks['../../components/motion'] = motion;
    mocks['./themed-text'] = mocks['../../components/themed-text'] = text;
    const confirm = loadTypeScript('presentation/components/confirm-dialog.tsx', mocks);
    const toast = loadTypeScript('presentation/components/toast.tsx', mocks);
    mocks['./confirm-dialog'] = mocks['../../components/confirm-dialog'] = confirm;
    mocks['./toast'] = mocks['../../components/toast'] = toast;
    const {OverlayProvider} = loadTypeScript('presentation/components/overlay-provider.tsx', mocks);
    const {WatchlistActionsSheet} = loadTypeScript('presentation/movies/components/WatchlistActionsSheet.tsx', mocks);
    const {WatchlistSheetInput} = loadTypeScript('presentation/movies/components/WatchlistSheet.tsx', mocks);
    const state = {watched: {}, memberships: {}, clearedAt: 0, collections: {
        weekend: {name: 'Weekend', updatedAt: 1, removedAt: 0},
    }};
    const library = {removeCollection: id => {
        if (removalFails) throw new Error('Disk full');
        calls.removed.push(id);
    }};
    function App() {
        const [visible, setVisible] = React.useState(true);
        return React.createElement(OverlayProvider, null,
            React.createElement(WatchlistActionsSheet, {
                visible, movie: null, library, state, onClose: () => setVisible(false),
                onRemove: () => {}, onSelectCollection: () => {},
            }));
    }
    return {App, calls, OverlayProvider, WatchlistSheetInput};
}

async function mount(t, element) {
    let renderer;
    await act(async () => {renderer = create(element);});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

async function press(renderer, label) {
    const button = renderer.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label);
    assert.ok(button, `Missing button: ${label}`);
    await act(async () => button.props.onPress());
}

test('watchlist portal content retains confirmation context and deletes only after approval', async t => {
    const f = fixture();
    const renderer = await mount(t, React.createElement(f.App));
    assert.equal(renderer.root.findAllByType('Sheet').length, 1);
    await press(renderer, 'Delete Weekend');
    assert.deepEqual(f.calls.removed, []);
    assert.equal(renderer.root.findAllByType('Sheet').length, 1);
    await press(renderer, 'Delete');
    assert.deepEqual(f.calls.removed, ['weekend']);
    assert.equal(renderer.root.findAllByType('Sheet').length, 0);
});

test('cancelling a confirmation from a watchlist portal preserves the collection', async t => {
    const f = fixture();
    const renderer = await mount(t, React.createElement(f.App));
    await press(renderer, 'Delete Weekend');
    await press(renderer, 'Cancel');
    assert.deepEqual(f.calls.removed, []);
    assert.equal(renderer.root.findAllByType('Sheet').length, 0);
});

test('a failed collection deletion keeps toast feedback available across the portal', async t => {
    const f = fixture({removalFails: true});
    const renderer = await mount(t, React.createElement(f.App));
    await press(renderer, 'Delete Weekend');
    await press(renderer, 'Delete');
    assert.deepEqual(f.calls.removed, []);
    assert.deepEqual(f.calls.announced, ['This collection could not be deleted.']);
    assert.equal(renderer.root.findAllByType('AnimatedView').some(node => node.props.accessibilityRole === 'alert'), true);
});

test('compact web watchlist editors use browser text inputs and retain blur callbacks', async t => {
    const f = fixture({platform: 'web'});
    const renderer = await mount(t, React.createElement(f.WatchlistSheetInput, {
        value: 'Weekend', onBlur: () => f.calls.blurred++, accessibilityLabel: 'Collection name',
    }));
    assert.equal(renderer.root.findAllByType('NativeSheetInput').length, 0);
    const input = renderer.root.findByType('TextInput');
    assert.equal(input.props.value, 'Weekend');
    await act(async () => input.props.onBlur());
    assert.equal(f.calls.blurred, 1);
});

test('compact native watchlist editors retain bottom-sheet keyboard integration', async t => {
    for (const platform of ['android', 'ios']) {
        const f = fixture({platform});
        const renderer = await mount(t, React.createElement(f.WatchlistSheetInput, {value: 'Weekend'}));
        assert.equal(renderer.root.findAllByType('TextInput').length, 0);
        assert.equal(renderer.root.findByType('NativeSheetInput').props.value, 'Weekend');
    }
});
