import type {ReactNativeClient, ReactNativeOptions} from '@sentry/react-native';
import {optionalTelemetryConsent, type OptionalTelemetryConsent} from './optional-telemetry';

type Envelope = Parameters<NonNullable<ReturnType<ReactNativeClient['getTransport']>>['send']>[0];
type Integration = Exclude<NonNullable<ReactNativeOptions['integrations']>, (...args: never[]) => unknown>[number];
export const CONSENT_REVISION = 'yify.privacy_revision';

function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : undefined;
}

function keepOptional(value: unknown, consent: OptionalTelemetryConsent): boolean {
    const attributes = record(record(value)?.attributes);
    if (!attributes) return false;
    const token = attributes[CONSENT_REVISION];
    const allowed = consent.permits(record(token)?.value ?? token);
    delete attributes[CONSENT_REVISION];
    return allowed;
}

export function filterSentryEnvelope(envelope: Envelope, consent = optionalTelemetryConsent): Envelope {
    const items = envelope[1].filter(item => {
        const type = item[0].type;
        if (type === 'event' || type === 'feedback' || type === 'attachment') return true;
        if (type === 'transaction') {
            const event = record(item[1]);
            const trace = record(record(event?.contexts)?.trace);
            const data = record(trace?.data);
            const allowed = consent.permits(data?.[CONSENT_REVISION]);
            if (data) delete data[CONSENT_REVISION];
            if (Array.isArray(event?.spans)) {
                for (const span of event.spans) {
                    const spanData = record(record(span)?.data);
                    if (spanData) delete spanData[CONSENT_REVISION];
                }
            }
            return allowed;
        }
        if (type === 'log' || type === 'trace_metric') {
            const payload = record(item[1]);
            if (!payload || !Array.isArray(payload.items)) return false;
            payload.items = payload.items.filter(value => keepOptional(value, consent));
            item[0].item_count = (payload.items as unknown[]).length;
            return item[0].item_count > 0;
        }
        return false;
    });
    return [envelope[0], items] as Envelope;
}

export function sentryConsentIntegration(consent = optionalTelemetryConsent): Integration {
    return {
        name: 'YifyOptionalTelemetryConsent',
        setup(client) {
            const transport = client.getTransport();
            if (transport) {
                const send = transport.send.bind(transport);
                transport.send = envelope => {
                    const filtered = filterSentryEnvelope(envelope, consent);
                    return filtered[1].length > 0 ? send(filtered) : Promise.resolve({});
                };
            }
            client.on('spanStart', span => {
                const token = consent.token();
                if (token !== undefined) span.setAttribute(CONSENT_REVISION, token);
            });
        },
    };
}
