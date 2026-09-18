import {emptyJournalData, encodeJournalData, parseJournalData} from '@/domain/policies/journal';
import type {JournalData} from '@/domain/entities/Journal';

export interface JournalRead {data: JournalData; updateTime?: string; deleting?: boolean}
export class JournalConflict extends Error {}

export class JournalDataSource {
    private readonly base: string;
    private readonly root: string;
    constructor(private readonly request: typeof fetch = fetch) {
        const project = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'yify-2da67';
        this.root = `projects/${project}/databases/(default)/documents`;
        this.base = `https://firestore.googleapis.com/v1/${this.root}`;
    }

    async read(uid: string, token: string, metadataOnly = false): Promise<JournalRead> {
        const response = await this.call(`${this.base}/journals/${encodeURIComponent(uid)}`, token);
        if (response.status === 404) return {data: parseJournalData(undefined)};
        if (!response.ok) throw new Error('Your journal could not sync. Try again when you are connected.');
        const body = response.body as {fields?: {payload?: {stringValue?: unknown}; deleting?: {booleanValue?: unknown}}; updateTime?: unknown};
        if ((!metadataOnly && typeof body.fields?.payload?.stringValue !== 'string') || typeof body.updateTime !== 'string') {
            throw new Error('Your saved journal could not be read. Retry before making changes.');
        }
        return {data: metadataOnly ? emptyJournalData() : parseJournalData(body.fields?.payload?.stringValue as string), updateTime: body.updateTime,
            deleting: body.fields?.deleting?.booleanValue === true};
    }

    async write(uid: string, token: string, data: JournalData, updateTime: string | undefined, now: number): Promise<void> {
        const response = await this.call(`${this.base}:commit`, token, {method: 'POST', body: JSON.stringify({writes: [{
            update: {name: `${this.root}/journals/${uid}`, fields: {payload: {stringValue: encodeJournalData(data)},
                updatedAt: {integerValue: String(Math.trunc(now))}, deleting: {booleanValue: false}}},
            currentDocument: updateTime ? {updateTime} : {exists: false},
        }]})});
        const body = response.body as {error?: {status?: string}};
        if (response.status === 409 || response.status === 412 || ['ABORTED', 'FAILED_PRECONDITION'].includes(body.error?.status ?? '')) throw new JournalConflict();
        if (!response.ok) throw new Error('Your journal is saved on this device. Sync will retry when you are connected.');
    }

    async remove(uid: string, token: string, now: number, canContinue: () => boolean): Promise<void> {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const current = await this.read(uid, token, true);
            if (!canContinue()) throw new Error('Account changed');
            if (current.deleting) return;
            // Keep an immutable empty marker so another signed-in device cannot recreate removed notes.
            const response = await this.call(`${this.base}:commit`, token, {method: 'POST', body: JSON.stringify({writes: [{
                update: {name: `${this.root}/journals/${uid}`, fields: {payload: {stringValue: encodeJournalData(emptyJournalData())},
                    updatedAt: {integerValue: String(Math.trunc(now))}, deleting: {booleanValue: true}}},
                currentDocument: current.updateTime ? {updateTime: current.updateTime} : {exists: false},
            }]})});
            if (response.ok) return;
            const body = response.body as {error?: {status?: string}};
            if (response.status === 409 || response.status === 412 || ['ABORTED', 'FAILED_PRECONDITION'].includes(body.error?.status ?? '')) continue;
            throw new Error('Your journal could not be deleted. Reconnect and try again.');
        }
        throw new Error('Your journal could not be deleted. Reconnect and try again.');
    }

    private async call(url: string, token: string, init: RequestInit = {}): Promise<{ok: boolean; status: number; body: unknown}> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await this.request(url, {...init, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
                headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json'}});
            const raw = await response.text();
            if (raw.length > 850000) throw new Error('Your saved journal could not be read.');
            let body: unknown = {};
            if (raw) { try { body = JSON.parse(raw); } catch { throw new Error('Your saved journal could not be read.'); } }
            return {ok: response.ok, status: response.status, body};
        } finally { clearTimeout(timer); }
    }
}
