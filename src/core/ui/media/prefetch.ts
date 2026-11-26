const MAX_BATCH_URLS = 12;
const REMEMBERED_URLS = 200;

export function posterPrefetchUrls<T>(
  items: readonly T[],
  lastVisibleIndex: number,
  columns: number,
  urlFor: (item: T) => string | null | undefined,
): string[] {
  const start = Math.max(0, lastVisibleIndex + 1);
  const count = Math.min(MAX_BATCH_URLS, Math.max(4, columns * 2));
  const urls: string[] = [];
  for (let index = start; index < Math.min(items.length, start + count); index += 1) {
    const url = urlFor(items[index]);
    if (url) urls.push(url);
  }
  return urls;
}

export interface PosterPrefetcher {
  request(urls: string[]): void;
  dispose(): void;
}

export function createPosterPrefetcher(prefetch: (urls: string[]) => Promise<boolean>): PosterPrefetcher {
  const requested = new Set<string>();
  let pending: string[] | null = null;
  let running = false;
  let disposed = false;

  const pump = (): void => {
    if (running || disposed || !pending) return;
    const urls = [...new Set(pending)].filter((url) => !requested.has(url)).slice(0, MAX_BATCH_URLS);
    pending = null;
    if (urls.length === 0) return;
    running = true;
    for (const url of urls) requested.add(url);
    while (requested.size > REMEMBERED_URLS) {
      const oldest = requested.values().next().value;
      if (oldest === undefined) break;
      requested.delete(oldest);
    }
    void Promise.resolve()
      .then(() => (disposed ? false : prefetch(urls)))
      .catch(() => false)
      .then((ok) => {
        if (!ok) for (const url of urls) requested.delete(url);
        running = false;
        pump();
      });
  };

  return {
    request(urls) {
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
