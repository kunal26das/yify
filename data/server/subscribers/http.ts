import {SubscriberAccessError} from './errors';

export async function fetchSubscriberJson(
    fetcher: typeof fetch,
    url: string,
    init: RequestInit,
    signal: AbortSignal,
    timeoutMs: number,
    maximumBytes: number,
): Promise<{value: unknown; headers: Headers; status: number}> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetcher(url, {
            ...init,
            signal: AbortSignal.any([signal, controller.signal]),
            redirect: 'manual',
            cache: 'no-store',
            credentials: 'omit',
        });
        if (!response.ok) {
            await response.body?.cancel();
            return {value: undefined, headers: response.headers, status: response.status};
        }
        if (!response.body) throw new SubscriberAccessError(503);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let size = 0;
        let source = '';
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > maximumBytes) throw new SubscriberAccessError(503);
                source += decoder.decode(chunk.value, {stream: true});
            }
            source += decoder.decode();
            if (signal.aborted || controller.signal.aborted) throw new SubscriberAccessError(503);
            return {value: JSON.parse(source), headers: response.headers, status: response.status};
        } finally {
            reader.releaseLock();
        }
    } catch {
        controller.abort();
        throw new SubscriberAccessError(503);
    } finally {
        clearTimeout(timer);
    }
}
