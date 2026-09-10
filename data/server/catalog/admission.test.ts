import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../../tests/helpers/load-typescript.cjs');
const {createCatalogAdmission} = loadTypeScript('data/server/catalog/admission.ts');
const movies = {operation: 'movies', params: {page: 1}};
const episodes = {operation: 'episodes', imdbId: '1234567'};

function request(ip = '192.0.2.1', extraHeaders = {}) {
    return new Request('https://yify.expo.app/api/catalog/movies', {
        headers: {'X-Real-IP': ip, ...extraHeaders},
    });
}

test('limits changing searches and operations together, refills gradually and separates clients', () => {
    let now = 0;
    const admission = createCatalogAdmission({now: () => now, clientCapacity: 2, clientRefillPerMinute: 2});
    for (const query of ['first', 'second']) {
        const permit = admission.acquire(request(), {...movies, params: {page: 1, query}});
        assert.equal(permit.allowed, true);
        permit.release();
    }
    assert.deepEqual(admission.acquire(request(), {operation: 'movie', id: 10}), {allowed: false, retryAfter: 30});
    assert.equal(admission.acquire(request('192.0.2.2'), movies).allowed, true);
    now = 29_000;
    assert.deepEqual(admission.acquire(request(), movies), {allowed: false, retryAfter: 1});
    now = 30_000;
    assert.equal(admission.acquire(request(), movies).allowed, true);
});

test('shared worker budget also caps rotating client addresses', () => {
    const admission = createCatalogAdmission({now: () => 0, workerCapacity: 2, workerRefillPerMinute: 2});
    for (const ip of ['192.0.2.1', '192.0.2.2']) {
        const permit = admission.acquire(request(ip), movies);
        assert.equal(permit.allowed, true);
        permit.release();
    }
    assert.deepEqual(admission.acquire(request('192.0.2.3'), movies), {allowed: false, retryAfter: 30});
});

test('episode pagination reserves six upstream units from both budgets', () => {
    const admission = createCatalogAdmission({now: () => 0, clientCapacity: 7, clientRefillPerMinute: 6});
    const permit = admission.acquire(request(), episodes);
    assert.equal(permit.allowed, true);
    permit.release();
    const moviePermit = admission.acquire(request(), movies);
    assert.equal(moviePermit.allowed, true);
    moviePermit.release();
    assert.deepEqual(admission.acquire(request(), episodes), {allowed: false, retryAfter: 60});
});

test('weighted concurrency is enforced per client and worker, and release is idempotent', () => {
    const admission = createCatalogAdmission({now: () => 0, clientConcurrency: 6, workerConcurrency: 7});
    const first = admission.acquire(request(), episodes);
    assert.equal(first.allowed, true);
    assert.deepEqual(admission.acquire(request(), movies), {allowed: false, retryAfter: 1});
    const second = admission.acquire(request('192.0.2.2'), movies);
    assert.equal(second.allowed, true);
    assert.deepEqual(admission.acquire(request('192.0.2.3'), movies), {allowed: false, retryAfter: 1});
    first.release();
    first.release();
    const third = admission.acquire(request(), episodes);
    assert.equal(third.allowed, true);
    assert.equal(admission.acquire(request('192.0.2.3'), movies).allowed, false);
    second.release();
    assert.equal(admission.acquire(request('192.0.2.3'), movies).allowed, true);
});

test('full client table rejects new addresses without evicting active or depleted clients', () => {
    let now = 0;
    const admission = createCatalogAdmission({now: () => now, maximumClients: 1});
    const first = admission.acquire(request(), movies);
    first.release();
    assert.deepEqual(admission.acquire(request('192.0.2.2'), movies), {allowed: false, retryAfter: 60});
    now = 1000;
    const second = admission.acquire(request('192.0.2.2'), movies);
    assert.equal(second.allowed, true);
    now = 60_000;
    assert.equal(admission.acquire(request('192.0.2.3'), movies).allowed, false);
    second.release();
    assert.equal(admission.acquire(request('192.0.2.3'), movies).allowed, true);
});

test('IPv6 spelling variants share a bucket and spoofable forwarding headers cannot change identity', () => {
    const admission = createCatalogAdmission({now: () => 0, clientCapacity: 1});
    const first = admission.acquire(request('2001:db8::1'), movies);
    first.release();
    assert.equal(admission.acquire(request('2001:0db8:0:0:0:0:0:1', {
        'X-Forwarded-For': '198.51.100.1', Forwarded: 'for=198.51.100.1',
    }), movies).allowed, false);
});

test('missing, malformed and scoped IP headers share a bounded fallback bucket', () => {
    const admission = createCatalogAdmission({now: () => 0, clientCapacity: 1});
    const permit = admission.acquire(new Request('https://yify.expo.app/api/catalog/movies'), movies);
    permit.release();
    for (const ip of ['', 'invalid', '192.0.2.1, 192.0.2.2', 'fe80::1%eth0', 'a'.repeat(100)]) {
        assert.equal(admission.acquire(request(ip), movies).allowed, false, ip);
    }
});

test('a backward clock adjustment cannot refill a consumed budget', () => {
    let now = 10_000;
    const admission = createCatalogAdmission({now: () => now, clientCapacity: 1});
    const permit = admission.acquire(request(), movies);
    permit.release();
    now = 0;
    assert.equal(admission.acquire(request(), movies).allowed, false);
    now = 10_000;
    assert.equal(admission.acquire(request(), movies).allowed, false);
    now = 11_000;
    assert.equal(admission.acquire(request(), movies).allowed, true);
});
