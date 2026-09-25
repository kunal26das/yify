const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const first = {movieId: 1, videoId: 'first', title: 'First'};
const second = {movieId: 2, videoId: 'second', title: 'Second'};

async function fixture(t, youtube = false) {
    const values = new Map();
    const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
    const privacy = new PrivacyPreferencesImpl({getString: key => values.get(key), set: (key, value) => values.set(key, value),
        delete: key => values.delete(key)});
    privacy.updateChoices({adultConfirmed: true, analytics: true, youtube});
    const ads = [];
    const spans = [];
    const events = [];
    const analytics = [];
    const surface = [];
    const diagnostics = {
        start(operation) {
            const span = {operation, outcomes: []};
            spans.push(span);
            return {finish: (outcome = 'ok') => span.outcomes.push(outcome)};
        },
        event: operation => events.push(operation),
        capture: error => events.push(error.message),
    };
    const adBreak = (trigger, complete) => ads.push({trigger, complete});
    const playback = {miniPlayer: true, autoplayNext: true};
    const module = loadTypeScript('presentation/player/PlayerContext.tsx', {
        'react-native': {Platform: {OS: 'android'}, AppState: {currentState: 'active', addEventListener: () => ({remove() {}})}},
        '@/presentation/analytics/events': {Analytics: new Proxy({}, {get: (_, name) => () => analytics.push(name)})},
        './use-ad-break': {useAdBreak: () => adBreak},
        '../hooks/use-preferences': {usePreferences: () => ({playback})},
        '../di/DependenciesContext': {useDiagnostics: () => diagnostics, usePrivacyPreferences: () => privacy},
    });
    let api;
    let internal;
    function Probe() {
        api = module.usePlayer();
        internal = module.usePlayerInternal();
        return null;
    }
    let renderer;
    await act(async () => {renderer = create(React.createElement(module.PlayerProvider, null, React.createElement(Probe)));});
    internal.surfaceRef.current = Object.fromEntries(['play', 'pause', 'seekBy', 'setMuted'].map(name =>
        [name, () => surface.push(name)]));
    t.after(async () => {await act(async () => renderer.unmount());});
    return {privacy, ads, spans, events, analytics, surface, get api() {return api;}, get internal() {return internal;},
        consent: value => privacy.updateChoices({...privacy.getChoices(), youtube: value}),
        unmount: () => renderer.unmount()};
}

test('opening a gated trailer preserves its inline placeholder without ads, playback or startup measurements', async t => {
    const f = await fixture(t);
    await act(async () => f.api.open(first));
    assert.equal(f.api.mode, 'inline');
    assert.equal(f.api.video, first);
    assert.equal(f.api.playing, false);
    await act(async () => {
        f.api.togglePlay();
        f.api.toggleMute();
        f.api.seekBy(10);
        f.internal.reportPlaying(true);
        f.internal.reportReady();
        f.internal.reportState('playing');
        f.internal.reportError('2');
    });
    assert.deepEqual(f.ads, []);
    assert.deepEqual(f.spans, []);
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.surface, []);
    assert.equal(f.api.playing, false);
    await act(async () => f.consent(true));
    assert.equal(f.ads.length, 1);
    assert.equal(f.ads[0].trigger, 'movie_open');
    assert.equal(f.api.playing, false);
    assert.deepEqual(f.spans.map(span => span.operation), ['player.ad_wait']);
    await act(async () => f.ads[0].complete());
    assert.equal(f.api.playing, true);
    assert.deepEqual(f.spans.map(span => span.operation), ['player.ad_wait', 'player.start']);
    assert.equal(f.analytics.filter(name => name === 'trailerPlay').length, 1);
});

test('withdrawal invalidates pending ad completion and only a newly permitted start may resume playback', async t => {
    const f = await fixture(t, true);
    await act(async () => f.api.open(first));
    assert.equal(f.ads.length, 1);
    await act(async () => {
        f.consent(false);
        f.ads[0].complete();
    });
    assert.equal(f.api.playing, false);
    assert.equal(f.api.mode, 'inline');
    assert.deepEqual(f.spans[0].outcomes, ['cancelled']);
    assert.equal(f.spans.length, 1);
    await act(async () => f.consent(true));
    assert.equal(f.ads.length, 2);
    await act(async () => f.ads[0].complete());
    assert.equal(f.api.playing, false);
    await act(async () => f.ads[1].complete());
    assert.equal(f.api.playing, true);
    assert.equal(f.analytics.filter(name => name === 'trailerPlay').length, 1);
});

test('withdrawal stops a playing miniplayer and consent resumes only the currently selected trailer', async t => {
    const f = await fixture(t, true);
    await act(async () => f.api.open(first));
    await act(async () => f.ads[0].complete());
    await act(async () => {
        f.api.minimize();
        f.consent(false);
    });
    assert.equal(f.api.mode, 'mini');
    assert.equal(f.api.playing, false);
    assert.deepEqual(f.surface, ['pause']);
    assert.equal(f.spans[1].outcomes.at(-1), 'cancelled');
    await act(async () => f.api.open(second));
    assert.equal(f.ads.length, 1);
    await act(async () => f.consent(true));
    assert.equal(f.ads.length, 2);
    await act(async () => f.ads[1].complete());
    assert.equal(f.api.video, second);
    assert.equal(f.api.playing, true);
});

test('closing a gated player clears deferred playback and unmounting invalidates ad callbacks', async t => {
    const f = await fixture(t);
    await act(async () => {
        f.api.open(first);
        f.api.close();
        f.consent(true);
    });
    assert.equal(f.api.mode, 'closed');
    assert.equal(f.ads.length, 0);
    await act(async () => f.api.open(second));
    assert.equal(f.ads.length, 1);
    await act(async () => f.unmount());
    f.ads[0].complete();
    assert.deepEqual(f.spans.map(span => span.operation), ['player.ad_wait']);
    assert.equal(f.analytics.filter(name => name === 'trailerPlay').length, 0);
});
