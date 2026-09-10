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
    options: {signal?: AbortSignal; fetch?: typeof fetch; onResponse?: (body: unknown) => void} = {},
): CatalogRepositories {
    const moviesUrl = upstreamUrl(environment.YIFY_CATALOG_YTS_BASE_URL, DEFAULT_BASE_URL);
    const showsUrl = upstreamUrl(environment.YIFY_CATALOG_EZTV_BASE_URL, EZTV_BASE_URL);
    const fetcher = createCatalogFetch(options.signal, options.fetch);
    const movies = new YtsApiDataSource(() => moviesUrl, undefined, {fetch: fetcher, cache: false});
    const shows = new EztvApiDataSource(() => showsUrl, undefined, fetcher);
    const capture = async <T>(work: () => Promise<T>): Promise<T> => {
        const body = await withCatalogSignal(options.signal, work);
        options.onResponse?.(body);
        return body;
    };
    return {
        movies: new MovieRepositoryImpl({
            listMovies: params => capture(() => movies.listMovies(params)),
            getMovieDetails: params => capture(() => movies.getMovieDetails(params)),
            getMovieSuggestions: id => capture(() => movies.getMovieSuggestions(id)),
            getMovieParentalGuides: id => capture(() => movies.getMovieParentalGuides(id)),
        }),
        shows: new ShowRepositoryImpl({
            getTorrents: params => capture(() => shows.getTorrents(params)),
        }),
    };
}
