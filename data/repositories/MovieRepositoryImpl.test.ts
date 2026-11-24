import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const {MovieRepositoryImpl} = loadTypeScript('data/repositories/MovieRepositoryImpl.ts');
const {POSTER_WIDTHS} = loadTypeScript('domain/entities/Movie.ts');

const ASSETS = 'https://yts.pw/assets/images/movies/microstar_2026';

function dto(overrides: Record<string, unknown> = {}) {
    return {
        id: 80033, url: '', imdb_code: 'tt1234567', title: 'Microstar', title_english: 'Microstar',
        title_long: 'Microstar (2026)', slug: 'microstar-2026', year: 2026, rating: 6.5, runtime: 95,
        genres: ['Drama'], summary: '', description_full: '', synopsis: '', yt_trailer_code: '', language: 'en',
        mpa_rating: '', background_image: `${ASSETS}/background.jpg`, background_image_original: `${ASSETS}/background.jpg`,
        small_cover_image: `${ASSETS}/small-cover.jpg`, medium_cover_image: `${ASSETS}/medium-cover.jpg`,
        large_cover_image: `${ASSETS}/large-cover.jpg`, torrents: [], date_uploaded: '', date_uploaded_unix: 0,
        ...overrides,
    };
}

function repository(movie: Record<string, unknown>) {
    return new MovieRepositoryImpl({
        listMovies: async () => ({data: {movies: [movie], page_number: 1, movie_count: 1, limit: 20}}),
        getMovieDetails: async () => ({data: {movie}}),
    });
}

async function listed(movie: Record<string, unknown>) {
    return (await repository(movie).listMovies({page: 1})).movies[0];
}

test('catalog artwork loads directly from the catalog image host without an image proxy', async () => {
    const details = await repository(dto({
        medium_screenshot_image1: `${ASSETS}/medium-screenshot1.jpg`, large_screenshot_image1: `${ASSETS}/large-screenshot1.jpg`,
        medium_screenshot_image2: `${ASSETS}/medium-screenshot2.jpg`,
        cast: [{name: 'Actor', character_name: 'Lead', url_small_image: 'https://yts.pw/assets/images/actors/thumb/nm1.jpg'}],
    })).getMovieDetails(80033);

    assert.deepEqual(details.posterUrls, [`${ASSETS}/medium-cover.jpg`, `${ASSETS}/large-cover.jpg`]);
    assert.equal(details.posterUrls.length, POSTER_WIDTHS.length);
    assert.equal(details.backgroundImageUrl, `${ASSETS}/background.jpg`);
    assert.deepEqual(details.thumbnailUrls, [`${ASSETS}/background.jpg`]);
    assert.deepEqual(details.screenshotUrls, [`${ASSETS}/large-screenshot1.jpg`, `${ASSETS}/medium-screenshot2.jpg`]);
    assert.deepEqual(details.screenshotThumbUrls, details.screenshotUrls);
    assert.equal(details.cast[0].imageUrl, 'https://yts.pw/assets/images/actors/thumb/nm1.jpg');
    assert.doesNotMatch(JSON.stringify(details), /wsrv\.nl/);
});

test('catalog artwork upgrades insecure URLs and skips missing or unusable ones', async () => {
    const movie = await listed(dto({
        medium_cover_image: ` http://yts.pw/assets/images/movies/x/medium-cover.jpg `,
        large_cover_image: 'not a url',
        background_image_original: 'javascript:alert(1)',
        background_image: 'http://yts.pw/assets/images/movies/x/background.jpg',
    }));

    assert.deepEqual(movie.posterUrls, ['https://yts.pw/assets/images/movies/x/medium-cover.jpg']);
    assert.equal(movie.backgroundImageUrl, 'https://yts.pw/assets/images/movies/x/background.jpg');
});

test('posters fall back to the small cover only when no larger cover exists', async () => {
    assert.deepEqual((await listed(dto({medium_cover_image: '', large_cover_image: ''}))).posterUrls,
        [`${ASSETS}/small-cover.jpg`]);
    assert.deepEqual((await listed(dto({medium_cover_image: `${ASSETS}/cover.jpg`, large_cover_image: `${ASSETS}/cover.jpg`}))).posterUrls,
        [`${ASSETS}/cover.jpg`]);
    const bare = await listed(dto({small_cover_image: '', medium_cover_image: '', large_cover_image: '',
        background_image: '', background_image_original: ''}));
    assert.deepEqual(bare.posterUrls, []);
    assert.equal(bare.backgroundImageUrl, undefined);
    assert.equal(bare.thumbnailUrls, undefined);
});
