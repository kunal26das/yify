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
const DISCOVERY_DISMISSED_KEY = 'discovery_dismissed';
const FIRST_HOME_VISIT_KEY = 'first_home_visit';
const HOME_RETURN_DELAY_MS = 24 * 60 * 60 * 1000;

export interface SupporterNudgeOptions {
    analytics: AnalyticsSink;
    store: KeyValueStore;
    enabled: () => boolean;
    entitlement: () => PurchaseState;
}

export class SupporterNudgeImpl implements SupporterNudge {
    private readonly options: SupporterNudgeOptions;

    private state: NudgeState;
    private discoveryDismissed = false;

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

    recordHomeVisit(): boolean {
        const now = Date.now();
        if (!Number.isSafeInteger(now) || now <= 0) return false;
        try {
            const stored = this.options.store.getString(FIRST_HOME_VISIT_KEY);
            const firstVisit = stored && /^[1-9]\d*$/.test(stored) ? Number(stored) : NaN;
            if (!Number.isSafeInteger(firstVisit) || firstVisit > now) {
                this.options.store.set(FIRST_HOME_VISIT_KEY, String(now));
                return false;
            }
            return now - firstVisit >= HOME_RETURN_DELAY_MS;
        } catch {
            return false;
        }
    }

    isDiscoveryDismissed(): boolean {
        if (this.discoveryDismissed) return true;
        try {
            return this.options.store.getString(DISCOVERY_DISMISSED_KEY) === 'true';
        } catch {
            return true;
        }
    }

    dismissDiscovery(): void {
        this.discoveryDismissed = true;
        try {
            this.options.store.set(DISCOVERY_DISMISSED_KEY, 'true');
        } catch {
        }
    }

    private write(next: NudgeState): void {
        this.state = next;
        try {
            this.options.store.set(NUDGE_STATE_KEY, encodeNudgeState(next));
        } catch {
        }
    }
}
