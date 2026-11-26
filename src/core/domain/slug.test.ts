import assert from 'node:assert/strict';
import {test} from 'node:test';
import {slugify} from './slug';

test('slugs follow the canonical URL table', () => {
  assert.equal(slugify('The Matrix'), 'the-matrix');
  assert.equal(slugify('Amélie'), 'amelie');
  assert.equal(slugify('Spider-Man: Across the Spider-Verse'), 'spider-man-across-the-spider-verse');
  assert.equal(slugify('Fast & Furious'), 'fast-and-furious');
  assert.equal(slugify('千と千尋の神隠し'), '');
});

test('slugs drop apostrophes, trim separators and stay within 60 characters', () => {
  assert.equal(slugify("Schindler's List"), 'schindlers-list');
  assert.equal(slugify('It’s a Wonderful Life'), 'its-a-wonderful-life');
  assert.equal(slugify('  --Hello,   World!--  '), 'hello-world');
  assert.equal(slugify('A very long title that keeps going well past the sixty character limit of slugs'),
    'a-very-long-title-that-keeps-going-well-past-the-sixty-chara');
  assert.equal(slugify(`${'x'.repeat(59)} yz`), 'x'.repeat(59));
});
