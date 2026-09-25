const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

test('YTS rejects malformed envelopes and collection data before repositories or cache consume them', () => {
    const {parseYtsResponse} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    const valid = {status: 'ok', data: {movie_count: 0, page_number: 1, limit: 20}};
    assert.equal(parseYtsResponse(valid, 'list_movies.json'), valid);
    for (const value of [null, [], {}, {status: 'ok'}, {status: 'ok', data: []},
        {status: 'ok', data: {movies: []}}, {...valid, data: {...valid.data, movies: {}}},
        {...valid, data: {...valid.data, movies: [null]}},
        {...valid, data: {...valid.data, movies: [{id: 1, title: 'Title', genres: 'Drama'}]}}]) {
        assert.throws(() => parseYtsResponse(value, 'list_movies.json'), {name: 'InvalidResponseError', code: 'invalid_response'});
    }
    assert.throws(() => parseYtsResponse({status: 'error', status_message: 'private query data'}, 'list_movies.json'),
        error => error.code === 'upstream_rejected' && !error.message.includes('private'));
});

test('YTS details, suggestions and parental guides validate their own endpoint shapes', () => {
    const {parseYtsResponse} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    const movie = {id: 1, title: 'Title'};
    for (const [endpoint, data] of [['movie_details.json', {movie}],
        ['movie_suggestions.json', {movies: [movie]}], ['movie_suggestions.json', {}],
        ['movie_parental_guides.json', {parental_guides: [{type: 'Violence', parental_guide_text: 'Mild.'}]}]]) {
        const body = {status: 'ok', data};
        assert.equal(parseYtsResponse(body, endpoint), body);
    }
    for (const [endpoint, data] of [['movie_details.json', {}], ['movie_details.json', {movie: []}],
        ['movie_suggestions.json', {movies: [{id: '1', title: 'Title'}]}],
        ['movie_parental_guides.json', {parental_guides: [null]}]]) {
        assert.throws(() => parseYtsResponse({status: 'ok', data}, endpoint), {code: 'invalid_response'});
    }
});

test('EZTV distinguishes legitimate empty results from invalid objects and error responses', () => {
    const {parseEztvResponse} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    for (const body of [{torrents: []}, {torrents_count: 0},
        {torrents: [{id: 1, title: 'Show S01E01', imdb_id: '1234567'}]},
        {torrents: [{id: 1, title: 'Unidentified show', imdb_id: null}]},
        {torrents: [{id: 1, title: 'Unidentified show'}]}]) {
        assert.equal(parseEztvResponse(body), body);
    }
    for (const body of [null, [], {}, {error: 'private upstream error'}, {torrents: 'unavailable'},
        {torrents: [null]}, {torrents: [{id: 1, title: 'Show', imdb_id: 123}]}]) {
        assert.throws(() => parseEztvResponse(body), {name: 'InvalidResponseError', code: 'invalid_response'});
    }
});

test('EZTV accepts an omitted collection only when valid pagination proves the page is exhausted', () => {
    const {parseEztvResponse} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    for (const body of [{torrents_count: 78, limit: 50, page: 3},
        {torrents_count: 78, limit: 50, page: 6, torrents: null},
        {torrents_count: 100, limit: 50, page: 3}]) {
        assert.equal(parseEztvResponse(body), body);
    }
    for (const body of [{torrents_count: 78}, {torrents_count: 78, page: 2, limit: 50},
        {torrents_count: 100, page: 2, limit: 50}, {torrents_count: 78, page: 3},
        {torrents_count: 78, page: 3, limit: 0}, {torrents_count: 78, page: 3, limit: 51},
        {torrents_count: 78, page: '3', limit: 50}, {torrents_count: '78', page: 3, limit: 50},
        {torrents_count: -1, page: 3, limit: 50}, {torrents_count: 78.5, page: 3, limit: 50},
        {torrents_count: 78, page: Infinity, limit: 50}, {torrents_count: 78, page: 3, limit: 50, torrents: {}}]) {
        assert.throws(() => parseEztvResponse(body), {name: 'InvalidResponseError', code: 'invalid_response'});
    }
});

test('a terminal EZTV page preserves episodes already loaded for a show', async () => {
    const records = [];
    const diagnostics = {event() {}, start() {
        return {finish(outcome) { records.push(outcome); }, fail(error) { assert.fail(String(error)); }};
    }};
    const {EztvApiDataSource} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    const {ShowRepositoryImpl} = loadTypeScript('data/repositories/ShowRepositoryImpl.ts');
    const pages = [];
    const api = new EztvApiDataSource(undefined, diagnostics, async url => {
        const page = Number(new URL(url).searchParams.get('page'));
        pages.push(page);
        return Response.json({torrents_count: 1, limit: 50, page,
            ...(page === 1 ? {torrents: [{id: 1, title: 'Show S01E01', imdb_id: '1234567',
                season: '1', episode: '1', date_released_unix: 1_700_000_000}]} : {})});
    });
    const episodes = await new ShowRepositoryImpl(api).listEpisodes('1234567');
    assert.deepEqual(pages, [1, 2]);
    assert.equal(episodes.length, 1);
    assert.equal(episodes[0].id, 1);
    assert.deepEqual(records, ['ok', 'ok']);
});

