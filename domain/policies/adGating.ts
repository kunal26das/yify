export type AdTrigger = 'movie_open' | 'queue_advance';

export type AdGateDecision =
    | 'show'
    | 'wrong_trigger'
    | 'unknown'
    | 'entitled'
    | 'paced_actions'
    | 'paced_time'
    | 'unfilled';

export interface AdGateInput {
    trigger: AdTrigger;
    entitlementKnown: boolean;
    adsRemoved: boolean;
    movieOpensSinceVisible: number;
    lastVisibleAt: number | null;
    now: number;
    loaded: boolean;
}

export function decideAd(input: AdGateInput): AdGateDecision {
    if (input.trigger !== 'movie_open') return 'wrong_trigger';
    if (!input.entitlementKnown) return 'unknown';
    if (input.adsRemoved) return 'entitled';
    if (input.movieOpensSinceVisible < 3) return 'paced_actions';
    if (input.lastVisibleAt != null && input.now - input.lastVisibleAt < 120000) return 'paced_time';
    if (!input.loaded) return 'unfilled';
    return 'show';
}
