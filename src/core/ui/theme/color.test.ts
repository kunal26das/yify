import assert from 'node:assert/strict';
import {test} from 'node:test';
import {withAlpha} from './color';

test('withAlpha applies an opacity to hex and rgba colours', () => {
  assert.equal(withAlpha('#C8F03C', 0.1), 'rgba(200, 240, 60, 0.1)');
  assert.equal(withAlpha('#0b0d13', 1), 'rgba(11, 13, 19, 1)');
  assert.equal(withAlpha('#FFFFFF80', 0.5), 'rgba(255, 255, 255, 0.251)');
  assert.equal(withAlpha('rgba(0, 0, 0, 0.6)', 0.5), 'rgba(0, 0, 0, 0.3)');
  assert.equal(withAlpha('rgb(1, 2, 3)', 2), 'rgba(1, 2, 3, 1)');
});

test('withAlpha leaves CSS variables untouched', () => {
  assert.equal(withAlpha('var(--c-onSurface)', 0.1), 'var(--c-onSurface)');
});
