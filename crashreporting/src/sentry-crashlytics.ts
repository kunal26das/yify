import {createCrashlyticsError} from './crashlytics-error';
import {diagnosticOperation, GLOBAL_MECHANISM} from './constants';
import type {CrashEvent, CrashException, CrashFrame} from './types';

interface MirrorOptions {
    recordError(error: Error, metadata: Record<string, string>): void | Promise<void>;
    isEnabled(): boolean;
    normalizeError?: (error: unknown, operation?: string) => Error;
    globalMechanism?: string;
}

const EVENT_HISTORY_LIMIT = 128;
const eventIdPattern = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const identifierPattern = /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/;
const releasePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.+@()-]{0,127}$/;

function safeValue(value: unknown, pattern: RegExp): string | undefined {
    return typeof value === 'string' && pattern.test(value) ? value : undefined;
}

function isJavaScript(platform: string | undefined): boolean {
    return platform === undefined || platform === 'javascript';
}

function exceptionFrames(exception: CrashException): CrashFrame[] {
    return (exception.stacktrace?.frames ?? []).filter(frame => isJavaScript(frame.platform));
}

function sourceException(event: CrashEvent, globalMechanism: string): CrashException | undefined {
    const exceptions = event.exception?.values ?? [];
    if (exceptions.some(exception => exception.mechanism?.type === globalMechanism)) return undefined;
    return [...exceptions].reverse().find(exception =>
        !exception.stacktrace?.frames?.length || exceptionFrames(exception).length > 0);
}

function sourceError(exception: CrashException, normalizeError: (error: unknown, operation?: string) => Error, operation?: string): Error {
    const name = exception.type || 'Error';
    const message = exception.value ?? 'JavaScript exception';
    const frames = exceptionFrames(exception).reverse().map(frame => {
        const location = (frame.filename || frame.abs_path || '<unknown>').replace(/[\r\n]/g, ' ');
        const fn = (frame.function || '<anonymous>').replace(/[\r\n]/g, ' ');
        const line = Number.isSafeInteger(frame.lineno) && frame.lineno! >= 0 ? frame.lineno : 0;
        const column = Number.isSafeInteger(frame.colno) && frame.colno! >= 0 ? frame.colno : 0;
        return `    at ${fn} (${location}:${line}:${column})`;
    });
    return normalizeError({name, message, stack: [`${name}: ${message}`, ...frames].join('\n')}, operation);
}

function eventMetadata(event: CrashEvent, exception: CrashException): Record<string, string> {
    const result: Record<string, string> = {};
    const values = {
        sentry_event_id: safeValue(event.event_id, eventIdPattern),
        sentry_release: safeValue(event.release, releasePattern),
        sentry_environment: safeValue(event.environment, identifierPattern),
        sentry_mechanism: safeValue(exception.mechanism?.type, identifierPattern),
        'diagnostics.operation': diagnosticOperation(event.tags?.['diagnostics.operation']),
    };
    for (const [key, value] of Object.entries(values)) {
        if (value && value.length <= 128) result[key] = value;
    }
    if (typeof exception.mechanism?.handled === 'boolean') {
        result.sentry_handled = String(exception.mechanism.handled);
    }
    return result;
}

export function createSentryCrashlyticsMirror({recordError, isEnabled,
    normalizeError = (error, operation) => createCrashlyticsError(error, undefined, operation),
    globalMechanism = GLOBAL_MECHANISM}: MirrorOptions):
    (event: CrashEvent, hint?: unknown) => Promise<void> {
    const recorded = new Map<string, Promise<void>>();
    return async (event, _hint) => {
        try {
            if (!isEnabled() || event.type !== undefined || !isJavaScript(event.platform)) return;
            const exception = sourceException(event, globalMechanism);
            if (!exception) return;
            const metadata = eventMetadata(event, exception);
            const id = metadata.sentry_event_id;
            const existing = id ? recorded.get(id) : undefined;
            if (existing) return await existing;
            const error = sourceError(exception, normalizeError, metadata['diagnostics.operation']);
            const delivery = Promise.resolve().then(() => recordError(error, metadata)).catch(() => {
                if (id && recorded.get(id) === delivery) recorded.delete(id);
            });
            if (id) {
                recorded.set(id, delivery);
                if (recorded.size > EVENT_HISTORY_LIMIT) recorded.delete(recorded.keys().next().value!);
            }
            await delivery;
        } catch {}
    };
}
