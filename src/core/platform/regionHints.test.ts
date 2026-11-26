import assert from 'node:assert/strict';
import {test} from 'node:test';
import {regionCode, regionFromLanguageTag, regionFromTimeZone} from './regionHints';

test('region hints read language tags and time zones', () => {
  assert.equal(regionCode(' in '), 'IN');
  assert.equal(regionCode('IND'), null);
  assert.equal(regionFromLanguageTag('en-IN'), 'IN');
  assert.equal(regionFromLanguageTag('zh-Hant-TW'), 'TW');
  assert.equal(regionFromLanguageTag('pt_br'), 'BR');
  assert.equal(regionFromLanguageTag('en'), null);
  assert.equal(regionFromLanguageTag('es-419'), null);
  assert.equal(regionFromTimeZone('Asia/Kolkata'), 'IN');
  assert.equal(regionFromTimeZone('America/Chicago'), 'US');
  assert.equal(regionFromTimeZone('Europe/Tallinn'), 'GB');
  assert.equal(regionFromTimeZone('Africa/Lagos'), 'NG');
  assert.equal(regionFromTimeZone('Antarctica/Troll'), null);
  assert.equal(regionFromTimeZone(null), null);
});
