import type {MovieRepository, ShowRepository} from '@/domain';
import {InvalidCatalogRequest, parseCatalogRequest} from './parameters';
import type {CatalogRequest} from './parameters';
import {
    projectEpisodes, projectMovieDetails, projectMovieList, projectParentalGuides, projectShowList, projectSuggestions,
} from './projections';

export interface CatalogRepositories {
    movies: MovieRepository;
    shows: ShowRepository;
}

interface CatalogHandlerOptions {
    timeoutMs?: number;
}

class CatalogTimeout extends Error {}

function allowedOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        if (url.origin !== origin || url.username || url.password) return false;
        if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.protocol === 'http:' || url.protocol === 'https:';
        return url.protocol === 'https:' && !url.port && (
            url.hostname === 'yify.expo.app'
            || url.hostname === 'kunal26das.github.io'
            || /^yify--[a-z\d-]+\.expo\.app$/.test(url.hostname)
        );
    } catch {
        return false;
    }
}

async function execute(request: CatalogRequest, repositories: CatalogRepositories): Promise<unknown> {
    switch (request.operation) {
        case 'movies': return projectMovieList(await repositories.movies.listMovies(request.params));
        case 'movie': return projectMovieDetails(await repositories.movies.getMovieDetails(request.id));
        case 'suggestions': return projectSuggestions(await repositories.movies.getMovieSuggestions(request.id));
        case 'parental-guides': return projectParentalGuides(await repositories.movies.getMovieParentalGuides(request.id));
        case 'shows': return projectShowList(await repositories.shows.listShows(request.params));
        case 'episodes': return projectEpisodes(await repositories.shows.listEpisodes(request.imdbId));
    }
}

export function createCatalogHandler(
    repositories: CatalogRepositories | (() => CatalogRepositories),
    options: CatalogHandlerOptions = {},
): (request: Request, operation: string) => Promise<Response> {
    const timeoutMs = options.timeoutMs ?? 25_000;
    return async (request, operation) => {
        const headers = new Headers({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Vary': 'Origin',
        });
        const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), {status, headers});
        const origin = request.headers.get('Origin');
        if (origin !== null) {
            if (!allowedOrigin(origin)) return respond({error: 'Origin is not allowed'}, 403);
            headers.set('Access-Control-Allow-Origin', origin);
        }
        headers.set('Allow', 'GET, OPTIONS');
        if (request.method !== 'GET' && request.method !== 'OPTIONS') return respond({error: 'Method is not allowed'}, 405);

        let parsed: CatalogRequest;
        try {
            const url = new URL(request.url);
            if (url.search.length > 2048) throw new InvalidCatalogRequest();
            parsed = parseCatalogRequest(operation, url.searchParams);
        } catch {
            return respond({error: 'Invalid catalog request'}, 400);
        }

        if (request.method === 'OPTIONS') {
            const method = request.headers.get('Access-Control-Request-Method');
            const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
            if (method && method !== 'GET') return respond({error: 'Method is not allowed'}, 405);
            if (requestedHeaders?.split(',').some(header => !['accept', 'content-type'].includes(header.trim().toLowerCase()))) {
                return respond({error: 'Headers are not allowed'}, 400);
            }
            headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
            headers.set('Access-Control-Max-Age', '600');
            return new Response(null, {status: 204, headers});
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const deadline = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new CatalogTimeout()), timeoutMs);
            });
            const result = await Promise.race([
                execute(parsed, typeof repositories === 'function' ? repositories() : repositories),
                deadline,
            ]);
            if (parsed.operation !== 'movies' || !parsed.params.query) {
                headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
            }
            return respond(result, 200);
        } catch (error) {
            const timeout = error instanceof CatalogTimeout || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));
            headers.set('Cache-Control', 'no-store');
            return respond({error: timeout ? 'Catalog request timed out' : 'Catalog is temporarily unavailable'}, timeout ? 504 : 502);
        } finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    };
}
