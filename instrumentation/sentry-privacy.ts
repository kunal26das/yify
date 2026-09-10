import type {Breadcrumb, ErrorEvent, Event, Metric, ReactNativeOptions, Stacktrace, TransactionEvent} from '@sentry/react-native';

type SpanData = Parameters<NonNullable<ReactNativeOptions['beforeSendSpan']>>[0];
type LogData = Parameters<NonNullable<ReactNativeOptions['beforeSendLog']>>[0];
type Attributes = Record<string, string | number | boolean>;

const diagnosticStrings = new Set(['provider', 'operation', 'outcome', 'error_code', 'method', 'stage', 'cache', 'trigger', 'reason']);
const diagnosticNumbers = new Set(['status_code', 'duration_ms', 'count', 'attempt', 'retry_count']);
const diagnosticBooleans = new Set(['available', 'trimmed', 'forced']);
const staticIdentifier = /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/;
const versionIdentifier = /^[a-zA-Z0-9][a-zA-Z0-9_.+@()-]{0,127}$/;
const telemetryId = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const metadataKeys = new Set(['sentry.environment', 'sentry.release', 'sentry.sdk.name', 'sentry.sdk.version', 'sentry.origin', 'sentry.op', 'sentry.source']);
const updateMessages = new Set(['Checking for update', 'Update available', 'Downloading update', 'Update downloaded', 'Update check failed', 'Update download failed', 'Rollback directive received', 'Restarting for update']);
const contextFields: Record<string, ReadonlySet<string>> = {
    app: new Set(['type', 'app_identifier', 'app_name', 'app_version', 'app_build', 'app_start_time', 'in_foreground', 'start_type']),
    device: new Set(['type', 'arch', 'battery_level', 'charging', 'connection_type', 'free_memory', 'memory_size', 'usable_memory', 'low_memory', 'model', 'model_id', 'brand', 'manufacturer', 'family', 'orientation', 'online', 'screen_width_pixels', 'screen_height_pixels', 'screen_density', 'screen_dpi', 'simulator', 'processor_count']),
    os: new Set(['type', 'name', 'version', 'build', 'kernel_version', 'rooted']),
    runtime: new Set(['type', 'name', 'version']),
    browser: new Set(['type', 'name', 'version']),
    react_native_context: new Set(['turbo_module', 'fabric', 'react_native_version', 'expo', 'js_engine', 'hermes_version', 'hermes_debug_info', 'expo_go_version', 'expo_sdk_version']),
    expo_constants: new Set(['execution_environment', 'app_ownership', 'debug_mode', 'expo_version', 'expo_runtime_version', 'status_bar_height', 'app_name', 'app_slug', 'app_version', 'expo_sdk_version']),
    ota_updates: new Set(['is_enabled', 'is_embedded_launch', 'is_emergency_launch', 'is_using_embedded_assets', 'update_id', 'channel', 'runtime_version', 'check_automatically', 'launch_duration', 'created_at']),
};

export function httpOrigin(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : undefined;
    } catch {
        return undefined;
    }
}

export function isDiagnosticOperation(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 80 && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(value);
}

export function sanitizeDiagnosticAttributes(input: Record<string, unknown> | undefined): Attributes {
    const result: Attributes = {};
    for (const [key, value] of Object.entries(input ?? {})) {
        const name = key.replace(/^diagnostics\./, '');
        if (diagnosticStrings.has(name) && typeof value === 'string' && staticIdentifier.test(value) && (name !== 'operation' || isDiagnosticOperation(value))) result[key] = value;
        if (diagnosticNumbers.has(name) && typeof value === 'number' && Number.isFinite(value) && value >= 0) result[key] = value;
        if (diagnosticBooleans.has(name) && typeof value === 'boolean') result[key] = value;
    }
    return result;
}

function httpMethod(value: unknown): string | undefined {
    return typeof value === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(value) ? value : undefined;
}

