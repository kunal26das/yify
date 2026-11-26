import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BREAKPOINTS, windowClassFor} from './windowClass';

test('window classes follow the Material 3 breakpoints', () => {
  assert.deepEqual(BREAKPOINTS, {medium: 600, expanded: 840, large: 1200, extraLarge: 1600});
  const cases: [number, string][] = [
    [0, 'compact'], [360, 'compact'], [390, 'compact'], [599, 'compact'], [599.98, 'compact'],
    [600, 'medium'], [700, 'medium'], [839, 'medium'],
    [840, 'expanded'], [1280, 'expanded'], [2560, 'expanded'],
  ];
  for (const [width, expected] of cases) assert.equal(windowClassFor(width), expected, String(width));
});
