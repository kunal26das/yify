export type AdTrigger = 'movie_open' | 'queue_advance';

export type AdGateDecision =
    | 'show'
    | 'wrong_trigger'
    | 'unknown'
    | 'entitled'
    | 'unfilled';

export interface AdGateInput {
    trigger: AdTrigger;
    entitlementKnown: boolean;
    adsRemoved: boolean;
    loaded: boolean;
}

export function decideAd(input: AdGateInput): AdGateDecision {
    if (input.trigger !== 'movie_open') return 'wrong_trigger';
    if (!input.entitlementKnown) return 'unknown';
    if (input.adsRemoved) return 'entitled';
    if (!input.loaded) return 'unfilled';
    return 'show';
}
