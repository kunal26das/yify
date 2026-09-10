import type {LibraryCollection, LibraryMark, LibraryState} from '../entities/LibraryState';

export const LIBRARY_MAX_COLLECTIONS = 50;
export const LIBRARY_MAX_COLLECTION_RECORDS = 200;
export const LIBRARY_MAX_MARKS = 2000;
export const LIBRARY_NAME_LIMIT = 60;
export const LIBRARY_MAX_PAYLOAD_CHARS = 300000;

export function emptyLibraryState(): LibraryState {
    return {watched: {}, collections: {}, memberships: {}, clearedAt: 0};
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function record(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
}

function timestamp(value: unknown): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function movieKey(key: string): boolean {
    return /^[1-9]\d{0,15}$/.test(key) && Number.isSafeInteger(Number(key));
}

function collectionKey(key: string): boolean {
    return /^[a-zA-Z0-9_-]{1,80}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key);
}

export function normalizeCollectionName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

function parseMarks(value: unknown, clearedAt: number): Record<string, LibraryMark> {
    return Object.fromEntries(Object.entries(record(value)).flatMap(([id, raw]) => {
        const mark = record(raw);
        const at = timestamp(mark.at);
        return movieKey(id) && at > clearedAt && typeof mark.value === 'boolean'
            ? [[id, {at, value: mark.value}] as const] : [];
    }).sort(([a, x], [b, y]) => y.at - x.at || compare(a, b)).slice(0, LIBRARY_MAX_MARKS));
}

export function normalizeLibraryState(value: unknown): LibraryState {
    const raw = record(value);
    const clearedAt = timestamp(raw.clearedAt);
    const collections = Object.fromEntries(Object.entries(record(raw.collections)).flatMap(([id, value]) => {
        const item = record(value);
        const updatedAt = timestamp(item.updatedAt);
        const removedAt = timestamp(item.removedAt);
        const name = typeof item.name === 'string' ? normalizeCollectionName(item.name) : '';
        return collectionKey(id) && name.length > 0 && name.length <= LIBRARY_NAME_LIMIT && !/[\u0000-\u001f\u007f]/.test(name) &&
            Math.max(updatedAt, removedAt) > clearedAt
            ? [[id, {name, updatedAt, removedAt}] as const] : [];
    }).sort(([a, x], [b, y]) => Math.max(y.updatedAt, y.removedAt) - Math.max(x.updatedAt, x.removedAt) || compare(a, b))
        .slice(0, LIBRARY_MAX_COLLECTION_RECORDS));
    const memberships: LibraryState['memberships'] = {};
    const entries = Object.entries(record(raw.memberships)).flatMap(([collectionId, marks]) => {
        if (!Object.hasOwn(collections, collectionId) || collections[collectionId].removedAt > 0) return [];
        return Object.entries(parseMarks(marks, clearedAt)).map(([movieId, mark]) => ({collectionId, movieId, mark}));
    }).sort((a, b) => b.mark.at - a.mark.at || compare(a.collectionId, b.collectionId) || compare(a.movieId, b.movieId));
    for (const {collectionId, movieId, mark} of entries.slice(0, LIBRARY_MAX_MARKS)) {
        if (!Object.hasOwn(memberships, collectionId)) memberships[collectionId] = {};
        memberships[collectionId][movieId] = mark;
    }
    return {watched: parseMarks(raw.watched, clearedAt), collections, memberships, clearedAt};
}

export function parseLibraryState(raw: string | undefined): LibraryState {
    if (!raw || raw.length > LIBRARY_MAX_PAYLOAD_CHARS) return emptyLibraryState();
    try {
        return normalizeLibraryState(JSON.parse(raw));
    } catch {
        return emptyLibraryState();
    }
}

function mergeMarks(a: Record<string, LibraryMark>, b: Record<string, LibraryMark>): Record<string, LibraryMark> {
    const next = {...a};
    for (const [id, mark] of Object.entries(b)) {
        const previous = next[id];
        if (!previous || mark.at > previous.at || (mark.at === previous.at && !mark.value)) next[id] = mark;
    }
    return next;
}

export function mergeLibraryState(a: LibraryState, b: LibraryState): LibraryState {
    const collections: Record<string, LibraryCollection> = {...a.collections};
    for (const [id, item] of Object.entries(b.collections)) {
        const previous = Object.hasOwn(collections, id) ? collections[id] : undefined;
        if (!previous) {
            collections[id] = item;
            continue;
        }
        const name = item.updatedAt > previous.updatedAt ||
            (item.updatedAt === previous.updatedAt && item.name > previous.name) ? item.name : previous.name;
        collections[id] = {name, updatedAt: Math.max(item.updatedAt, previous.updatedAt), removedAt: Math.max(item.removedAt, previous.removedAt)};
    }
    const memberships = {...a.memberships};
    for (const [id, marks] of Object.entries(b.memberships)) {
        memberships[id] = mergeMarks(Object.hasOwn(memberships, id) ? memberships[id] : {}, marks);
    }
    return normalizeLibraryState({
        watched: mergeMarks(a.watched, b.watched), collections, memberships,
        clearedAt: Math.max(a.clearedAt, b.clearedAt),
    });
}

export function encodeLibraryState(state: LibraryState): string {
    const next = normalizeLibraryState(state);
    const sorted = <T>(items: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(items).sort(([a], [b]) => compare(a, b)));
    return JSON.stringify({version: 1, watched: sorted(next.watched), collections: sorted(next.collections),
        memberships: sorted(Object.fromEntries(Object.entries(next.memberships).map(([id, marks]) => [id, sorted(marks)]))), clearedAt: next.clearedAt});
}

export function sameLibraryState(a: LibraryState, b: LibraryState): boolean {
    return encodeLibraryState(a) === encodeLibraryState(b);
}

export function liveLibraryCollections(state: LibraryState): {id: string; name: string}[] {
    return Object.entries(state.collections)
        .filter(([, item]) => item.removedAt === 0 && item.updatedAt > state.clearedAt)
        .map(([id, item]) => ({id, name: item.name}))
        .sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));
}

export function libraryMovieWatched(state: LibraryState, movieId: number): boolean {
    const mark = state.watched[String(movieId)];
    return mark?.value === true && mark.at > state.clearedAt;
}

export function libraryCollectionContains(state: LibraryState, collectionId: string, movieId: number): boolean {
    const collection = Object.hasOwn(state.collections, collectionId) ? state.collections[collectionId] : undefined;
    const mark = Object.hasOwn(state.memberships, collectionId) ? state.memberships[collectionId][String(movieId)] : undefined;
    return collection != null && collection.removedAt === 0 && collection.updatedAt > state.clearedAt &&
        mark?.value === true && mark.at > state.clearedAt;
}

export function libraryLatestTimestamp(state: LibraryState): number {
    let latest = state.clearedAt;
    for (const mark of Object.values(state.watched)) latest = Math.max(latest, mark.at);
    for (const item of Object.values(state.collections)) latest = Math.max(latest, item.updatedAt, item.removedAt);
    for (const marks of Object.values(state.memberships)) {
        for (const mark of Object.values(marks)) latest = Math.max(latest, mark.at);
    }
    return latest;
}
