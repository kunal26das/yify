import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AD_COOLDOWN_MS,
    AD_GATE_STATE_VERSION,
    AD_WINDOW_LIMIT,
    AD_WINDOW_MS,
    INITIAL_AD_GATE_STATE,
    commitAdShown,
    decideAd,
    encodeAdGateState,
    parseAdGateState,
    type AdGateInput,
    type AdGateState,
} from './adGating.ts';

const NOW = 1_800_000_000_000;

function state(overrides: Partial<AdGateState> = {}): AdGateState {
    return {...INITIAL_AD_GATE_STATE, ...overrides};
}

function input(overrides: Partial<AdGateInput> = {}): AdGateInput {
    return {
        trigger: 'trailer_open',
        enabled: true,
        entitlementKnown: true,
        adsRemoved: false,
        loaded: true,
        state: state(),
        ...overrides,
    };
}

test('a queue advance is never gated, whatever else is true', () => {
    assert.equal(decideAd(input({trigger: 'queue_advance'}), NOW), 'wrong_trigger');
});

test('the remote kill switch outranks every device-local rule', () => {
    assert.equal(decideAd(input({enabled: false}), NOW), 'disabled');
});

test('an unresolved entitlement suppresses the ad rather than risking a paying user', () => {
    assert.equal(decideAd(input({entitlementKnown: false}), NOW), 'unknown');
});

test('a paying user is never shown an ad', () => {
    assert.equal(decideAd(input({adsRemoved: true}), NOW), 'entitled');
});

test('a fresh install with a loaded ad shows one', () => {
    assert.equal(decideAd(input(), NOW), 'show');
});

test('nothing loaded is a skip, not a wait', () => {
    assert.equal(decideAd(input({loaded: false}), NOW), 'unfilled');
});

test('the cooldown holds to the millisecond and then releases', () => {
    const shown = commitAdShown(state(), NOW);
    assert.equal(decideAd(input({state: shown}), NOW + AD_COOLDOWN_MS - 1), 'cooldown');
    assert.equal(decideAd(input({state: shown}), NOW + AD_COOLDOWN_MS), 'show');
});

test('the daily cap closes the window and the window rolls exactly one day later', () => {
    let current = state();
    let at = NOW;
    for (let index = 0; index < AD_WINDOW_LIMIT; index += 1) {
        assert.equal(decideAd(input({state: current}), at), 'show');
        current = commitAdShown(current, at);
        at += AD_COOLDOWN_MS;
    }
    assert.equal(current.shownInWindow, AD_WINDOW_LIMIT);
    assert.equal(decideAd(input({state: current}), NOW + AD_WINDOW_MS - 1), 'capped');
    assert.equal(decideAd(input({state: current}), NOW + AD_WINDOW_MS), 'show');
});

test('the first ad of a rolled window restarts the count at one', () => {
    const capped = state({
        lastShownAt: NOW,
        windowStartedAt: NOW,
        shownInWindow: AD_WINDOW_LIMIT,
    });
    assert.deepEqual(commitAdShown(capped, NOW + AD_WINDOW_MS), {
        lastShownAt: NOW + AD_WINDOW_MS,
        windowStartedAt: NOW + AD_WINDOW_MS,
        shownInWindow: 1,
    });
});

test('a clock dragged backwards cannot lock the placement out forever', () => {
    const future = state({
        lastShownAt: NOW + AD_WINDOW_MS,
        windowStartedAt: NOW + AD_WINDOW_MS,
        shownInWindow: AD_WINDOW_LIMIT,
    });
    assert.equal(decideAd(input({state: future}), NOW), 'show');
});

test('state survives a round trip and carries its version', () => {
    const shown = commitAdShown(state(), NOW);
    const encoded = encodeAdGateState(shown);
    assert.equal(JSON.parse(encoded).version, AD_GATE_STATE_VERSION);
    assert.deepEqual(parseAdGateState(encoded), shown);
});

test('absent, malformed and foreign payloads all read as a fresh install', () => {
    assert.deepEqual(parseAdGateState(undefined), INITIAL_AD_GATE_STATE);
    assert.deepEqual(parseAdGateState(''), INITIAL_AD_GATE_STATE);
    assert.deepEqual(parseAdGateState('not json'), INITIAL_AD_GATE_STATE);
    assert.deepEqual(parseAdGateState('[]'), INITIAL_AD_GATE_STATE);
    assert.deepEqual(parseAdGateState('{"shownInWindow":9}'), INITIAL_AD_GATE_STATE);
    assert.deepEqual(
        parseAdGateState(JSON.stringify({version: AD_GATE_STATE_VERSION + 1, shownInWindow: 9})),
        INITIAL_AD_GATE_STATE
    );
});

test('a tampered counter reads as zero rather than being trusted', () => {
    assert.deepEqual(
        parseAdGateState(
            JSON.stringify({
                version: AD_GATE_STATE_VERSION,
                lastShownAt: 'soon',
                windowStartedAt: -1,
                shownInWindow: Number.NaN,
            })
        ),
        INITIAL_AD_GATE_STATE
    );
});

test('parseAdGateState never hands back the shared initial object', () => {
    assert.notStrictEqual(parseAdGateState(undefined), INITIAL_AD_GATE_STATE);
});
