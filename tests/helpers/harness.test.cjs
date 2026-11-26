const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const React = require('react');
const {loadTs, transpileTs} = require('./loadTs.cjs');
const {createRnMock, spy} = require('./rnMock.cjs');
const {act, render} = require('./render.cjs');
const brand = require('../../config/brand.json');

function writeModule(t, name, source) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-harness-'));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const file = path.join(directory, name);
    fs.writeFileSync(file, source);
    return file;
}

test('loadTs resolves @/ imports, JSON imports and mocks from a TSX module', (t) => {
    const file = writeModule(t, 'Probe.tsx', `
        import {View, Text, useWindowDimensions} from 'react-native';
        import {slugify} from '@/core/domain/slug';
        import {brand} from '@/core/config/brand';
        import type {TitleKey} from '@/core/domain/keys';
        export const KEY: TitleKey = 'movie:603';
        export function Probe({title}: {title: string}) {
            const {width} = useWindowDimensions();
            return (
                <View role="button" aria-label={brand.appName}>
                    <Text>{slugify(title)}</Text>
                    <Text>{width}</Text>
                </View>
            );
        }
    `);
    const rn = createRnMock();
    const {Probe, KEY} = loadTs(file, {'react-native': rn});
    assert.equal(KEY, 'movie:603');
    const view = render(React.createElement(Probe, {title: 'The Matrix'}));
    const [button] = view.byRole('button');
    assert.equal(button.type, 'View');
    assert.equal(view.byLabel(brand.appName)[0], button);
    const texts = () => view.root.findAll((node) => node.type === 'Text').map((node) => node.props.children);
    assert.deepEqual(texts(), ['the-matrix', 390]);
    act(() => rn.setWindowDimensions({width: 1280}));
    assert.deepEqual(texts(), ['the-matrix', 1280]);
    view.update(React.createElement(Probe, {title: 'Fast & Furious'}));
    assert.deepEqual(texts(), ['fast-and-furious', 1280]);
    view.unmount();
});

test('the react-native mock keeps props on host components and records spy calls', () => {
    const rn = createRnMock();
    const items = [{id: 'a'}, {id: 'b'}];
    const view = render(React.createElement(rn.FlatList, {
        data: items, keyExtractor: (item) => item.id, accessibilityLabel: 'Results',
        renderItem: ({item}) => React.createElement(rn.Text, {role: 'listitem'}, item.id),
    }));
    assert.equal(view.byLabel('Results')[0].props.data, items);
    assert.deepEqual(view.byRole('listitem').map((node) => node.props.children), ['a', 'b']);
    rn.Linking.openURL('https://example.test');
    assert.deepEqual(rn.Linking.openURL.calls, [['https://example.test']]);
    assert.equal(rn.Platform.OS, 'android');
    assert.equal(rn.Platform.select({android: 'a', default: 'd'}), 'a');
    assert.deepEqual(rn.StyleSheet.flatten([{a: 1}, [{b: 2}], null]), {a: 1, b: 2});
    const listener = spy();
    const subscription = rn.AppState.addEventListener('change', listener);
    rn.setAppState('background');
    subscription.remove();
    rn.setAppState('active');
    assert.deepEqual(listener.calls, [['background']]);
    assert.equal(rn.AppState.currentState, 'active');
});

test('transpileTs keeps type-only imports out of the CommonJS output', () => {
    const code = transpileTs("import type {A} from './a';\nimport b from './b';\nexport const value: A = b;\n", 'probe.ts');
    assert.match(code, /require\("\.\/b"\)/);
    assert.doesNotMatch(code, /require\("\.\/a"\)/);
});
