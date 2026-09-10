import {DEFAULT_BASE_URL, YtsApiDataSource} from '../../datasources/YtsApiDataSource';
import {EZTV_BASE_URL, EztvApiDataSource} from '../../datasources/EztvApiDataSource';
import {MovieRepositoryImpl} from '../../repositories/MovieRepositoryImpl';
import {ShowRepositoryImpl} from '../../repositories/ShowRepositoryImpl';
import type {CatalogRepositories} from './handler';

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

export function createCatalogRepositories(environment: Record<string, string | undefined> = process.env): CatalogRepositories {
    const moviesUrl = upstreamUrl(environment.YIFY_CATALOG_YTS_BASE_URL, DEFAULT_BASE_URL);
    const showsUrl = upstreamUrl(environment.YIFY_CATALOG_EZTV_BASE_URL, EZTV_BASE_URL);
    return {
        movies: new MovieRepositoryImpl(new YtsApiDataSource(() => moviesUrl)),
        shows: new ShowRepositoryImpl(new EztvApiDataSource(() => showsUrl)),
    };
}
