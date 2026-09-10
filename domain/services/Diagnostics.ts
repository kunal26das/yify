export type DiagnosticAttributes = Record<string, string | number | boolean | undefined>;

export type DiagnosticOutcome =
    | 'ok' | 'error' | 'cancelled' | 'timeout' | 'unavailable' | 'empty' | 'skipped' | 'pending';

export interface DiagnosticSpan {
    finish(outcome?: DiagnosticOutcome, attributes?: DiagnosticAttributes): void;
    fail(error: unknown, attributes?: DiagnosticAttributes): void;
}

export interface Diagnostics {
    trace<T>(operation: string, work: () => Promise<T>, attributes?: DiagnosticAttributes): Promise<T>;
    start(operation: string, attributes?: DiagnosticAttributes): DiagnosticSpan;
    capture(error: unknown, operation: string, attributes?: DiagnosticAttributes): string | undefined;
    event(operation: string, attributes?: DiagnosticAttributes): void;
    showFeedback(): Promise<boolean>;
}
