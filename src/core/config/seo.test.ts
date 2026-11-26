import assert from 'node:assert/strict';
import {test} from 'node:test';
import {APP_NAME, PLUS_NAME} from './app';
import {
  HOME_DESCRIPTION, HOME_TITLE, isIndexableHost, pageTitle, personDocumentTitle, staticMetadata, staticPageTitle, titleDocumentTitle,
} from './seo';

test('document titles follow the metadata table', () => {
  assert.equal(pageTitle('Search'), `Search | ${APP_NAME}`);
  assert.equal(HOME_TITLE, `${APP_NAME} — find where to watch movies and TV`);
  assert.equal(titleDocumentTitle({type: 'movie', title: 'The Matrix', year: 1999}), `The Matrix (1999) — trailer, cast & where to watch | ${APP_NAME}`);
  assert.equal(titleDocumentTitle({type: 'movie', title: 'Untitled', year: null}), `Untitled — trailer, cast & where to watch | ${APP_NAME}`);
  assert.equal(titleDocumentTitle({type: 'tv', title: 'Dark', year: 2017}), `Dark (TV series 2017) — trailer & where to watch | ${APP_NAME}`);
  assert.equal(titleDocumentTitle({type: 'tv', title: 'Pilot', year: null}), `Pilot (TV series) — trailer & where to watch | ${APP_NAME}`);
  assert.equal(personDocumentTitle('Keanu Reeves'), `Keanu Reeves — movies and TV shows | ${APP_NAME}`);
  assert.equal(staticPageTitle('plus'), `${PLUS_NAME} | ${APP_NAME}`);
  assert.equal(staticPageTitle('home'), HOME_TITLE);
});

test('only the production host is indexable', () => {
  assert.equal(isIndexableHost(null), true);
  assert.equal(isIndexableHost('yify.expo.app'), true);
  assert.equal(isIndexableHost('YIFY.EXPO.APP'), true);
  assert.equal(isIndexableHost('yify.expo.app, proxy.example'), true);
  assert.equal(isIndexableHost('yify--v2.expo.app'), false);
  assert.equal(isIndexableHost('localhost:8081'), false);
});

test('home metadata is canonical and shareable, and app pages are never indexed', () => {
  const home = staticMetadata('home', 'yify.expo.app');
  assert.equal(home.title, HOME_TITLE);
  assert.equal(home.description, HOME_DESCRIPTION);
  assert.equal(home.robots, undefined);
  assert.deepEqual(home.alternates, {canonical: 'https://yify.expo.app/'});
  assert.deepEqual(home.openGraph?.images, [{url: 'https://yify.expo.app/og-card.png'}]);
  assert.equal(home.twitter?.card, 'summary_large_image');
  assert.deepEqual(staticMetadata('home', 'yify--v2.expo.app').robots, {index: false, follow: false});
  assert.deepEqual(staticMetadata('search', null), {title: `Search | ${APP_NAME}`, robots: {index: false, follow: true}});
  assert.deepEqual(staticMetadata('recent', 'yify--v2.expo.app'), {title: `Recently viewed | ${APP_NAME}`, robots: {index: false, follow: false}});
});
