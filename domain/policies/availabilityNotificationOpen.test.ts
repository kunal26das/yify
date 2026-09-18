import assert from 'node:assert/strict';
import test from 'node:test';
import {availabilityNotificationOpen} from './availabilityNotificationOpen.ts';

test('availability clicks attribute only validated movie or watchlist destinations', () => {
    assert.deepEqual(availabilityNotificationOpen('/movie/42', 'availability', 'event-1'), {eventId: 'event-1', movieId: 42});
    assert.deepEqual(availabilityNotificationOpen('/watchlist', 'availability', 'event-2'), {eventId: 'event-2'});
    for (const path of ['/preferences', '/movie/0', '/movie/2147483648', 'https://evil.example/movie/42', '/movie/42/extra']) {
        assert.equal(availabilityNotificationOpen(path, 'availability', 'event-1'), null);
    }
    assert.equal(availabilityNotificationOpen('/watchlist', 'unknown', 'event-1'), null);
    assert.equal(availabilityNotificationOpen('/watchlist', 'availability', ['event-1']), null);
    assert.equal(availabilityNotificationOpen('/watchlist', 'availability', '<script>'), null);
});
