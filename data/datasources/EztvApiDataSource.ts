import type {EztvTorrentsResponse} from '../models';
import {ResponseCache} from './storage/ResponseCache';
import type {Diagnostics, NetworkMonitor} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {InvalidResponseError, requestJson} from './JsonRequest';

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

export function parseEztvResponse(body: unknown): EztvTorrentsResponse {
    if (body == null || typeof body !== 'object' || Array.isArray(body)) throw new InvalidResponseError('invalid_response', 'envelope');
    const response = body as Record<string, unknown>;
    if (response.torrents == null) {
        if (response.torrents_count !== 0) throw new InvalidResponseError('invalid_response', 'torrents_count');
    } else if (!Array.isArray(response.torrents) || response.torrents.some(item => {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) return true;
        const torrent = item as Record<string, unknown>;
        return !Number.isSafeInteger(torrent.id) || Number(torrent.id) < 1
            || typeof torrent.title !== 'string'
            || (torrent.imdb_id != null && typeof torrent.imdb_id !== 'string');
    })) throw new InvalidResponseError('invalid_response', 'torrents_collection');
    return body as EztvTorrentsResponse;
}

export class EztvApiDataSource implements EztvApi {
    private readonly responses = new ResponseCache();

    constructor(private readonly resolveBaseUrl: () => string = () => EZTV_BASE_URL,
                private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS,
                private readonly fetcher?: typeof fetch,
                private readonly network?: NetworkMonitor) {
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
        try {
            return await requestJson(url, {
                diagnostics: this.diagnostics, operation: 'api.eztv.torrents', provider: 'eztv',
                timeoutMs: REQUEST_TIMEOUT_MS, fetcher: this.fetcher, network: this.network,
                parse: parseEztvResponse,
            });
        } catch (error) {
            throw new EztvUnavailableError(error);
        }
    }
}
