import assert from 'node:assert/strict';
import test from 'node:test';

import {decideAd, type AdGateInput} from './adGating.ts';

function input(overrides: Partial<AdGateInput> = {}): AdGateInput {
    return {
        trigger: 'movie_open',
        entitlementKnown: true,
        adsRemoved: false,
        loaded: true,
        ...overrides,
    };
}

test('a queue advance is never gated, whatever else is true', () => {
    assert.equal(decideAd(input({trigger: 'queue_advance'})), 'wrong_trigger');
});

test('an unresolved entitlement suppresses the ad rather than risking a paying user', () => {
    assert.equal(decideAd(input({entitlementKnown: false})), 'unknown');
});

test('a paying user is never shown an ad', () => {
    assert.equal(decideAd(input({adsRemoved: true})), 'entitled');
});

test('an unloaded ad reports unfilled rather than showing nothing silently', () => {
    assert.equal(decideAd(input({loaded: false})), 'unfilled');
});

test('a loaded ad on a movie open for a non-paying user shows', () => {
    assert.equal(decideAd(input()), 'show');
});

test('back-to-back movie opens are never throttled', () => {
    assert.equal(decideAd(input()), 'show');
    assert.equal(decideAd(input()), 'show');
    assert.equal(decideAd(input()), 'show');
});
