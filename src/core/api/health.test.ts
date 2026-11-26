import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createApiHealth, healthOutcome} from './health';

function clock(start = 1_000_000) {
  let now = start;
  return {now: () => now, advance: (ms: number) => {
    now += ms;
  }};
}

test('three server errors within 60 s trip the breaker', () => {
  const time = clock();
  const health = createApiHealth(time.now);
  health.record('server-error');
  time.advance(10_000);
  health.record('server-error');
  assert.equal(health.degraded(), false);
  time.advance(10_000);
  health.record('server-error');
  assert.equal(health.degraded(), true);
});

test('errors spread over more than 60 s never trip it', () => {
  const time = clock();
  const health = createApiHealth(time.now);
  for (let index = 0; index < 5; index += 1) {
    health.record('server-error');
    time.advance(31_000);
  }
  assert.equal(health.degraded(), false);
});

test('the breaker clears 60 s after the last server error, and each new error extends it', () => {
  const time = clock();
  const health = createApiHealth(time.now);
  for (let index = 0; index < 3; index += 1) health.record('server-error');
  time.advance(50_000);
  health.record('server-error');
  time.advance(50_000);
  assert.equal(health.degraded(), true);
  time.advance(10_000);
  assert.equal(health.degraded(), false);
});

test('any success clears the breaker; network errors neither trip nor clear it', () => {
  const time = clock();
  const health = createApiHealth(time.now);
  for (let index = 0; index < 3; index += 1) health.record('server-error');
  health.record('network-error');
  assert.equal(health.degraded(), true);
  health.record('ok');
  assert.equal(health.degraded(), false);
  for (let index = 0; index < 10; index += 1) health.record('network-error');
  assert.equal(health.degraded(), false);
});

test('only 500 to 504 count as server errors', () => {
  assert.deepEqual([500, 502, 503, 504].map(healthOutcome), ['server-error', 'server-error', 'server-error', 'server-error']);
  assert.deepEqual([200, 404, 429, 505].map(healthOutcome), ['ok', 'ok', 'ok', 'ok']);
});
