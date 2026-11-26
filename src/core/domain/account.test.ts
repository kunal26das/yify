import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AuthTokenError, INITIAL_AUTH_SESSION} from './account';

test('auth token errors carry their failure kind', () => {
  const error = new AuthTokenError('denied');
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'AuthTokenError');
  assert.equal(error.failure, 'denied');
  assert.equal(error.message, 'Account authentication is temporarily unavailable.');
  assert.deepEqual(INITIAL_AUTH_SESSION, {ready: false, signingIn: false, available: false, account: null, error: null});
});
