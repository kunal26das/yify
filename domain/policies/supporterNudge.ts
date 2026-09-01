export const NUDGE_STATE_VERSION = 1;

export const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const NUDGE_MIN_ADS = 2;

export type NudgeDecision =
    | 'show'
    | 'disabled'
    | 'unknown'
    | 'entitled'
    | 'no_offer'
    | 'too_early'
    | 'cooldown'
    | 'declined';

export const NUDGE_DECLINE_LIMIT = 3;

export interface NudgeState {
    lastShownAt: number;
    adsSinceShown: number;
    declines: number;
}

export const INITIAL_NUDGE_STATE: NudgeState = {
    lastShownAt: 0,
    adsSinceShown: 0,
    declines: 0,
};

export interface NudgeInput {
    enabled: boolean;
    entitlementKnown: boolean;
    adsRemoved: boolean;
    hasOffer: boolean;
    state: NudgeState;
}

function elapsed(now: number, since: number): number {
    if (since <= 0 || since > now) return Number.POSITIVE_INFINITY;
    return now - since;
}

function count(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    return value;
}

export function decideNudge(
    input: NudgeInput,
    now: number,
    cooldownMs: number = NUDGE_COOLDOWN_MS,
    minAds: number = NUDGE_MIN_ADS,
    declineLimit: number = NUDGE_DECLINE_LIMIT
): NudgeDecision {
    if (!input.enabled) return 'disabled';
    if (!input.entitlementKnown) return 'unknown';
    if (input.adsRemoved) return 'entitled';
    if (!input.hasOffer) return 'no_offer';
    if (input.state.declines >= declineLimit) return 'declined';
    if (input.state.adsSinceShown < minAds) return 'too_early';
    if (elapsed(now, input.state.lastShownAt) < cooldownMs) return 'cooldown';
    return 'show';
}

export function commitAdWatched(state: NudgeState): NudgeState {
    return {...state, adsSinceShown: state.adsSinceShown + 1};
}

export function commitNudgeShown(state: NudgeState, now: number): NudgeState {
    return {lastShownAt: now, adsSinceShown: 0, declines: state.declines};
}

export function commitNudgeDeclined(state: NudgeState): NudgeState {
    return {...state, declines: state.declines + 1};
}

export function commitNudgeAccepted(state: NudgeState): NudgeState {
    return {...state, declines: 0};
}

export function parseNudgeState(raw: string | undefined): NudgeState {
    if (!raw) return {...INITIAL_NUDGE_STATE};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {...INITIAL_NUDGE_STATE};
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {...INITIAL_NUDGE_STATE};
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== NUDGE_STATE_VERSION) return {...INITIAL_NUDGE_STATE};
    return {
        lastShownAt: count(record.lastShownAt),
        adsSinceShown: count(record.adsSinceShown),
        declines: count(record.declines),
    };
}

export function encodeNudgeState(state: NudgeState): string {
    return JSON.stringify({version: NUDGE_STATE_VERSION, ...state});
}
