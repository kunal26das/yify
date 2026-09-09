interface Entry {
    expiresAt: number;
    promise: Promise<unknown>;
}

/** Shares pending requests and briefly retains successful responses in bounded memory. */
export class ResponseCache {
    private readonly entries = new Map<string, Entry>();

    constructor(private readonly maxEntries = 120) {
    }

    getOrLoad<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
        const cached = this.entries.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            this.entries.delete(key);
            this.entries.set(key, cached);
            return cached.promise as Promise<T>;
        }

        const entry: Entry = {expiresAt: Infinity, promise: Promise.resolve()};
        entry.promise = Promise.resolve().then(load).then((value) => {
            entry.expiresAt = Date.now() + ttlMs;
            return value;
        }, (error) => {
            // An evicted request may finish after a newer request for the same key.
            if (this.entries.get(key) === entry) this.entries.delete(key);
            throw error;
        });
        this.entries.delete(key);
        this.entries.set(key, entry);
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined) this.entries.delete(oldest);
        }
        return entry.promise as Promise<T>;
    }
}
