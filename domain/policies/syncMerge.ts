export type SyncMode = 'union' | 'remote-wins' | 'compare';

export type SectionResolution = 'apply-remote' | 'push-local' | 'in-sync';

export const WATCHLIST_PAYLOAD_VERSION = 2;

export const TOMBSTONE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;

export interface WatchlistEntry {
    id: number;
}

export interface WatchlistMark {
    at: number;
    deleted: boolean;
}

export type WatchlistMarks = Record<string, WatchlistMark>;

export interface WatchlistState<T extends WatchlistEntry> {
    items: T[];
    marks: WatchlistMarks;
}

export interface FittedPayload {
    payload: string;
    trimmed: boolean;
}

export function chooseSyncMode(linkedUid: string | undefined, uid: string): SyncMode {
    if (!linkedUid) return 'union';
    return linkedUid === uid ? 'compare' : 'remote-wins';
}

export function resolveSection(
    mode: SyncMode,
    remoteAt: number,
    localAt: number
): SectionResolution {
    if (mode === 'remote-wins') return 'apply-remote';
    if (remoteAt > localAt) return 'apply-remote';
    if (localAt > remoteAt) return 'push-local';
    return 'in-sync';
}

function validItems<T extends WatchlistEntry>(raw: unknown[]): T[] {
    return raw.filter((entry): entry is T => {
        if (entry == null || typeof entry !== 'object') return false;
        return typeof (entry as WatchlistEntry).id === 'number';
    });
}

function parseMarks(raw: unknown): WatchlistMarks {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const marks: WatchlistMarks = {};
    Object.entries(raw as Record<string, unknown>).forEach(([id, value]) => {
        if (value == null || typeof value !== 'object') return;
        const {at, deleted} = value as {at?: unknown; deleted?: unknown};
        if (typeof at !== 'number' || !Number.isFinite(at)) return;
        marks[id] = {at, deleted: deleted === true};
    });
    return marks;
}

export function parseWatchlistState<T extends WatchlistEntry>(
    raw: string | undefined
): WatchlistState<T> {
    if (!raw) return {items: [], marks: {}};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {items: [], marks: {}};
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {items: [], marks: {}};
    }
    const record = parsed as {items?: unknown; marks?: unknown};
    return {
        items: Array.isArray(record.items) ? validItems<T>(record.items) : [],
        marks: parseMarks(record.marks),
    };
}

export function markChanges(
    marks: WatchlistMarks,
    previousIds: number[],
    nextIds: number[],
    now: number
): WatchlistMarks {
    const before = new Set(previousIds);
    const after = new Set(nextIds);
    const next = {...marks};
    after.forEach((id) => {
        if (!before.has(id)) next[String(id)] = {at: now, deleted: false};
    });
    before.forEach((id) => {
        if (!after.has(id)) next[String(id)] = {at: now, deleted: true};
    });
    return next;
}

function markFor(
    marks: WatchlistMarks,
    id: string,
    present: boolean
): WatchlistMark | null {
    const mark = marks[id];
    if (mark) return mark;
    return present ? {at: 0, deleted: false} : null;
}

export function mergeWatchlistState<T extends WatchlistEntry>(
    local: WatchlistState<T>,
    remote: WatchlistState<T>
): WatchlistState<T> {
    const localItems = new Map(local.items.map((item) => [String(item.id), item]));
    const remoteItems = new Map(remote.items.map((item) => [String(item.id), item]));
    const ids = new Set([
        ...Object.keys(local.marks),
        ...Object.keys(remote.marks),
        ...localItems.keys(),
        ...remoteItems.keys(),
    ]);
    const marks: WatchlistMarks = {};
    ids.forEach((id) => {
        const mine = markFor(local.marks, id, localItems.has(id));
        const theirs = markFor(remote.marks, id, remoteItems.has(id));
        if (mine == null && theirs == null) return;
        if (mine == null) {
            marks[id] = theirs as WatchlistMark;
            return;
        }
        if (theirs == null) {
            marks[id] = mine;
            return;
        }
        if (mine.at === theirs.at) {
            marks[id] = mine.deleted ? theirs : mine;
            return;
        }
        marks[id] = mine.at > theirs.at ? mine : theirs;
    });
    const byId = new Map<string, T>();
    remote.items.forEach((item) => byId.set(String(item.id), item));
    local.items.forEach((item) => byId.set(String(item.id), item));
    const items = [...byId.entries()]
        .filter(([id]) => marks[id] != null && !marks[id].deleted)
        .sort(([a], [b]) => marks[b].at - marks[a].at || Number(b) - Number(a))
        .map(([, item]) => item);
    return {items, marks};
}

export function pruneMarks(
    marks: WatchlistMarks,
    now: number,
    horizonMs: number = TOMBSTONE_HORIZON_MS
): WatchlistMarks {
    const next: WatchlistMarks = {};
    Object.entries(marks).forEach(([id, mark]) => {
        if (mark.deleted && now - mark.at > horizonMs) return;
        next[id] = mark;
    });
    return next;
}

export function sameWatchlistState<T extends WatchlistEntry>(
    a: WatchlistState<T>,
    b: WatchlistState<T>
): boolean {
    if (a.items.length !== b.items.length) return false;
    if (a.items.some((item, index) => item.id !== b.items[index].id)) return false;
    const keys = Object.keys(a.marks);
    if (keys.length !== Object.keys(b.marks).length) return false;
    return keys.every((key) => {
        const mine = a.marks[key];
        const theirs = b.marks[key];
        return theirs != null && mine.at === theirs.at && mine.deleted === theirs.deleted;
    });
}

export function encodeWatchlistState<T extends WatchlistEntry>(
    state: WatchlistState<T>
): string {
    return JSON.stringify({
        version: WATCHLIST_PAYLOAD_VERSION,
        items: state.items,
        marks: state.marks,
    });
}

export function fitWatchlistPayload<T extends WatchlistEntry>(
    state: WatchlistState<T>,
    maxChars: number
): FittedPayload {
    let items = state.items;
    let payload = encodeWatchlistState({items, marks: state.marks});
    if (payload.length <= maxChars) return {payload, trimmed: false};
    while (items.length > 0 && payload.length > maxChars) {
        items = items.slice(0, items.length - 1);
        payload = encodeWatchlistState({items, marks: state.marks});
    }
    if (payload.length <= maxChars) return {payload, trimmed: true};
    return {payload: encodeWatchlistState<T>({items: [], marks: {}}), trimmed: true};
}

export function payloadWithinBudget(value: unknown, maxChars: number): string | null {
    const json = JSON.stringify(value);
    return json.length <= maxChars ? json : null;
}
