const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');

afterEach(() => {
  delete process.env.EXPO_PUBLIC_DIAGNOSTICS;
});

test('diagnostics are off unless EXPO_PUBLIC_DIAGNOSTICS is 1', () => {
  let crashes = 0;
  const off = loadTs('src/core/platform/telemetry/diagnostics.ts', {'./sentry': {crashNative: () => {
    crashes += 1;
  }}});
  assert.equal(off.DIAGNOSTICS_ENABLED, false);
  off.triggerDiagnostic('native_java');
  assert.equal(crashes, 0);
  process.env.EXPO_PUBLIC_DIAGNOSTICS = '1';
  const on = loadTs('src/core/platform/telemetry/diagnostics.ts', {'./sentry': {crashNative: () => {
    crashes += 1;
  }}});
  assert.equal(on.DIAGNOSTICS_ENABLED, true);
  on.triggerDiagnostic('native_java');
  on.triggerDiagnostic('native_ndk');
  assert.equal(crashes, 2);
});

test('the JS fatal diagnostic throws outside the caller so the global handler sees it', async () => {
  process.env.EXPO_PUBLIC_DIAGNOSTICS = '1';
  const {triggerDiagnostic, JS_FATAL_MESSAGE} = loadTs('src/core/platform/telemetry/diagnostics.ts', {'./sentry': {crashNative: () => undefined}});
  const original = globalThis.setTimeout;
  let scheduled = null;
  globalThis.setTimeout = (callback) => {
    scheduled = callback;
    return 0;
  };
  try {
    assert.doesNotThrow(() => triggerDiagnostic('js_fatal'));
  } finally {
    globalThis.setTimeout = original;
  }
  assert.throws(scheduled, new RegExp(JS_FATAL_MESSAGE));
});
