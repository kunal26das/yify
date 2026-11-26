import assert from 'node:assert/strict';
import {test} from 'node:test';
import {proxyFirebase} from './auth/firebaseProxy';
import {fixturesEnabled, legacyCatalogMode, tmdbApiBaseUrl, tmdbKeySource} from './env';
import {getServerState} from './http/state';
import {handleCatalogRequest} from './legacy/catalog/handler';
import {legacyRedirect} from './middleware/legacyRedirects';
import {sitemapFile, sitemapIndex} from './seo/sitemaps';

test('the legacy catalog and the Firebase proxy answer 501 until P1 lands', async () => {
  const catalog = await handleCatalogRequest(new Request('https://yify.expo.app/api/catalog/movies?v=2'), 'movies');
  assert.equal(catalog.status, 501);
  assert.equal(catalog.headers.get('access-control-allow-origin'), '*');
  assert.equal(catalog.headers.get('x-yify-legacy'), '1');
  assert.deepEqual(await catalog.json(), {error: 'rebuilding'});
  const proxy = await proxyFirebase(new Request('https://yify.expo.app/__/auth/handler'), 'auth', 'handler');
  assert.equal(proxy.status, 501);
  assert.equal(proxy.headers.get('cache-control'), 'no-store');
});

test('the middleware lets every request through and the sitemap index is empty', async () => {
  assert.equal(await legacyRedirect(new Request('https://yify.expo.app/movie/8462')), undefined);
  const index = await sitemapIndex(new Request('https://yify.expo.app/sitemap.xml'));
  assert.equal(index.headers.get('content-type'), 'application/xml; charset=utf-8');
  assert.match(await index.text(), /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/sitemapindex>/);
  assert.equal((await sitemapFile(new Request('https://yify.expo.app/sitemaps/movie-1.xml'), 'movie-1.xml')).status, 404);
});

test('server state lives once on globalThis and the environment has safe defaults', () => {
  assert.equal(getServerState(), getServerState());
  assert.equal(Reflect.get(globalThis, '__yifyServer'), getServerState());
  const saved = {...process.env};
  try {
    delete process.env.YIFY_API_FIXTURES;
    delete process.env.TMDB_API_KEY;
    delete process.env.TMDB_API_BASE_URL;
    delete process.env.YIFY_LEGACY_CATALOG;
    assert.equal(fixturesEnabled(), false);
    assert.equal(tmdbKeySource(), 'fallback');
    assert.equal(tmdbApiBaseUrl(), 'https://api.themoviedb.org/3');
    assert.equal(legacyCatalogMode(), 'on');
    process.env.TMDB_API_KEY = 'x';
    process.env.TMDB_API_BASE_URL = 'http://localhost:9999/3/';
    process.env.YIFY_LEGACY_CATALOG = 'gone';
    assert.equal(tmdbKeySource(), 'env');
    assert.equal(tmdbApiBaseUrl(), 'http://localhost:9999/3');
    assert.equal(legacyCatalogMode(), 'gone');
    process.env.YIFY_API_FIXTURES = '1';
    assert.equal(tmdbKeySource(), 'fixtures');
  } finally {
    process.env = saved;
  }
});