export function sanitizeRoute(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const route = value.split(/[?#]/, 1)[0].replace(/^\/(?:yify\/)?/, '').replace(/^\([^)]+\)\//, '');
    if (['', 'index', 'movies', 'shows', 'history', 'preferences', 'watchlist'].includes(route)) return route === '' || route === 'index' ? '/' : `/${route}`;
    if (/^movie\/[^/]+$/.test(route)) return '/movie/[id]';
    if (/^show\/[^/]+$/.test(route)) return '/show/[imdbId]';
    return undefined;
}

function sanitizeAttributes(input: Record<string, unknown> | undefined): Attributes {
    const result = sanitizeDiagnosticAttributes(input);
    for (const [key, value] of Object.entries(input ?? {})) {
        if (metadataKeys.has(key) && typeof value === 'string' && versionIdentifier.test(value)) result[key] = value;
        if (['profile_id', 'sentry.replay_id', 'replay_id', 'expo.updates.update_id', 'update_id', 'updateId'].includes(key) && typeof value === 'string' && telemetryId.test(value)) result[key] = value;
        if (['expo.updates.channel', 'expo.updates.runtime_version'].includes(key) && typeof value === 'string' && versionIdentifier.test(value)) result[key] = value;
        if (['event.origin', 'event.environment'].includes(key) && typeof value === 'string' && staticIdentifier.test(value)) result[key] = value;
        if (key === 'hermes' && typeof value === 'boolean') result[key] = value;
        if (['route.name', 'route.from', 'route.to'].includes(key)) {
            const route = sanitizeRoute(value);
            if (route) result[key] = route;
        }
        if (['url', 'http.url', 'url.full'].includes(key)) {
            const origin = httpOrigin(value);
            if (origin) result[key] = origin;
        }
        if (['http.method', 'http.request.method'].includes(key) && typeof value === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(value)) result[key] = value;
        if (['http.status_code', 'http.response.status_code', 'http.request_content_length', 'http.response_content_length', 'sentry.sample_rate', 'frames.total', 'frames.slow', 'frames.frozen', 'frames.delay', 'stall_count', 'stall_total_time', 'stall_longest_time'].includes(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) result[key] = value;
    }
    return result;
}

function sanitizeText(value: string): string {
    return value
        .replace(/https?:\/\/[^\s<>"')]+/gi, url => httpOrigin(url) ?? '[url]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[credential]')
        .replace(/\b(?:token|api[_-]?key|password|secret|authorization|query_term|query|search|email|user[_-]?id|account[_-]?id)\s*[:=]\s*[^\s,;]+/gi, '[private]')
        .slice(0, 4096);
}

function sanitizeContexts(contexts: ErrorEvent['contexts']): ErrorEvent['contexts'] {
    if (!contexts) return undefined;
    const result: NonNullable<ErrorEvent['contexts']> = {};
    for (const [name, context] of Object.entries(contexts)) {
        if (!context) continue;
        if (name === 'trace' && contexts.trace) {
            const {trace_id, span_id, parent_span_id, op, status, origin} = contexts.trace;
            result.trace = {trace_id, span_id, parent_span_id, op, status, origin, data: sanitizeAttributes(contexts.trace.data)};
        } else if (name === 'profile') {
            if (typeof context.profile_id === 'string' && telemetryId.test(context.profile_id)) result.profile = {profile_id: context.profile_id};
        } else if (name === 'replay') {
            if (typeof context.replay_id === 'string' && telemetryId.test(context.replay_id)) result.replay = {replay_id: context.replay_id};
        } else if (name === 'diagnostics') {
            result[name] = sanitizeDiagnosticAttributes(context);
        } else if (name === 'route') {
            result[name] = {name: sanitizeRoute(context.name ?? context['route.name'])};
        } else if (contextFields[name]) {
            const fields: Attributes = {};
            for (const [key, value] of Object.entries(context)) {
                if (!contextFields[name].has(key)) continue;
                if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) fields[key] = value;
                if (typeof value === 'string' && value.length <= 256 && !/[?/#@]/.test(value)) fields[key] = sanitizeText(value);
            }
            result[name] = fields;
        }
    }
    return result;
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    if (breadcrumb.category === 'console') return null;
    if (breadcrumb.type === 'http' || ['http', 'xhr', 'fetch'].includes(breadcrumb.category ?? '')) {
        return {...breadcrumb, message: undefined, data: {
            url: httpOrigin(breadcrumb.data?.url),
            method: httpMethod(breadcrumb.data?.method),
            status_code: sanitizeDiagnosticAttributes({status_code: breadcrumb.data?.status_code}).status_code,
        }};
    }
    const data = sanitizeAttributes(breadcrumb.data);
    if (breadcrumb.category === 'navigation' || breadcrumb.type === 'navigation') {
        const from = sanitizeRoute(breadcrumb.data?.from);
        const to = sanitizeRoute(breadcrumb.data?.to ?? breadcrumb.data?.pathname);
        return {...breadcrumb, message: undefined, data: {...data, ...(from ? {from} : {}), ...(to ? {to} : {})}};
    }
    const message = breadcrumb.category === 'expo.updates' && updateMessages.has(breadcrumb.message ?? '')
        ? breadcrumb.message : undefined;
    return {...breadcrumb, message, data};
}

function sanitizeEvent<T extends Event>(event: T): T {
    return {
        ...event,
        user: undefined,
        server_name: undefined,
        extra: undefined,
        tags: sanitizeAttributes(event.tags),
        contexts: sanitizeContexts(event.contexts),
        request: event.request ? {url: httpOrigin(event.request.url), method: httpMethod(event.request.method)} : undefined,
        breadcrumbs: event.breadcrumbs?.map(sanitizeBreadcrumb).filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null),
    };
}

export function sanitizeFeedbackEvent(event: Event): Event {
    if (event.type !== 'feedback') return event;
    const feedback = event.contexts?.feedback;
    const result = sanitizeEvent(event);
    result.contexts = {...result.contexts, feedback: {
        message: typeof feedback?.message === 'string' ? feedback.message : '',
        ...(typeof feedback?.associated_event_id === 'string' && telemetryId.test(feedback.associated_event_id)
            ? {associated_event_id: feedback.associated_event_id} : {}),
    }};
    return result;
}

function sanitizeStacktrace(stacktrace: Stacktrace): Stacktrace {
    return {...stacktrace, frames: stacktrace.frames?.map(frame => {
        const clean = {...frame};
        delete clean.vars;
        return clean;
    })};
}

export function sanitizeErrorEvent(event: ErrorEvent): ErrorEvent {
    const result = sanitizeEvent(event);
    if (event.message) result.message = sanitizeText(event.message);
    if (event.exception?.values) result.exception = {...event.exception, values: event.exception.values.map(exception => {
        const clean = {...exception, value: exception.value ? sanitizeText(exception.value) : exception.value};
        if (exception.stacktrace) clean.stacktrace = sanitizeStacktrace(exception.stacktrace);
        if (exception.mechanism?.data) clean.mechanism = {...exception.mechanism, data: undefined};
        return clean;
    })};
    if (event.threads?.values) result.threads = {...event.threads, values: event.threads.values.map(thread => ({
        ...thread,
        ...(thread.stacktrace ? {stacktrace: sanitizeStacktrace(thread.stacktrace)} : {}),
    }))};
    return result;
}

function sanitizeSpanName(name: string | undefined, op: string | undefined, data: Attributes): string | undefined {
    if (!name) return name;
    if (op?.startsWith('http')) return `${data['http.request.method'] ?? data['http.method'] ?? 'HTTP'} ${data['url.full'] ?? data['http.url'] ?? data.url ?? 'request'}`;
    if (op?.startsWith('navigation') || op === 'ui.load' || op === 'ui.action') return sanitizeRoute(name) ?? String(data['route.name'] ?? 'Navigation');
    if (op?.startsWith('yify.') && isDiagnosticOperation(name)) return name;
    if (['app.start.cold', 'app.start.warm', 'ui.load.initial_display', 'ui.load.full_display'].includes(op ?? '')) return op;
    return op && staticIdentifier.test(op) ? op : 'Operation';
}

export function sanitizeSpan(span: SpanData): SpanData {
    const data = sanitizeAttributes(span.data);
    return {...span, data, description: sanitizeSpanName(span.description, span.op, data), links: undefined};
}

export function sanitizeTransaction(event: TransactionEvent): TransactionEvent {
    const result = sanitizeEvent(event);
    const data = sanitizeAttributes(event.contexts?.trace?.data);
    result.transaction = sanitizeSpanName(event.transaction, event.contexts?.trace?.op, data);
    result.spans = event.spans?.map(sanitizeSpan);
    return result;
}

export function sanitizeLog(log: LogData): LogData | null {
    if (!isDiagnosticOperation(log.message)) return null;
    const attributes = sanitizeAttributes(log.attributes);
    if (attributes['diagnostics.operation'] !== log.message) return null;
    return {...log, attributes};
}

export function sanitizeMetric(metric: Metric): Metric | null {
    if (!['yify.operation.count', 'yify.operation.duration'].includes(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return null;
    return {...metric, unit: metric.unit === 'millisecond' ? metric.unit : undefined, attributes: sanitizeAttributes(metric.attributes)};
}

export function shouldCaptureErrorReplay(event: Event): boolean {
    return event.exception?.values?.some(exception => exception.mechanism?.handled === false) === true;
}
