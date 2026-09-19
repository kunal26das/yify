const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const policy = loadTypeScript('domain/policies/journal.ts');
const insights = loadTypeScript('domain/policies/journalInsights.ts');
const movie = {id: 1, title: 'A private favorite', year: 2024, runtimeMinutes: 90, genres: ['Drama'], posterUrl: null};
const entry = {id: 'entry-one', movie, watchedOn: '2024-02-29', rating: 7, note: 'My private note', updatedAt: 100, deletedAt: 0};
const nodeText = node => typeof node === 'string' ? node : node.children?.map(nodeText).join('') ?? '';
function observable(initial) {
    let value = initial;
    const listeners = new Set();
    return {get: () => value, set: patch => {value = {...value, ...patch}; listeners.forEach(listener => listener());},
        subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);}};
}

async function fixture(t, options = {}) {
    const session = observable({ready: true, account: {uid: 'alice'}, signingIn: false, available: true, error: null, ...options.session});
    const purchase = observable({ready: true, adsRemoved: false, ...options.purchase});
    const snapshot = observable({ready: true, entries: [entry], syncing: false, error: null, ...options.snapshot});
    const calls = {saved: [], removed: [], events: [], paywalls: [], links: [], searches: [], confirmations: [], signIn: 0, closed: 0, retries: 0, confirms: []};
    const repository = {
        save(input) {if (options.saveError) throw new Error(typeof options.saveError === 'string' ? options.saveError : 'private server details'); calls.saved.push(input); return input.id ?? 'new-entry';},
        remove(id) {calls.removed.push(id);}, retrySync() {calls.retries++;},
    };
    const moviesRepository = {listMovies: params => {calls.searches.push(params); return options.search?.(params) ?? Promise.resolve({movies: [], hasMore: false});}};
    const hook = state => React.useSyncExternalStore(state.subscribe, state.get);
    const colors = new Proxy({}, {get: () => '#123456'});
    const mocks = {
        '@/domain': {...policy, ...insights},
        'react-native': {
            ActivityIndicator: 'Spinner', View: 'View', ScrollView: 'ScrollView', StyleSheet: {create: value => value},
            Platform: {OS: 'web', select: value => value.web ?? value.default},
            FlatList: ({data, renderItem, ListHeaderComponent, ListEmptyComponent}) => React.createElement('List', null,
                ListHeaderComponent, ...data.map(item => React.createElement(React.Fragment, {key: item.id}, renderItem({item}))),
                data.length ? null : ListEmptyComponent),
        },
        'expo-image': {Image: 'Image'},
        '@expo/vector-icons/Ionicons': 'Icon',
        'react-native-safe-area-context': {useSafeAreaInsets: () => ({top: 0, bottom: 12})},
        '../analytics/events': {Analytics: {journal: action => calls.events.push(action)}},
        '../components/confirm-dialog': {useConfirm: () => request => calls.confirms.push(request)},
        '../components/motion': {PressableScale: 'Button'},
        '../components/screen': {Screen: ({children, overlays}) => React.createElement('Screen', null, children, overlays)},
        '../components/themed-text': {ThemedText: 'Text'},
        '../di/DependenciesContext': {useJournalRepository: () => repository,
            useMovieRepository: () => moviesRepository,
            useAuthRepository: () => ({getSession: session.get, async signIn() {calls.signIn++; return false;}})},
        '../hooks/use-auth': {useAuth: () => hook(session)},
        '../hooks/use-journal': {useJournal: () => hook(snapshot)},
        '../hooks/use-palette': {usePalette: () => ({colors})},
        '../hooks/use-purchases': {usePurchases: () => hook(purchase)},
        '../hooks/use-responsive': {useResponsive: () => ({width: 360, contentMaxWidth: 360, gutter: 16, isPhone: true})},
        '../movies/components/TopBar': {useTopBarHeight: () => 64},
        '../movies/constants/destinations': {useGoTo: () => value => calls.links.push(value)},
        '../movies/useWatchlist': {useWatchlist: () => options.savedMovies ?? []},
        '../purchases/supporter-paywall': {useSupporterPaywall: () => value => calls.paywalls.push(value)},
        '../movies/components/WatchlistSheet': {
            WatchlistSheet: ({children, visible}) => visible ? React.createElement('Sheet', null, children) : null,
            WatchlistSheetInput: 'Input',
        },
    };
    const Component = options.editor ? loadTypeScript('presentation/journal/JournalEditor.tsx', mocks).JournalEditor
        : loadTypeScript('presentation/journal/JournalScreen.tsx', mocks).JournalScreen;
    let props = options.editor ? {visible: true, movie, onClose: () => calls.closed++, onSaved: kind => calls.confirmations.push(kind), ...options.props} : {};
    let renderer;
    await act(async () => {renderer = create(React.createElement(Component, props));});
    t.after(async () => {await act(async () => renderer.unmount());});
    const button = label => renderer.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label);
    return {renderer, calls, session, purchase, snapshot, button,
        text: () => renderer.root.findAllByType('Text').map(nodeText).join('\n'),
        press: async label => {const found = button(label); assert.ok(found, label); assert.ok(!found.props.disabled, `${label} is enabled`);
            await act(async () => found.props.onPress());},
        change: async (label, value) => act(async () => renderer.root.findAllByType('Input').find(node => node.props.accessibilityLabel === label).props.onChangeText(value)),
        update: async (state, patch) => act(async () => state.set(patch)),
        props: async patch => {props = {...props, ...patch}; await act(async () => renderer.update(React.createElement(Component, props)));},
    };
}

