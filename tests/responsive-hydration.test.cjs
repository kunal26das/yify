const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {renderToString} = require('react-dom/server');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture(platform = 'web') {
    let window = {width: 0, height: 0, scale: 1, fontScale: 1};
    const listeners = new Set();
    const {useResponsive} = loadTypeScript('presentation/hooks/use-responsive.ts', {
        'react-native': {
            Platform: {OS: platform},
            useWindowDimensions: () => {
                const [dimensions, setDimensions] = React.useState(() => window);
                React.useEffect(() => {
                    const listener = () => setDimensions(window);
                    listeners.add(listener);
                    listener();
                    return () => listeners.delete(listener);
                }, []);
                return dimensions;
            },
        },
    });
    return {
        useResponsive, listeners,
        resize: (width, height) => {
            window = {...window, width, height};
            listeners.forEach(listener => listener({window}));
        },
    };
}

test('server markup uses one stable snapshot even when desktop dimensions are available during hydration', () => {
    const f = fixture();
    function Navigation() {
        const {isPhone, width} = f.useResponsive();
        return React.createElement('nav', null,
            isPhone ? React.createElement('button', null, 'Search') : React.createElement('input', {placeholder: 'Search'}),
            width >= 768 ? React.createElement('select', {defaultValue: 'all'}, React.createElement('option', {value: 'all'}, 'All')) : null);
    }
    const html = renderToString(React.createElement(Navigation));
    assert.equal(html, '<nav><button>Search</button></nav>');
    f.resize(1440, 900);
    assert.equal(renderToString(React.createElement(Navigation)), html);
    f.resize(390, 844);
    assert.equal(renderToString(React.createElement(Navigation)), html);
    assert.equal(f.listeners.size, 0);
});

test('native dimensions are never replaced by the web hydration snapshot', () => {
    const f = fixture('ios');
    function Screen() {
        const {width, breakpoint} = f.useResponsive();
        return React.createElement('span', null, `${breakpoint}:${width}`);
    }
    f.resize(390, 844);
    assert.equal(renderToString(React.createElement(Screen)), '<span>phone:390</span>');
    f.resize(844, 390);
    assert.equal(renderToString(React.createElement(Screen)), '<span>tablet:844</span>');
});

test('client snapshots use real initial dimensions and keep native rotation and web resize updates', async t => {
    const f = fixture();
    f.resize(390, 844);
    let current;
    function Screen() {
        current = f.useResponsive();
        return React.createElement('size', current);
    }
    let renderer;
    await act(async () => {renderer = create(React.createElement(Screen));});
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.equal(current.width, 390);
    assert.equal(current.height, 844);
    assert.equal(current.isPhone, true);
    assert.equal(current.gutter, 16);
    assert.equal(f.listeners.size, 1);
    for (const [width, height, breakpoint, contentMaxWidth, gutter] of [
        [844, 390, 'tablet', 844, 24],
        [1200, 800, 'desktop', 1120, 32],
        [1440, 900, 'wide', 1320, 32],
        [320, 568, 'phone', 320, 16],
    ]) {
        await act(async () => f.resize(width, height));
        assert.equal(current.width, width);
        assert.equal(current.height, height);
        assert.equal(current.breakpoint, breakpoint);
        assert.equal(current.contentMaxWidth, contentMaxWidth);
        assert.equal(current.gutter, gutter);
        assert.equal(f.listeners.size, 1);
    }
    await act(async () => renderer.unmount());
    assert.equal(f.listeners.size, 0);
});
