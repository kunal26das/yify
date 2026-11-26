import assert from 'node:assert/strict';
import {test} from 'node:test';
import {screenNameForSegments} from './screenNames';

test('route segments map to the C5.5 screen names', () => {
  const cases: [string[], ReturnType<typeof screenNameForSegments>][] = [
    [['(tabs)', '(home)'], 'home'],
    [['(tabs)', '(home)', 'index'], 'home'],
    [['(tabs)', '(search)', 'search'], 'search'],
    [['(tabs)', '(home)', 'title', 'movie', '[id]'], 'title_movie'],
    [['(tabs)', '(library)', 'title', 'tv', '[id]'], 'title_tv'],
    [['(tabs)', '(search)', 'title', 'tv', '[id]', 'season', '[season]'], 'title_tv'],
    [['(tabs)', '(you)', 'person', '[id]'], 'person'],
    [['(tabs)', '(library)', 'library'], 'library'],
    [['(tabs)', '(library)', 'library', 'watched'], 'library'],
    [['(tabs)', '(library)', 'list', '[id]'], 'library'],
    [['(tabs)', '(you)', 'you'], 'you'],
    [['(tabs)', '(you)', 'plus'], 'plus'],
    [['(tabs)', '(you)', 'settings'], 'settings'],
    [['(tabs)', '(you)', 'settings', 'appearance'], 'settings'],
    [['movie', '[id]'], null],
    [['+not-found'], null],
    [[], null],
  ];
  for (const [segments, expected] of cases) assert.equal(screenNameForSegments(segments), expected, segments.join('/'));
});