test('free accounts can read, edit and delete; only explicit insights upgrade opens the paywall', async t => {
    const f = await fixture(t);
    assert.match(f.text(), /My private note/);
    await f.press('Edit entry'); assert.match(f.text(), /Private note/);
    await f.press('Cancel journal entry');
    await f.press('Delete journal entry for A private favorite');
    assert.equal(f.calls.confirms[0].destructive, true);
    await act(async () => f.calls.confirms[0].onConfirm());
    assert.deepEqual(f.calls.removed, ['entry-one']);
    await f.press('Insights'); assert.match(f.text(), /editing stay free/);
    assert.deepEqual(f.calls.paywalls, []);
    assert.doesNotMatch(f.text(), /Watches logged|Your highest rated/);
    await f.press('Explore supporter access');
    assert.deepEqual(f.calls.paywalls, ['journal_insights']);
    assert.deepEqual(f.calls.events, ['opened', 'entry_deleted', 'insights_opened', 'upgrade_opened']);
});

test('loading entitlements do not flash an upgrade prompt or hide free entries', async t => {
    const f = await fixture(t, {purchase: {ready: false, adsRemoved: false}});
    assert.match(f.text(), /My private note/);
    await f.press('Insights');
    assert.equal(f.button('Explore supporter access'), undefined);
    assert.equal(f.renderer.root.findAllByType('Spinner').length, 1);
    await f.update(f.purchase, {ready: true, adsRemoved: true});
    await f.press('All time');
    assert.match(f.text(), /Watches logged/); assert.match(f.text(), /1h 30m/);
    assert.deepEqual(f.calls.paywalls, []);
});

test('active and legacy supporters see real insights; expired access keeps the journal readable', async t => {
    const f = await fixture(t, {purchase: {ready: true, adsRemoved: true, expiresAt: null}});
    await f.press('Insights'); await f.press('All time');
    assert.match(f.text(), /Your highest rated/); assert.match(f.text(), /Drama/);
    await f.update(f.purchase, {adsRemoved: false});
    assert.doesNotMatch(f.text(), /Your highest rated|Watches logged|My private note/);
    await f.press('Entries'); assert.match(f.text(), /My private note/);
    assert.ok(f.button('Edit entry'));
});

test('empty supporter insights have no invented ratings or sample movies', async t => {
    const f = await fixture(t, {purchase: {adsRemoved: true}, snapshot: {entries: []}});
    await f.press('Insights');
    assert.match(f.text(), /No watches logged/);
    assert.doesNotMatch(f.text(), /Your average rating|A private favorite/);
    await f.press('Entries'); await f.press('Open watchlist');
    assert.deepEqual(f.calls.links, ['/watchlist']);
});

test('guests must explicitly sign in and cannot see cached notes or supporter insights', async t => {
    const f = await fixture(t, {session: {account: null}, purchase: {adsRemoved: true}});
    assert.doesNotMatch(f.text(), /My private note|A private favorite/);
    assert.deepEqual(f.calls.paywalls, []);
    await f.press('Sign in with Google'); assert.equal(f.calls.signIn, 1);
});

test('account changes clear an open draft and a stale delete confirmation cannot remove another account entry', async t => {
    const f = await fixture(t);
    await f.press('Delete journal entry for A private favorite');
    const confirmation = f.calls.confirms[0];
    await f.press('Edit entry'); await f.change('Private note', 'unsaved secret');
    await f.update(f.session, {account: null});
    assert.equal(f.renderer.root.findAllByType('Input').length, 0);
    await act(async () => confirmation.onConfirm());
    assert.deepEqual(f.calls.removed, []);
});

test('editor accepts half-star ratings and private notes without sending content to analytics', async t => {
    const f = await fixture(t, {editor: true});
    await f.change('Watched on, YYYY-MM-DD', '2024-02-29');
    await f.press('3.5 stars'); await f.change('Private note', 'Personal memory');
    await f.press('Save entry');
    assert.deepEqual(f.calls.saved[0], {id: undefined, movie, watchedOn: '2024-02-29', rating: 7, note: 'Personal memory'});
    assert.equal(f.calls.closed, 1); assert.deepEqual(f.calls.events, ['entry_created']);
    assert.deepEqual(f.calls.confirmations, ['created']);
});

