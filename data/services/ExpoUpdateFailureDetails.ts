import * as Updates from 'expo-updates';
import type {DiagnosticAttributes} from '@/domain';

const LOG_WINDOW_MS = 60_000;
const LOG_DEADLINE_MS = 250;
const LOG_ENTRY_LIMIT = 50;
const LOG_PHASES: Record<string, string> = {
    UpdateAssetsNotAvailable: 'asset',
    UpdateServerUnreachable: 'update',
    UpdateHasInvalidSignature: 'signature',
    UpdateCodeSigningError: 'signature',
    UpdateFailedToLoad: 'update',
    AssetsFailedToLoad: 'asset',
    JSRuntimeError: 'runtime',
    InitializationError: 'initialization',
    Unknown: 'unknown',
};

function field(value: unknown, key: string): unknown {
    try {
        return value !== null && typeof value === 'object'
            ? (value as Record<string, unknown>)[key] : undefined;
    } catch {
        return undefined;
    }
}

function summarize(entries: unknown, startedAt: number, failedAt: number): DiagnosticAttributes {
    if (!Array.isArray(entries)) return {updates_log_status: 'invalid'};
    const length = entries.length;
    if (!Number.isSafeInteger(length) || length < 0) return {updates_log_status: 'invalid'};
    const earliest = Math.max(startedAt, failedAt - LOG_WINDOW_MS);
    let selected: {code: string; timestamp: number; specificity: number} | undefined;
    for (let index = Math.max(0, length - LOG_ENTRY_LIMIT); index < length; index++) {
        const entry = field(entries, String(index));
        const timestamp = field(entry, 'timestamp');
        const level = field(entry, 'level');
        const code = field(entry, 'code');
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < earliest || timestamp > failedAt ||
            (level !== 'error' && level !== 'fatal') || typeof code !== 'string' || !Object.hasOwn(LOG_PHASES, code)) continue;
        const specificity = code === 'Unknown' ? 0 : code === 'UpdateFailedToLoad' ? 1 : 2;
        if (!selected || specificity > selected.specificity ||
            (specificity === selected.specificity && timestamp >= selected.timestamp)) selected = {code, timestamp, specificity};
    }
    return selected ? {
        updates_log_status: 'captured', updates_log_code: selected.code, updates_phase: LOG_PHASES[selected.code],
    } : {updates_log_status: 'empty'};
}

export async function readExpoUpdateFailureDetails(startedAt: number, failedAt: number): Promise<DiagnosticAttributes> {
    if (!Number.isFinite(startedAt) || !Number.isFinite(failedAt) || startedAt > failedAt) return {updates_log_status: 'invalid'};
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            new Promise<DiagnosticAttributes>(resolve => {
                timer = setTimeout(() => resolve({updates_log_status: 'timeout'}), LOG_DEADLINE_MS);
            }),
            Promise.resolve().then(async () => {
                if (typeof Updates.readLogEntriesAsync !== 'function') return {updates_log_status: 'unavailable'};
                const entries = await Updates.readLogEntriesAsync(LOG_WINDOW_MS);
                return summarize(entries, startedAt, failedAt);
            }).catch(() => ({updates_log_status: 'error'})),
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}
