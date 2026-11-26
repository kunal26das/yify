import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import brandData from '../../../config/brand.json';
import {APP_NAME, PACKAGE_ID, PLAY_STORE_URL, PLUS_NAME, SITE_ORIGIN} from './app';
import {brand} from './brand';
import {DELETE_ACCOUNT_URL, PRIVACY_URL, SUPPORT_EMAIL, SUPPORT_URL, TERMS_URL} from './legal';

test('the display name comes from config/brand.json', () => {
  assert.equal(brand.appName, brandData.appName);
  assert.equal(APP_NAME, brandData.appName);
  assert.equal(PLUS_NAME, `${brandData.appName} Plus`);
});

test('store and legal links use the canonical host and the .html pages', () => {
  assert.equal(SITE_ORIGIN, 'https://yify.expo.app');
  assert.equal(PLAY_STORE_URL, `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`);
  assert.equal(PRIVACY_URL, 'https://yify.expo.app/privacy.html');
  assert.equal(TERMS_URL, 'https://yify.expo.app/terms.html');
  assert.equal(DELETE_ACCOUNT_URL, 'https://yify.expo.app/delete-account.html');
  assert.equal(SUPPORT_URL, 'https://yify.expo.app/support.html');
});

test('the support address is the contact in the privacy policy', () => {
  const policy = readFileSync(new URL('../../../public/privacy.html', import.meta.url), 'utf8');
  assert.match(policy, new RegExp(`href="mailto:${SUPPORT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
});
