import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {TitleSummary} from '@/core/domain/title';
import {clearSummaries, getSummary, rememberSummary, SUMMARY_CACHE_SIZE} from './summaryCache';

function summary(id: number): TitleSummary {
  return {
    key: `movie:${id}`, type: 'movie', id, slug: `title-${id}`, title: `Title ${id}`, originalTitle: `Title ${id}`, year: 2000,
    releaseDate: '2000-01-01', overview: '', posterPath: null, backdropPath: null, rating: null, voteCount: 0, genreIds: [], originalLanguage: 'en',
  };
}

test('the summary cache keeps the 500 most recently used summaries', () => {
  clearSummaries();
  for (let id = 1; id <= SUMMARY_CACHE_SIZE; id += 1) rememberSummary(summary(id));
  assert.equal(getSummary('movie:1')?.id, 1);
  rememberSummary(summary(SUMMARY_CACHE_SIZE + 1));
  assert.equal(getSummary('movie:1')?.id, 1);
  assert.equal(getSummary('movie:2'), null);
  assert.equal(getSummary(`movie:${SUMMARY_CACHE_SIZE + 1}`)?.id, SUMMARY_CACHE_SIZE + 1);
  rememberSummary({...summary(3), title: 'Updated'});
  assert.equal(getSummary('movie:3')?.title, 'Updated');
  clearSummaries();
  assert.equal(getSummary('movie:3'), null);
});
