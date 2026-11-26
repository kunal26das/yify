import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Codec} from './json';
import {readValue, writeValue} from './json';
import type {KeyValueStore} from './kv';

function memoryStore(initial: Record<string, string> = {}, accepts = true): KeyValueStore & {data: Map<string, string>} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getString: (key) => data.get(key),
    setString: (key, value) => {
      if (!accepts) return false;
      data.set(key, value);
      return true;
    },
    remove: (key) => {
      data.delete(key);
    },
    keys: () => [...data.keys()],
  };
}

interface Counter {
  count: number;
}

function counterCodec(version: number, upgrade?: Codec<Counter>['upgrade']): Codec<Counter> & {decoded: unknown[]} {
  const decoded: unknown[] = [];
  return {
    version,
    decoded,
    decode(data) {
      decoded.push(data);
      const count = (data as {count?: unknown} | null)?.count;
      return typeof count === 'number' ? {count} : null;
    },
    encode: (value) => ({count: value.count}),
    ...(upgrade ? {upgrade} : {}),
  };
}

test('writeValue stores a versioned envelope and reports the store result', () => {
  const store = memoryStore();
  assert.equal(writeValue(store, 'v2.test', counterCodec(3), {count: 7}), true);
  assert.equal(store.data.get('v2.test'), '{"v":3,"d":{"count":7}}');
  assert.equal(writeValue(memoryStore({}, false), 'v2.test', counterCodec(3), {count: 7}), false);
});

test('readValue decodes the current version and round-trips writeValue', () => {
  const store = memoryStore();
  const codec = counterCodec(2);
  writeValue(store, 'v2.test', codec, {count: 4});
  assert.deepEqual(readValue(store, 'v2.test', codec), {count: 4});
  assert.deepEqual(codec.decoded, [{count: 4}]);
});

test('missing, unparseable and malformed envelopes read as null without decoding', () => {
  const codec = counterCodec(1);
  const values = ['', '{', 'null', '[]', '"text"', '42', '{"v":1}', '{"d":{"count":1}}', '{"v":0,"d":{"count":1}}',
    '{"v":-1,"d":{"count":1}}', '{"v":1.5,"d":{"count":1}}', '{"v":"1","d":{"count":1}}', '[1,{"count":1}]'];
  assert.equal(readValue(memoryStore(), 'v2.test', codec), null);
  for (const value of values) assert.equal(readValue(memoryStore({'v2.test': value}), 'v2.test', codec), null, value);
  assert.deepEqual(codec.decoded, []);
});

test('a newer version reads as null and never reaches decode or upgrade', () => {
  let upgraded = 0;
  const codec = counterCodec(2, () => {
    upgraded += 1;
    return {count: 0};
  });
  assert.equal(readValue(memoryStore({'v2.test': '{"v":3,"d":{"count":1}}'}), 'v2.test', codec), null);
  assert.equal(upgraded, 0);
  assert.deepEqual(codec.decoded, []);
});

test('an older version goes through upgrade, or reads as null without one', () => {
  const calls: [number, unknown][] = [];
  const upgrading = counterCodec(3, (fromVersion, data) => {
    calls.push([fromVersion, data]);
    const total = (data as {total?: unknown}).total;
    return typeof total === 'number' ? {count: total} : null;
  });
  const store = memoryStore({'v2.old': '{"v":1,"d":{"total":9}}', 'v2.broken': '{"v":2,"d":{"total":"nine"}}'});
  assert.deepEqual(readValue(store, 'v2.old', upgrading), {count: 9});
  assert.equal(readValue(store, 'v2.broken', upgrading), null);
  assert.deepEqual(calls, [[1, {total: 9}], [2, {total: 'nine'}]]);
  assert.deepEqual(upgrading.decoded, []);
  assert.equal(readValue(store, 'v2.old', counterCodec(3)), null);
});

test('decode rejections read as null and data that is null still reaches decode', () => {
  const codec = counterCodec(1);
  assert.equal(readValue(memoryStore({'v2.test': '{"v":1,"d":{"count":"seven"}}'}), 'v2.test', codec), null);
  assert.equal(readValue(memoryStore({'v2.test': '{"v":1,"d":null}'}), 'v2.test', codec), null);
  assert.deepEqual(codec.decoded, [{count: 'seven'}, null]);
});
