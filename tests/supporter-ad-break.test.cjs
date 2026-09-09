const assert = require('node:assert/strict');
const test = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; }
function fixture(options = {}) {
    const calls = [];
    const pending = options.pending ?? Promise.resolve(true);
    let finish;
    const {useAdBreak} = loadTypeScript('presentation/player/use-ad-break.ts', {
        react: {useCallback: fn => fn, useRef: current => ({current})},
        '../analytics/events': {Analytics: {supporterNudgeDeclined: () => calls.push('declined-event')}},
        '../purchases/supporter-paywall': {useSupporterPaywall: () => (placement, callback) => {
            calls.push(placement); finish = callback;
        }},
        '../di/DependenciesContext': {
            useAdGateway: () => ({show: () => pending}),
            useAuthRepository: () => ({getSession: () => ({account: {uid: 'a'}, available: true})}),
            usePurchaseRepository: () => ({
                getOffers: placement => { calls.push(`offers:${placement}`); return typeof options.offers === 'function' ? options.offers() : options.offers ?? Promise.resolve([{id: 'monthly'}, {id: 'lifetime'}]); },
                getState: () => ({adsRemoved: Boolean(options.supported)}),
            }),
            useSupporterNudge: () => ({
                recordAdShown: () => calls.push('ad'), shouldPrompt: () => true,
                recordPrompted: () => calls.push('prompted'), recordAccepted: () => calls.push('accepted'),
                recordDeclined: () => calls.push('declined'),
            }),
        },
    });
    return {run: useAdBreak(), calls, close: supported => finish(supported)};
}
test('post-ad prompt uses its targeted offering and resumes once after dismissal', async () => {
    const f = fixture(); let done = 0;
    f.run('movie_open', () => done++); await flush();
    assert.deepEqual(f.calls, ['ad', 'offers:post_ad_supporter', 'prompted', 'post_ad_supporter']);
    assert.equal(done, 0);
    f.close(false); f.close(false);
    assert.equal(done, 1);
});
test('supporting through the post-ad paywall records acceptance and resumes playback', async () => {
    const f = fixture(); let done = 0;
    f.run('movie_open', () => done++); await flush(); f.close(true);
    assert.equal(done, 1); assert.ok(f.calls.includes('accepted'));
});
test('targeting exclusions, failed offer requests and existing supporters do not block playback', async () => {
    for (const options of [{offers: Promise.resolve([])}, {offers: () => Promise.reject(Error('offline'))}, {supported: true}]) {
        const f = fixture(options); let done = 0;
        f.run('movie_open', () => done++); await flush();
        assert.equal(done, 1); assert.ok(!f.calls.includes('prompted'));
    }
});
test('a slow optional offering lookup cannot hold playback indefinitely', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const offers = deferred(); const f = fixture({offers: offers.promise}); let done = 0;
    f.run('movie_open', () => done++); await flush();
    t.mock.timers.tick(1500); await flush(); assert.equal(done, 1);
    offers.resolve([{id: 'late'}]); await flush();
    assert.equal(done, 1); assert.ok(!f.calls.includes('prompted'));
});
test('callers sharing an ad result show one supporter prompt', async () => {
    const ad = deferred(); const f = fixture({pending: ad.promise}); let done = 0;
    f.run('movie_open', () => done++); f.run('movie_open', () => done++);
    ad.resolve(true); await flush();
    assert.equal(f.calls.filter(c => c === 'prompted').length, 1);
    assert.equal(done, 1); f.close(false); assert.equal(done, 2);
});
