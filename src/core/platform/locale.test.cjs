const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
});

function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', {value, configurable: true, writable: true});
}

test('native prefers the device locale region and falls back without throwing', () => {
  const load = (getLocales) => loadTs('src/core/platform/locale.ts', {'expo-localization': {getLocales}}).deviceRegion;
  assert.equal(load(() => [{regionCode: 'in'}])(), 'IN');
  const fallback = load(() => {
    throw new Error('missing');
  })();
  assert.match(fallback, /^[A-Z]{2}$/);
  assert.match(load(() => [])(), /^[A-Z]{2}$/);
});

test('web reads the browser languages before Intl and the time zone', () => {
  setNavigator({languages: ['en', 'hi-IN'], language: 'en'});
  assert.equal(loadTs('src/core/platform/locale.web.ts').deviceRegion(), 'IN');
  setNavigator({languages: [], language: 'fr-CA'});
  assert.equal(loadTs('src/core/platform/locale.web.ts').deviceRegion(), 'CA');
  setNavigator(undefined);
  assert.match(loadTs('src/core/platform/locale.web.ts').deviceRegion(), /^[A-Z]{2}$/);
});
