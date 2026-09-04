import type {HistoryEntry} from '../entities/HistoryEntry';

export const HISTORY_PAYLOAD_VERSION = 1;

export const HISTORY_LIMIT = 500;

export const HISTORY_TOMBSTONE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;

export type HistoryTombstones = Record<string, number>;

export interface HistoryState {
    entries: HistoryEntry[];
    removed: HistoryTombstones;
    clearedAt: number;
}

export interface FittedHistoryPayload {
    payload: string;
    trimmed: boolean;
}

export function emptyHistoryState(): HistoryState {
    return {entries: [], removed: {}, clearedAt: 0};
}

function validEntry(value: unknown): HistoryEntry | null {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const {key, title, watchedAt} = record;
    if (typeof key !== 'string' || key.length === 0) return null;
    if (typeof title !== 'string') return null;
    if (typeof watchedAt !== 'number' || !Number.isFinite(watchedAt)) return null;
    const entry: HistoryEntry = {key, title, watchedAt};
    if (typeof record.imageUrl === 'string') entry.imageUrl = record.imageUrl;
    if (typeof record.year === 'number' && Number.isFinite(record.year)) {
        entry.year = record.year;
    }
    if (typeof record.rating === 'number' && Number.isFinite(record.rating)) {
        entry.rating = record.rating;
    }
    if (typeof record.runtimeMinutes === 'number' && Number.isFinite(record.runtimeMinutes)) {
        entry.runtimeMinutes = record.runtimeMinutes;
    }
    return entry;
}

function tombstoneAt(removed: HistoryTombstones, key: string): number | undefined {
    return Object.prototype.hasOwnProperty.call(removed, key) ? removed[key] : undefined;
}

function parseTombstones(raw: unknown): HistoryTombstones {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).filter(
            (pair): pair is [string, number] =>
                typeof pair[1] === 'number' && Number.isFinite(pair[1])
        )
    );
}

function parseClearedAt(raw: unknown): number {
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

export function sortHistory(entries: HistoryEntry[]): HistoryEntry[] {
    return [...entries].sort(
        (a, b) => b.watchedAt - a.watchedAt || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    );
}

function entryRank(entry: HistoryEntry): string {
    return [
        entry.title,
        entry.imageUrl ?? '',
        entry.year ?? '',
        entry.rating ?? '',
        entry.runtimeMinutes ?? '',
    ].join('|');
}

function newestByKey(entries: HistoryEntry[]): Map<string, HistoryEntry> {
    const byKey = new Map<string, HistoryEntry>();
    entries.forEach((entry) => {
        const existing = byKey.get(entry.key);
        if (!existing || entry.watchedAt > existing.watchedAt) {
            byKey.set(entry.key, entry);
            return;
        }
        if (entry.watchedAt === existing.watchedAt && entryRank(entry) < entryRank(existing)) {
            byKey.set(entry.key, entry);
        }
    });
    return byKey;
}

export function parseHistoryState(raw: string | undefined): HistoryState {
    if (!raw) return emptyHistoryState();
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return emptyHistoryState();
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return emptyHistoryState();
    }
    const record = parsed as { entries?: unknown; removed?: unknown; clearedAt?: unknown };
    const entries = Array.isArray(record.entries)
        ? record.entries.map(validEntry).filter((entry): entry is HistoryEntry => entry != null)
        : [];
    return {
        entries: sortHistory([...newestByKey(entries).values()]),
        removed: parseTombstones(record.removed),
        clearedAt: parseClearedAt(record.clearedAt),
    };
}

export function liveHistory(state: HistoryState): HistoryEntry[] {
    return sortHistory(
        state.entries.filter((entry) => {
            if (entry.watchedAt <= state.clearedAt) return false;
            const removedAt = tombstoneAt(state.removed, entry.key);
            return removedAt == null || entry.watchedAt > removedAt;
        })
    ).slice(0, HISTORY_LIMIT);
}

function dropCleared(removed: HistoryTombstones, clearedAt: number): HistoryTombstones {
    return Object.fromEntries(Object.entries(removed).filter(([, at]) => at > clearedAt));
}

export function pruneTombstones(
    removed: HistoryTombstones,
    clearedAt: number,
    now: number,
    horizonMs: number = HISTORY_TOMBSTONE_HORIZON_MS
): HistoryTombstones {
    return Object.fromEntries(
        Object.entries(dropCleared(removed, clearedAt)).filter(([, at]) => now - at <= horizonMs)
    );
}

