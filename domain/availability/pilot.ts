/** Shared enrollment contract. This module deliberately has no platform dependencies. */
export const MAX_AVAILABILITY_DEVICES = 5;
export const MAX_AVAILABILITY_ENROLLMENT_CHARS = 16_000;
export const MAX_AVAILABILITY_MOVIES = 20;

export interface AvailabilityDevice {
    id: string;
    kind: 'expo' | 'fcm';
    token: string;
    country: string;
    timeZone: string;
    updatedAt: number;
}
export interface AvailabilityEnrollment {version: 1; devices: AvailabilityDevice[]}

export function availabilityRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseAvailabilityEnrollment(raw: unknown): AvailabilityEnrollment | null {
    if (typeof raw !== 'string' || raw.length > MAX_AVAILABILITY_ENROLLMENT_CHARS) return null;
    try {
        const value = availabilityRecord(JSON.parse(raw));
        if (value.version !== 1 || !Array.isArray(value.devices) || value.devices.length > MAX_AVAILABILITY_DEVICES) return null;
        const ids = new Set<string>();
        const tokens = new Set<string>();
        const devices: AvailabilityDevice[] = [];
        for (const item of value.devices) {
            const d = availabilityRecord(item);
            if (typeof d.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(d.id) || ids.has(d.id)
                || (d.kind !== 'expo' && d.kind !== 'fcm') || typeof d.token !== 'string'
                || d.token.length < 20 || d.token.length > 2048 || tokens.has(d.token)
                || (d.kind === 'expo' ? !/^(Expo|Exponent)PushToken\[[a-zA-Z0-9_-]+\]$/.test(d.token)
                    : !/^[a-zA-Z0-9_:\-]+$/.test(d.token))
                || typeof d.country !== 'string' || !/^[A-Z]{2}$/.test(d.country)
                || typeof d.timeZone !== 'string' || d.timeZone.length > 100
                || !Number.isSafeInteger(d.updatedAt) || Number(d.updatedAt) <= 0) return null;
            new Intl.DateTimeFormat('en', {timeZone: d.timeZone}).format(0);
            ids.add(d.id); tokens.add(d.token);
            devices.push({id: d.id, kind: d.kind, token: d.token, country: d.country,
                timeZone: d.timeZone, updatedAt: Number(d.updatedAt)});
        }
        return {version: 1, devices};
    } catch {return null;}
}

export interface AlertMovie {id: number; imdbCode: string}
export interface AlertContext {
    country: string;
    services: string[];
    signature: string;
    movies: AlertMovie[];
    dailyHour: number;
    quietHours: boolean;
    quietStartHour: number;
    quietEndHour: number;
}

function parseJson(raw: unknown, max: number): Record<string, unknown> {
    if (typeof raw !== 'string' || raw.length > max) return {};
    try {return availabilityRecord(JSON.parse(raw));} catch {return {};}
}

export function alertContext(document: Record<string, unknown>, device: AvailabilityDevice): AlertContext | null {
    const preferences = parseJson(document.preferences, 4000);
    const country = preferences.watchRegion == null ? device.country : preferences.watchRegion;
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return null;
    const selected = availabilityRecord(preferences.streamingServices)[country];
    if (!Array.isArray(selected) || selected.length > 100) return null;
    const services = [...new Set(selected.filter((id): id is string => typeof id === 'string' && /^tmdb:[1-9]\d{0,9}$/.test(id)))].sort();
    if (!services.length) return null;
    const watchlist = parseJson(document.watchlist, 500_000);
    if (document.library !== undefined) {
        if (typeof document.library !== 'string' || document.library.length > 300_000) return null;
        try {
            const parsed: unknown = JSON.parse(document.library);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        } catch {return null;}
    }
    const library = parseJson(document.library, 300_000);
    const watched = availabilityRecord(library.watched);
    const marks = availabilityRecord(watchlist.marks);
    const seen = new Set<string>();
    const movies: AlertMovie[] = [];
    for (const item of Array.isArray(watchlist.items) ? watchlist.items : []) {
        const movie = availabilityRecord(item);
        if (!Number.isSafeInteger(movie.id) || Number(movie.id) <= 0 || typeof movie.imdbCode !== 'string'
            || !/^tt\d{5,12}$/.test(movie.imdbCode) || seen.has(movie.imdbCode)
            || availabilityRecord(marks[String(movie.id)]).deleted === true) continue;
        const mark = availabilityRecord(watched[String(movie.id)]);
        if (mark.value === true && typeof mark.at === 'number' && mark.at > Number(library.clearedAt ?? 0)) continue;
        seen.add(movie.imdbCode);
        movies.push({id: Number(movie.id), imdbCode: movie.imdbCode});
        if (movies.length === MAX_AVAILABILITY_MOVIES) break;
    }
    const notify = availabilityRecord(preferences.notify);
    const hour = (value: unknown, fallback: number) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 23 ? Number(value) : fallback;
    return {country, services, signature: `${country}|${services.join(',')}`, movies,
        dailyHour: hour(notify.dailyHour, 19), quietHours: notify.quietHours === true,
        quietStartHour: hour(notify.quietStartHour, 22), quietEndHour: hour(notify.quietEndHour, 8)};
}

