const assert = require('node:assert/strict');
const test = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
    let resolve;
    const promise = new Promise(res => { resolve = res; });
    return {promise, resolve};
}

function fixture(show) {
    const calls = [];
    const {useAdBreak} = loadTypeScript('presentation/player/use-ad-break.ts', {
        react: {useCallback: fn => fn, useRef: current => ({current})},
        '../di/DependenciesContext': {
            useAdGateway: () => ({show}),
            useSupporterNudge: () => ({recordAdShown: () => calls.push('ad')}),
            useAuthRepository: () => { throw new Error('auth must not be read'); },
            usePurchaseRepository: () => { throw new Error('offers must not be read'); },
        },
        '../purchases/supporter-paywall': {
            useSupporterPaywall: () => { throw new Error('paywall must not open'); },
        },
    });
    return {run: useAdBreak(), calls};
}

test('an unavailable ad resumes playback immediately', () => {
    const f = fixture(() => null);
    let done = 0;
    f.run('movie_open', () => done++);
    assert.equal(done, 1);
    assert.deepEqual(f.calls, []);
});

test('a visible ad resumes playback exactly once after settlement', async () => {
    const ad = deferred();
    const f = fixture(() => ad.promise);
    let done = 0;
    f.run('movie_open', () => done++);
    assert.equal(done, 0);
    ad.resolve(true);
    await flush();
    assert.equal(done, 1);
    assert.deepEqual(f.calls, ['ad']);
});

test('callers sharing a visible ad each resume once and record one impression', async () => {
    const ad = deferred();
    const f = fixture(() => ad.promise);
    const done = [0, 0];
    f.run('movie_open', () => done[0]++);
    f.run('movie_open', () => done[1]++);
    ad.resolve(true);
    await flush();
    assert.deepEqual(done, [1, 1]);
    assert.deepEqual(f.calls, ['ad']);
});

test('failed or rejected ads resume playback without recording an impression', async () => {
    for (const result of [() => Promise.resolve(false), () => Promise.reject(new Error('show failed'))]) {
        const f = fixture(result);
        let done = 0;
        f.run('movie_open', () => done++);
        await flush();
        assert.equal(done, 1);
        assert.deepEqual(f.calls, []);
    }
});
