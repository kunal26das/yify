export type SyncMode = 'union' | 'remote-wins' | 'compare';

export type SectionResolution = 'apply-remote' | 'push-local' | 'in-sync';

export interface WatchlistEntry {
    id: number;
}

export function chooseSyncMode(linkedUid: string | undefined, uid: string): SyncMode {
    if (!linkedUid) return 'union';
    return linkedUid === uid ? 'compare' : 'remote-wins';
}

export function resolveSection(mode: SyncMode, remoteAt: number, localAt: number): SectionResolution {
    if (mode === 'remote-wins') return 'apply-remote';
    if (remoteAt > localAt) return 'apply-remote';
    if (localAt > remoteAt) return 'push-local';
    return 'in-sync';
}

export function parseWatchlist<T extends WatchlistEntry>(raw: string | undefined): T[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as T[];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry) => entry != null && typeof entry.id === 'number');
    } catch {
        return [];
    }
}

export function unionWatchlist<T extends WatchlistEntry>(local: T[], remote: T[]): T[] {
    const seen = new Set(local.map((entry) => entry.id));
    return [...local, ...remote.filter((entry) => !seen.has(entry.id))];
}

export function payloadWithinBudget(value: unknown, maxChars: number): string | null {
    const json = JSON.stringify(value);
    return json.length <= maxChars ? json : null;
}
