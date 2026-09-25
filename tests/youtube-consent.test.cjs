const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture() {
    const values = new Map();
    const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
    const store = {getString: key => values.get(key), set: (key, value) => values.set(key, value), delete: key => values.delete(key)};
    const privacy = new PrivacyPreferencesImpl(store);
    privacy.updateChoices({adultConfirmed: true, analytics: false});
    const usePrivacyChoices = () => React.useSyncExternalStore(listener => privacy.subscribe(listener), () => privacy.getChoices());
    const rn = {Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', StyleSheet: {create: value => value, absoluteFill: {}}};
    const {YoutubeConsent} = loadTypeScript('presentation/components/youtube-consent.tsx', {
        'react-native': rn,
        '../di/DependenciesContext': {usePrivacyPreferences: () => privacy},
        '../hooks/use-privacy-choices': {usePrivacyChoices},
        '../hooks/use-palette': {usePalette: () => ({colors: {}})},
        '../constants/theme': {Spacing: {}, Radius: {}},
        '../constants/legal': {openLegalPage: async () => {}},
        './themed-text': {ThemedText: 'Text'},
    });
    let active = 0;
    let requests = 0;
    function Player() {
        React.useEffect(() => {active++; requests++; return () => {active--;};}, []);
        return React.createElement('iframe');
    }
    const {HeroTrailerLayer} = loadTypeScript('presentation/movies/components/HeroTrailerLayer.tsx', {
        'react-native': rn,
        './YoutubePlayer': {YoutubePlayer: Player},
        '../../hooks/use-privacy-choices': {usePrivacyChoices},
    });
    return {privacy, store, values, YoutubeConsent, Player, HeroTrailerLayer,
        counts: () => ({active, requests})};
}

test('YouTube never mounts before permission, then unloads immediately on withdrawal', async t => {
    const f = fixture();
    let renderer;
    await act(async () => {renderer = create(React.createElement(f.YoutubeConsent, null, React.createElement(f.Player)));});
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.deepEqual(f.counts(), {active: 0, requests: 0});
    await act(async () => f.privacy.updateChoices({adultConfirmed: true, analytics: true}));
    assert.deepEqual(f.counts(), {active: 0, requests: 0});
    await act(async () => renderer.root.findByProps({accessibilityLabel: 'Allow YouTube trailers'}).props.onPress());
    assert.deepEqual(f.counts(), {active: 1, requests: 1});
    await act(async () => f.privacy.updateChoices({...f.privacy.getChoices(), youtube: false}));
    assert.deepEqual(f.counts(), {active: 0, requests: 1});
    assert.equal(renderer.root.findAllByType('iframe').length, 0);
});

test('storage failure cannot mount YouTube and a cross-tab reset unloads ambient previews', async t => {
    const f = fixture();
    let renderer;
    await act(async () => {renderer = create(React.createElement(React.Fragment, null,
        React.createElement(f.YoutubeConsent, null, React.createElement(f.Player)),
        React.createElement(f.HeroTrailerLayer, {videoId: 'example', width: 320, height: 180, muted: true})));});
    t.after(async () => {await act(async () => renderer.unmount());});
    assert.deepEqual(f.counts(), {active: 0, requests: 0});
    const set = f.store.set;
    f.store.set = () => {throw Error('quota');};
    await act(async () => renderer.root.findByProps({accessibilityLabel: 'Allow YouTube trailers'}).props.onPress());
    assert.equal(f.counts().requests, 0);
    assert.match(JSON.stringify(renderer.toJSON()), /YouTube remains off/);
    f.store.set = set;
    await act(async () => f.privacy.updateChoices({adultConfirmed: true, analytics: false, youtube: true}));
    assert.equal(f.counts().active, 2);
    await act(async () => {f.values.clear(); f.privacy.refreshFromStorage();});
    assert.deepEqual(f.counts(), {active: 0, requests: 2});
});

test('catalog artwork ignores YouTube thumbnail URLs retained in old caches', () => {
    const {thumbCandidates, thumbPlaceholder} = loadTypeScript('presentation/movies/components/format.ts');
    const movie = {id: 1, ytTrailerCode: 'example',
        thumbnailUrls: ['https://img.youtube.com/vi/example/maxresdefault.jpg', 'https://i.ytimg.com/vi/example/hq.jpg', 'https://catalog.example/backdrop.jpg'],
        posterUrls: ['https://catalog.example/poster.jpg']};
    assert.deepEqual(thumbCandidates(movie), ['https://catalog.example/backdrop.jpg', 'https://catalog.example/poster.jpg']);
    assert.equal(thumbPlaceholder(movie), 'https://catalog.example/poster.jpg');
});
