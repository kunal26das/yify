import assert from 'node:assert/strict';
import test from 'node:test';

import {decideAd, type AdGateInput} from './adGating.ts';

function input(overrides: Partial<AdGateInput> = {}): AdGateInput {
    return {
        trigger: 'movie_open',
        entitlementKnown: true,
        adsRemoved: false,
        movieOpensSinceVisible: 3,
        lastVisibleAt: null,
        now: 120000,
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

test('the first two eligible movie opens after an impression are free', () => {
    assert.equal(decideAd(input({movieOpensSinceVisible: 1})), 'paced_actions');
    assert.equal(decideAd(input({movieOpensSinceVisible: 2})), 'paced_actions');
    assert.equal(decideAd(input({movieOpensSinceVisible: 3})), 'show');
});

test('an eligible third open waits 120 seconds from the last visible ad', () => {
    assert.equal(decideAd(input({lastVisibleAt: 1000, now: 120999})), 'paced_time');
    assert.equal(decideAd(input({lastVisibleAt: 1000, now: 121000})), 'show');
});

test('an unfilled eligible open stays unfilled after action and time gates pass', () => {
    assert.equal(decideAd(input({loaded: false, lastVisibleAt: 1000, now: 121000})), 'unfilled');
});
