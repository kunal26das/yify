const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {activeFeedChipKey, chipFor, chipMatches, FEED_CHIPS} = loadTypeScript('presentation/movies/constants/feedChips.ts');

test('unfiltered browse selects Latest while the existing all key remains Popular', () => {
    assert.equal(activeFeedChipKey({}), 'new');
    assert.equal(chipFor('new').label, 'Latest');
    assert.equal(chipFor('all').label, 'Popular');
    assert.equal(chipFor('all').query.sort_by, 'download_count');
    assert.equal(activeFeedChipKey({sort_by: 'download_count'}), 'all');
});

test('empty selectors and omitted descending order match the same API defaults', () => {
    assert.equal(activeFeedChipKey({genre: '', quality: '', minimum_rating: 0}), 'new');
    assert.equal(chipMatches({sort_by: 'date_added', order_by: 'desc'}, {}), true);
    assert.equal(chipMatches({sort_by: 'date_added', order_by: 'desc'}, {order_by: 'asc'}), false);
});

test('a genre preset matches only its complete filter and sort combination', () => {
    const genre = chipFor('genre-action').query;
    assert.equal(activeFeedChipKey(genre), 'genre-action');
    assert.equal(activeFeedChipKey({...genre, quality: '2160p'}), '');
    assert.equal(activeFeedChipKey({...genre, minimum_rating: 7}), '');
    assert.equal(activeFeedChipKey({...genre, sort_by: 'date_added'}), '');
    assert.equal(activeFeedChipKey({...genre, order_by: 'asc'}), '');
});

test('rating and quality presets require their stated sort and all other selectors', () => {
    assert.equal(activeFeedChipKey({minimum_rating: 7, sort_by: 'rating'}), 'top-rated');
    assert.equal(activeFeedChipKey({minimum_rating: 7, sort_by: 'year'}), '');
    assert.equal(activeFeedChipKey({quality: '2160p', sort_by: 'download_count'}), 'uhd');
    assert.equal(activeFeedChipKey({quality: '2160p', sort_by: 'download_count', minimum_rating: 7}), '');
});

test('every configured preset resolves to itself and unknown stored keys retain their fallback', () => {
    for (const chip of FEED_CHIPS) assert.equal(activeFeedChipKey(chip.query), chip.key);
    assert.equal(chipFor('previously-removed'), chipFor('all'));
});
