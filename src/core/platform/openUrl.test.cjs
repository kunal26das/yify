const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {createRnMock, spy} = require('../../../tests/helpers/rnMock.cjs');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

afterEach(() => {
  delete globalThis.window;
});

test('native opens https links in a Custom Tab and falls back to the system', async () => {
  const rn = createRnMock();
  const browser = {openBrowserAsync: spy(() => Promise.resolve({type: 'opened'}))};
  const {openUrl} = loadTs('src/core/platform/openUrl.ts', {'react-native': rn, 'expo-web-browser': browser});
  assert.equal(await openUrl('https://www.justwatch.com'), true);
  assert.equal(browser.openBrowserAsync.calls[0][0], 'https://www.justwatch.com/');
  assert.equal(browser.openBrowserAsync.calls[0][1].enableBarCollapsing, true);
  assert.match(browser.openBrowserAsync.calls[0][1].toolbarColor, /^#[0-9A-F]{6}$/i);
  assert.equal(await openUrl('https://www.youtube.com/watch?v=vKQi3bBA1y8', {external: true, toolbarColor: '#000000'}), true);
  assert.equal(rn.Linking.openURL.calls[0][0], 'https://www.youtube.com/watch?v=vKQi3bBA1y8');
  browser.openBrowserAsync = spy(() => Promise.reject(new Error('no browser')));
  assert.equal(await openUrl('https://yify.expo.app/privacy.html'), true);
  assert.equal(rn.Linking.openURL.calls[1][0], 'https://yify.expo.app/privacy.html');
  assert.equal(await openUrl('mailto:help@example.com'), true);
  assert.equal(await openUrl('http://insecure.example.com'), false);
  rn.Linking.openURL = spy(() => Promise.reject(new Error('no handler')));
  assert.equal(await openUrl('mailto:help@example.com'), false);
});

test('web opens a new tab without an opener and refuses unsafe links', async () => {
  const opened = [];
  globalThis.window = {open: (...args) => opened.push(args), location: {href: ''}};
  const {openUrl} = loadTs('src/core/platform/openUrl.web.ts');
  assert.equal(await openUrl('https://www.justwatch.com/in'), true);
  assert.deepEqual(opened, [['https://www.justwatch.com/in', '_blank', 'noopener,noreferrer']]);
  assert.equal(await openUrl('mailto:help@example.com'), true);
  assert.equal(globalThis.window.location.href, 'mailto:help@example.com');
  assert.equal(await openUrl('javascript:alert(1)'), false);
  delete globalThis.window;
  assert.equal(await openUrl('https://www.justwatch.com'), false);
});
