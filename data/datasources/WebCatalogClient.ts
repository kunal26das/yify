import type {
    CastMember, Diagnostics, ListMoviesParams, ListMoviesResult, ListShowsParams,
    ListShowsResult, Movie, MovieDetails, ParentalGuide, Show, ShowEpisode,
} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import type {SubscriberCatalogAccess} from '../services/SubscriberCatalogAccess';
import {ResponseCache} from './storage/ResponseCache';

type CatalogLocation = Pick<Location, 'origin' | 'hostname' | 'protocol'>;
type CatalogEndpoint = 'movies' | 'movie' | 'suggestions' | 'parental-guides' | 'shows' | 'episodes';
type Query = Record<string, string | number | undefined>;

const CANONICAL_ORIGIN = 'https://yify.expo.app';
const REQUEST_TIMEOUT_MS = 30_000;
const LIST_TTL_MS = 60_000;
const DETAILS_TTL_MS = 10 * 60_000;
const BLOCKED_FIELDS = new Set(['torrents', 'torrent', 'hash', 'infoHash', 'info_hash', 'url',
    'magnetUrl', 'magnet_url', 'torrentUrl', 'torrent_url', 'downloadCount', 'download_count',
    'seeds', 'peers', 'sizeBytes', 'size_bytes']);

export function webCatalogBaseUrl(
    location: CatalogLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
    desktop = typeof window !== 'undefined' && 'yifyDesktop' in window,
): string {
    const hosted = location?.protocol === 'https:' && location.hostname.endsWith('.expo.app');
    const local = !desktop && location != null &&
        ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
        ['http:', 'https:'].includes(location.protocol);
    return `${hosted || local ? location!.origin : CANONICAL_ORIGIN}/api/catalog`;
}

function invalid(): never {
    throw new Error('The catalog returned an invalid metadata response.');
}

function object(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return invalid();
    return value as Record<string, unknown>;
}

function text(value: unknown): string {
    if (typeof value !== 'string') return invalid();
    return value;
}

function optionalText(value: unknown): string | undefined {
    return value == null ? undefined : text(value);
}

function numeric(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return invalid();
    return value;
}

function integer(value: unknown, minimum = 0): number {
    const result = numeric(value);
    if (!Number.isSafeInteger(result) || result < minimum) return invalid();
    return result;
}

function boolean(value: unknown): boolean {
    if (typeof value !== 'boolean') return invalid();
    return value;
}

function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
    if (!Array.isArray(value)) return invalid();
    return value.map(parse);
}

function imageUrl(value: unknown): string {
    const result = text(value);
    try {
        const url = new URL(result);
        if (url.protocol !== 'https:' || url.username || url.password) return invalid();
    } catch {
        return invalid();
    }
    return result;
}

function optionalImage(value: unknown): string | undefined {
    return value == null ? undefined : imageUrl(value);
}

function date(value: unknown): Date {
    const result = new Date(text(value));
    if (!Number.isFinite(result.getTime())) return invalid();
    return result;
}

