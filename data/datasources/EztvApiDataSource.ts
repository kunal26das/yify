import type {EztvTorrentsResponse} from '../models';
import {ResponseCache} from './storage/ResponseCache';
import type {Diagnostics} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';

export const EZTV_BASE_URL = 'https://eztvx.to/api';

export const EZTV_MAX_LIMIT = 50;

const REQUEST_TIMEOUT_MS = 12000;
const RESPONSE_TTL_MS = 60_000;

export interface ListTorrentsApiParams {
    page: number;
    limit?: number;
    imdb_id?: string;
}

export interface EztvApi {
    getTorrents(params: ListTorrentsApiParams): Promise<EztvTorrentsResponse>;
}

export class EztvUnavailableError extends Error {
    constructor(cause?: unknown) {
        super(cause instanceof Error ? cause.message : 'EZTV is unreachable');
        this.name = 'EztvUnavailableError';
    }
}

export class EztvApiDataSource implements EztvApi {
    private readonly responses = new ResponseCache();

    constructor(private readonly resolveBaseUrl: () => string = () => EZTV_BASE_URL,
                private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
                private readonly fetcher?: typeof fetch) {
    }

    async getTorrents(params: ListTorrentsApiParams): Promise<EztvTorrentsResponse> {
        const searchParams = new URLSearchParams({
            page: String(Math.max(1, params.page)),
            limit: String(Math.min(EZTV_MAX_LIMIT, Math.max(1, params.limit ?? EZTV_MAX_LIMIT))),
        });
        if (params.imdb_id?.trim()) {
            searchParams.set('imdb_id', params.imdb_id.trim());
        }

        const baseUrl = this.resolveBaseUrl().replace(/\/+$/, '');
        const url = `${baseUrl}/get-torrents?${searchParams.toString()}`;
        return this.responses.getOrLoad(url, RESPONSE_TTL_MS, () => this.fetchTorrents(url),
            cache => this.diagnostics.event('api.eztv.cache', {provider: 'eztv', cache}));
    }

    private async fetchTorrents(url: string): Promise<EztvTorrentsResponse> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const span = this.diagnostics.start('api.eztv.torrents', {provider: 'eztv', method: 'GET', cache: 'miss'});
        let status: number | undefined;
        try {
            const response = await (this.fetcher ?? fetch)(url, {signal: controller.signal});
            status = response.status;
            if (!response.ok) {
                throw new EztvUnavailableError(new Error(`EZTV error: ${response.status}`));
            }
            const body = (await response.json()) as EztvTorrentsResponse;
            span.finish('ok', {status_code: status});
            return body;
        } catch (error) {
            span.fail(error, {status_code: status});
            if (error instanceof EztvUnavailableError) throw error;
            throw new EztvUnavailableError(error);
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
