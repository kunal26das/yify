const assert = require('node:assert/strict');
const {afterEach, test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

afterEach(() => {
  delete globalThis.window;
  delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
});

test('the web Firebase app uses the same-origin auth domain only on the proxied hosts', async () => {
  const web = loadTs('src/core/platform/firebase/webApp.web.ts');
  assert.equal(web.firebaseAuthDomain('yify.expo.app'), 'yify.expo.app');
  assert.equal(web.firebaseAuthDomain('YIFY--V2.expo.app'), 'yify--v2.expo.app');
  assert.equal(web.firebaseAuthDomain('localhost:8081'), 'yify-2da67.firebaseapp.com');
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'auth.example.com';
  assert.equal(web.firebaseAuthDomain('yify--abc123.expo.app'), 'auth.example.com');
  assert.equal(web.firebaseWebConfig('yify.expo.app').projectId, 'yify-2da67');
  assert.match(web.getFirebaseMeasurementId(), /^G-[A-Z0-9]+$/);
  assert.equal(await web.loadFirebaseApp(), null);
  const native = loadTs('src/core/platform/firebase/webApp.ts');
  assert.equal(await native.loadFirebaseApp(), null);
  assert.equal(native.getFirebaseMeasurementId(), null);
});

test('the web Firebase app is created once, lazily, with the host-derived config', async () => {
  const created = [];
  const firebaseApp = {getApps: () => created, initializeApp: (config) => {
    const app = {options: config};
    created.push(app);
    return app;
  }};
  globalThis.window = {location: {host: 'yify.expo.app'}};
  const web = loadTs('src/core/platform/firebase/webApp.web.ts', {'firebase/app': firebaseApp});
  const first = await web.loadFirebaseApp();
  const second = await web.loadFirebaseApp();
  assert.equal(first, second);
  assert.equal(created.length, 1);
  assert.equal(first.options.authDomain, 'yify.expo.app');
});
