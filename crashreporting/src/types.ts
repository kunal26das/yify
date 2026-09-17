export type ErrorHandler = (error: unknown, isFatal?: boolean) => unknown;

export interface ErrorUtilsLike {
    getGlobalHandler(): ErrorHandler;
    setGlobalHandler(handler: ErrorHandler): void;
}

export interface ExceptionsManagerLike {
    handleException(error: unknown, isFatal: boolean): unknown;
}

export interface CrashlyticsClient {
    readonly isCrashlyticsCollectionEnabled: boolean;
}

export interface CrashlyticsApi<Client extends CrashlyticsClient> {
    getCrashlytics(): Client;
    recordError(client: Client, error: Error): void;
    setAttributes(client: Client, attributes: Record<string, string>): void | Promise<unknown>;
}

export interface CrashFrame {
    platform?: string;
    filename?: string;
    abs_path?: string;
    function?: string;
    lineno?: number;
    colno?: number;
}

export interface CrashException {
    type?: string;
    value?: string;
    mechanism?: {type: string; handled?: boolean};
    stacktrace?: {frames?: CrashFrame[]};
}

export interface CrashEvent {
    type?: string;
    platform?: string;
    event_id?: string;
    release?: string;
    environment?: string;
    tags?: Record<string, unknown>;
    exception?: {values?: CrashException[]};
}

export interface CaptureHint {
    originalException: unknown;
    mechanism: {type: string; handled: boolean};
    captureContext: {level: 'fatal' | 'error'};
}

export interface SentryReporter {
    captureException(error: unknown, hint: CaptureHint): string;
    flush(timeout: number): PromiseLike<boolean>;
}

export interface CrashReportingBridge {
    connectSentry(sentry: SentryReporter): void;
    mirrorException(event: CrashEvent, hint?: unknown): Promise<void>;
}

export interface CrashReportingOptions<Client extends CrashlyticsClient> {
    errorUtils: ErrorUtilsLike;
    loadCrashlytics(): CrashlyticsApi<Client>;
    exceptionsManager?: ExceptionsManagerLike;
    attributes?: Record<string, string>;
    groupingNamespace?: string;
    globalMechanism?: string;
    fatalTimeoutMs?: number;
    metadataTimeoutMs?: number;
}
