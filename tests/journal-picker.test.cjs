const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const movie = {id: 1, title: 'Arrival', year: 2016};
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
const deferred = () => {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};};

async function fixture(t, options = {}) {
    const requests = [];
    const selections = [];
    const pending = [];
    const repository = {listMovies: params => {requests.push(params); const request = deferred(); pending.push(request); return request.promise;}};
    const colors = new Proxy({}, {get: () => '#123456'});
    const {JournalMoviePicker} = loadTypeScript('presentation/journal/JournalMoviePicker.tsx', {
        'react-native': {ActivityIndicator: 'Spinner', View: 'View', StyleSheet: {create: value => value},
            Platform: {OS: 'web', select: value => value.web ?? value.default}},
        '../components/motion': {PressableScale: 'Button'},
        '../components/themed-text': {ThemedText: 'Text'},
        '../hooks/use-palette': {usePalette: () => ({colors})},
        '../movies/components/WatchlistSheet': {
            WatchlistSheet: ({children}) => React.createElement('Sheet', null, children), WatchlistSheetInput: 'Input',
        },
    });
    let props = {visible: true, repository, savedMovies: [movie], onSelect: value => selections.push(value), onClose() {}, ...options};
    let renderer;
    await act(async () => {renderer = create(React.createElement(JournalMoviePicker, props));});
    t.after(async () => {await act(async () => renderer.unmount());});
    const button = label => renderer.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label);
    return {requests, selections, pending, renderer, button,
        text: () => renderer.root.findAllByType('Text').map(nodeText).join('\n'),
        change: async value => act(async () => renderer.root.findByType('Input').props.onChangeText(value)),
        press: async label => {assert.ok(button(label), label); await act(async () => button(label).props.onPress());},
        submit: async () => act(async () => renderer.root.findByType('Input').props.onSubmitEditing()),
        settle: async (index, result, fail = false) => act(async () => {pending[index][fail ? 'reject' : 'resolve'](result);}),
        props: async patch => {props = {...props, ...patch}; await act(async () => renderer.update(React.createElement(JournalMoviePicker, props)));},
    };
}

test('saved movies are selectable offline, and typing does not fetch or modify the journal', async t => {
    const f = await fixture(t);
    assert.match(f.text(), /Saved movies/);
    await f.change('A private query');
    assert.deepEqual(f.requests, []);
    await f.press('Log Arrival (2016)');
    assert.deepEqual(f.selections, [movie]);
    assert.deepEqual(f.requests, []);
});

test('keyboard search uses a trimmed query; a blank query clears to saved movies without a request', async t => {
    const f = await fixture(t);
    await f.change('  Arrival  '); await f.submit();
    assert.deepEqual(f.requests, [{page: 1, limit: 20, query: 'Arrival'}]);
    assert.equal(f.renderer.root.findAllByType('Spinner').length, 1);
    await f.settle(0, {movies: [], hasMore: false});
    assert.match(f.text(), /No movies found/);
    await f.change('   '); await f.press('Search journal movies');
    assert.equal(f.requests.length, 1);
    assert.match(f.text(), /Saved movies/);
    assert.ok(f.button('Log Arrival (2016)'));
});

test('an older result cannot replace the latest search or reappear after clearing', async t => {
    const f = await fixture(t);
    await f.change('Old'); await f.submit();
    await f.change('New'); await f.submit();
    await f.settle(1, {movies: [{id: 2, title: 'New result', year: 2024}], hasMore: false});
    await f.settle(0, {movies: [{id: 3, title: 'Stale result', year: 2024}], hasMore: false});
    assert.match(f.text(), /New result/); assert.doesNotMatch(f.text(), /Stale result/);
    await f.change('Pending'); await f.submit();
    await f.press('Clear journal movie search');
    await f.settle(2, {movies: [{id: 4, title: 'Cleared result', year: 2024}], hasMore: false});
    assert.match(f.text(), /Saved movies/); assert.doesNotMatch(f.text(), /Cleared result/);
});

test('search failures offer retry and saved movies, distinct from a successful empty result', async t => {
    const f = await fixture(t);
    await f.change('Arrival'); await f.submit();
    await f.settle(0, new Error('private upstream details'), true);
    assert.match(f.text(), /Movies could not be loaded/);
    assert.doesNotMatch(f.text(), /private upstream|No movies found/);
    await f.press('Retry journal movie search');
    assert.deepEqual(f.requests[1], f.requests[0]);
    await f.settle(1, {movies: [movie], hasMore: false});
    await f.press('Log Arrival (2016)');
    assert.deepEqual(f.selections, [movie]);
    await f.press('Clear journal movie search');
    assert.match(f.text(), /Saved movies/);
});

test('closing discards pending results and query, including a later reopen', async t => {
    const f = await fixture(t);
    await f.change('Private query'); await f.submit();
    await f.props({visible: false});
    await f.props({visible: true});
    await f.settle(0, {movies: [{id: 2, title: 'Private result', year: 2024}], hasMore: false});
    assert.equal(f.renderer.root.findByType('Input').props.value, '');
    assert.match(f.text(), /Saved movies/); assert.doesNotMatch(f.text(), /Private result/);
});

test('large saved lists and catalog results remain bounded and offer explicit search guidance', async t => {
    const movies = Array.from({length: 25}, (_, index) => ({...movie, id: index + 1, title: `Movie ${index + 1}`}));
    const f = await fixture(t, {savedMovies: movies});
    assert.equal(f.renderer.root.findAllByType('Button').filter(node => node.props.accessibilityLabel.startsWith('Log ')).length, 20);
    assert.match(f.text(), /Showing your first 20 saved movies/);
    await f.change('Movie'); await f.submit();
    await f.settle(0, {movies, hasMore: true});
    assert.equal(f.renderer.root.findAllByType('Button').filter(node => node.props.accessibilityLabel.startsWith('Log ')).length, 20);
    assert.match(f.text(), /more specific title/);
});
