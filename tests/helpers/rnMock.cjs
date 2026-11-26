const React = require('react');

function spy(implementation = () => undefined) {
    const calls = [];
    const fn = (...args) => {
        calls.push(args);
        return implementation(...args);
    };
    fn.calls = calls;
    return fn;
}

function createSubscribable(initial) {
    let value = initial;
    const listeners = new Set();
    return {
        get: () => value,
        set(next) {
            value = next;
            for (const listener of [...listeners]) listener(value);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

function useSubscribable(store) {
    return React.useSyncExternalStore(store.subscribe, store.get, store.get);
}

function flattenStyle(style) {
    if (!Array.isArray(style)) return style ?? undefined;
    return style.reduce((merged, item) => {
        const flat = flattenStyle(item);
        return flat && typeof flat === 'object' ? {...merged, ...flat} : merged;
    }, {});
}

function createRnMock() {
    const dimensions = createSubscribable({width: 390, height: 844, scale: 3, fontScale: 1});
    const colorScheme = createSubscribable('dark');
    const appState = createSubscribable('active');
    const appStateListeners = new Map();

    const FlatList = React.forwardRef(function FlatList(props, ref) {
        const {data = [], renderItem, keyExtractor} = props;
        const items = renderItem ? data.map((item, index) => React.createElement(React.Fragment, {
            key: keyExtractor ? keyExtractor(item, index) : String(item?.key ?? index),
        }, renderItem({item, index, separators: {}}))) : null;
        return React.createElement('FlatList', {...props, ref}, items);
    });

    const AccessibilityInfo = {
        announceForAccessibility: spy(),
        setAccessibilityFocus: spy(),
        isReduceMotionEnabled: spy(() => Promise.resolve(false)),
        isScreenReaderEnabled: spy(() => Promise.resolve(false)),
        addEventListener: spy(() => ({remove: () => undefined})),
    };

    const AppState = {
        get currentState() {
            return appState.get();
        },
        addEventListener: spy((type, listener) => {
            if (type !== 'change') return {remove: () => undefined};
            const unsubscribe = appState.subscribe(listener);
            appStateListeners.set(listener, unsubscribe);
            return {remove: () => {
                unsubscribe();
                appStateListeners.delete(listener);
            }};
        }),
    };

    const Linking = {
        openURL: spy(() => Promise.resolve(true)),
        canOpenURL: spy(() => Promise.resolve(true)),
        getInitialURL: spy(() => Promise.resolve(null)),
        addEventListener: spy(() => ({remove: () => undefined})),
    };

    return {
        View: 'View',
        Text: 'Text',
        Pressable: 'Pressable',
        ScrollView: 'ScrollView',
        FlatList,
        TextInput: 'TextInput',
        Modal: 'Modal',
        Image: 'Image',
        ActivityIndicator: 'ActivityIndicator',
        KeyboardAvoidingView: 'KeyboardAvoidingView',
        StyleSheet: {
            create: (styles) => styles,
            flatten: flattenStyle,
            compose: (first, second) => [first, second],
            hairlineWidth: 1,
            absoluteFill: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0},
            absoluteFillObject: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0},
        },
        Platform: {
            OS: 'android',
            Version: 36,
            select: (choices) => ('android' in choices ? choices.android : 'native' in choices ? choices.native : choices.default),
        },
        AccessibilityInfo,
        AppState,
        Linking,
        useWindowDimensions: () => useSubscribable(dimensions),
        useColorScheme: () => useSubscribable(colorScheme),
        setWindowDimensions: (size) => dimensions.set({...dimensions.get(), ...size}),
        setColorScheme: (scheme) => colorScheme.set(scheme),
        setAppState: (state) => appState.set(state),
    };
}

module.exports = {createRnMock, spy};