test('a guest movie logging action offers sign-in and preserves the selected movie afterwards', async t => {
    const f = await fixture(t, {editor: true, session: {account: null}});
    assert.match(f.text(), /free movie journal/);
    assert.equal(f.renderer.root.findAllByType('Input').length, 0);
    await f.press('Sign in with Google');
    assert.equal(f.calls.signIn, 1); assert.deepEqual(f.calls.paywalls, []);
    await f.update(f.session, {account: {uid: 'alice'}});
    assert.match(f.text(), /A private favorite/);
    assert.ok(f.button('Save entry'));
    await f.press('Save entry');
    assert.equal(f.calls.saved[0].movie.id, movie.id);
});

test('invalid and future dates cannot save; clear rating stores an unrated entry', async t => {
    const f = await fixture(t, {editor: true});
    for (const date of ['2024-02-30', '2999-01-01', 'bad']) {
        await f.change('Watched on, YYYY-MM-DD', date); await f.press('Save entry');
        assert.match(f.text(), /Choose a valid watch date/);
    }
    assert.deepEqual(f.calls.saved, []);
    await f.change('Watched on, YYYY-MM-DD', '2024-02-29'); await f.press('0.5 stars'); await f.press('Clear rating');
    await f.press('Save entry'); assert.equal(f.calls.saved[0].rating, null);
});

test('oversized notes and storage failures retain the draft and show safe errors', async t => {
    const f = await fixture(t, {editor: true, saveError: true});
    await f.change('Private note', 'x'.repeat(1001)); await f.press('Save entry');
    assert.match(f.text(), /within 1000 characters/);
    await f.change('Private note', 'keep this draft'); await f.press('Save entry');
    assert.match(f.text(), /could not be saved/); assert.doesNotMatch(f.text(), /private server/);
    assert.equal(f.calls.closed, 0); assert.deepEqual(f.calls.events, []);
    assert.deepEqual(f.calls.confirmations, []);
    assert.equal(f.renderer.root.findAllByType('Input').find(node => node.props.accessibilityLabel === 'Private note').props.value, 'keep this draft');
});

test('closing and reopening the editor clears canceled drafts; edits preserve the entry id', async t => {
    const f = await fixture(t, {editor: true, props: {entry}});
    await f.change('Private note', 'unsaved'); await f.press('Cancel journal entry');
    await f.props({visible: false}); await f.props({visible: true});
    const note = f.renderer.root.findAllByType('Input').find(node => node.props.accessibilityLabel === 'Private note');
    assert.equal(note.props.value, entry.note);
    await f.press('Save changes'); assert.equal(f.calls.saved[0].id, entry.id);
    assert.deepEqual(f.calls.events, ['entry_updated']);
    assert.deepEqual(f.calls.confirmations, ['updated']);
});

test('sync failures stay visible and offer a retry without locking existing journal entries', async t => {
    const f = await fixture(t, {snapshot: {error: 'sync failed'}});
    assert.match(f.text(), /saved entries are still here/); assert.match(f.text(), /My private note/);
    await f.press('Retry journal sync'); assert.equal(f.calls.retries, 1);
    assert.ok(f.button('Edit entry'));
});

test('an editor opened before journal loading fails offers recovery and cannot overwrite unread data', async t => {
    const f = await fixture(t, {editor: true, snapshot: {ready: false, error: 'private upstream message'}});
    assert.match(f.text(), /could not be loaded/); assert.doesNotMatch(f.text(), /private upstream/);
    assert.equal(f.button('Save entry').props.disabled, true);
    await f.press('Retry journal sync'); assert.equal(f.calls.retries, 1);
    assert.deepEqual(f.calls.saved, []);
});

test('known storage limits are actionable while arbitrary repository errors remain private', async t => {
    const f = await fixture(t, {editor: true, saveError: 'Your journal has reached its storage limit.'});
    await f.press('Save entry');
    assert.match(f.text(), /has reached its storage limit/);
    assert.doesNotMatch(f.text(), /could not be saved. Try again/);
    assert.equal(f.calls.closed, 0);
});

test('an account-deleted journal shows the deletion state without a loading spinner or futile retry', async t => {
    const snapshot = {ready: false, entries: [], error: 'This journal was removed by an account deletion request.'};
    const screen = await fixture(t, {snapshot});
    assert.match(screen.text(), /removed by an account deletion request/);
    assert.equal(screen.renderer.root.findAllByType('Spinner').length, 0);
    assert.equal(screen.button('Retry journal sync'), undefined);
    const editor = await fixture(t, {editor: true, snapshot});
    assert.match(editor.text(), /removed by an account deletion request/);
    assert.equal(editor.button('Save entry').props.disabled, true);
    assert.equal(editor.button('Retry journal sync'), undefined);
});

