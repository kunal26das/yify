import type {Genre, ListMoviesParams, ListShowsParams, OrderBy, Quality, SortBy} from '@/domain';

const MOVIE_PARAMETERS = ['page', 'limit', 'query', 'quality', 'minimum_rating', 'genre', 'sort_by', 'order_by'];
const QUALITIES = ['', '480p', '720p', '1080p', '1080p.x265', '2160p', '3D'];
const GENRES = ['', 'action', 'adventure', 'animation', 'comedy', 'crime', 'documentary', 'drama', 'fantasy', 'horror', 'mystery', 'romance', 'sci-fi', 'thriller', 'war', 'western'];
const SORTS = ['date_added', 'title', 'year', 'rating', 'download_count', 'like_count', 'seeds', 'peers'];

export class InvalidCatalogRequest extends Error {}

export type CatalogRequest = (
    | {operation: 'movies'; params: ListMoviesParams}
    | {operation: 'movie' | 'suggestions' | 'parental-guides'; id: number}
    | {operation: 'shows'; params: ListShowsParams}
    | {operation: 'episodes'; imdbId: string}
) & {version: 1 | 2};

function integer(value: string | null, maximum: number, fallback?: number): number {
    if (value === null && fallback !== undefined) return fallback;
    if (value === null || !/^[1-9]\d*$/.test(value)) throw new InvalidCatalogRequest();
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new InvalidCatalogRequest();
    return parsed;
}

function choice<T extends string>(value: string | null, values: readonly string[]): T | undefined {
    if (value === null) return undefined;
    if (!values.includes(value)) throw new InvalidCatalogRequest();
    return value as T;
}

function imdb(value: string | null): string {
    if (!value || !/^(?:tt)?\d{1,12}$/.test(value)) throw new InvalidCatalogRequest();
    const digits = value.replace(/^tt/, '');
    if (!/[1-9]/.test(digits)) throw new InvalidCatalogRequest();
    return digits;
}

export function parseCatalogRequest(operation: string, params: URLSearchParams): CatalogRequest {
    const allowed = operation === 'movies' ? MOVIE_PARAMETERS
        : operation === 'shows' ? ['page', 'limit', 'imdbId']
            : operation === 'episodes' ? ['imdbId']
                : ['movie', 'suggestions', 'parental-guides'].includes(operation) ? ['id'] : null;
    const keys = [...params.keys()];
    if (!allowed || keys.some(key => key !== 'v' && !allowed.includes(key)) || new Set(keys).size !== keys.length) throw new InvalidCatalogRequest();
    const requestedVersion = params.get('v');
    if (requestedVersion !== null && requestedVersion !== '2') throw new InvalidCatalogRequest();
    const version = requestedVersion === '2' ? 2 : 1;
    if (operation === 'movies') {
        const query = params.get('query');
        if (query !== null && (query.length > 200 || /[\u0000-\u001f\u007f]/.test(query))) throw new InvalidCatalogRequest();
        const minimumRating = params.get('minimum_rating');
        if (minimumRating !== null && (!/^(?:[0-9](?:\.\d)?|10(?:\.0)?)$/.test(minimumRating))) throw new InvalidCatalogRequest();
        return {operation, version, params: {
            page: integer(params.get('page'), 10_000, 1),
            limit: params.has('limit') ? integer(params.get('limit'), 50) : undefined,
            query: query?.trim() || undefined,
            quality: choice<Quality>(params.get('quality'), QUALITIES),
            minimum_rating: minimumRating === null ? undefined : Number(minimumRating),
            genre: choice<Genre>(params.get('genre'), GENRES),
            sort_by: choice<SortBy>(params.get('sort_by'), SORTS),
            order_by: choice<OrderBy>(params.get('order_by'), ['asc', 'desc']),
        }};
    }
    if (operation === 'shows') return {operation, version, params: {
        page: integer(params.get('page'), 10_000, 1),
        limit: params.has('limit') ? integer(params.get('limit'), 50) : undefined,
        imdbId: params.has('imdbId') ? imdb(params.get('imdbId')) : undefined,
    }};
    if (operation === 'episodes') return {operation, version, imdbId: imdb(params.get('imdbId'))};
    return {operation: operation as 'movie' | 'suggestions' | 'parental-guides', version, id: integer(params.get('id'), 2_147_483_647)};
}
