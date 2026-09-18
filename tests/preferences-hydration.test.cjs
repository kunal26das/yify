const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {renderToString} = require('react-dom/server');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture(platform = 'web') {
    let recent = [];
    let current;
    const history = {getRecent: () => recent, clear: () => {recent = [];}};
    const {usePreferencesViewModel} = loadTypeScript('presentation/movies/usePreferencesViewModel.ts', {
        'expo-constants': {expoConfig: {version: '1.8.3'}},
        'react-native': {Platform: {OS: platform}, AppState: {addEventListener: () => ({remove() {}})}},
        '@/presentation/analytics/events': {Analytics: {settingChanged: () => {}}},
        '../di/DependenciesContext': {
            useSearchHistory: () => history,
            useNewMoviesNotifier: () => ({}),
            usePreferencesRepository: () => ({}),
            useWatchlistRepository: () => ({}),
        },
        '../hooks/use-preferences': {usePreferences: () => ({theme: 'system'})},
        './useWatchlist': {useWatchlist: () => []},
    });
    function SearchSummary() {
        current = usePreferencesViewModel();
        const count = current.searchHistoryCount;
        return React.createElement('span', null, count === 0 ? 'None' : `${count} recent`);
    }
    return {SearchSummary, current: () => current, remember: values => {recent = values;}};
}

test('Preferences uses the same initial web markup with empty server storage and saved browser searches', () => {
    const f = fixture();
    const html = renderToString(React.createElement(f.SearchSummary));
    assert.equal(html, '<span>None</span>');
    f.remember(['Arrival', 'Dune', 'Alien']);
    assert.equal(renderToString(React.createElement(f.SearchSummary)), html);
});

test('Preferences restores the browser search count after mounting and clears it immediately', async t => {
    const f = fixture();
    f.remember(['Arrival', 'Dune', 'Alien']);
    let renderer;
    await act(async () => {renderer = create(React.createElement(f.SearchSummary));});
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.equal(f.current().searchHistoryCount, 3);
    assert.deepEqual(renderer.toJSON().children, ['3 recent']);
    await act(async () => f.current().clearSearchHistory());
    assert.equal(f.current().searchHistoryCount, 0);
    assert.deepEqual(renderer.toJSON().children, ['None']);
});

test('native Preferences retains its saved search count on the first render', () => {
    const f = fixture('android');
    f.remember(['Arrival', 'Dune']);
    assert.equal(renderToString(React.createElement(f.SearchSummary)), '<span>2 recent</span>');
});
