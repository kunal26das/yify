const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

test('native haptics never throw, even when the module fails', async () => {
  const calls = [];
  const expoHaptics = {
    NotificationFeedbackType: {Success: 'success', Warning: 'warning'},
    selectionAsync: async () => calls.push('select'),
    notificationAsync: async (type) => calls.push(type),
  };
  const {haptics, useHaptics} = loadTs('src/core/platform/haptics.ts', {'expo-haptics': expoHaptics});
  assert.equal(useHaptics(), haptics);
  haptics.select();
  haptics.commit();
  haptics.warn();
  assert.deepEqual(calls, ['select', 'success', 'warning']);
  expoHaptics.selectionAsync = () => {
    throw new Error('unavailable');
  };
  expoHaptics.notificationAsync = () => Promise.reject(new Error('unavailable'));
  assert.doesNotThrow(() => haptics.select());
  assert.doesNotThrow(() => haptics.commit());
  const web = loadTs('src/core/platform/haptics.web.ts');
  assert.doesNotThrow(() => web.haptics.select());
  assert.equal(web.useHaptics(), web.haptics);
});
