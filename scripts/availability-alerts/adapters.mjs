import {setTimeout as delay} from 'node:timers/promises';
import {availabilityRecord as record} from '../../domain/availability/pilot.ts';

export async function jsonRequest(url, init = {}, fetcher = fetch) {
    const response = await fetcher(url, {...init, redirect: 'error', signal: AbortSignal.timeout(12_000)});
    const reader = response.body?.getReader();
    let length = 0; let source = '';
    const decoder = new TextDecoder();
    if (reader) try {
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            length += value.length;
            if (length > 2_000_000) {await reader.cancel(); throw new Error('response_limit');}
            source += decoder.decode(value, {stream: true});
        }
        source += decoder.decode();
    } finally {reader.releaseLock();}
    let value;
    try {value = source ? JSON.parse(source) : {};} catch {throw new Error('invalid_response');}
    return {status: response.status, value};
}

export function firestoreStore(project, accessToken, fetcher = fetch) {
    if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error('invalid_project');
    const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
    const headers = {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'};
    const path = (collection, id) => `${base}/${collection}/${encodeURIComponent(id)}`;
    async function read(collection, id) {
        const response = await jsonRequest(path(collection, id), {headers}, fetcher);
        if (response.status === 404) return null;
        if (response.status !== 200 || typeof response.value.updateTime !== 'string') throw new Error('firestore_read');
        const fields = record(response.value.fields);
        return {updateTime: response.value.updateTime,
            data: Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value?.stringValue === 'string')
                .map(([key, value]) => [key, value.stringValue]))};
    }
    async function write(id, data, updateTime) {
        const url = new URL(path('availabilityAlertState', id));
        url.searchParams.set(updateTime ? 'currentDocument.updateTime' : 'currentDocument.exists', updateTime || 'false');
        const response = await jsonRequest(url, {method: 'PATCH', headers,
            body: JSON.stringify({fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, {stringValue: value}]))})}, fetcher);
        if ([409, 412].includes(response.status) || response.value?.error?.status === 'FAILED_PRECONDITION') return null;
        if (response.status !== 200 || typeof response.value.updateTime !== 'string') throw new Error('firestore_write');
        return {updateTime: response.value.updateTime, data};
    }
    async function remove(id, updateTime) {
        const url = new URL(path('availabilityAlertState', id));
        url.searchParams.set('currentDocument.updateTime', updateTime);
        const response = await jsonRequest(url, {method: 'DELETE', headers}, fetcher);
        if (![200, 404, 409, 412].includes(response.status)) throw new Error('firestore_delete');
    }
    return {readUser: uid => read('users', uid), readState: uid => read('availabilityAlertState', uid), writeState: write, deleteState: remove};
}

/** Mirrors the existing production recurring entitlement policy, with no owner exception. */
export function revenueCatVerifier(apiKey, productIds, fetcher = fetch, now = Date.now) {
    const project = '8b6ff243'; const entitlementId = 'entl2b0b9c6396';
    if (!apiKey || !productIds.length || productIds.some(id => !/^prod[a-zA-Z\d]{4,60}$/.test(id))) throw new Error('invalid_revenuecat_config');
    return async uid => {
        const base = new URL(`https://api.revenuecat.com/v2/projects/${project}/customers/${encodeURIComponent(uid)}/subscriptions`);
        const visited = new Set(); let cursor;
        for (let page = 0; page < 3; page++) {
            const url = new URL(base); url.searchParams.set('environment', 'production'); url.searchParams.set('limit', '100');
            if (cursor) url.searchParams.set('starting_after', cursor);
            const {status, value} = await jsonRequest(url, {headers: {Authorization: `Bearer ${apiKey}`}}, fetcher);
            if (status === 404) return false;
            if (status !== 200 || value.object !== 'list' || !Array.isArray(value.items) || value.items.length > 100) throw new Error('subscription_unverified');
            if (value.items.some(s => {
                const time = now();
                return s?.object === 'subscription' && s.environment === 'production' && s.gives_access === true
                    && productIds.includes(s.product_id) && ['play_store', 'rc_billing', 'stripe'].includes(s.store)
                    && ['active', 'trialing', 'in_grace_period'].includes(s.status)
                    && Number.isSafeInteger(s.starts_at) && s.starts_at <= time
                    && Number.isSafeInteger(s.current_period_starts_at) && s.current_period_starts_at <= time
                    && Number.isSafeInteger(s.ends_at) && s.ends_at > 0 && (s.status === 'in_grace_period' || s.ends_at > time)
                    && s.entitlements?.object === 'list' && Array.isArray(s.entitlements.items)
                    && s.entitlements.items.some(e => e?.object === 'entitlement' && e.state === 'active'
                        && e.id === entitlementId && e.lookup_key === 'remove_ads' && e.project_id === project);
            })) return true;
            if (value.next_page == null) return false;
            const next = new URL(value.next_page, base);
            const keys = [...next.searchParams.keys()]; cursor = next.searchParams.get('starting_after');
            if (next.origin !== base.origin || next.pathname !== base.pathname || next.username || next.password || next.hash
                || new Set(keys).size !== keys.length || keys.some(key => !['starting_after', 'environment', 'limit'].includes(key))
                || !cursor || !/^[a-zA-Z\d_-]{1,255}$/.test(cursor) || visited.has(cursor)
                || (next.searchParams.has('environment') && next.searchParams.get('environment') !== 'production')) throw new Error('subscription_pagination');
            visited.add(cursor);
        }
        throw new Error('subscription_page_limit');
    };
}

