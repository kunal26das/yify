import assert from 'node:assert/strict';
import test from 'node:test';
import {alertContext, deliveryWindow, parseAvailabilityEnrollment, planAvailability} from './pilot.ts';
import type {AlertContext, AvailabilityDevice, AvailabilityObservation} from './pilot.ts';

const device: AvailabilityDevice = {id: '01234567-89ab-cdef', kind: 'expo', token: 'ExponentPushToken[test123456789]',
    country: 'IN', timeZone: 'Asia/Kolkata', updatedAt: 1};
const context: AlertContext = {country: 'IN', services: ['tmdb:8'], signature: 'IN|tmdb:8',
    movies: [{id: 1, imdbCode: 'tt1234567'}], dailyHour: 19, quietHours: false, quietStartHour: 22, quietEndHour: 8};
const now = Date.parse('2026-09-19T14:30:00Z');
const observation = (type = 'subscription', country = 'IN'): Record<string, AvailabilityObservation> => ({tt1234567: {
    country, status: 'ready', offers: type ? [{serviceId: 'tmdb:8', type}] : []}});

test('enrollment accepts only bounded, unique devices, valid provider tokens and IANA zones', () => {
    const parse = (devices: unknown[], version = 1) => parseAvailabilityEnrollment(JSON.stringify({version, devices}));
    assert.equal(parse([device])?.devices.length, 1);
    assert.equal(parse([])?.devices.length, 0);
    for (const bad of [{...device, id: '../bad'}, {...device, country: 'in'}, {...device, timeZone: 'invalid'},
        {...device, token: 'https://secret.example'}, {...device, kind: 'http'}, {...device, updatedAt: 0}]) assert.equal(parse([bad]), null);
    assert.equal(parse([device, device]), null);
    assert.equal(parse([device], 2), null);
    assert.equal(parseAvailabilityEnrollment('x'.repeat(16_001)), null);
    assert.equal(parseAvailabilityEnrollment('{'), null);
});

test('context uses canonical country/services and excludes duplicates, removed and watched movies', () => {
    const document = {preferences: JSON.stringify({watchRegion: 'US', streamingServices: {US: ['tmdb:8', 'tmdb:8'], IN: ['tmdb:9']}}),
        watchlist: JSON.stringify({items: [{id: 1, imdbCode: 'tt1234567'}, {id: 2, imdbCode: 'tt1234567'},
            {id: 3, imdbCode: 'tt2345678'}, {id: 4, imdbCode: 'tt3456789'}, {id: -1, imdbCode: 'bad'}], marks: {3: {deleted: true}}}),
        library: JSON.stringify({watched: {4: {value: true, at: 10}}, clearedAt: 0})};
    const parsed = alertContext(document, device)!;
    assert.equal(parsed.country, 'US'); assert.deepEqual(parsed.services, ['tmdb:8']);
    assert.deepEqual(parsed.movies, context.movies);
    assert.equal(alertContext({...document, preferences: '{'}, device), null);
    assert.equal(alertContext({...document, preferences: JSON.stringify({watchRegion: 'XX'})}, device), null);
    for (const library of ['{', '[]', 'null', 'x'.repeat(300_001), null]) {
        assert.equal(alertContext({...document, library}, device), null);
    }
});

test('device region is used only when canonical region is unset and processing is capped at 20 titles', () => {
    const parsed = alertContext({preferences: JSON.stringify({watchRegion: null, streamingServices: {IN: ['tmdb:8']}}),
        watchlist: JSON.stringify({items: Array.from({length: 30}, (_, i) => ({id: i + 1, imdbCode: `tt${1234567 + i}`}))})}, device)!;
    assert.equal(parsed.country, 'IN'); assert.equal(parsed.movies.length, 20);
});

test('first observation silently baselines; only zero-to-positive selected streaming availability creates an event', () => {
    assert.equal(planAvailability(context, undefined, observation(), now).deliverable.length, 0);
    const baseline = planAvailability(context, undefined, observation(''), now).state;
    for (const type of ['rent', 'buy']) assert.equal(planAvailability(context, baseline, observation(type), now).deliverable.length, 0);
    for (const type of ['subscription', 'free', 'ads']) assert.equal(planAvailability(context, baseline, observation(type), now).deliverable.length, 1);
    const other = observation(); other.tt1234567.offers[0].serviceId = 'tmdb:9';
    assert.equal(planAvailability(context, baseline, other, now).deliverable.length, 0);
});

