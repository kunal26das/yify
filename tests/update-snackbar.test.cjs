const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function fixture(t, platform, status = {state: 'ready', progress: 1}) {
    const calls = {restarted: 0, dismissed: 0};
    const {UpdateSnackbar} = loadTypeScript('presentation/components/update-snackbar.tsx', {
        'react-native': {Platform: {OS: platform, select: value => value[platform] ?? value.default},
            View: 'View', StyleSheet: {create: value => value}},
        'react-native-reanimated': {View: 'AnimatedView'},
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({bottom: 24})},
        '@expo/vector-icons/Ionicons': 'Icon',
        '@/domain': {IDLE_UPDATE_STATUS: {state: 'idle', progress: 0}},
        '../di/DependenciesContext': {useAppUpdates: () => ({
            getStatus: () => status,
            subscribe: () => () => {},
            restart: () => calls.restarted++,
            dismiss: () => calls.dismissed++,
        })},
        './motion': {Duration: {base: 200}, PressableScale: 'Button', enterPop: () => undefined, enterRise: () => undefined},
        './themed-text': {ThemedText: 'Text'},
        '../hooks/use-palette': {usePalette: () => ({colors: {}, scheme: 'dark'})},
    });
    let renderer;
    await act(async () => {renderer = create(React.createElement(UpdateSnackbar));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {calls, renderer,
        buttons: () => renderer.root.findAllByType('Button'),
        text: () => renderer.root.findAllByType('Text').map(node => node.children.join('')).join('\n')};
}

test('Android explains the next-start update without exposing a crashing live restart', async t => {
    const f = await fixture(t, 'android');
    assert.match(f.text(), /Update downloaded\. Applies on next app start\./);
    assert.doesNotMatch(f.text(), /Installing|restart to apply|Restart/);
    assert.deepEqual(f.buttons().map(node => node.props.accessibilityLabel), ['Dismiss']);
    assert.equal(f.renderer.root.findByType('Text').props.numberOfLines, undefined,
        'The complete next-start instruction can wrap on narrow screens and at large text sizes');
    await act(async () => f.buttons()[0].props.onPress());
    assert.deepEqual(f.calls, {restarted: 0, dismissed: 1});
});

for (const platform of ['ios', 'web']) {
    test(`${platform} retains its working explicit restart action`, async t => {
        const f = await fixture(t, platform);
        assert.match(f.text(), /Update ready — restart to apply/);
        const restart = f.buttons().find(node => node.props.accessibilityLabel === 'Restart to apply the update');
        assert.ok(restart);
        await act(async () => restart.props.onPress());
        assert.deepEqual(f.calls, {restarted: 1, dismissed: 0});
    });
}
