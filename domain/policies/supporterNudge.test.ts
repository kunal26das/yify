import assert from 'node:assert/strict';
import test from 'node:test';

import {
    INITIAL_NUDGE_STATE,
    NUDGE_COOLDOWN_MS,
    NUDGE_DECLINE_LIMIT,
    NUDGE_MIN_ADS,
    commitAdWatched,
    commitNudgeAccepted,
    commitNudgeDeclined,
    commitNudgeShown,
    decideNudge,
    encodeNudgeState,
    parseNudgeState,
    type NudgeInput,
    type NudgeState,
} from './supporterNudge.ts';

const NOW = 1_700_000_000_000;

function watched(times: number, base: NudgeState = INITIAL_NUDGE_STATE): NudgeState {
    let state = {...base};
    for (let index = 0; index < times; index += 1) state = commitAdWatched(state);
    return state;
}

function input(overrides: Partial<NudgeInput> = {}): NudgeInput {
    return {
        enabled: true,
        entitlementKnown: true,
        adsRemoved: false,
        hasOffer: true,
        state: watched(NUDGE_MIN_ADS),
        ...overrides,
    };
}

test('prompts once the viewer has sat through enough ads', () => {
    assert.equal(decideNudge(input(), NOW), 'show');
});

test('never prompts before the ad threshold', () => {
    assert.equal(decideNudge(input({state: watched(NUDGE_MIN_ADS - 1)}), NOW), 'too_early');
    assert.equal(decideNudge(input({state: INITIAL_NUDGE_STATE}), NOW), 'too_early');
});

test('stays silent when there is nothing to sell or nothing to remove', () => {
    assert.equal(decideNudge(input({enabled: false}), NOW), 'disabled');
    assert.equal(decideNudge(input({entitlementKnown: false}), NOW), 'unknown');
    assert.equal(decideNudge(input({adsRemoved: true}), NOW), 'entitled');
    assert.equal(decideNudge(input({hasOffer: false}), NOW), 'no_offer');
});

test('an entitled viewer is never prompted even after many ads', () => {
    assert.equal(decideNudge(input({adsRemoved: true, state: watched(50)}), NOW), 'entitled');
});

test('holds off for the cooldown after a prompt, then asks again', () => {
    const shown = commitNudgeShown(watched(NUDGE_MIN_ADS), NOW);
    const ready = watched(NUDGE_MIN_ADS, shown);
    assert.equal(decideNudge(input({state: ready}), NOW + NUDGE_COOLDOWN_MS - 1), 'cooldown');
    assert.equal(decideNudge(input({state: ready}), NOW + NUDGE_COOLDOWN_MS), 'show');
});

test('showing the prompt resets the ad counter but keeps declines', () => {
    const declined = commitNudgeDeclined(watched(NUDGE_MIN_ADS));
    const shown = commitNudgeShown(declined, NOW);
    assert.equal(shown.adsSinceShown, 0);
    assert.equal(shown.lastShownAt, NOW);
    assert.equal(shown.declines, declined.declines);
});

test('gives up after repeated declines', () => {
    let state = watched(NUDGE_MIN_ADS);
    for (let index = 0; index < NUDGE_DECLINE_LIMIT; index += 1) state = commitNudgeDeclined(state);
    assert.equal(decideNudge(input({state}), NOW), 'declined');
});

test('a purchase attempt clears the decline count', () => {
    let state = watched(NUDGE_MIN_ADS);
    for (let index = 0; index < NUDGE_DECLINE_LIMIT; index += 1) state = commitNudgeDeclined(state);
    assert.equal(decideNudge(input({state: commitNudgeAccepted(state)}), NOW), 'show');
});

test('round-trips through storage', () => {
    const state: NudgeState = {lastShownAt: NOW, adsSinceShown: 3, declines: 1};
    assert.deepEqual(parseNudgeState(encodeNudgeState(state)), state);
});

test('falls back to a clean slate on junk, absence, or a version bump', () => {
    assert.deepEqual(parseNudgeState(undefined), INITIAL_NUDGE_STATE);
    assert.deepEqual(parseNudgeState('not json'), INITIAL_NUDGE_STATE);
    assert.deepEqual(parseNudgeState('[]'), INITIAL_NUDGE_STATE);
    assert.deepEqual(parseNudgeState(JSON.stringify({version: 99, declines: 7})), INITIAL_NUDGE_STATE);
});

test('sanitises hostile counters rather than trusting them', () => {
    const raw = JSON.stringify({
        version: 1,
        lastShownAt: -5,
        adsSinceShown: Number.NaN,
        declines: 'lots',
    });
    assert.deepEqual(parseNudgeState(raw), INITIAL_NUDGE_STATE);
});

test('a clock jumping backwards does not wedge the prompt shut', () => {
    const shown = commitNudgeShown(watched(NUDGE_MIN_ADS), NOW);
    const ready = watched(NUDGE_MIN_ADS, shown);
    assert.equal(decideNudge(input({state: ready}), NOW - NUDGE_COOLDOWN_MS), 'show');
});
