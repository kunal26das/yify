import {
    DEFAULT_PRIVACY_CHOICES,
    PRIVACY_NOTICE_VERSION,
    type KeyValueStore,
    type PrivacyChoices,
    type PrivacyPreferences,
} from '@/domain';

const KEY = 'choices';

function readChoices(store: KeyValueStore): PrivacyChoices {
    try {
        const value: unknown = JSON.parse(store.getString(KEY) ?? 'null');
        if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PRIVACY_CHOICES;
        const record = value as Record<string, unknown>;
        if (record.noticeVersion !== PRIVACY_NOTICE_VERSION ||
            typeof record.adultConfirmed !== 'boolean' || typeof record.analytics !== 'boolean' ||
            typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt)) ||
            new Date(record.updatedAt).toISOString() !== record.updatedAt ||
            (!record.adultConfirmed && record.analytics)) return DEFAULT_PRIVACY_CHOICES;
        return Object.freeze({adultConfirmed: record.adultConfirmed, analytics: record.analytics,
            updatedAt: record.updatedAt, noticeVersion: PRIVACY_NOTICE_VERSION});
    } catch {
        return DEFAULT_PRIVACY_CHOICES;
    }
}

export class PrivacyPreferencesImpl implements PrivacyPreferences {
    private choices: PrivacyChoices;
    private readonly listeners = new Set<() => void>();

    constructor(private readonly store: KeyValueStore, watchStore?: (listener: () => void) => void) {
        this.choices = readChoices(store);
        watchStore?.(() => this.refreshFromStorage());
    }

    getChoices(): PrivacyChoices {
        return this.choices;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    refreshFromStorage(): void {
        const choices = readChoices(this.store);
        if (JSON.stringify(choices) !== JSON.stringify(this.choices)) this.publish(choices);
    }

    updateChoices(choices: Pick<PrivacyChoices, 'adultConfirmed' | 'analytics'>): void {
        try {
            if (typeof choices?.adultConfirmed !== 'boolean' || typeof choices?.analytics !== 'boolean') {
                throw new Error('Invalid privacy choices');
            }
            const next: PrivacyChoices = Object.freeze({
                adultConfirmed: choices.adultConfirmed,
                analytics: choices.adultConfirmed && choices.analytics,
                noticeVersion: PRIVACY_NOTICE_VERSION,
                updatedAt: new Date().toISOString(),
            });
            const encoded = JSON.stringify(next);
            this.store.set(KEY, encoded);
            if (this.store.getString(KEY) !== encoded) throw new Error('Privacy choices could not be saved');
            this.publish(next);
        } catch {
            try { this.store.delete(KEY); } catch {}
            this.publish(DEFAULT_PRIVACY_CHOICES);
            throw new Error('Privacy choices could not be saved');
        }
    }

    private publish(choices: PrivacyChoices): void {
        this.choices = choices;
        for (const listener of this.listeners) {
            try { listener(); } catch {}
        }
    }
}
