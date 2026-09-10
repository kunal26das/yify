import * as Sentry from '@sentry/react-native';
import type {DiagnosticAttributes, DiagnosticOutcome, DiagnosticSpan, Diagnostics} from '@/domain';
import {isDiagnosticOperation, sanitizeDiagnosticAttributes} from '@/instrumentation/sentry-privacy';
import {NOOP_DIAGNOSTICS} from './NoopDiagnostics';

type Sdk = Pick<typeof Sentry, 'startInactiveSpan' | 'withActiveSpan' | 'captureException' | 'addBreadcrumb' | 'metrics' | 'logger' | 'showFeedbackForm' | 'getClient'>;

function safely<T>(work: () => T): T | undefined {
    try { return work(); } catch { return undefined; }
}

function field(error: unknown, key: string): unknown {
    return safely(() => error != null && typeof error === 'object'
        ? (error as Record<string, unknown>)[key] : undefined);
}

function attributes(input?: DiagnosticAttributes): Record<string, string | number | boolean> {
    return safely(() => Object.fromEntries(Object.entries(sanitizeDiagnosticAttributes(input))
        .map(([key, value]) => [key.startsWith('diagnostics.') ? key : `diagnostics.${key}`, value]))) ?? {};
}

const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
    'URIError', 'EvalError', 'AggregateError', 'FirebaseError', 'AbortError', 'EztvUnavailableError']);

function handledError(error: unknown, operation: string, data: Record<string, string | number | boolean>): Error {
    const copy = new Error(`${operation} failed${data['diagnostics.error_code'] ? ` (${data['diagnostics.error_code']})` : ''}`);
    const name = field(error, 'name');
    copy.name = typeof name === 'string' && ERROR_NAMES.has(name) ? name : 'Error';
    const stack = field(error, 'stack');
    if (typeof stack === 'string') {
        const frames = stack.split('\n').filter(line => /^\s*at\s/.test(line) || /@.+:\d+(?::\d+)?$/.test(line));
        if (frames.length) copy.stack = `${copy.name}: ${copy.message}\n${frames.join('\n')}`;
    }
    return copy;
}

export class SentryDiagnostics implements Diagnostics {
    private readonly captured = new WeakMap<object, string | undefined>();
    private readonly spans = new WeakMap<DiagnosticSpan, Sentry.Span>();

    constructor(private readonly sdk: Sdk = Sentry, private readonly now: () => number = Date.now) {}

    async trace<T>(operation: string, work: () => Promise<T>, input?: DiagnosticAttributes): Promise<T> {
        const span = this.start(operation, input);
        try {
            const value = await this.inContext(this.spans.get(span), async () => work());
            span.finish();
            return value;
        } catch (error) {
            span.fail(error);
            throw error;
        }
    }

    start(operation: string, input?: DiagnosticAttributes): DiagnosticSpan {
        if (!safely(() => isDiagnosticOperation(operation))) return NOOP_DIAGNOSTICS.start(operation);
        const data = {...attributes(input), 'diagnostics.operation': operation};
        const started = safely(this.now) ?? 0;
        const span = safely(() => this.sdk.startInactiveSpan({name: operation, op: `yify.${operation}`, attributes: data}));
        let finished = false;
        const finish = (outcome: DiagnosticOutcome = 'ok', extra?: DiagnosticAttributes) => {
            if (finished) return;
            finished = true;
            const duration = Math.max(0, (safely(this.now) ?? started) - started);
            const finalData = {...data, ...attributes(extra), 'diagnostics.operation': operation, 'diagnostics.outcome': outcome};
            safely(() => span?.setAttributes(finalData));
            safely(() => span?.setStatus(outcome === 'error' || outcome === 'timeout'
                ? {code: 2, message: outcome === 'timeout' ? 'deadline_exceeded' : 'internal_error'} : {code: 1}));
            safely(() => span?.end());
            safely(() => this.sdk.metrics.count('yify.operation.count', 1, {attributes: finalData}));
            safely(() => this.sdk.metrics.distribution('yify.operation.duration', duration, {unit: 'millisecond', attributes: finalData}));
            this.event(operation, {...finalData, outcome, duration_ms: duration});
        };
        const diagnosticSpan: DiagnosticSpan = {
            finish,
            fail: (error, extra) => {
                if (finished) return;
                const timeout = field(error, 'name') === 'AbortError';
                if (!timeout) this.inContext(span, () => this.capture(error, operation, {...data, ...attributes(extra)}));
                finish(timeout ? 'timeout' : 'error', extra);
            },
        };
        if (span) this.spans.set(diagnosticSpan, span);
        return diagnosticSpan;
    }

    private inContext<T>(span: Sentry.Span | undefined, work: () => T): T {
        let called = false;
        let result: T;
        const once = () => {
            if (!called) {
                called = true;
                result = work();
            }
            return result;
        };
        if (span) safely(() => this.sdk.withActiveSpan(span, once));
        return once();
    }

    capture(error: unknown, operation: string, input?: DiagnosticAttributes): string | undefined {
        if (!safely(() => isDiagnosticOperation(operation))) return undefined;
        const object = error != null && typeof error === 'object' ? error : undefined;
        if (object && this.captured.has(object)) return this.captured.get(object);
        const data: Record<string, string | number | boolean> = {...attributes(input), 'diagnostics.operation': operation};
        const id = safely(() => this.sdk.captureException(handledError(error, operation, data), {
            level: 'error', fingerprint: ['{{ default }}', operation],
            tags: {'diagnostics.operation': operation}, contexts: {diagnostics: data},
        }));
        if (object) this.captured.set(object, id);
        return id;
    }

    event(operation: string, input?: DiagnosticAttributes): void {
        if (!safely(() => isDiagnosticOperation(operation))) return;
        const data: Record<string, string | number | boolean> = {...attributes(input), 'diagnostics.operation': operation};
        const warning = data['diagnostics.outcome'] === 'error' || data['diagnostics.outcome'] === 'timeout';
        safely(() => this.sdk.addBreadcrumb({category: `yify.${operation}`, message: operation,
            level: warning ? 'warning' : 'info', data}));
        safely(() => warning ? this.sdk.logger.warn(operation, data) : this.sdk.logger.info(operation, data));
    }

    async showFeedback(): Promise<boolean> {
        try {
            if (!this.sdk.getClient()) return false;
            this.sdk.showFeedbackForm();
            return true;
        } catch {
            return false;
        }
    }
}