export interface AvailabilityObservation {
    country: string;
    status: 'ready' | 'unavailable';
    offers: {serviceId: string; type: string}[];
}
export interface AlertEvent {id: string; movieId: number; imdbCode: string; at: number}
export interface DeviceAlertState {
    signature: string;
    snapshots: Record<string, {available: boolean; generation: number; since: number}>;
    pending: AlertEvent[];
    attemptedDay?: string;
    attempt?: {id: string; at: number; status: 'reserved' | 'accepted' | 'unknown' | 'failed'; receiptId?: string; tokenHash?: string};
    disabledTokenHash?: string;
}

export function planAvailability(context: AlertContext, previous: DeviceAlertState | undefined,
    observations: Record<string, AvailabilityObservation>, now: number): {state: DeviceAlertState; deliverable: AlertEvent[]} {
    const same = previous?.signature === context.signature;
    const state: DeviceAlertState = {signature: context.signature, snapshots: {}, pending: [],
        ...(previous ? {attemptedDay: previous.attemptedDay, attempt: previous.attempt,
            disabledTokenHash: previous.disabledTokenHash} : {})};
    const valid = new Set(context.movies.map(movie => movie.imdbCode));
    state.pending = same ? (previous?.pending ?? []).filter(event => valid.has(event.imdbCode) && event.at > now - 7 * 86_400_000) : [];
    const deliverable: AlertEvent[] = [];
    for (const movie of context.movies) {
        const key = movie.imdbCode;
        const before = same ? previous?.snapshots[key] : undefined;
        const observation = observations[key];
        if (!observation || observation.status !== 'ready' || observation.country !== context.country) {
            if (before) state.snapshots[key] = before;
            continue;
        }
        const available = observation.offers.some(offer => context.services.includes(offer.serviceId)
            && ['subscription', 'free', 'ads'].includes(offer.type));
        const gain = before?.available === false && available;
        const generation = (before?.generation ?? 0) + (gain ? 1 : 0);
        const since = before?.since ?? now;
        state.snapshots[key] = {available, generation, since};
        if (!available) state.pending = state.pending.filter(event => event.imdbCode !== key);
        if (gain) state.pending.push({id: `${context.signature}|${key}|${since}|${generation}`, movieId: movie.id, imdbCode: key, at: now});
        if (available) deliverable.push(...state.pending.filter(event => event.imdbCode === key));
    }
    return {state, deliverable};
}

export function deliveryWindow(context: AlertContext, device: AvailabilityDevice, now: number): {day: string; due: boolean} {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: device.timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'}).formatToParts(now);
    const part = (name: string) => parts.find(value => value.type === name)?.value ?? '';
    const hour = Number(part('hour'));
    const start = context.quietStartHour; const end = context.quietEndHour;
    const quiet = context.quietHours && (start === end || (start < end ? hour >= start && hour < end : hour >= start || hour < end));
    const targetInQuiet = context.quietHours && (start === end || (start < end
        ? context.dailyHour >= start && context.dailyHour < end : context.dailyHour >= start || context.dailyHour < end));
    const postponedOvernight = targetInQuiet && start > end && context.dailyHour >= start && hour >= end && hour < start;
    return {day: `${part('year')}-${part('month')}-${part('day')}`, due: (hour >= context.dailyHour || postponedOvernight) && !quiet};
}
