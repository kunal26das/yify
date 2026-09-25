import type {PrivacyPreferences} from '@/domain';

export class OptionalTelemetryConsent {
    private allowed = false;
    private revision = 0;
    private unsubscribe?: () => void;

    bind(privacy: PrivacyPreferences): void {
        this.unsubscribe?.();
        this.allowed = false;
        this.revision++;
        const refresh = () => {
            let allowed = false;
            try {
                const choices = privacy.getChoices();
                allowed = choices.adultConfirmed && choices.analytics;
            } catch {}
            if (allowed !== this.allowed) {
                this.allowed = allowed;
                this.revision++;
            }
        };
        refresh();
        this.unsubscribe = privacy.subscribe(refresh);
    }

    token(): number | undefined {
        return this.allowed ? this.revision : undefined;
    }

    permits(token: unknown): boolean {
        return this.allowed && token === this.revision;
    }
}

export const optionalTelemetryConsent = new OptionalTelemetryConsent();
