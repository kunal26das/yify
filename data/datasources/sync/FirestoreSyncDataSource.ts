const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'yify-2da67';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export const WATCHLIST_FIELD = 'watchlist';
export const WATCHLIST_UPDATED_AT_FIELD = 'watchlistUpdatedAt';
export const PREFERENCES_FIELD = 'preferences';
export const PREFERENCES_UPDATED_AT_FIELD = 'preferencesUpdatedAt';

export const MAX_WATCHLIST_CHARS = 500000;
export const MAX_PREFERENCES_CHARS = 4000;

export interface SyncDocument {
    watchlist?: string;
    watchlistUpdatedAt?: number;
    preferences?: string;
    preferencesUpdatedAt?: number;
}

type FirestoreValue = {stringValue: string} | {integerValue: string};

const STRING_FIELDS = [WATCHLIST_FIELD, PREFERENCES_FIELD] as const;
const INTEGER_FIELDS = [WATCHLIST_UPDATED_AT_FIELD, PREFERENCES_UPDATED_AT_FIELD] as const;

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

export async function fetchSyncDocument(uid: string, token: string): Promise<SyncDocument | null> {
    const response = await fetch(documentUrl(uid), {
        headers: {Authorization: `Bearer ${token}`},
    });
    if (response.status === 404) return {};
    if (!response.ok) return null;
    const body = (await response.json()) as {fields?: Record<string, FirestoreValue>};
    return fromFields(body.fields);
}

export async function writeSyncDocument(
    uid: string,
    token: string,
    patch: SyncDocument,
): Promise<boolean> {
    const fields = toFields(patch);
    const paths = Object.keys(fields);
    if (paths.length === 0) return true;
    const mask = paths.map((path) => `updateMask.fieldPaths=${path}`).join('&');
    const response = await fetch(`${documentUrl(uid)}?${mask}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({fields}),
    });
    return response.ok;
}
