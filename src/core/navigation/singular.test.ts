import assert from 'node:assert/strict';
import {test} from 'node:test';
import {singularById} from './singular';

test('detail screens are singular per route and TMDB id, whatever the slug', () => {
  assert.equal(singularById('title/movie/[id]', {id: '603-the-matrix'}), 'title/movie/[id]:603');
  assert.equal(singularById('title/movie/[id]', {id: '603'}), singularById('title/movie/[id]', {id: '603-old-slug'}));
  assert.equal(singularById('title/movie/[id]', {id: ['603-the-matrix', 'x']}), 'title/movie/[id]:603');
  assert.notEqual(singularById('title/movie/[id]', {id: '603'}), singularById('person/[id]', {id: '603'}));
  assert.notEqual(singularById('title/tv/[id]/index', {id: '1399'}), singularById('title/tv/[id]/index', {id: '1400'}));
  assert.equal(singularById('person/[id]', {}), 'person/[id]:undefined');
});
