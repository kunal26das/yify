export function assertCatalogActive(signal?: AbortSignal): void {
    if (signal?.aborted) {
        const error = new Error('Catalog request cancelled');
        error.name = 'AbortError';
        throw error;
    }
}

export function createCatalogFetch(signal?: AbortSignal, fetcher: typeof fetch = (input, init) => fetch(input, init)): typeof fetch {
    return (input, init) => {
        assertCatalogActive(signal);
        const signals = [signal, init?.signal, input instanceof Request ? input.signal : undefined]
            .filter((value): value is AbortSignal => value != null);
        return fetcher(input, {...init, signal: signals.length ? AbortSignal.any(signals) : undefined});
    };
}

export async function withCatalogSignal<T>(signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    assertCatalogActive(signal);
    const result = await work();
    assertCatalogActive(signal);
    return result;
}
