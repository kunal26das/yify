const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');

test('native accessibility helpers use roles React Native supports', () => {
  const a11y = loadTs('src/core/ui/a11y.ts');
  assert.deepEqual(a11y.headingProps(2), {role: 'heading'});
  assert.deepEqual(a11y.currentPageProps(true), {role: 'tab', 'aria-selected': true});
  assert.deepEqual(a11y.toggleProps(false), {accessibilityRole: 'togglebutton', 'aria-checked': false});
  assert.deepEqual(a11y.popupProps(true), {'aria-expanded': true});
});

test('web accessibility helpers use the ARIA attributes react-native-web maps', () => {
  const a11y = loadTs('src/core/ui/a11y.web.ts');
  assert.deepEqual(a11y.headingProps(3), {role: 'heading', 'aria-level': 3});
  assert.deepEqual(a11y.currentPageProps(true), {'aria-current': 'page'});
  assert.deepEqual(a11y.currentPageProps(false), {'aria-current': undefined});
  assert.deepEqual(a11y.toggleProps(true), {role: 'button', 'aria-pressed': true});
  assert.deepEqual(a11y.popupProps(false), {'aria-haspopup': 'dialog', 'aria-expanded': false});
});
