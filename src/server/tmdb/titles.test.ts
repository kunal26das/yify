import assert from 'node:assert/strict';
import {test} from 'node:test';
import {discover, getMovie, getPerson, getTv, popularPeople} from './titles';

const signal = new AbortController().signal;

test('the title helpers answer from the fixtures and return null for unknown ids', async () => {
  const movie = await getMovie(603, 'US', signal);
  assert.equal(movie?.title, 'The Matrix');
  assert.equal(movie?.availability.region, 'US');
  assert.deepEqual((await getMovie(299536, null, signal))?.availability, {region: '', offers: {stream: [], free: [], ads: [], rent: [], buy: []}, link: null, attribution: 'JustWatch'});
  assert.equal(await getMovie(1399, 'US', signal), null);
  assert.equal((await getTv(1399, 'IN', signal))?.type, 'tv');
  assert.equal(await getTv(603, 'IN', signal), null);
  assert.equal((await getPerson(6384, signal))?.slug, 'keanu-reeves');
  assert.equal(await getPerson(1, signal), null);
});

test('discover and popular people return the fixture page for every page', async () => {
  const first = await discover('movie', 1, signal);
  const later = await discover('movie', 25, signal);
  assert.equal(later.page, 25);
  assert.deepEqual(later.results, first.results);
  assert.ok((await discover('tv', 1, signal)).results.every((item) => item.type === 'tv'));
  assert.ok((await popularPeople(2, signal)).results.length > 0);
});

test('an aborted signal stops every helper', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(getMovie(603, 'US', controller.signal));
  await assert.rejects(popularPeople(1, controller.signal));
});
