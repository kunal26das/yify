import {
    getAnalytics,
    getAppInstanceId,
    logEvent,
    logScreenView,
    resetAnalyticsData,
    setAnalyticsCollectionEnabled,
    setConsent,
    setUserProperty as setFirebaseUserProperty,
} from '@react-native-firebase/analytics';

import type {AnalyticsParams, AnalyticsSink, PrivacyPreferences} from '@/domain';
import {optionalAnalyticsAllowed} from '../../services/optionalAnalytics';

const instanceReaders = new WeakMap<PrivacyPreferences, () => Promise<string | null>>();

export class FirebaseAnalyticsSink implements AnalyticsSink {
    private enabled = false;
    private revision = 0;
    private resetRevision = 0;
    private lastResetRevision = 0;
    private applying: Promise<void> = Promise.resolve();

    constructor(private readonly privacy: PrivacyPreferences) {
        instanceReaders.set(privacy, () => this.instanceId());
        privacy.subscribe(() => this.applyChoices());
        this.applyChoices();
    }

    trackEvent(name: string, params?: AnalyticsParams): void {
        if (!this.allowed()) return;
        try { void Promise.resolve(logEvent(getAnalytics(), name, params)).catch(() => {}); } catch {}
    }

    trackScreenView(screenName: string): void {
        if (!this.allowed()) return;
        try {
            void Promise.resolve(logScreenView(getAnalytics(), {screen_name: screenName, screen_class: screenName})).catch(() => {});
        } catch {}
    }

    setUserProperty(name: string, value: string | null): void {
        if (!this.allowed()) return;
        try { void setFirebaseUserProperty(getAnalytics(), name, value).catch(() => {}); } catch {}
    }

    private allowed(): boolean {
        return this.enabled && optionalAnalyticsAllowed(this.privacy);
    }

    private applyChoices(): void {
        const revision = ++this.revision;
        const allowed = optionalAnalyticsAllowed(this.privacy);
        if (!allowed) this.resetRevision += 1;
        this.enabled = false;
        this.applying = this.applying.catch(() => {}).then(async () => {
            if (revision !== this.revision) return;
            const analytics = getAnalytics();
            await setAnalyticsCollectionEnabled(analytics, false);
            if (revision !== this.revision) return;
            await setConsent(analytics, {analytics_storage: allowed, ad_storage: false,
                ad_user_data: false, ad_personalization: false});
            if (this.lastResetRevision < this.resetRevision) {
                const resetRevision = this.resetRevision;
                await resetAnalyticsData(analytics);
                this.lastResetRevision = resetRevision;
            }
            if (!allowed) return;
            if (revision !== this.revision || !optionalAnalyticsAllowed(this.privacy)) return;
            await setAnalyticsCollectionEnabled(analytics, true);
            this.enabled = revision === this.revision && optionalAnalyticsAllowed(this.privacy);
        }).catch(() => { this.enabled = false; });
    }

    private async instanceId(): Promise<string | null> {
        const revision = this.revision;
        try {
            await this.applying;
            if (!this.allowed() || revision !== this.revision) return null;
            const id = await getAppInstanceId(getAnalytics());
            return this.allowed() && revision === this.revision ? id : null;
        } catch {
            return null;
        }
    }
}

export async function getAnalyticsInstanceId(privacy?: PrivacyPreferences): Promise<string | null> {
    if (!privacy || !optionalAnalyticsAllowed(privacy)) return null;
    return instanceReaders.get(privacy)?.() ?? null;
}
