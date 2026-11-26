import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BatchMissingError, createBatcher} from './batch';

function loader() {
  const batches: string[][] = [];
  const load = async (keys: string[]) => {
    batches.push(keys);
    return new Map(keys.filter((key) => key !== 'missing').map((key) => [key, key.toUpperCase()] as const));
  };
  return {batches, load};
}

test('keys requested in one window share one call and duplicates share one slot', async () => {
  const {batches, load} = loader();
  const batch = createBatcher({maxBatch: 40, windowMs: 5, load});
  const values = await Promise.all([batch('a'), batch('b'), batch('a')]);
  assert.deepEqual(values, ['A', 'B', 'A']);
  assert.deepEqual(batches, [['a', 'b']]);
  assert.equal(await batch('c'), 'C');
  assert.deepEqual(batches, [['a', 'b'], ['c']]);
});

test('a full batch flushes at once and larger bursts split at maxBatch', async () => {
  const {batches, load} = loader();
  const batch = createBatcher({maxBatch: 2, windowMs: 1000, load});
  const started = Date.now();
  assert.deepEqual(await Promise.all([batch('a'), batch('b')]), ['A', 'B']);
  assert.ok(Date.now() - started < 500);
  const wide = createBatcher({maxBatch: 40, windowMs: 1, load});
  const keys = Array.from({length: 45}, (_, index) => `k${index}`);
  await Promise.all(keys.map((key) => wide(key)));
  assert.deepEqual(batches.slice(1).map((keysInBatch) => keysInBatch.length), [40, 5]);
});

test('missing keys and failed loads reject only their waiters', async () => {
  const {load} = loader();
  const batch = createBatcher({maxBatch: 40, windowMs: 1, load});
  const [present, missing] = await Promise.allSettled([batch('a'), batch('missing')]);
  assert.deepEqual(present, {status: 'fulfilled', value: 'A'});
  assert.equal(missing.status, 'rejected');
  assert.ok(missing.status === 'rejected' && missing.reason instanceof BatchMissingError);
  const custom = createBatcher({maxBatch: 40, windowMs: 1, load, missing: (key: string) => new RangeError(key)});
  await assert.rejects(custom('missing'), (error: unknown) => error instanceof RangeError && error.message === 'missing');
  const failing = createBatcher<string, string>({maxBatch: 40, windowMs: 1, load: async () => {
    throw new Error('down');
  }});
  await assert.rejects(failing('a'), /down/);
  const throwing = createBatcher<string, string>({maxBatch: 40, windowMs: 1, load: () => {
    throw new Error('sync');
  }});
  await assert.rejects(throwing('a'), /sync/);
});
