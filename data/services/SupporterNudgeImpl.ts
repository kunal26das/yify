import {
    commitAdWatched,
    commitNudgeAccepted,
    commitNudgeDeclined,
    commitNudgeShown,
    decideNudge,
    encodeNudgeState,
    parseNudgeState,
    type AnalyticsSink,
    type KeyValueStore,
    type NudgeState,
    type PurchaseState,
    type SupporterNudge,
} from '@/domain';

const NUDGE_STATE_KEY = 'state';

export interface SupporterNudgeOptions {
    analytics: AnalyticsSink;
    store: KeyValueStore;
    enabled: () => boolean;
    entitlement: () => PurchaseState;
}

export class SupporterNudgeImpl implements SupporterNudge {
    private readonly options: SupporterNudgeOptions;

    private state: NudgeState;

    constructor(options: SupporterNudgeOptions) {
        this.options = options;
        this.state = parseNudgeState(options.store.getString(NUDGE_STATE_KEY));
    }

    recordAdShown(): void {
        this.write(commitAdWatched(this.state));
    }

    shouldPrompt(): boolean {
        const entitlement = this.options.entitlement();
        const decision = decideNudge(
            {
                enabled: this.options.enabled(),
                entitlementKnown: entitlement.ready,
                adsRemoved: entitlement.adsRemoved,
                hasOffer: entitlement.available && entitlement.offers.length > 0,
                state: this.state,
            },
            Date.now()
        );
        if (decision === 'show') return true;
        this.options.analytics.trackEvent('supporter_nudge_gated', {reason: decision});
        return false;
    }

    recordPrompted(): void {
        this.write(commitNudgeShown(this.state, Date.now()));
    }

    recordDeclined(): void {
        this.write(commitNudgeDeclined(this.state));
    }

    recordAccepted(): void {
        this.write(commitNudgeAccepted(this.state));
    }

    private write(next: NudgeState): void {
        this.state = next;
        try {
            this.options.store.set(NUDGE_STATE_KEY, encodeNudgeState(next));
        } catch {
        }
    }
}
