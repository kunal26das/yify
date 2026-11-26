import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPosterPrefetcher, posterPrefetchUrls} from './prefetch';

test('the next window of poster urls follows the last visible card', () => {
  const items = Array.from({length: 40}, (_, index) => ({id: index, url: index % 5 === 0 ? null : `u${index}`}));
  assert.deepEqual(posterPrefetchUrls(items, 3, 3, (item) => item.url), ['u4', 'u6', 'u7', 'u8', 'u9']);
  assert.equal(posterPrefetchUrls(items, 0, 10, (item) => item.url).length, 10);
  assert.deepEqual(posterPrefetchUrls(items, 39, 3, (item) => item.url), []);
});

test('the prefetcher keeps one request in flight and skips urls it already fetched', async () => {
  const batches: string[][] = [];
  let release: (ok: boolean) => void = () => undefined;
  const prefetcher = createPosterPrefetcher((urls) => {
    batches.push(urls);
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  prefetcher.request(['a', 'b']);
  await Promise.resolve();
  prefetcher.request(['b', 'c']);
  prefetcher.request(['c', 'd']);
  assert.deepEqual(batches, [['a', 'b']]);
  release(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(batches, [['a', 'b'], ['c', 'd']]);
  release(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  prefetcher.request(['c', 'd', 'a']);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(batches[2], ['c', 'd']);
  prefetcher.dispose();
  prefetcher.request(['z']);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(batches.length, 3);
});
