const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture({width = 390, height = 640, platform = 'android'} = {}) {
    let dimensions = {width, height};
    let back;
    const instances = [];
    const calls = {closed: 0};
    const list = name => props => React.createElement(name, props,
        props.ListHeaderComponent,
        props.data.length ? props.data.map((item, index) => React.cloneElement(props.renderItem({item, index}),
            {key: props.keyExtractor(item)})) : props.ListEmptyComponent);
    const Sheet = React.forwardRef((props, ref) => {
        const instance = React.useRef(null);
        if (!instance.current) {
            instance.current = {presented: 0, dismissed: 0, props};
            instances.push(instance.current);
        }
        instance.current.props = props;
        React.useImperativeHandle(ref, () => ({
            present: () => {instance.current.presented++;},
            dismiss: () => {
                instance.current.dismissed++;
                instance.current.props.onDismiss();
            },
        }), []);
        return React.createElement('Sheet', props, props.children);
    });
    const components = loadTypeScript('presentation/movies/components/PickerSheet.tsx', {
        'react-native': {
            FlatList: list('FlatList'), KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal',
            Pressable: 'Pressable', TextInput: 'TextInput', View: 'View',
            Platform: {OS: platform, select: options => options[platform] ?? options.default},
            StyleSheet: {create: value => value, absoluteFill: {}, hairlineWidth: 1},
        },
        '@gorhom/bottom-sheet': {
            BottomSheetModal: Sheet, BottomSheetBackdrop: 'Backdrop',
            BottomSheetFlatList: list('SheetList'), BottomSheetTextInput: 'SheetInput',
        },
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 24, bottom: 16})},
        '../../components/motion': {PressableScale: 'PressableScale'},
        '../../components/themed-text': {ThemedText: 'Text'},
        '../../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../../hooks/use-responsive': {useResponsive: () => ({...dimensions, isLarge: dimensions.width >= 600})},
        '../../hooks/use-android-back': {useAndroidBackHandler: (active, callback) => {
            React.useEffect(() => {
                back = active ? callback : undefined;
                return () => {if (back === callback) back = undefined;};
            }, [active, callback]);
        }},
    });
    function Picker() {
        const [query, setQuery] = React.useState('');
        return React.createElement(components.PickerSheet, {
            title: 'Choose a country', onClose: () => calls.closed++, backdropLabel: 'Close country picker',
            listProps: {
                data: [{code: 'IN', name: 'India'}, {code: 'ZW', name: 'Zimbabwe'}],
                keyExtractor: item => item.code,
                renderItem: ({item}) => React.createElement('Text', null, item.name),
                ListHeaderComponent: React.createElement(components.PickerSheetInput, {
                    value: query, onChangeText: setQuery, accessibilityLabel: 'Search countries',
                }),
            },
            footer: React.createElement('Footer'),
        });
    }
    return {Picker, calls, instances, back: () => back,
        resize: (width, height = dimensions.height) => {dimensions = {width, height};}};
}