export function tmdbCatalog(token, existing = {}, fetcher = fetch, now = Date.now, rateDelay = 250) {
    let requests = 0;
    const day = new Date(now()).toISOString().slice(0, 10);
    const cache = existing.day === day ? existing : {day, entries: {}};
    cache.entries = record(cache.entries);
    const findings = new Map();
    async function request(path) {
        if (++requests > 850) throw new Error('tmdb_request_budget');
        if (rateDelay) await delay(rateDelay);
        const {status, value} = await jsonRequest(`https://api.themoviedb.org/3${path}`, {headers: {Authorization: `Bearer ${token}`}}, fetcher);
        if (status !== 200) throw new Error('tmdb_unavailable');
        return value;
    }
    async function regions() {
        if (!Array.isArray(cache.regions)) {
            const value = await request('/watch/providers/regions');
            if (!Array.isArray(value.results) || value.results.length > 300) throw new Error('invalid_regions');
            cache.regions = value.results.map(item => item.iso_3166_1).filter(item => typeof item === 'string' && /^[A-Z]{2}$/.test(item));
            if (!cache.regions.length) throw new Error('empty_regions');
        }
        return cache.regions;
    }
    return {cache, requestCount: () => requests, observe: async (movie, country) => {
        const key = `${movie.imdbCode}:${country}:movie`;
        if (cache.entries[key]) return cache.entries[key];
        try {
            if (!(await regions()).includes(country)) return {country, status: 'unavailable', offers: []};
            let found = findings.get(movie.imdbCode);
            if (!found) {
                found = await request(`/find/${movie.imdbCode}?external_source=imdb_id`);
                findings.set(movie.imdbCode, found);
            }
            const matches = found.movie_results;
            if (!Array.isArray(matches) || matches.length !== 1 || !Number.isSafeInteger(matches[0].id) || matches[0].id <= 0) throw new Error('ambiguous_movie');
            const value = await request(`/movie/${matches[0].id}/watch/providers`);
            if (!value.results || typeof value.results !== 'object' || Array.isArray(value.results)) throw new Error('invalid_availability');
            const row = value.results[country]; const offers = [];
            if (Object.hasOwn(value.results, country) && (row === null || typeof row !== 'object' || Array.isArray(row))) throw new Error('invalid_country');
            for (const [field, type] of [['flatrate', 'subscription'], ['free', 'free'], ['ads', 'ads']]) {
                const items = row && Object.hasOwn(row, field) ? row[field] : [];
                if (!Array.isArray(items) || items.length > 200) throw new Error('invalid_offers');
                for (const item of items) {
                    if (!Number.isSafeInteger(item.provider_id) || item.provider_id <= 0) throw new Error('invalid_provider');
                    offers.push({serviceId: `tmdb:${item.provider_id}`, type});
                }
            }
            const result = {country, status: 'ready', offers};
            cache.entries[key] = result;
            // Firestore documents remain bounded; evicted entries can be fetched again within the request budget.
            while (JSON.stringify(cache).length > 600_000) delete cache.entries[Object.keys(cache.entries)[0]];
            return result;
        } catch {return {country, status: 'unavailable', offers: []};}
    }};
}

export function pushTransport(project, accessToken, expoAccessToken, fetcher = fetch) {
    return {
        async send(device, payload) {
            if (device.kind === 'expo') {
                const headers = {'Content-Type': 'application/json', ...(expoAccessToken ? {Authorization: `Bearer ${expoAccessToken}`} : {})};
                const response = await jsonRequest('https://exp.host/--/api/v2/push/send', {method: 'POST', headers,
                    body: JSON.stringify({to: device.token, title: payload.title, body: payload.body,
                        data: payload.data, sound: 'default', channelId: 'availability-alerts', ttl: 3600, collapseId: payload.data.eventId})}, fetcher);
                if (response.status >= 500) throw new Error('ambiguous_provider_response');
                if (response.status !== 200) return {status: 'failed'};
                const ticket = response.value.data;
                if (ticket?.status === 'ok' && typeof ticket.id === 'string') return {status: 'accepted', receiptId: ticket.id};
                if (ticket?.status !== 'error') throw new Error('ambiguous_provider_response');
                return {status: 'failed', invalidToken: ticket.details?.error === 'DeviceNotRegistered'};
            }
            const response = await jsonRequest(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
                method: 'POST', headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({message: {token: device.token, data: payload.data,
                    webpush: {headers: {TTL: '3600', Topic: payload.data.eventId}}}}),
            }, fetcher);
            if (response.status === 200 && typeof response.value.name === 'string') return {status: 'accepted'};
            if (response.status === 200 || response.status >= 500) throw new Error('ambiguous_provider_response');
            const details = response.value.error?.details;
            return {status: 'failed', invalidToken: Array.isArray(details) && details.some(item => item.errorCode === 'UNREGISTERED')};
        },
        async receipt(id) {
            const response = await jsonRequest('https://exp.host/--/api/v2/push/getReceipts', {method: 'POST',
                headers: {'Content-Type': 'application/json', ...(expoAccessToken ? {Authorization: `Bearer ${expoAccessToken}`} : {})},
                body: JSON.stringify({ids: [id]})}, fetcher);
            if (response.status !== 200) return null;
            const receipt = response.value.data?.[id];
            return receipt ? {invalidToken: receipt.details?.error === 'DeviceNotRegistered', ok: receipt.status === 'ok'} : null;
        },
    };
}
