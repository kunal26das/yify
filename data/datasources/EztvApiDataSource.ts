import type {EztvTorrentsResponse} from '../models';

export const EZTV_BASE_URL = 'https://eztvx.to/api';

export const EZTV_MAX_LIMIT = 50;

const REQUEST_TIMEOUT_MS = 12000;

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
    constructor(private readonly resolveBaseUrl: () => string = () => EZTV_BASE_URL) {
    }

    async getTorrents(params: ListTorrentsApiParams): Promise<EztvTorrentsResponse> {
        const searchParams = new URLSearchParams({
            page: String(Math.max(1, params.page)),
            limit: String(Math.min(EZTV_MAX_LIMIT, Math.max(1, params.limit ?? EZTV_MAX_LIMIT))),
        });
        if (params.imdb_id?.trim()) {
            searchParams.set('imdb_id', params.imdb_id.trim());
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(
                `${this.resolveBaseUrl()}/get-torrents?${searchParams.toString()}`,
                {signal: controller.signal}
            );
            if (!response.ok) {
                throw new EztvUnavailableError(new Error(`EZTV error: ${response.status}`));
            }
            return (await response.json()) as EztvTorrentsResponse;
        } catch (error) {
            if (error instanceof EztvUnavailableError) throw error;
            throw new EztvUnavailableError(error);
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
