import assert from 'node:assert/strict';
import test from 'node:test';
import {movieNotificationTarget} from './movieNotificationTarget.ts';

test('daily picks and existing single-title alerts resolve to their movie', () => {
    assert.deepEqual(movieNotificationTarget({movieId: 42, kind: 'daily-pick'}), {movieId: 42, kind: 'daily-pick'});
    assert.deepEqual(movieNotificationTarget({movieId: 7}), {movieId: 7, kind: 'new-release'});
});

test('legacy digest alerts retain a useful catalog destination', () => {
    assert.deepEqual(movieNotificationTarget({count: 5}), {count: 5, kind: 'new-release'});
});

test('invalid notification payloads cannot create malformed routes', () => {
    for (const data of [null, undefined, '', [], {}, {movieId: -1}, {movieId: 0}, {movieId: NaN},
        {movieId: Infinity}, {movieId: 1.2}, {movieId: '42'}, {movieId: '../../preferences'},
        {movieId: 2_147_483_648}, {count: 0}, {count: '1'}, {kind: 'daily-pick', count: 3}]) {
        assert.equal(movieNotificationTarget(data), null);
    }
});
