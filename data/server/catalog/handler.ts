import type {MovieRepository, ShowRepository} from '@/domain';
import {InvalidCatalogRequest, parseCatalogRequest} from './parameters';
import type {CatalogRequest} from './parameters';
import {assertCatalogActive} from './cancellation';
import {createCatalogAdmission} from './admission';
import type {CatalogAdmission} from './admission';
import {SubscriberAccessError} from '../subscribers/errors';
import {
    projectEpisodes, projectMovieDetails, projectMovieList, projectParentalGuides, projectShowList, projectSuggestions,
} from './projections';

export interface CatalogRepositories {
    movies: MovieRepository;
    shows: ShowRepository;
}

interface CatalogHandlerOptions {
    timeoutMs?: number;
    admission?: CatalogAdmission;
    subscriber?: {authorize: (request: Request, signal: AbortSignal) => Promise<{uid: string}>};
}

class CatalogTimeout extends Error {}

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
    repositories: CatalogRepositories | ((signal: AbortSignal, onResponse?: (body: unknown) => void) => CatalogRepositories),
    options: CatalogHandlerOptions = {},
): (request: Request, operation: string) => Promise<Response> {
    const timeoutMs = options.timeoutMs ?? 25_000;
    const admission = options.admission ?? createCatalogAdmission();
    const privateResponse = Boolean(options.subscriber);
    return async (request, operation) => {
        const headers = new Headers({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': privateResponse ? 'private, no-store' : 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Allow-Origin': '*',
        });
        if (privateResponse) {
            headers.set('CDN-Cache-Control', 'no-store');
            headers.set('Vary', 'Authorization');
        }
        const respond = (body: unknown, status: number) => new Response(JSON.stringify(body), {status, headers});
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
            const allowedHeaders = privateResponse ? ['accept', 'content-type', 'authorization'] : ['accept', 'content-type'];
            if (requestedHeaders?.split(',').some(header => !allowedHeaders.includes(header.trim().toLowerCase()))) {
                return respond({error: 'Headers are not allowed'}, 400);
            }
            headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            headers.set('Access-Control-Allow-Headers', privateResponse ? 'Accept, Content-Type, Authorization' : 'Accept, Content-Type');
            headers.set('Access-Control-Max-Age', '600');
            return new Response(null, {status: 204, headers});
        }

        const permit = admission.acquire(request, parsed);
        if (!permit.allowed) {
            headers.set('Retry-After', String(permit.retryAfter));
            return respond({error: 'Too many catalog requests. Please try again shortly.'}, 429);
        }
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let rejectCancellation: (error: Error) => void = () => {};
        const cancelled = new Promise<never>((_, reject) => { rejectCancellation = reject; });
        const cancel = () => {
            controller.abort();
            rejectCancellation(new CatalogTimeout());
        };
        try { request.signal.addEventListener('abort', cancel, {once: true}); } catch {}
        if (request.signal.aborted) cancel();
        else timer = setTimeout(cancel, timeoutMs);
        const work = Promise.resolve().then(async () => {
            assertCatalogActive(controller.signal);
            if (options.subscriber) await options.subscriber.authorize(request, controller.signal);
            assertCatalogActive(controller.signal);
            const responses: unknown[] = [];
            const onResponse = privateResponse ? (body: unknown) => { responses.push(body); } : undefined;
            const source = typeof repositories === 'function' ? repositories(controller.signal, onResponse) : repositories;
            const metadata = await execute(parsed, source);
            assertCatalogActive(controller.signal);
            return privateResponse ? {metadata, raw: {responses}} : metadata;
        });
        void work.then(permit.release, permit.release);
        try {
            const result = await Promise.race([work, cancelled]);
            if (!privateResponse && (parsed.operation !== 'movies' || !parsed.params.query)) {
                headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
            }
            return respond(result, 200);
        } catch (error) {
            const timeout = controller.signal.aborted || error instanceof CatalogTimeout || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));
            if (privateResponse && error instanceof SubscriberAccessError && !timeout) {
                return respond({error: error.status === 401 ? 'Sign in to access subscriber catalog data'
                    : error.status === 403 ? 'An active subscription is required' : 'Subscriber verification is temporarily unavailable'}, error.status);
            }
            return respond({error: timeout ? 'Catalog request timed out' : 'Catalog is temporarily unavailable'}, timeout ? 504 : 502);
        } finally {
            if (timer !== undefined) clearTimeout(timer);
            try { request.signal.removeEventListener('abort', cancel); } catch {}
        }
    };
}
