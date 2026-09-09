const MAX_BATCH_URLS = 12;
const REMEMBERED_URLS = 200;

export function posterPrefetchUrls<T>(
    movies: readonly T[],
    lastVisibleIndex: number,
    columns: number,
    urlForMovie: (movie: T) => string | undefined,
): string[] {
    const start = Math.max(0, lastVisibleIndex + 1);
    const count = Math.min(MAX_BATCH_URLS, Math.max(4, columns * 2));
    const urls: string[] = [];
    for (let index = start; index < Math.min(movies.length, start + count); index++) {
        const url = urlForMovie(movies[index]);
        if (url) urls.push(url);
    }
    return urls;
}

// Keep one bounded request in flight. If the user scrolls or replaces the feed,
// discard queued windows that are no longer next to the visible cards.
export function createPosterPrefetcher(prefetch: (urls: string[]) => Promise<boolean>) {
    const requested = new Set<string>();
    let pending: string[] | null = null;
    let running = false;
    let disposed = false;

    const pump = () => {
        if (running || disposed || !pending) return;
        const urls = [...new Set(pending)].filter((url) => !requested.has(url)).slice(0, MAX_BATCH_URLS);
        pending = null;
        if (!urls.length) return;
        running = true;
        for (const url of urls) requested.add(url);
        while (requested.size > REMEMBERED_URLS) requested.delete(requested.values().next().value!);
        void Promise.resolve().then(() => disposed ? false : prefetch(urls)).catch(() => false).then((ok) => {
            if (!ok) for (const url of urls) requested.delete(url);
            running = false;
            pump();
        });
    };

    return {
        request(urls: string[]) {
            if (disposed) return;
            pending = urls;
            pump();
        },
        dispose() {
            disposed = true;
            pending = null;
            requested.clear();
        },
    };
}