test('YTS normalizes only the exact zero-count suggestions sentinel without changing the source payload', () => {
    const {parseYtsResponse} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    const body = {status: 'ok', data: {movie_count: 0, movies: [{id: 0, title: null, genres: null}]}};
    assert.deepEqual(parseYtsResponse(body, 'movie_suggestions.json'), {status: 'ok', data: {movie_count: 0, movies: []}});
    assert.equal(body.data.movies.length, 1);
    for (const data of [{movie_count: 1, movies: [{id: 0, title: null}]},
        {movie_count: '0', movies: [{id: 0, title: null}]},
        {movie_count: 0, movies: [{id: '0', title: null}]},
        {movie_count: 0, movies: [{id: 1, title: null}]},
        {movie_count: 0, movies: [{id: 0, title: 'Broken'}]},
        {movie_count: 0, movies: [{id: 0, title: null}, {id: 1, title: 'Real film'}]}]) {
        assert.throws(() => parseYtsResponse({status: 'ok', data}, 'movie_suggestions.json'), {name: 'InvalidResponseError'});
    }
    assert.throws(() => parseYtsResponse({...body, data: {...body.data, limit: 20, page_number: 1}}, 'list_movies.json'),
        {name: 'InvalidResponseError'});
    assert.throws(() => parseYtsResponse({...body, data: {...body.data, parental_guides: [null]}}, 'movie_suggestions.json'),
        {name: 'InvalidResponseError', reason: 'parental_guides'});
});

test('empty YTS suggestions reach the repository as an empty list and are cached without error reports', async () => {
    const outcomes = [];
    const diagnostics = {event() {}, start() {
        return {finish(outcome) { outcomes.push(outcome); }, fail(error) { assert.fail(String(error)); }};
    }};
    const {YtsApiDataSource} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    const {MovieRepositoryImpl} = loadTypeScript('data/repositories/MovieRepositoryImpl.ts');
    let calls = 0;
    const api = new YtsApiDataSource(undefined, diagnostics, {fetch: async () => {
        calls++;
        return Response.json({status: 'ok', data: {movie_count: 0, movies: [{id: 0, title: null}]}});
    }});
    const repository = new MovieRepositoryImpl(api);
    assert.deepEqual(await repository.getMovieSuggestions(987654321), []);
    assert.deepEqual(await repository.getMovieSuggestions(987654321), []);
    assert.equal(calls, 1);
    assert.deepEqual(outcomes, ['ok']);
});

test('an invalid JSON object is reported once, excluded from cache, and does not trigger retries', async () => {
    const records = [];
    const diagnostics = {event() {}, start() {
        return {finish() {}, fail(error, attributes) { records.push({error, attributes}); }};
    }};
    const {YtsApiDataSource} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    let calls = 0;
    const api = new YtsApiDataSource(undefined, diagnostics, {fetch: async () => Response.json(++calls === 1
        ? {status: 'ok', data: null} : {status: 'ok', data: {movies: [], movie_count: 0, limit: 20, page_number: 1}})});
    const outcomes = await Promise.allSettled([api.listMovies({page: 1}), api.listMovies({page: 1})]);
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected'));
    assert.equal(calls, 1);
    assert.equal(records.length, 1);
    assert.equal(records[0].attributes.stage, 'validate');
    assert.equal(records[0].attributes.error_code, 'invalid_response');
    await api.listMovies({page: 1});
    assert.equal(calls, 2);
});

test('YTS removed-movie sentinel produces a readable missing movie without retrying or caching it', async () => {
    const records = [];
    const diagnostics = {event() {}, start() {
        return {finish(outcome, attributes) { records.push({outcome, attributes}); },
            fail(error) { assert.fail(`Missing movie captured as an error: ${error}`); }};
    }};
    const {YtsApiDataSource} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    let calls = 0;
    const api = new YtsApiDataSource(undefined, diagnostics, {fetch: async () => {
        calls++;
        return Response.json({status: 'ok', data: {movie: {id: 0, title: null, genres: null}}});
    }});
    for (let attempt = 0; attempt < 2; attempt++) {
        await assert.rejects(api.getMovieDetails({movie_id: 999999999}), {
            name: 'MovieNotFoundError', message: 'This movie is no longer available in the catalog.',
        });
    }
    assert.equal(calls, 2);
    assert.ok(records.every(record => record.outcome === 'empty' && record.attributes.error_code === 'movie_not_found'
        && record.attributes.retry_count === 0 && record.attributes.status_code === 200));
});

test('missing movie handling does not swallow malformed real movies or invalid list entries', () => {
    const {parseYtsResponse} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    for (const movie of [{id: 0, title: 'Broken'}, {id: '0', title: null}, {id: 1, title: null},
        {id: 1, title: 'Film', cast: {actor: 'Unexpected'}}]) {
        assert.throws(() => parseYtsResponse({status: 'ok', data: {movie}}, 'movie_details.json'),
            {name: 'InvalidResponseError', code: 'invalid_response'});
    }
    assert.throws(() => parseYtsResponse({status: 'ok', data: {movies: [{id: 0, title: null}],
        movie_count: 1, limit: 20, page_number: 1}}, 'list_movies.json'), {name: 'InvalidResponseError'});
});

test('invalid provider structures retain only bounded reasons for diagnosis', () => {
    const {parseYtsResponse} = loadTypeScript('data/datasources/YtsApiDataSource.ts');
    const {parseEztvResponse} = loadTypeScript('data/datasources/EztvApiDataSource.ts');
    assert.throws(() => parseYtsResponse({status: 'ok', data: {movie: {id: 1, title: 'Private title', cast: 'Private details'}}},
        'movie_details.json'), error => error.reason === 'movie_collections' && !error.message.includes('Private'));
    assert.throws(() => parseEztvResponse({torrents_count: 'private malformed count'}),
        error => error.reason === 'torrents_count' && !error.message.includes('private'));
});
