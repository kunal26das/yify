import type {SyncFailure} from '@/domain';

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'yify-2da67';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export const WATCHLIST_FIELD = 'watchlist';
export const WATCHLIST_UPDATED_AT_FIELD = 'watchlistUpdatedAt';
export const PREFERENCES_FIELD = 'preferences';
export const PREFERENCES_UPDATED_AT_FIELD = 'preferencesUpdatedAt';
export const HISTORY_FIELD = 'history';
export const HISTORY_UPDATED_AT_FIELD = 'historyUpdatedAt';

export const MAX_WATCHLIST_CHARS = 500000;
export const MAX_PREFERENCES_CHARS = 4000;
export const MAX_HISTORY_CHARS = 150000;

export interface SyncDocument {
    watchlist?: string;
    watchlistUpdatedAt?: number;
    preferences?: string;
    preferencesUpdatedAt?: number;
    history?: string;
    historyUpdatedAt?: number;
}

export type SyncFetchResult =
    | {ok: true; document: SyncDocument}
    | {ok: false; failure: SyncFailure; detail: string};

export type SyncWriteResult = {ok: true} | {ok: false; failure: SyncFailure; detail: string};

type FirestoreValue = {stringValue: string} | {integerValue: string};

const STRING_FIELDS = [WATCHLIST_FIELD, PREFERENCES_FIELD, HISTORY_FIELD] as const;
const INTEGER_FIELDS = [
    WATCHLIST_UPDATED_AT_FIELD,
    PREFERENCES_UPDATED_AT_FIELD,
    HISTORY_UPDATED_AT_FIELD,
] as const;

function toFields(document: SyncDocument): Record<string, FirestoreValue> {
    const fields: Record<string, FirestoreValue> = {};
    STRING_FIELDS.forEach((key) => {
        const value = document[key];
        if (typeof value === 'string') fields[key] = {stringValue: value};
    });
    INTEGER_FIELDS.forEach((key) => {
        const value = document[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            fields[key] = {integerValue: String(Math.trunc(value))};
        }
    });
    return fields;
}

function fromFields(fields: Record<string, FirestoreValue> | undefined): SyncDocument {
    const document: SyncDocument = {};
    if (!fields) return document;
    STRING_FIELDS.forEach((key) => {
        const value = fields[key];
        if (value && 'stringValue' in value) document[key] = value.stringValue;
    });
    INTEGER_FIELDS.forEach((key) => {
        const value = fields[key];
        if (!value || !('integerValue' in value)) return;
        const parsed = Number(value.integerValue);
        if (Number.isFinite(parsed)) document[key] = parsed;
    });
    return document;
}

function documentUrl(uid: string): string {
    return `${BASE}/users/${encodeURIComponent(uid)}`;
}

function failureFor(status: number): SyncFailure {
    if (status === 401 || status === 403) return 'denied';
    if (status === 400 || status === 413) return 'oversized';
    return 'server';
}

async function detailFor(response: Response, fallback: string): Promise<string> {
    try {
        const body = (await response.json()) as {error?: {message?: string}};
        return body.error?.message || fallback;
    } catch {
        return fallback;
    }
}

export async function fetchSyncDocument(uid: string, token: string): Promise<SyncFetchResult> {
    let response: Response;
    try {
        response = await fetch(documentUrl(uid), {
            headers: {Authorization: `Bearer ${token}`},
        });
    } catch (error) {
        return {ok: false, failure: 'network', detail: String(error)};
    }
    if (response.status === 404) return {ok: true, document: {}};
    if (!response.ok) {
        return {
            ok: false,
            failure: failureFor(response.status),
            detail: await detailFor(response, `read failed with ${response.status}`),
        };
    }
    try {
        const body = (await response.json()) as {fields?: Record<string, FirestoreValue>};
        return {ok: true, document: fromFields(body.fields)};
    } catch (error) {
        return {ok: false, failure: 'server', detail: String(error)};
    }
}

export async function deleteSyncDocument(uid: string, token: string): Promise<SyncWriteResult> {
    let response: Response;
    try {
        response = await fetch(documentUrl(uid), {
            method: 'DELETE',
            headers: {Authorization: `Bearer ${token}`},
        });
    } catch (error) {
        return {ok: false, failure: 'network', detail: String(error)};
    }
    if (response.ok || response.status === 404) return {ok: true};
    return {
        ok: false,
        failure: failureFor(response.status),
        detail: await detailFor(response, `delete failed with ${response.status}`),
    };
}

export async function writeSyncDocument(
    uid: string,
    token: string,
    patch: SyncDocument
): Promise<SyncWriteResult> {
    const fields = toFields(patch);
    const paths = Object.keys(fields);
    if (paths.length === 0) return {ok: true};
    const mask = paths.map((path) => `updateMask.fieldPaths=${path}`).join('&');
    let response: Response;
    try {
        response = await fetch(`${documentUrl(uid)}?${mask}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({fields}),
        });
    } catch (error) {
        return {ok: false, failure: 'network', detail: String(error)};
    }
    if (response.ok) return {ok: true};
    return {
        ok: false,
        failure: failureFor(response.status),
        detail: await detailFor(response, `write failed with ${response.status}`),
    };
}
