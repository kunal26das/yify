import {DEFAULT_BASE_URL, YtsApiDataSource} from '../../datasources/YtsApiDataSource';
import {EZTV_BASE_URL, EztvApiDataSource} from '../../datasources/EztvApiDataSource';
import {MovieRepositoryImpl} from '../../repositories/MovieRepositoryImpl';
import {ShowRepositoryImpl} from '../../repositories/ShowRepositoryImpl';
import type {CatalogRepositories} from './handler';
import {createCatalogFetch, withCatalogSignal} from './cancellation';

function upstreamUrl(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    const expected = new URL(fallback);
    const supplied = new URL(value);
    if (supplied.protocol !== 'https:' || supplied.hostname !== expected.hostname || supplied.port
        || supplied.username || supplied.password || supplied.search || supplied.hash
        || supplied.pathname.replace(/\/+$/, '') !== expected.pathname) {
        throw new Error('Invalid catalog server configuration');
    }
    return supplied.href.replace(/\/+$/, '');
}

export function createCatalogRepositories(
    environment: Record<string, string | undefined> = process.env,
    options: {signal?: AbortSignal; fetch?: typeof fetch} = {},
): CatalogRepositories {
    const moviesUrl = upstreamUrl(environment.YIFY_CATALOG_YTS_BASE_URL, DEFAULT_BASE_URL);
    const showsUrl = upstreamUrl(environment.YIFY_CATALOG_EZTV_BASE_URL, EZTV_BASE_URL);
    const fetcher = createCatalogFetch(options.signal, options.fetch);
    const movies = new YtsApiDataSource(() => moviesUrl, undefined, {fetch: fetcher, cache: false});
    const shows = new EztvApiDataSource(() => showsUrl, undefined, fetcher);
    return {
        movies: new MovieRepositoryImpl({
            listMovies: params => withCatalogSignal(options.signal, () => movies.listMovies(params)),
            getMovieDetails: params => withCatalogSignal(options.signal, () => movies.getMovieDetails(params)),
            getMovieSuggestions: id => withCatalogSignal(options.signal, () => movies.getMovieSuggestions(id)),
            getMovieParentalGuides: id => withCatalogSignal(options.signal, () => movies.getMovieParentalGuides(id)),
        }),
        shows: new ShowRepositoryImpl({
            getTorrents: params => withCatalogSignal(options.signal, () => shows.getTorrents(params)),
        }),
    };
}
