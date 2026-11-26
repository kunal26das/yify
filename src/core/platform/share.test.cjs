const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

const INPUT = {title: 'The Matrix', message: 'Watch The Matrix', url: 'https://yify.expo.app/title/movie/603-the-matrix'};
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
});

function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', {value, configurable: true, writable: true});
}

test('native shares the link inside the message and reports the outcome', async () => {
  const calls = [];
  let result = {action: 'sharedAction'};
  const Share = {sharedAction: 'sharedAction', dismissedAction: 'dismissedAction', share: async (...args) => {
    calls.push(args);
    if (result instanceof Error) throw result;
    return result;
  }};
  const {shareLink} = loadTs('src/core/platform/share.ts', {'react-native': {Share}});
  assert.equal(await shareLink(INPUT), 'shared');
  assert.equal(calls[0][0].message, `${INPUT.message} ${INPUT.url}`);
  assert.deepEqual(calls[0][1], {dialogTitle: INPUT.title});
  result = {action: 'dismissedAction'};
  assert.equal(await shareLink({...INPUT, message: `See ${INPUT.url}`}), 'dismissed');
  assert.equal(calls[1][0].message, `See ${INPUT.url}`);
  result = new Error('no activity');
  assert.equal(await shareLink(INPUT), 'failed');
});

test('web uses the share sheet, treats a cancel as dismissed and otherwise copies the link', async () => {
  const copied = [];
  setNavigator({share: async () => {
    const error = new Error('cancel');
    error.name = 'AbortError';
    throw error;
  }, clipboard: {writeText: async (text) => copied.push(text)}});
  const {shareLink} = loadTs('src/core/platform/share.web.ts');
  assert.equal(await shareLink(INPUT), 'dismissed');
  setNavigator({clipboard: {writeText: async (text) => copied.push(text)}});
  assert.equal(await shareLink(INPUT), 'copied');
  assert.deepEqual(copied, [INPUT.url]);
  setNavigator({share: async () => undefined});
  assert.equal(await shareLink(INPUT), 'shared');
  setNavigator({});
  assert.equal(await shareLink(INPUT), 'failed');
});
