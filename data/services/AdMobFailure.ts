import type {DiagnosticAttributes} from '@/domain';

const reasons: Readonly<Record<string, string>> = {
    'no-fill': 'no_fill',
    'mediation-no-fill': 'no_fill',
    'network-error': 'network_error',
    'invalid-request': 'invalid_request',
    'invalid-argument': 'invalid_argument',
    'invalid-ad-string': 'invalid_ad_string',
    'app-id-missing': 'app_id_missing',
    'internal-error': 'internal_error',
    'server-error': 'server_error',
    'mediation-adapter-error': 'mediation_adapter_error',
    'mediation-data-error': 'mediation_data_error',
    'mediation-invalid-ad-size': 'mediation_invalid_ad_size',
    'ad-already-used': 'ad_already_used',
    'request-id-mismatch': 'request_id_mismatch',
    'app-not-foreground': 'app_not_foreground',
    timeout: 'timeout',
};

function field(value: unknown, key: string): unknown {
    try {
        return value != null && typeof value === 'object'
            ? (value as Record<string, unknown>)[key] : undefined;
    } catch {
        return undefined;
    }
}

export function adErrorCode(error: unknown): string {
    const reason = field(error, 'reason');
    if (typeof reason === 'string' && Object.hasOwn(reasons, reason)) return reasons[reason];
    const code = field(error, 'code');
    if (typeof code !== 'string' || !code.startsWith('googleMobileAds/')) return 'unknown';
    const legacy = code.slice('googleMobileAds/'.length).replace(/^error-code-/, '');
    return Object.hasOwn(reasons, legacy) ? reasons[legacy] : 'unknown';
}

export function adErrorDetails(error: unknown): DiagnosticAttributes {
    const details: DiagnosticAttributes = {};
    const phase = field(error, 'phase');
    if (phase === 'load' || phase === 'show') details.stage = phase;
    const adapters = field(field(error, 'responseInfo'), 'adapterResponses');
    if (!Array.isArray(adapters)) return details;
    const bounded = adapters.slice(0, 100);
    details.ad_adapter_count = bounded.length;
    let failures = 0;
    for (const adapter of bounded) {
        const error = field(adapter, 'adError');
        if (field(adapter, 'outcome') !== 'error' || error == null || typeof error !== 'object') continue;
        failures += 1;
        const code = field(error, 'code');
        if (details.ad_adapter_error_code !== undefined || typeof code !== 'number' ||
            !Number.isInteger(code) || code < 0 || code > 65535) continue;
        const domain = field(error, 'domain');
        details.ad_adapter_error_code = code;
        details.ad_error_domain = domain === 'com.google.android.gms.ads' || domain === 'com.google.admob'
            ? 'admob' : domain === 'com.google.android.gms.ads.mediation' ? 'admob_mediation' : 'other';
    }
    details.ad_adapter_error_count = failures;
    return details;
}