async function mount(t, f) {
    let renderer;
    await act(async () => {renderer = create(React.createElement(f.Picker));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return renderer;
}

test('compact pickers present a keyboard-aware sheet with the footer outside its scrolling list', async t => {
    const f = fixture({width: 599, height: 360});
    const renderer = await mount(t, f);
    assert.equal(f.instances[0].presented, 1);
    assert.equal(renderer.root.findAllByType('Modal').length, 0);
    const sheet = renderer.root.findByType('Sheet');
    assert.equal(sheet.props.enablePanDownToClose, true);
    assert.equal(sheet.props.enableDynamicSizing, false);
    assert.equal(sheet.props.keyboardBehavior, 'interactive');
    assert.equal(sheet.props.android_keyboardInputMode, 'adjustResize');
    const list = renderer.root.findByType('SheetList');
    assert.equal(list.props.keyboardShouldPersistTaps, 'handled');
    assert.equal(list.findAllByType('SheetInput').length, 1);
    assert.equal(list.findAllByType('Footer').length, 0);
    assert.equal(sheet.findAllByType('Footer').length, 1);
    assert.equal(f.back() instanceof Function, true);
});

test('resizing between sheet and dialog preserves search and ignores stale sheet dismissal callbacks', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    const firstDismiss = f.instances[0].props.onDismiss;
    await act(async () => renderer.root.findByType('SheetInput').props.onChangeText('Zimbabwe'));
    f.resize(600);
    await act(async () => renderer.update(React.createElement(f.Picker)));
    assert.equal(renderer.root.findAllByType('Sheet').length, 0);
    assert.equal(renderer.root.findByType('Modal').props.visible, true);
    assert.equal(renderer.root.findByType('TextInput').props.value, 'Zimbabwe');
    assert.equal(f.calls.closed, 0);
    assert.equal(f.back(), undefined);
    await act(async () => firstDismiss());
    assert.equal(f.calls.closed, 0);
    f.resize(390);
    await act(async () => renderer.update(React.createElement(f.Picker)));
    assert.equal(f.instances.length, 2);
    assert.equal(f.instances[1].presented, 1);
    assert.equal(renderer.root.findByType('SheetInput').props.value, 'Zimbabwe');
    await act(async () => firstDismiss());
    assert.equal(f.calls.closed, 0);
    await act(async () => f.instances[1].props.onDismiss());
    assert.equal(f.calls.closed, 1);
});

test('a gesture dismissal notifies the parent once', async t => {
    const f = fixture();
    await mount(t, f);
    const dismiss = f.instances[0].props.onDismiss;
    await act(async () => {dismiss(); dismiss();});
    assert.equal(f.calls.closed, 1);
});

test('compact web sheets search without native keyboard APIs and preserve input when resized', async t => {
    const f = fixture({platform: 'web'});
    const renderer = await mount(t, f);
    assert.equal(renderer.root.findAllByType('SheetInput').length, 0);
    await act(async () => renderer.root.findByType('TextInput').props.onChangeText('Japan'));
    assert.equal(renderer.root.findByType('TextInput').props.value, 'Japan');
    f.resize(1024);
    await act(async () => renderer.update(React.createElement(f.Picker)));
    assert.equal(renderer.root.findByType('TextInput').props.value, 'Japan');
    assert.equal(f.calls.closed, 0);
});

test('the close button and Android back ignore a subsequent sheet dismissal', async t => {
    for (const closeUsing of ['button', 'back']) {
        const f = fixture();
        const renderer = await mount(t, f);
        const dismiss = f.instances[0].props.onDismiss;
        await act(async () => {
            if (closeUsing === 'button') renderer.root.findByType('PressableScale').props.onPress();
            else f.back()();
        });
        await act(async () => dismiss());
        assert.equal(f.calls.closed, 1);
    }
});

test('unmounting clears the Android back handler and suppresses late dismissals', async t => {
    const f = fixture();
    const renderer = await mount(t, f);
    const dismiss = f.instances[0].props.onDismiss;
    await act(async () => renderer.unmount());
    await act(async () => dismiss());
    assert.equal(f.back(), undefined);
    assert.equal(f.calls.closed, 0);
});

test('wide dialogs support backdrop and system dismissal without activating a bottom sheet', async t => {
    for (const closeUsing of ['backdrop', 'system']) {
        const f = fixture({width: 1024});
        const renderer = await mount(t, f);
        assert.equal(f.instances.length, 0);
        assert.equal(f.back(), undefined);
        assert.equal(renderer.root.findByType('FlatList').props.keyboardShouldPersistTaps, 'handled');
        await act(async () => {
            if (closeUsing === 'backdrop') renderer.root.findByType('Pressable').props.onPress();
            else renderer.root.findByType('Modal').props.onRequestClose();
        });
        assert.equal(f.calls.closed, 1);
    }
});
