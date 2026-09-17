export class StreamingUnavailable extends Error {
    readonly status: number;
    readonly retryAfter: number;

    constructor(status = 503, retryAfter = 60) {
        super('Streaming availability is temporarily unavailable');
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

export async function fetchStreamingJson(fetcher: typeof fetch, path: string, key: string, timeoutMs: number, maximumBytes: number): Promise<unknown | null> {
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            void reader?.cancel().catch(() => {});
            reject(new StreamingUnavailable(504));
        }, timeoutMs);
    });
    const work = async () => {
        const response = await fetcher(`https://api.movieofthenight.com/v4/${path}`, {
            headers: {'X-API-Key': key, Accept: 'application/json'}, signal: controller.signal,
            redirect: 'manual', cache: 'no-store', credentials: 'omit',
        });
        if (controller.signal.aborted) {
            void response.body?.cancel().catch(() => {});
            throw new StreamingUnavailable(504);
        }
        if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            if (response.status === 404) return null;
            const retry = Number(response.headers.get('Retry-After'));
            throw new StreamingUnavailable(response.status === 429 ? 429 : 502,
                response.status === 401 || response.status === 403 ? 3600 : response.status === 429 ? Math.max(60, Math.min(86400, retry || 3600)) : 60);
        }
        if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) throw new StreamingUnavailable(502);
        const declared = Number(response.headers.get('Content-Length'));
        if (declared > maximumBytes) {
            void response.body.cancel().catch(() => {});
            throw new StreamingUnavailable(502);
        }
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        let source = '';
        try {
            while (true) {
                const chunk = await reader.read();
                if (controller.signal.aborted) throw new StreamingUnavailable(504);
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > maximumBytes) {
                    void reader.cancel().catch(() => {});
                    throw new StreamingUnavailable(502);
                }
                source += decoder.decode(chunk.value, {stream: true});
            }
            return JSON.parse(source + decoder.decode());
        } finally {
            reader.releaseLock();
        }
    };
    try {
        return await Promise.race([work(), timeout]);
    } catch (error) {
        controller.abort();
        if (error instanceof StreamingUnavailable) throw error;
        throw new StreamingUnavailable(502);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}
