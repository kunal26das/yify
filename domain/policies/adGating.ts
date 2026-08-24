export const AD_GATE_STATE_VERSION = 1;

export const AD_COOLDOWN_MS = 20 * 60 * 1000;

export const AD_WINDOW_MS = 24 * 60 * 60 * 1000;

export const AD_WINDOW_LIMIT = 4;

export type AdTrigger = 'trailer_open' | 'queue_advance';

export type AdGateDecision =
    | 'show'
    | 'wrong_trigger'
    | 'disabled'
    | 'unknown'
    | 'entitled'
    | 'capped'
    | 'cooldown'
    | 'unfilled';

export interface AdGateState {
    lastShownAt: number;
    windowStartedAt: number;
    shownInWindow: number;
}

export const INITIAL_AD_GATE_STATE: AdGateState = {
    lastShownAt: 0,
    windowStartedAt: 0,
    shownInWindow: 0,
};

export interface AdGateInput {
    trigger: AdTrigger;
    enabled: boolean;
    entitlementKnown: boolean;
    adsRemoved: boolean;
    loaded: boolean;
    state: AdGateState;
}

function elapsed(now: number, since: number): number {
    if (since <= 0 || since > now) return Number.POSITIVE_INFINITY;
    return now - since;
}

function count(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
    return value;
}

export function decideAd(
    input: AdGateInput,
    now: number,
    cooldownMs: number = AD_COOLDOWN_MS,
    windowMs: number = AD_WINDOW_MS,
    windowLimit: number = AD_WINDOW_LIMIT
): AdGateDecision {
    if (input.trigger !== 'trailer_open') return 'wrong_trigger';
    if (!input.enabled) return 'disabled';
    if (!input.entitlementKnown) return 'unknown';
    if (input.adsRemoved) return 'entitled';
    if (
        input.state.shownInWindow >= windowLimit &&
        elapsed(now, input.state.windowStartedAt) < windowMs
    ) {
        return 'capped';
    }
    if (elapsed(now, input.state.lastShownAt) < cooldownMs) return 'cooldown';
    if (!input.loaded) return 'unfilled';
    return 'show';
}

export function commitAdShown(
    state: AdGateState,
    now: number,
    windowMs: number = AD_WINDOW_MS
): AdGateState {
    const rolled = elapsed(now, state.windowStartedAt) >= windowMs;
    return {
        lastShownAt: now,
        windowStartedAt: rolled ? now : state.windowStartedAt,
        shownInWindow: rolled ? 1 : state.shownInWindow + 1,
    };
}

export function parseAdGateState(raw: string | undefined): AdGateState {
    if (!raw) return {...INITIAL_AD_GATE_STATE};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {...INITIAL_AD_GATE_STATE};
    }
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {...INITIAL_AD_GATE_STATE};
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== AD_GATE_STATE_VERSION) return {...INITIAL_AD_GATE_STATE};
    return {
        lastShownAt: count(record.lastShownAt),
        windowStartedAt: count(record.windowStartedAt),
        shownInWindow: count(record.shownInWindow),
    };
}

export function encodeAdGateState(state: AdGateState): string {
    return JSON.stringify({version: AD_GATE_STATE_VERSION, ...state});
}
