const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture({nativeFailure = false} = {}) {
    const failure = new TypeError("Cannot read property 'default' of undefined");
    const renders = [];
    function ExpoBlurView(props) {
        renders.push(props);
        if (nativeFailure) throw failure;
        return React.createElement('ExpoBlurView', props);
    }
    const mocks = {
        'react-native': {Platform: {OS: 'android'}, View: 'View', StyleSheet: {create: value => value}},
        'expo-blur': {
            BlurView: props => React.createElement(ExpoBlurView, props),
            BlurTargetView: 'BlurTargetView',
        },
        'expo-glass-effect': {
            GlassView: 'GlassView', GlassContainer: 'GlassContainer',
            isLiquidGlassAvailable: () => assert.fail('Android must not query iOS liquid glass'),
        },
    };
    const target = loadTypeScript('presentation/components/blur-target.tsx', mocks);
    const {LiquidGlassView} = loadTypeScript('presentation/components/liquid-glass-view.tsx', {
        ...mocks, './blur-target': target,
    });
    function Content() {
        const [count, setCount] = React.useState(0);
        return React.createElement('Button', {onPress: () => setCount(value => value + 1)},
            React.createElement('Text', null, `Watchlist ${count}`));
    }
    const style = {borderRadius: 18, padding: 12};
    const element = (active = true) => React.createElement(active ? target.BlurTargetProvider : React.Fragment, null,
        React.createElement(LiquidGlassView, {style, fallbackBackgroundColor: '#18222f', tint: 'dark', intensity: 45},
            React.createElement(Content)));
    return {failure, renders, style, element};
}

async function mount(t, element) {
    let renderer;
    await act(async () => { renderer = create(element); });
    t.after(async () => { await act(async () => renderer.unmount()); });
    return renderer;
}

async function assertContentStillWorks(renderer) {
    assert.equal(renderer.root.findByType('Text').props.children, 'Watchlist 0');
    await act(async () => renderer.root.findByType('Button').props.onPress());
    assert.equal(renderer.root.findByType('Text').props.children, 'Watchlist 1');
}

test('an ExpoBlurView render throws the historical missing-default error and preserves usable children on a solid surface', async t => {
    const f = fixture({nativeFailure: true});
    const errors = [];
    t.mock.method(console, 'error', (...args) => errors.push(args));
    const renderer = await mount(t, f.element());
    assert.ok(f.renders.length > 0, 'the native blur render must actually throw');
    assert.ok(errors.some(args => args.includes(f.failure)), 'React must catch the original native render failure');
    assert.ok(errors.every(args => args.includes(f.failure) || String(args[0]).includes('react-test-renderer is deprecated')));
    assert.equal(renderer.root.findAllByType('ExpoBlurView').length, 0);
    assert.equal(renderer.toJSON().type, 'View');
    assert.deepEqual(renderer.toJSON().props.style, [f.style, {backgroundColor: '#18222f'}]);
    await assertContentStillWorks(renderer);
});

test('Android without an active blur target never mounts the missing native component', async t => {
    const f = fixture({nativeFailure: true});
    const renderer = await mount(t, f.element(false));
    assert.equal(f.renders.length, 0);
    assert.equal(renderer.toJSON().type, 'View');
    assert.deepEqual(renderer.toJSON().props.style, [f.style, {backgroundColor: '#18222f'}]);
    await assertContentStillWorks(renderer);
    assert.equal(f.renders.length, 0);
});

test('an available Android blur target still renders the native effect and its children', async t => {
    const f = fixture();
    const renderer = await mount(t, f.element());
    const blur = renderer.root.findByType('ExpoBlurView');
    assert.equal(blur.props.blurMethod, 'dimezisBlurViewSdk31Plus');
    assert.ok(blur.props.blurTarget);
    assert.equal(blur.props.tint, 'dark');
    assert.equal(blur.props.intensity, 45);
    assert.deepEqual(blur.props.style, f.style);
    await assertContentStillWorks(renderer);
});