function metadataOnly(value: unknown): void {
    if (typeof value === 'string') {
        if (/magnet\s*:|urn:btih:|\.torrent(?:$|[?\s#])/i.test(value)) invalid();
    } else if (Array.isArray(value)) {
        value.forEach(metadataOnly);
    } else if (value != null && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            if (BLOCKED_FIELDS.has(key)) invalid();
            metadataOnly(item);
        }
    }
}

function movie(value: unknown): Movie {
    const item = object(value);
    return {
        id: integer(item.id, 1),
        imdbCode: text(item.imdbCode),
        title: text(item.title),
        titleLong: text(item.titleLong),
        year: integer(item.year),
        rating: numeric(item.rating),
        runtimeMinutes: numeric(item.runtimeMinutes),
        genres: array(item.genres, text),
        summary: text(item.summary),
        language: text(item.language),
        mpaRating: text(item.mpaRating),
        posterUrls: array(item.posterUrls, imageUrl),
        backgroundImageUrl: optionalImage(item.backgroundImageUrl),
        ytTrailerCode: optionalText(item.ytTrailerCode),
        thumbnailUrls: item.thumbnailUrls == null ? undefined : array(item.thumbnailUrls, imageUrl),
    };
}

function castMember(value: unknown): CastMember {
    const item = object(value);
    return {
        name: text(item.name),
        character: text(item.character),
        imdbCode: optionalText(item.imdbCode),
        imageUrl: optionalImage(item.imageUrl),
    };
}

function movieDetails(value: unknown): MovieDetails {
    const item = object(value);
    return {
        ...movie(item),
        descriptionIntro: optionalText(item.descriptionIntro),
        descriptionFull: text(item.descriptionFull),
        synopsis: text(item.synopsis),
        ytTrailerCode: text(item.ytTrailerCode),
        likeCount: item.likeCount == null ? undefined : numeric(item.likeCount),
        screenshotUrls: array(item.screenshotUrls, imageUrl),
        screenshotThumbUrls: array(item.screenshotThumbUrls, imageUrl),
        cast: array(item.cast, castMember),
        torrents: [],
    };
}

function episode(value: unknown): ShowEpisode {
    const item = object(value);
    return {
        id: integer(item.id, 1),
        title: text(item.title),
        season: integer(item.season),
        episode: integer(item.episode),
        releasedAt: date(item.releasedAt),
        thumbnailUrl: optionalImage(item.thumbnailUrl),
        magnetUrl: '',
        seeds: 0,
        peers: 0,
        sizeBytes: 0,
    };
}

function show(value: unknown): Show {
    const item = object(value);
    return {
        imdbId: text(item.imdbId),
        imdbCode: text(item.imdbCode),
        title: text(item.title),
        episodeCount: integer(item.episodeCount),
        latestEpisode: episode(item.latestEpisode),
        thumbnailUrl: optionalImage(item.thumbnailUrl),
        updatedAt: date(item.updatedAt),
    };
}

export class WebCatalogClient {
    private readonly responses = new ResponseCache();

    constructor(
        private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
        private readonly subscriberAccess?: SubscriberCatalogAccess,
    ) {}

    listMovies(params: ListMoviesParams): Promise<ListMoviesResult> {
        return this.request('movies', {
            page: params.page, limit: params.limit, query: params.query, quality: params.quality,
            minimum_rating: params.minimum_rating, genre: params.genre,
            sort_by: params.sort_by, order_by: params.order_by,
        }, value => {
            const result = object(value);
            return {movies: array(result.movies, movie), pageNumber: integer(result.pageNumber, 1),
                movieCount: integer(result.movieCount), hasMore: boolean(result.hasMore)};
        });
    }

    getMovieDetails(id: number): Promise<MovieDetails> {
        return this.request('movie', {id}, movieDetails);
    }

    getMovieSuggestions(id: number): Promise<Movie[]> {
        return this.request('suggestions', {id}, value => array(value, movie));
    }

    getMovieParentalGuides(id: number): Promise<ParentalGuide[]> {
        return this.request('parental-guides', {id}, value => array(value, item => {
            const guide = object(item);
            return {type: text(guide.type), text: text(guide.text)};
        }));
    }

    listShows(params: ListShowsParams): Promise<ListShowsResult> {
        return this.request('shows', {page: params.page, limit: params.limit, imdbId: params.imdbId}, value => {
            const result = object(value);
            return {shows: array(result.shows, show), pageNumber: integer(result.pageNumber, 1),
                hasMore: boolean(result.hasMore)};
        });
    }

    listEpisodes(imdbId: string): Promise<ShowEpisode[]> {
        return this.request('episodes', {imdbId}, value => array(value, episode));
    }

    private request<T>(endpoint: CatalogEndpoint, query: Query, parse: (value: unknown) => T): Promise<T> {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== '') params.set(key, String(value));
        }
        const url = `${webCatalogBaseUrl()}/${endpoint}?${params}`;
        if (this.subscriberAccess) {
            const subscriberUrl = url.replace('/api/catalog/', '/api/subscriber-catalog/');
            return this.subscriberAccess.load(subscriberUrl, value => {
                metadataOnly(value);
                return parse(value);
            }).then(result => result === null ? this.publicRequest(url, endpoint, parse) : result.value);
        }
        return this.publicRequest(url, endpoint, parse);
    }

    private publicRequest<T>(url: string, endpoint: CatalogEndpoint, parse: (value: unknown) => T): Promise<T> {
        const ttl = ['movies', 'shows', 'episodes'].includes(endpoint) ? LIST_TTL_MS : DETAILS_TTL_MS;
        return this.responses.getOrLoad(url, ttl, async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const span = this.diagnostics.start(`api.catalog.${endpoint.replace('-', '_')}`, {provider: 'catalog'});
            let status: number | undefined;
            try {
                const response = await fetch(url, {signal: controller.signal, redirect: 'error',
                    credentials: 'omit', headers: {Accept: 'application/json'}});
                status = response.status;
                if (!response.ok) throw new Error(`Catalog request failed (${status}).`);
                const value: unknown = await response.json();
                metadataOnly(value);
                const result = parse(value);
                span.finish('ok', {status_code: status});
                return result;
            } catch {
                const error = new Error(controller.signal.aborted
                    ? 'The catalog request timed out. Please try again.'
                    : 'The catalog is unavailable. Please try again.');
                span.fail(error, {status_code: status});
                throw error;
            } finally {
                clearTimeout(timeout);
            }
        }, cache => this.diagnostics.event('api.catalog.cache', {provider: 'catalog', cache}));
    }
}