test('an empty journal logs a saved movie and confirms success without automatically opening a paywall', async t => {
    const f = await fixture(t, {snapshot: {entries: []}, savedMovies: [movie]});
    await f.press('Log your first movie');
    assert.match(f.text(), /Saved movies/);
    assert.deepEqual(f.calls.searches, []);
    await f.press('Log A private favorite (2024)');
    assert.ok(f.button('Save entry'));
    assert.deepEqual(f.calls.saved, []);
    await f.press('3.5 stars'); await f.change('Private note', 'My private memory');
    await f.press('Save entry');
    assert.equal(f.calls.saved[0].movie.id, movie.id);
    assert.equal(f.calls.saved[0].note, 'My private memory');
    assert.equal(f.renderer.root.findAllByType('Input').length, 0);
    assert.match(f.text(), /Saved to your journal/);
    assert.deepEqual(f.calls.paywalls, []);
    assert.deepEqual(f.calls.events, ['opened', 'picker_opened', 'entry_created']);
    await f.press('View insights');
    assert.match(f.text(), /editing stay free/);
    assert.deepEqual(f.calls.paywalls, []);
    await f.press('Explore supporter access');
    assert.deepEqual(f.calls.paywalls, ['journal_insights']);
    assert.deepEqual(f.calls.events, ['opened', 'picker_opened', 'entry_created', 'insights_opened', 'upgrade_opened']);
});

test('editing reports an update and never counts as a new journal entry', async t => {
    const f = await fixture(t);
    await f.press('Edit entry');
    await f.change('Private note', 'An updated private memory');
    await f.press('Save changes');
    assert.match(f.text(), /Changes saved/);
    assert.equal(f.calls.saved[0].id, entry.id);
    assert.deepEqual(f.calls.events, ['opened', 'entry_updated']);
    assert.deepEqual(f.calls.paywalls, []);
});

test('repeated save events create one entry and one success confirmation', async t => {
    const f = await fixture(t, {editor: true});
    const save = f.button('Save entry').props.onPress;
    await act(async () => {save(); save();});
    assert.equal(f.calls.saved.length, 1);
    assert.equal(f.calls.closed, 1);
    assert.deepEqual(f.calls.events, ['entry_created']);
    assert.deepEqual(f.calls.confirmations, ['created']);
});

test('an account switch invalidates old movie selections, pending results, and draft save callbacks', async t => {
    let resolveSearch;
    const f = await fixture(t, {snapshot: {entries: []}, savedMovies: [movie],
        search: () => new Promise(resolve => {resolveSearch = resolve;})});
    await f.press('Log a movie');
    const choose = f.button('Log A private favorite (2024)').props.onPress;
    await f.change('Search movies for your journal', 'private query');
    await f.press('Search journal movies');
    await f.update(f.session, {account: {uid: 'bob'}});
    await act(async () => {choose(); resolveSearch({movies: [{...movie, title: 'Old private result'}], hasMore: false});});
    assert.equal(f.renderer.root.findAllByType('Input').length, 0);
    assert.doesNotMatch(f.text(), /Old private result/);
    assert.deepEqual(f.calls.saved, []);

    const editor = await fixture(t, {editor: true});
    await editor.change('Private note', 'Alice private draft');
    const save = editor.button('Save entry').props.onPress;
    await editor.update(editor.session, {account: {uid: 'bob'}});
    await act(async () => save());
    assert.deepEqual(editor.calls.saved, []);
    assert.deepEqual(editor.calls.events, []);
    assert.equal(editor.renderer.root.findAllByType('Input').find(node => node.props.accessibilityLabel === 'Private note').props.value, '');
    await editor.update(editor.session, {account: {uid: 'alice'}});
    await act(async () => save());
    assert.deepEqual(editor.calls.saved, [], 'the old draft stays invalid after returning to the original account');
});

test('movie search stays explicit inside the journal and successful results can be logged', async t => {
    const f = await fixture(t, {snapshot: {entries: []}, search: async () => ({movies: [movie], hasMore: false})});
    await f.press('Log a movie');
    await f.change('Search movies for your journal', 'A private favorite');
    assert.deepEqual(f.calls.searches, []);
    await f.press('Search journal movies');
    assert.deepEqual(f.calls.searches, [{page: 1, limit: 20, query: 'A private favorite'}]);
    await f.press('Log A private favorite (2024)');
    await f.press('Save entry');
    assert.equal(f.calls.saved[0].movie.id, movie.id);
    assert.deepEqual(f.calls.events, ['opened', 'picker_opened', 'entry_created']);
});
