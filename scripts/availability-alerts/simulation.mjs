import assert from 'node:assert/strict';
import {runPilot} from './worker.mjs';

export const fixtureDevice = {id: '01234567-89ab-cdef', kind: 'expo', token: 'ExponentPushToken[fixture123456789]',
    country: 'IN', timeZone: 'Asia/Kolkata', updatedAt: 1};
export function fixtureAccount() {
    return {availabilityAlerts: JSON.stringify({version: 1, devices: [fixtureDevice]}),
        preferences: JSON.stringify({watchRegion: 'IN', streamingServices: {IN: ['tmdb:8']}, notify: {dailyHour: 19}}),
        watchlist: JSON.stringify({version: 2, items: [{id: 1, imdbCode: 'tt1234567'}], marks: {}})};
}
export function memoryStore(account = fixtureAccount()) {
    const states = new Map(); let serial = 1; let user = account ? {data: account, updateTime: 'u1'} : null;
    return {states, setAccount(value) {user = value ? {data: value, updateTime: `u${++serial}`} : null;},
        async readUser() {return structuredClone(user);},
        async readState(id) {return structuredClone(states.get(id) ?? null);},
        async writeState(id, data, updateTime) {
            if (states.get(id)?.updateTime !== updateTime) return null;
            const next = {data: structuredClone(data), updateTime: String(++serial)};
            states.set(id, next); return structuredClone(next);
        },
        async deleteState(id, updateTime) {if (states.get(id)?.updateTime === updateTime) states.delete(id);},
    };
}
export async function demonstrate() {
    const store = memoryStore(); let available = false; let sends = 0;
    const options = {uids: ['fixture'], store, now: () => Date.parse('2026-09-19T14:30:00Z'), dryRun: false,
        verifySubscription: async () => true,
        catalog: {observe: async () => ({country: 'IN', status: 'ready',
            offers: available ? [{serviceId: 'tmdb:8', type: 'subscription'}] : []})},
        transport: {send: async () => {sends++; return {status: 'accepted'};}},
    };
    const baseline = await runPilot(options); assert.equal(sends, 0);
    available = true;
    const gain = await runPilot(options); assert.equal(sends, 1);
    const repeated = await runPilot(options); assert.equal(sends, 1);
    return {baseline: baseline.accepted, newlyAvailable: gain.accepted, repeated: repeated.accepted,
        mockDeliveries: sends, externalRequests: 0};
}