export function recordHistory(state: HistoryState, entry: HistoryEntry): HistoryState {
    const floor = Math.max(state.clearedAt, tombstoneAt(state.removed, entry.key) ?? 0);
    const stamped = entry.watchedAt > floor ? entry : {...entry, watchedAt: floor + 1};
    const byKey = newestByKey([stamped, ...state.entries]);
    byKey.set(stamped.key, stamped);
    const removed = Object.fromEntries(
        Object.entries(state.removed).filter(([key]) => key !== stamped.key)
    );
    return {
        entries: sortHistory([...byKey.values()]).slice(0, HISTORY_LIMIT),
        removed,
        clearedAt: state.clearedAt,
    };
}

export function removeHistory(state: HistoryState, key: string, now: number): HistoryState {
    const entry = state.entries.find((item) => item.key === key);
    if (!entry) return state;
    const at = Math.max(now, entry.watchedAt);
    return {
        entries: state.entries.filter((item) => item.key !== key),
        removed: {...state.removed, [key]: at},
        clearedAt: state.clearedAt,
    };
}

export function clearHistory(state: HistoryState, now: number): HistoryState {
    const clearedAt = Math.max(now, state.clearedAt);
    const tombstones = new Map(Object.entries(dropCleared(state.removed, clearedAt)));
    state.entries.forEach((entry) => {
        if (entry.watchedAt <= clearedAt) return;
        const mine = tombstones.get(entry.key);
        if (mine == null || entry.watchedAt > mine) tombstones.set(entry.key, entry.watchedAt);
    });
    return {entries: [], removed: Object.fromEntries(tombstones), clearedAt};
}

export function mergeHistoryState(local: HistoryState, remote: HistoryState): HistoryState {
    const clearedAt = Math.max(local.clearedAt, remote.clearedAt);
    const tombstones = new Map(Object.entries(local.removed));
    Object.entries(remote.removed).forEach(([key, at]) => {
        const mine = tombstones.get(key);
        if (mine == null || at > mine) tombstones.set(key, at);
    });
    const removed: HistoryTombstones = Object.fromEntries(tombstones);
    const byKey = newestByKey([...remote.entries, ...local.entries]);
    const merged: HistoryState = {
        entries: [...byKey.values()],
        removed,
        clearedAt,
    };
    return {
        entries: liveHistory(merged),
        removed: dropCleared(removed, clearedAt),
        clearedAt,
    };
}

export function sameHistoryState(a: HistoryState, b: HistoryState): boolean {
    if (a.clearedAt !== b.clearedAt) return false;
    if (a.entries.length !== b.entries.length) return false;
    if (
        a.entries.some(
            (entry, index) =>
                entry.key !== b.entries[index].key ||
                entry.watchedAt !== b.entries[index].watchedAt
        )
    ) {
        return false;
    }
    const keys = Object.keys(a.removed);
    if (keys.length !== Object.keys(b.removed).length) return false;
    return keys.every((key) => a.removed[key] === b.removed[key]);
}

export function encodeHistoryState(state: HistoryState): string {
    return JSON.stringify({
        version: HISTORY_PAYLOAD_VERSION,
        entries: state.entries,
        removed: state.removed,
        clearedAt: state.clearedAt,
    });
}

export function fitHistoryPayload(state: HistoryState, maxChars: number): FittedHistoryPayload {
    let entries = state.entries;
    let payload = encodeHistoryState({...state, entries});
    if (payload.length <= maxChars) return {payload, trimmed: false};
    while (entries.length > 0 && payload.length > maxChars) {
        entries = entries.slice(0, entries.length - 1);
        payload = encodeHistoryState({...state, entries});
    }
    if (payload.length <= maxChars) return {payload, trimmed: true};
    const ordered = Object.entries(state.removed).sort(
        (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
    );
    let used = encodeHistoryState({entries: [], removed: {}, clearedAt: state.clearedAt}).length;
    const kept: [string, number][] = [];
    for (const [key, at] of ordered) {
        const cost = JSON.stringify(key).length + String(at).length + 2;
        if (used + cost > maxChars) break;
        kept.push([key, at]);
        used += cost;
    }
    const collapsed = encodeHistoryState({
        entries: [],
        removed: Object.fromEntries(kept),
        clearedAt: state.clearedAt,
    });
    if (collapsed.length <= maxChars) return {payload: collapsed, trimmed: true};
    return {
        payload: encodeHistoryState({entries: [], removed: {}, clearedAt: state.clearedAt}),
        trimmed: true,
    };
}
