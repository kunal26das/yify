import ErrorStackParser from 'error-stack-parser';
import {GLOBAL_MECHANISM} from './constants';
import type {SentryReporter} from './types';

function errorWithComponentStack(error: unknown): unknown {
    try {
        if (!error || typeof error !== 'object') return error;
        const source = error as {name?: unknown; message?: unknown; stack?: unknown; componentStack?: unknown};
        if (typeof source.componentStack !== 'string') return error;
        try {
            if (ErrorStackParser.parse(source as Error).some(frame => frame.lineNumber !== undefined)) return error;
        } catch {}
        const copy = new Error(typeof source.message === 'string' ? source.message : 'React render error');
        copy.name = typeof source.name === 'string' ? source.name : 'Error';
        copy.stack = `${copy.name}: ${copy.message}\n${source.componentStack}`;
        return copy;
    } catch {
        return error;
    }
}

export function createSentryGlobalErrorReporter(
    sentry: SentryReporter,
    correlate: (eventId: string) => void | Promise<void>,
    timeout = 2000,
    globalMechanism = GLOBAL_MECHANISM,
): (error: unknown, isFatal: boolean) => Promise<void> {
    return async (error, isFatal) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const eventId = sentry.captureException(errorWithComponentStack(error), {
                originalException: error,
                mechanism: {type: globalMechanism, handled: !isFatal},
                captureContext: {level: isFatal ? 'fatal' : 'error'},
            });
            const pending = Promise.allSettled([
                Promise.resolve().then(() => correlate(eventId)),
                Promise.resolve().then(() => sentry.flush(timeout)),
            ]);
            await Promise.race([
                pending,
                new Promise<void>(resolve => { timer = setTimeout(resolve, timeout); }),
            ]);
        } catch {}
        finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    };
}