test('country changes, service changes, and newly saved movies rebaseline without false notifications', () => {
    const baseline = planAvailability(context, undefined, observation(''), now).state;
    const changed = {...context, country: 'US', signature: 'US|tmdb:8'};
    assert.equal(planAvailability(changed, baseline, observation('subscription', 'US'), now).deliverable.length, 0);
    assert.equal(planAvailability({...context, signature: 'IN|tmdb:8,tmdb:9', services: ['tmdb:8', 'tmdb:9']}, baseline, observation(), now).deliverable.length, 0);
    const more = {...context, movies: [...context.movies, {id: 2, imdbCode: 'tt7654321'}]};
    assert.equal(planAvailability(more, baseline, {tt7654321: observation().tt1234567}, now).deliverable.length, 0);
});

test('upstream failures and wrong-country data never erase successful observations or manufacture gains', () => {
    const baseline = planAvailability(context, undefined, observation(), now).state;
    for (const invalid of [{}, observation('', 'US'), {tt1234567: {country: 'IN', status: 'unavailable' as const, offers: []}}]) {
        const after = planAvailability(context, baseline, invalid, now);
        assert.equal(after.state.snapshots.tt1234567.available, true); assert.equal(after.deliverable.length, 0);
    }
});

test('postponed gains survive unchanged observations, are suppressed on errors, and disappear when removed or unavailable', () => {
    const baseline = planAvailability(context, undefined, observation(''), now).state;
    const gain = planAvailability(context, baseline, observation(), now);
    const again = planAvailability(context, gain.state, observation(), now + 1);
    assert.equal(again.deliverable.length, 1); assert.equal(again.deliverable[0].id, gain.deliverable[0].id);
    const error = planAvailability(context, gain.state, {}, now + 1);
    assert.equal(error.state.pending.length, 1); assert.equal(error.deliverable.length, 0);
    assert.equal(planAvailability({...context, movies: []}, gain.state, {}, now + 1).state.pending.length, 0);
    assert.equal(planAvailability(context, gain.state, observation(''), now + 1).state.pending.length, 0);
    assert.equal(planAvailability(context, gain.state, observation(), now + 8 * 86_400_000).deliverable.length, 0);
});

test('an actual removal and later return gets a new event identity; context changes do not reset the daily cap', () => {
    const baseline = planAvailability(context, undefined, observation(''), now).state;
    const first = planAvailability(context, baseline, observation(), now);
    first.state.attemptedDay = '2026-09-19';
    const gone = planAvailability(context, first.state, observation(''), now + 1);
    const second = planAvailability(context, gone.state, observation(), now + 2);
    assert.notEqual(second.deliverable[0].id, first.deliverable[0].id);
    assert.equal(planAvailability({...context, signature: 'new'}, first.state, observation(), now).state.attemptedDay, '2026-09-19');
});

test('removing and re-saving a movie starts a distinct event identity sequence', () => {
    const firstBaseline = planAvailability(context, undefined, observation(''), now).state;
    const first = planAvailability(context, firstBaseline, observation(), now + 1);
    const removed = planAvailability({...context, movies: []}, first.state, {}, now + 2);
    const secondBaseline = planAvailability(context, removed.state, observation(''), now + 3);
    const second = planAvailability(context, secondBaseline.state, observation(), now + 4);
    assert.notEqual(second.deliverable[0].id, first.deliverable[0].id);
});

test('local scheduling respects preferred hour and overnight quiet hours, including postponed morning delivery', () => {
    assert.equal(deliveryWindow(context, device, now).due, true);
    assert.equal(deliveryWindow(context, device, Date.parse('2026-09-19T10:00:00Z')).due, false);
    const quiet = {...context, quietHours: true, dailyHour: 23};
    assert.equal(deliveryWindow(quiet, device, Date.parse('2026-09-19T18:00:00Z')).due, false);
    assert.equal(deliveryWindow(quiet, device, Date.parse('2026-09-20T03:00:00Z')).due, true);
    const allDay = {...quiet, quietStartHour: 8, quietEndHour: 8};
    assert.equal(deliveryWindow(allDay, device, now).due, false);
    const dst = {...device, timeZone: 'America/New_York'};
    assert.equal(deliveryWindow({...context, dailyHour: 0}, dst, Date.parse('2026-11-01T05:30:00Z')).day,
        deliveryWindow({...context, dailyHour: 0}, dst, Date.parse('2026-11-01T06:30:00Z')).day);
});
